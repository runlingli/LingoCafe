import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import clsx from "clsx";
import { Link } from "react-router-dom";
import Tag from "@/components/common/Tag";
import { HeartIcon, EyeIcon, MoreIcon } from "@/components/icons/Icon";
import { useAuth } from "@/context/AuthContext";
import { knowpostService } from "@/services/knowpostService";
import type { KnowpostDetailResponse, VisibleScope } from "@/types/knowpost";
import styles from "./CourseCard.module.css";

const renderEmHighlightedText = (text: string): ReactNode => {
  if (!text.includes("<em")) return text;

  const parts: ReactNode[] = [];
  const re = /<em(?:\s[^>]*)?>(.*?)<\/em>/gis;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = re.exec(text)) !== null) {
    const start = match.index;
    if (start > lastIndex) parts.push(text.slice(lastIndex, start));
    parts.push(<em key={`em-${key++}`}>{match[1]}</em>);
    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length ? <>{parts}</> : text;
};

export type CourseCardProps = {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  authorTags?: string[];
  isFree?: boolean;
  isTop?: boolean;
  teacher: {
    name: string;
    avatarText?: string;
    avatarUrl?: string;
  };
  stats?: {
    likes: number;
    views: number;
  };
  coverImage?: string;
  layout?: "vertical" | "horizontal";
  showPlayBadge?: boolean;
  footerExtra?: ReactNode;
  to?: string;
  className?: string;
  editable?: boolean;
  onChanged?: (action: "top" | "visibility" | "delete", payload?: unknown) => void;
};

const CourseCard = ({
  id,
  title,
  summary,
  tags,
  authorTags,
  isFree = true,
  isTop,
  teacher,
  stats,
  coverImage,
  layout = "vertical",
  showPlayBadge,
  footerExtra,
  to,
  className,
  editable = false,
  onChanged
}: CourseCardProps) => {
  const { tokens } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [detail, setDetail] = useState<KnowpostDetailResponse | null>(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const loadDetailIfNeeded = async (id: string) => {
    if (detail || menuLoading) return;
    try {
      setMenuLoading(true);
      const d = await knowpostService.detail(id, tokens?.accessToken ?? undefined);
      setDetail(d);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load details";
      setMenuError(msg);
    } finally {
      setMenuLoading(false);
    }
  };

  const toggleMenu = async (id: string) => {
    const next = !menuOpen;
    setMenuOpen(next);
    if (next) {
      await loadDetailIfNeeded(id);
    }
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const btn = buttonRef.current;
      const menu = menuRef.current;
      if (menu && menu.contains(target)) return;
      if (btn && btn.contains(target)) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick, true);
    return () => document.removeEventListener("mousedown", onDocClick, true);
  }, [menuOpen]);

  const handleSetTop = async (id: string, isTop: boolean) => {
    try {
      if (!tokens?.accessToken) {
        setMenuError("Please sign in");
        return;
      }
      setMenuLoading(true);
      await knowpostService.setTop(id, isTop, tokens.accessToken);
      setDetail(prev => prev ? { ...prev, isTop } : prev);
      setMenuOpen(false);
      onChanged?.("top", { isTop });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to pin";
      setMenuError(msg);
    } finally {
      setMenuLoading(false);
    }
  };

  const handleSetVisibility = async (id: string, visible: VisibleScope) => {
    try {
      if (!tokens?.accessToken) {
        setMenuError("Please sign in");
        return;
      }
      setMenuLoading(true);
      await knowpostService.setVisibility(id, visible, tokens.accessToken);
      setDetail(prev => prev ? { ...prev, visible } : prev);
      setMenuOpen(false);
      onChanged?.("visibility", { visible });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update visibility";
      setMenuError(msg);
    } finally {
      setMenuLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (!tokens?.accessToken) {
        setMenuError("Please sign in");
        return;
      }
      if (!window.confirm("Are you sure you want to delete this post? This cannot be undone.")) return;
      setMenuLoading(true);
      await knowpostService.remove(id, tokens.accessToken);
      setMenuOpen(false);
      onChanged?.("delete");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      setMenuError(msg);
    } finally {
      setMenuLoading(false);
    }
  };

  const content = (
    <>
      {coverImage ? (
        <div className={styles.coverWrap}>
          <img className={styles.cover} src={coverImage} alt={title} loading="lazy" />
          {showPlayBadge ? (
            <div className={styles.playBadge}>
              <svg width="24" height="24" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <polygon points="6,4 12,8 6,12" fill="currentColor" />
              </svg>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={styles.contentArea}>
        <h3 className={styles.title}>{title}</h3>
        <div className={styles.body}>
          {summary.trim() ? (
            <p className={styles.description}>{renderEmHighlightedText(summary)}</p>
          ) : null}
        </div>
        {tags?.length ? (
          <div className={styles.tagGroups}>
            {tags.map(tag => (
              <Tag key={tag}>#{tag}</Tag>
            ))}
          </div>
        ) : null}
      </div>

      <div className={styles.footer}>
        <div className={styles.teacher}>
          <div className={styles.avatarWrap}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={styles.avatarIcon}>
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </div>
          <div className={styles.teacherInfo}>
            <span className={styles.teacherName}>{teacher.name}</span>
          </div>
        </div>
        {footerExtra ? (
          <div className={styles.footerExtra}>{footerExtra}</div>
        ) : null}
      </div>
    </>
  );

  return (
    <article className={clsx(styles.card, className)}>
      {(detail?.isTop ?? isTop) ? (
        <div className={styles.topBadge}><span>Pinned</span></div>
      ) : null}
      {editable ? (
        <>
          <button ref={buttonRef} type="button" className={styles.menuButton} onClick={() => toggleMenu(id)} aria-haspopup="true" aria-expanded={menuOpen} title="Edit">
            <MoreIcon width={18} height={18} />
          </button>
          {menuOpen ? (
            <div ref={menuRef} className={styles.menuList} role="menu">
              {menuError ? <div style={{ color: "var(--color-danger)", padding: 6 }}>{menuError}</div> : null}
              <button type="button" className={styles.menuItem} onClick={() => handleSetTop(id, !(detail?.isTop))} disabled={menuLoading}>
                {detail?.isTop ? "Unpin" : "Pin"}
              </button>
              <button type="button" className={styles.menuItem} onClick={() => handleSetVisibility(id, "public")} disabled={menuLoading}>
                Set Public
              </button>
              <button type="button" className={styles.menuItem} onClick={() => handleSetVisibility(id, "private")} disabled={menuLoading}>
                Set Private
              </button>
              <button type="button" className={clsx(styles.menuItem, styles.menuDanger)} onClick={() => handleDelete(id)} disabled={menuLoading}>
                Delete
              </button>
            </div>
          ) : null}
        </>
      ) : null}
      {to ? <Link to={to}>{content}</Link> : content}
    </article>
  );
};

export default CourseCard;

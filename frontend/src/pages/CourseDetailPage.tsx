import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import MainHeader from "@/components/layout/MainHeader";
import Tag from "@/components/common/Tag";
import SectionHeader from "@/components/common/SectionHeader";
import { ArrowRightIcon, CloseIcon } from "@/components/icons/Icon";
import AuthStatus from "@/features/auth/AuthStatus";
import styles from "./CourseDetailPage.module.css";
import { knowpostService } from "@/services/knowpostService";
import { useAuth } from "@/context/AuthContext";
import type { KnowpostDetailResponse } from "@/types/knowpost";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import LikeFavBar from "@/components/common/LikeFavBar";
import FollowButton from "@/components/common/FollowButton";

const CourseDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tokens, user } = useAuth();
  const [detail, setDetail] = useState<KnowpostDetailResponse | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [contentText, setContentText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(0);
  const [contentError, setContentError] = useState<string | null>(null);
  const previewBoxRef = useRef<HTMLDivElement | null>(null);
  const [showNavLeft, setShowNavLeft] = useState(false);
  const [showNavRight, setShowNavRight] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  // RAG Q&A state
  const [ragQuestion, setRagQuestion] = useState<string>("");
  const [ragAnswer, setRagAnswer] = useState<string>("");
  const [ragLoading, setRagLoading] = useState<boolean>(false);
  const [ragError, setRagError] = useState<string | null>(null);
  const ragESRef = useRef<EventSource | null>(null);
  const [ragTopK, setRagTopK] = useState<number>(5);
  const [ragMaxTokens, setRagMaxTokens] = useState<number>(1024);
  const parseAvatarUserId = (url?: string): number | undefined => {
    if (!url) return undefined;
    const m = url.match(/\/avatars\/(\d+)-/);
    return m ? Number(m[1]) : undefined;
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!id) return;
      setError(null);
      try {
        const resp = await knowpostService.detail(id, tokens?.accessToken ?? undefined);
        if (cancelled) return;
        setDetail(resp);
        setActiveImage(0);
        if (resp.contentUrl) {
          const allowAnonymous = resp.visible?.toUpperCase() === "PUBLIC";
          if (allowAnonymous || !!tokens?.accessToken) {
            try {
              const text = await fetch(resp.contentUrl, { credentials: "omit" }).then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.text();
              });
              if (!cancelled) {
                setContentText(text);
                setContentError(null);
              }
            } catch (e) {
              if (!cancelled) setContentError("Content unavailable — may be private or cross-origin restricted");
            }
          } else {
            setContentError("This post is not public. Please sign in to view the content.");
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load";
        if (!cancelled) setError(msg);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [id, tokens?.accessToken]);

  useEffect(() => {
    const calc = () => {
      const el = rowRef.current;
      if (!el) return;
      const width = el.clientWidth;
      const itemW = 180;
      const gap = 12;
      const count = Math.max(1, Math.floor((width + gap) / (itemW + gap)));
      setVisibleCount(count);
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [detail?.images]);

  useEffect(() => {
    const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    setIsTouch(touch);
    if (touch) {
      setShowNavLeft(true);
      setShowNavRight(true);
    }
  }, []);

  const handlePreviewMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isTouch) return;
    const el = previewBoxRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const threshold = Math.max(60, Math.min(120, rect.width * 0.08));
    setShowNavLeft(x < threshold);
    setShowNavRight(x > rect.width - threshold);
  };

  const handlePreviewMouseLeave = () => {
    if (isTouch) return;
    setShowNavLeft(false);
    setShowNavRight(false);
  };

  const openPreview = (index: number) => {
    setPreviewIndex(index);
    setPreviewOpen(true);
  };

  const prevImage = () => {
    if (!detail?.images?.length) return;
    setPreviewIndex((i) => (i - 1 + detail.images.length) % detail.images.length);
  };

  const nextImage = () => {
    if (!detail?.images?.length) return;
    setPreviewIndex((i) => (i + 1) % detail.images.length);
  };

  const startRag = () => {
    if (!id) return;
    const q = ragQuestion.trim();
    if (!q) return;
    if (detail && detail.visible !== "public") {
      setRagError("Only public posts support Q&A");
      return;
    }
    setRagError(null);
    setRagAnswer("");
    if (ragESRef.current) {
      try { ragESRef.current.close(); } catch {}
      ragESRef.current = null;
    }
    const url = `/api/v1/knowposts/${id}/qa/stream?question=${encodeURIComponent(q)}&topK=${ragTopK}&maxTokens=${ragMaxTokens}`;
    const es = new EventSource(url);
    ragESRef.current = es;
    setRagLoading(true);
    es.onmessage = (e) => {
      setRagAnswer((prev) => prev + (e.data ?? ""));
    };
    es.onerror = () => {
      setRagLoading(false);
      try { es.close(); } catch {}
      ragESRef.current = null;
    };
  };

  const stopRag = () => {
    if (ragESRef.current) {
      try { ragESRef.current.close(); } catch {}
      ragESRef.current = null;
    }
    setRagLoading(false);
  };

  useEffect(() => {
    return () => {
      if (ragESRef.current) {
        try { ragESRef.current.close(); } catch {}
        ragESRef.current = null;
      }
    };
  }, []);

  return (
    <AppLayout
      header={
        <MainHeader
          headline={detail?.title ?? ""}
          subtitle=""
          rightSlot={<AuthStatus />}
        />
      }
      variant="cardless"
    >
      <article className={styles.detailCard}>
        {error ? <div style={{ color: "var(--color-danger)" }}>{error}</div> : null}
        {detail?.images?.length ? (
          <div ref={rowRef} className={styles.imageRow}>
            {(detail.images.slice(0, visibleCount)).map((src, idx) => {
              const isLastVisible = idx === visibleCount - 1 && detail.images.length > visibleCount;
              return (
                <div key={src + idx} className={styles.imageItem} onClick={() => openPreview(idx)}>
                  <img className={styles.image} src={src} alt={detail.title} />
                  {isLastVisible ? (
                    <div className={styles.moreBadge}>+{detail.images.length - visibleCount}</div>
                  ) : null}
                </div>
              );
            })}
            {detail.images.length <= visibleCount
              ? null
              : null}
          </div>
        ) : null}
        <div className={styles.titleBlock}>
          <div className={styles.titleRow}></div>
          <div className={styles.meta}>
            {detail?.authorAvatar ? (
              <img className={styles.authorAvatar} src={detail.authorAvatar} alt={detail.authorNickname} />
            ) : null}
            <span className={styles.authorName}>{detail?.authorNickname ?? ""}</span>
            {(() => {
              const derivedId = detail?.authorId ?? parseAvatarUserId(detail?.authorAvatar);
              const isSelf = (derivedId && user?.id === derivedId) || (!!detail?.authorNickname && !!user?.nickname && detail.authorNickname === user.nickname);
              return derivedId && !isSelf ? <FollowButton targetUserId={derivedId} /> : null;
            })()}
          </div>
          <div className={styles.tagList}>
            {(detail?.tags ?? []).map(tag => (
              <Tag key={tag}>#{tag}</Tag>
            ))}
          </div>
          <div className={styles.meta}>
            {detail?.publishTime ? (
              <span>{new Date(detail.publishTime).toLocaleDateString("en-US")}</span>
            ) : null}
          </div>
          <div className={styles.bottomBar}>
            {detail ? (
              <LikeFavBar
                entityId={detail.id}
                initialCounts={{ like: detail.likeCount ?? 0, fav: detail.favoriteCount ?? 0 }}
                initialState={{ liked: detail.liked, faved: detail.faved }}
              />
            ) : null}
          </div>
        </div>

        <SectionHeader title="Content" subtitle="" />

        <div className={styles.contentRow}>
          <div className={styles.contentMain}>
            <div className={`${styles.body} ${styles.markdown}`}>
              {contentText ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ node, ...props }) => (
                      <a {...props} target="_blank" rel="noreferrer" />
                    ),
                    img: ({ node, ...props }) => (
                      <img {...props} style={{ maxWidth: "100%", borderRadius: 12 }} />
                    ),
                  }}
                >
                  {contentText}
                </ReactMarkdown>
              ) : detail?.description ? (
                <p style={{ fontFamily: "var(--sans)", fontSize: 16, lineHeight: 1.8, color: "var(--ink-2)" }}>
                  {detail.description}
                </p>
              ) : null}
            </div>
            {contentError ? (
              <div style={{ color: "var(--color-danger)" }}>{contentError} {detail?.contentUrl ? (<a href={detail.contentUrl} target="_blank" rel="noreferrer">View source</a>) : null}</div>
            ) : null}
          </div>

          <aside className={styles.ragPanel}>
            <div className={styles.ragBody}>
              <textarea
                className={styles.ragTextarea}
                placeholder="Ask about this post, e.g. What are the key ideas in this article?"
                value={ragQuestion}
                onChange={(e) => setRagQuestion(e.target.value)}
              />
              <div className={styles.ragControls}>
                <button
                  type="button"
                  className={`${styles.ragBtn} ${styles.ragBtnPrimary}`}
                  onClick={startRag}
                  disabled={ragLoading || !ragQuestion.trim()}
                >
                  {ragLoading ? "Generating…" : "Send"}
                </button>
                <button type="button" className={`${styles.ragBtn} ${styles.ragBtnGhost}`} onClick={stopRag} disabled={!ragLoading}>
                  Stop
                </button>
              </div>
              <div className={styles.ragHint}>
                Note: Only &quot;public&quot; posts support Q&amp;A. Answers are generated in real time from indexed content.
              </div>
              {ragError ? (
                <div style={{ color: "var(--color-danger)" }}>{ragError}</div>
              ) : null}
              <div className={styles.ragAnswer}>
                {ragAnswer ? (
                  <div className={styles.markdown}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ node, ...props }) => (
                          <a {...props} target="_blank" rel="noreferrer" />
                        ),
                        img: ({ node, ...props }) => (
                          <img {...props} style={{ maxWidth: "100%", borderRadius: 12 }} />
                        ),
                      }}
                    >
                      {ragAnswer}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className={styles.ragPlaceholder}>
                    {ragLoading ? "Waiting for response…" : "The answer will appear here (streaming)"}
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>

        {previewOpen && detail?.images?.length ? (
          <div className={styles.previewOverlay} onClick={() => setPreviewOpen(false)}>
            <div
              className={styles.previewBox}
              ref={previewBoxRef}
              onMouseMove={handlePreviewMouseMove}
              onMouseLeave={handlePreviewMouseLeave}
              onClick={(e) => e.stopPropagation()}
            >
              <img className={styles.previewImage} src={detail.images[previewIndex]} alt={detail.title} />
              <button
                type="button"
                className={`${styles.navButton} ${styles.navButtonLeft} ${showNavLeft ? styles.navButtonVisible : ""}`}
                onClick={(e) => { e.stopPropagation(); prevImage(); }}
                aria-label="Previous"
              >
                <ArrowRightIcon width={24} height={24} style={{ transform: "rotate(180deg)" }} />
              </button>
              <button
                type="button"
                className={`${styles.navButton} ${styles.navButtonRight} ${showNavRight ? styles.navButtonVisible : ""}`}
                onClick={(e) => { e.stopPropagation(); nextImage(); }}
                aria-label="Next"
              >
                <ArrowRightIcon width={24} height={24} />
              </button>
              <button type="button" className={styles.closeButton} onClick={(e) => { e.stopPropagation(); setPreviewOpen(false); }} aria-label="Close"><CloseIcon width={20} height={20} /></button>
            </div>
          </div>
        ) : null}
      </article>
    </AppLayout>
  );
};

export default CourseDetailPage;

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import MainHeader from "@/components/layout/MainHeader";
import SectionHeader from "@/components/common/SectionHeader";
import AuthStatus from "@/features/auth/AuthStatus";
import { useAuth } from "@/context/AuthContext";
import styles from "./ProfilePage.module.css";
import feedStyles from "./HomePage.module.css";
import CourseCard from "@/components/cards/CourseCard";
import LikeFavBar from "@/components/common/LikeFavBar";
import { knowpostService } from "@/services/knowpostService";
import RelationCounters from "@/components/common/RelationCounters";

const ProfilePage = () => {
  const { user, tokens } = useAuth();
  const displayName = user?.nickname ?? user?.phone ?? user?.email ?? "LingoCafe User";
  const avatarInitial = displayName.trim().charAt(0).toUpperCase() || "L";

  const tags = useMemo(() => {
    if (user && typeof user.tagJson === "string") {
      try {
        const parsed = JSON.parse(user.tagJson);
        return Array.isArray(parsed)
          ? parsed.filter((t) => typeof t === "string")
          : [];
      } catch {
        return [];
      }
    }
    return [];
  }, [user]);


  const [items, setItems] = useState<Array<{
    id: string;
    title: string;
    description: string;
    coverImage?: string;
    tags: string[];
    tagJson?: string;
    authorAvatar?: string;
    authorAvator?: string;
    authorNickname: string;
    likeCount?: number;
    favoriteCount?: number;
    liked?: boolean;
    faved?: boolean;
    isTop?: boolean;
  }>>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reloadMine = async () => {
    if (!tokens?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await knowpostService.mine(1, 20, tokens.accessToken);
      setItems(resp.items ?? []);
      setHasMore(!!resp.hasMore);
      setPage(resp.page ?? 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reloadMine();
  }, [tokens?.accessToken]);


  return (
    <AppLayout
      header={
        <MainHeader
          headline="My Profile"
          subtitle="Complete your profile and build your knowledge portfolio"
          rightSlot={<AuthStatus />}
        />
      }
    >
      <>
        <SectionHeader
          title="Profile"
          subtitle="Help others get to know you"
          actions={<Link to="/profile/edit" className="ghost-button">Edit Profile</Link>}
        />
        <div className={styles.profileGrid}>
          <div className={styles.avatarBox}>
            {user?.avatar ? (
              <img src={user.avatar} alt="avatar" className={styles.avatarImg} />
            ) : (
              <span>{avatarInitial}</span>
            )}
          </div>
          <div className={styles.infoBox}>
            <div className={styles.nickname}>{displayName}</div>
            <div className={styles.tags}>
              {tags.length > 0 ? (
                tags.map(tag => <span key={tag}>{tag}</span>)
              ) : (
                <span>Not set</span>
              )}
            </div>
          </div>
        </div>
        <div className={styles.bioBlock}>{user?.bio ?? "No bio yet"}</div>

        {user?.id ? (
          <div style={{ marginTop: 8 }}>
            <RelationCounters userId={user.id} />
          </div>
        ) : null}

        <SectionHeader title="My Posts" subtitle="Showing only your published posts" />
        {error ? <div style={{ color: "var(--color-danger)" }}>{error}</div> : null}
        {!user ? (
          <div style={{ color: "var(--color-text-muted)", padding: 12 }}>Please sign in to view your posts</div>
        ) : (
          <div className={feedStyles.masonry}>
            {items.map(item => (
              <div key={item.id} className={feedStyles.masonryItem}>
                <CourseCard
                  id={item.id}
                  title={item.title}
                  summary={item.description ?? ""}
                  tags={item.tags ?? []}
                  isTop={item.isTop}
                  authorTags={(() => {
                    try {
                      return item.tagJson ? (JSON.parse(item.tagJson) as unknown[]).filter((t) => typeof t === "string") as string[] : [];
                    } catch {
                      return [];
                    }
                  })()}
                  teacher={{ name: item.authorNickname, avatarUrl: item.authorAvatar ?? item.authorAvator }}
                  coverImage={item.coverImage}
                  to={`/post/${item.id}`}
                  editable
                  onChanged={(action) => {
                    if (action === "delete") {
                      setItems(prev => prev.filter(x => x.id !== item.id));
                    } else {
                      void reloadMine();
                    }
                  }}
              footerExtra={<LikeFavBar entityId={item.id} compact initialCounts={{ like: item.likeCount ?? 0, fav: item.favoriteCount ?? 0 }} initialState={{ liked: item.liked, faved: item.faved }} />}
            />
              </div>
            ))}
            {loading ? <div className={feedStyles.masonryItem}><div>Loading…</div></div> : null}
            {!loading && items.length === 0 ? (
              <div className={feedStyles.masonryItem}><div>No content yet</div></div>
            ) : null}
          </div>
        )}
      </>
    </AppLayout>
  );
};

export default ProfilePage;

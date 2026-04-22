import { useRef, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import MainHeader from "@/components/layout/MainHeader";
import SectionHeader from "@/components/common/SectionHeader";
import SearchBar from "@/components/common/SearchBar";
import AuthStatus from "@/features/auth/AuthStatus";
import styles from "./SearchPage.module.css";
import { searchService } from "@/services/searchService";
import type { FeedItem } from "@/types/knowpost";
import CourseCard from "@/components/cards/CourseCard";
import LikeFavBar from "@/components/common/LikeFavBar";
import feedStyles from "./HomePage.module.css";
import { useAuth } from "@/context/AuthContext";

const SearchPage = () => {
  const [q, setQ] = useState("");
  const [tags] = useState(""); // comma-separated
  const [size] = useState<number>(20);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [after, setAfter] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const { user } = useAuth();
  const [showLoginHint, setShowLoginHint] = useState(false);

  const executeSearch = async (keyword: string) => {
    const text = keyword.trim();
    if (!text) return;
    if (!user) {
      setShowLoginHint(true);
    }
    setQ(text);
    setLoading(true);
    try {
      const resp = await searchService.query({ q: text, size, tags: tags.trim() || undefined });
      setItems(resp.items ?? []);
      setAfter(resp.nextAfter ?? null);
      setHasMore(!!resp.hasMore);
    } catch {
      setItems([]);
      setAfter(null);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout
      header={
        <MainHeader
          headline="Search what you want to learn"
          subtitle="Explore from suggestions or your history, connect inspiration with growth"
          rightSlot={<AuthStatus />}
        >
          <SearchBar
            placeholder="Search what you want to learn..."
            value={q}
            suggestions={suggestions}
            suggestLoading={suggestLoading}
            onSuggestionClick={(s) => {
              executeSearch(s);
            }}
            onChange={(val) => {
              setQ(val);
              if (debounceRef.current) window.clearTimeout(debounceRef.current);
              debounceRef.current = window.setTimeout(async () => {
                if (!val.trim()) { setSuggestions([]); return; }
                try {
                  setSuggestLoading(true);
                  const resp = await searchService.suggest(val.trim(), 10);
                  setSuggestions(resp.items ?? []);
                } catch {
                  setSuggestions([]);
                } finally {
                  setSuggestLoading(false);
                }
              }, 300);
            }}
            onSubmit={() => executeSearch(q)}
          />
        </MainHeader>
      }
    >
      <>
        {showLoginHint && !user ? (
          <div className={styles.loginHint}>
            You&apos;re not signed in. Sign in for personalized recommendations and learning history.
          </div>
        ) : null}
        <SectionHeader title="Search Results" subtitle={loading ? "Loading…" : items.length ? `${items.length} result(s) (there may be more)` : "Enter a keyword to search"} />
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
                footerExtra={<LikeFavBar entityId={item.id} compact initialCounts={{ like: item.likeCount ?? 0, fav: item.favoriteCount ?? 0 }} initialState={{ liked: item.liked, faved: item.faved }} />}
              />
            </div>
          ))}
        </div>
        {hasMore ? (
          <button
            className={styles.loadMoreBtn}
            type="button"
            onClick={async () => {
              if (!q.trim() || !after) return;
              setLoading(true);
              try {
                const resp = await searchService.query({ q: q.trim(), size, tags: tags.trim() || undefined, after });
                setItems(prev => [...prev, ...(resp.items ?? [])]);
                setAfter(resp.nextAfter ?? null);
                setHasMore(!!resp.hasMore);
              } catch {
                // keep existing data
              } finally {
                setLoading(false);
              }
            }}
          >Load more</button>
        ) : null}
      </>
    </AppLayout>
  );
};

export default SearchPage;

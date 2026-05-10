import { useState, useRef, useCallback, useEffect } from "react";
import { Badge } from "../../layout/Badge";
import {
  useInfiniteQuery,
  useQuery,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import "./blog.css";
import { HiOutlineArrowCircleRight } from "react-icons/hi";
import { HiOutlineArrowCircleLeft } from "react-icons/hi";

// ── Types ────────────────────────────────────────────────────────────────────
interface BlogListItem {
  slug: string;
  url: string;
  title: string;
  emoji: string;
  type: "tech" | "idea";
  topics: string[];
  summary: string;
  created_at: string;
  // /api/v1/blogs?query=xxx
  // queryした際のみscore/highlightsが存在
  score?: number;
  // highlightはcontentベースで利用しており、markdown形式のため利用しない
  highlights?: Record<string, string[]>;
}

// /api/v1/blogs のレスポンス
interface BlogListResponse {
  success: boolean;
  data: BlogListItem[];
  next_cursor: unknown;
}

interface TopicBucket {
  key: string;
  doc_count: number;
}

// /api/v1/topics のレスポンス
interface TopicsResponse {
  success: boolean;
  data: TopicBucket[];
}

// ── Constants ────────────────────────────────────────────────────────────────
const INITIAL_LIMIT = 5;
const INCREMENTAL_LIMIT = 1;
const DEBOUNCE_MS = 400;

const queryClient = new QueryClient();

// ── Fetch ────────────────────────────────────────────────────────────────────
async function fetchTopics(): Promise<TopicsResponse> {
  try {
    const response = await fetch("/api/v1/topics");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } catch (error) {
    throw new Error(
      `Failed to fetch topics: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function fetchBlogs({
  cursor,
  limit,
  query,
  topics,
}: {
  cursor?: unknown;
  limit: number;
  query: string;
  topics: string[];
}): Promise<BlogListResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor != null) params.set("cursor", JSON.stringify(cursor));
  if (query) params.set("query", query);
  if (topics.length > 0) params.set("topic", topics[0]);

  try {
    const response = await fetch(`/api/v1/blogs?${params}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } catch (error) {
    throw new Error(
      `Failed to fetch blogs: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// ── Utils ────────────────────────────────────────────────────────────────────
function formatDate(value: string): string {
  const date = new Date(Number(value));
  if (isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ── Topic Select ──────────────────────────────────────────────────────────────
function TopicSelect({
  topics,
  value,
  onChange,
}: {
  topics: TopicBucket[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="py-2 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:border-violet-400 dark:focus:border-violet-500 focus:ring-1 focus:ring-violet-400 dark:focus:ring-violet-500 transition-colors cursor-pointer"
    >
      <option value="">すべてのタグ</option>
      {topics.map((t) => (
        <option key={t.key} value={t.key}>
          {t.key} ({t.doc_count})
        </option>
      ))}
    </select>
  );
}

// ── Nav Button ────────────────────────────────────────────────────────────────
function NavButton({
  direction,
  disabled,
  onClick,
  style = {},
  className = "",
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "prev" ? "前へ" : "次へ"}
      style={style}
      className={`text-violet-500 disabled:opacity-30 disabled:cursor-default cursor-pointer
                    transition-all duration-200 enabled:hover:scale-110 enabled:active:scale-95 ${className}`}
    >
      {direction === "prev" ? (
        <HiOutlineArrowCircleLeft className="w-9 h-9" />
      ) : (
        <HiOutlineArrowCircleRight className="w-9 h-9" />
      )}
    </button>
  );
}

// ── Component ────────────────────────────────────────────────────────────────
function BlogCarousel() {
  const [inputValue, setInputValue] = useState("");
  // デバウンス後の値が queryKey に入る → ここが変わると再 fetch
  const [query, setQuery] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const { data: topicsData } = useQuery({
    queryKey: ["topics"],
    queryFn: fetchTopics,
    staleTime: 5 * 60 * 1000,
  });

  const carouselRef = useRef<HTMLUListElement>(null);

  const updateNavState = useCallback(() => {
    const el = carouselRef.current;
    if (!el) return;
    setCanScrollPrev(el.scrollLeft > 0);
    setCanScrollNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  const scrollPrev = useCallback(() => {
    const el = carouselRef.current;
    if (el) el.scrollBy({ left: -el.clientWidth, behavior: "smooth" });
  }, []);

  const scrollNext = useCallback(() => {
    const el = carouselRef.current;
    if (el) el.scrollBy({ left: el.clientWidth, behavior: "smooth" });
  }, []);

  // 入力が止まって DEBOUNCE_MS 経過したら query を更新
  useEffect(() => {
    const timer = setTimeout(() => setQuery(inputValue), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // query または selectedTopics が変わったらカルーセルを先頭に戻す
  useEffect(() => {
    const el = carouselRef.current;
    if (el) el.scrollLeft = 0;
    setCanScrollPrev(false);
    setCanScrollNext(false);
  }, [query, selectedTopics]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isFetching,
    error,
  } = useInfiniteQuery({
    queryKey: ["blogs", query, selectedTopics],
    queryFn: ({ pageParam }) =>
      fetchBlogs({
        cursor: pageParam,
        limit: pageParam == null ? INITIAL_LIMIT : INCREMENTAL_LIMIT,
        query,
        topics: selectedTopics,
      }),
    initialPageParam: null as unknown,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });

  const rawBlogs = data?.pages.flatMap((page) => page.data) ?? [];
  const isSearching = query.length > 0;

  // 検索時のみ score 降順。非検索時は created_at 降順 (API 側のソート順) を維持
  const blogs = isSearching
    ? [...rawBlogs].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    : rawBlogs;

  // 新規データロード後にナビ状態を再評価
  useEffect(() => {
    updateNavState();
  }, [blogs.length, updateNavState]);

  const handleScroll = useCallback(() => {
    const el = carouselRef.current;
    if (!el) return;

    updateNavState();

    const cardWidth = el.clientWidth;
    if (cardWidth === 0) return;
    const idx = Math.round(el.scrollLeft / cardWidth);
    setCurrentIndex(idx);

    if (!hasNextPage || isFetchingNextPage) return;
    if (idx >= blogs.length - 2) {
      fetchNextPage();
    }
  }, [
    blogs.length,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    updateNavState,
  ]);

  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return (
    <section className="flex flex-col py-8">
      <h2 className="text-2xl font-bold font-geist text-violet-500 dark:text-violet-400 mb-6">
        Blog
      </h2>

      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          {/* search bar */}
          <input
            id="search"
            type="search"
            placeholder="記事を検索..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-full py-2 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-violet-400 dark:focus:border-violet-500 focus:ring-1 focus:ring-violet-400 dark:focus:ring-violet-500 transition-colors"
          />
          {/* topic select */}
          <TopicSelect
            topics={topicsData?.data ?? []}
            value={selectedTopics[0] ?? ""}
            onChange={(v) => setSelectedTopics(v ? [v] : [])}
          />
        </div>

        {!isLoading && !error && blogs.length > 0 && (
          <div className="flex flex-row gap-2">
            <NavButton
              direction="prev"
              disabled={!canScrollPrev}
              onClick={scrollPrev}
            />
            <ul ref={carouselRef} className="blog-carousel">
              {blogs.map((blog) => (
                <li
                  key={blog.slug}
                  className="blog-carousel-item
                            border rounded-2xl border-slate-200 dark:border-slate-700 
                          hover:border-violet-300 dark:hover:border-violet-600 transition-all duration-200"
                >
                  <a
                    href={blog.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col h-full p-6"
                  >
                    <div className="flex justify-between gap-3 mb-4">
                      {/* title */}
                      <div className="flex flex-row items-center gap-3">
                        <div className="text-3xl" aria-hidden="true">
                          {blog.emoji}
                        </div>
                        <h3
                          className="text-lg font-semibold text-slate-800 dark:text-slate-100 leading-tight
                                    group-hover:text-violet-500 transition-colors line-clamp-1"
                        >
                          {blog.title}
                        </h3>
                      </div>
                      {/* badges */}
                      <div className="flex flex-col items-end gap-1">
                        <Badge
                          color={blog.type === "tech" ? "cyan" : "rose"}
                          rounded="full"
                        >
                          {blog.type}
                        </Badge>
                        {blog.score != null && (
                          <Badge color="emerald" rounded="full">
                            score {blog.score.toFixed(2)}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col flex-1 justify-between gap-2">
                      {/* Summary */}
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-4">
                        {blog.summary}
                      </p>

                      <div className="flex items-center justify-between flex-wrap gap-2">
                        {/* tooltip topics */}
                        <div className="flex flex-wrap gap-1">
                          {blog.topics.map((topic) => (
                            <Badge key={topic} color="violet" rounded="full">
                              {topic}
                            </Badge>
                          ))}
                        </div>
                        {/* date */}
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {formatDate(blog.created_at)}
                        </p>
                      </div>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
            <NavButton
              direction="next"
              disabled={!canScrollNext}
              onClick={scrollNext}
            />
          </div>
        )}

        {!isLoading && !error && blogs.length > 1 && (
          <div className="flex justify-center gap-2">
            {blogs.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  const el = carouselRef.current;
                  if (el)
                    el.scrollTo({
                      left: i * el.clientWidth,
                      behavior: "smooth",
                    });
                }}
                aria-label={`スライド ${i + 1}`}
                className={`cursor-pointer rounded-full transition-all duration-300 ${
                  i === currentIndex
                    ? "w-4 h-2 bg-violet-500"
                    : "w-2 h-2 bg-slate-300 dark:bg-slate-600 hover:bg-violet-300 dark:hover:bg-violet-700"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function BlogSection() {
  return (
    <QueryClientProvider client={queryClient}>
      <BlogCarousel />
    </QueryClientProvider>
  );
}

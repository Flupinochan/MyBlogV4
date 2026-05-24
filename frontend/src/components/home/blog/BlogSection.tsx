import { useState, useDeferredValue } from "react";
import { Badge } from "../../shared/Badge";
import {
  useInfiniteQuery,
  useQuery,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import EmblaCarousel from "./carousel/EmblaCarousel";
import { type EmblaOptionsType } from "embla-carousel";
import "./blog.css";
import {
  fetchBlogs,
  fetchTopics,
  type BlogListItem,
  type TopicBucket,
} from "./blogApi";

// ── Constants ────────────────────────────────────────────────────────────────
const INITIAL_LIMIT = 10;
const LOAD_MORE_LIMIT = 1;
const HYBRID_PIPELINES: Partial<Record<SearchMode, string>> = {
  "hybrid-rrf": "hybrid-rrf-pipeline",
  "hybrid-nlp": "hybrid-nlp-pipeline",
};
const CAROUSEL_OPTIONS: EmblaOptionsType = {
  loop: false,
  slideChanges: false,
  duration: 15,
};

const queryClient = new QueryClient();

// ── Fetch ────────────────────────────────────────────────────────────────────
async function fetchBlogsWithMode({
  cursor,
  limit,
  query,
  topics,
  searchMode,
}: {
  cursor?: unknown;
  limit: number;
  query: string;
  topics: string[];
  searchMode: SearchMode;
}) {
  const pipeline = HYBRID_PIPELINES[searchMode];
  return fetchBlogs({
    limit,
    cursor,
    query: query || undefined,
    topic: topics[0],
    search_mode: (pipeline ? "hybrid" : searchMode) as
      | "fulltext"
      | "vector"
      | "hybrid",
    search_pipeline: pipeline,
  });
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

// ── Search Mode Select ────────────────────────────────────────────────────────
type SearchMode = "fulltext" | "vector" | "hybrid-rrf" | "hybrid-nlp";

function SearchModeSelect({
  value,
  onChange,
}: {
  value: SearchMode;
  onChange: (v: SearchMode) => void;
}) {
  return (
    <select
      id="search-mode"
      className="form-input-select blog-search cursor-pointer"
      value={value}
      onChange={(e) => onChange(e.target.value as SearchMode)}
    >
      <option value="fulltext">全文検索</option>
      <option value="vector">ベクトル検索</option>
      <option value="hybrid-rrf">ハイブリッド検索 (RRF)</option>
      <option value="hybrid-nlp">ハイブリッド検索 (NLP)</option>
    </select>
  );
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
      id="topic-select"
      className="form-input-select blog-search cursor-pointer"
      value={value}
      onChange={(e) => onChange(e.target.value)}
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

// ── Blog Card ────────────────────────────────────────────────────────────────
function BlogCard({ blog }: { blog: BlogListItem }) {
  return (
    <a
      href={blog.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col h-full p-6 transition-colors
              border rounded-2xl border-slate-300 dark:border-slate-700 hover:border-violet-400 dark:hover:border-violet-500"
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
          <Badge color={blog.type === "tech" ? "cyan" : "rose"} rounded="full">
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
          {/* topics */}
          <div className="flex flex-wrap gap-1">
            {(blog.topics ?? []).map((topic) => (
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
  );
}

// ── Component ────────────────────────────────────────────────────────────────
function BlogCarousel() {
  const [inputValue, setInputValue] = useState("");
  const query = useDeferredValue(inputValue);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [searchMode, setSearchMode] = useState<SearchMode>("fulltext");

  const { data: topicsData } = useQuery({
    queryKey: ["topics"],
    queryFn: fetchTopics,
    staleTime: 5 * 60 * 1000,
  });

  const {
    data,
    isLoading,
    isFetching,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["blogs", query, selectedTopics, searchMode],
    queryFn: ({ pageParam }) =>
      fetchBlogsWithMode({
        cursor: pageParam,
        limit: pageParam === null ? INITIAL_LIMIT : LOAD_MORE_LIMIT,
        query,
        topics: selectedTopics,
        searchMode,
      }),
    initialPageParam: null as unknown,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    placeholderData: (prev) => prev,
  });

  // 検索時のみ scoreでソート
  // 非検索時は created_atでソート (API側のソート順) を維持
  const rawBlogs = data?.pages.flatMap((page) => page.data ?? []) ?? [];
  const isSearching = query.length > 0;
  const blogs = isSearching
    ? [...rawBlogs].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    : rawBlogs;
  const slides = blogs.map((blog) => <BlogCard key={blog.slug} blog={blog} />);

  return (
    <section className="flex flex-col">
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          {/* search bar */}
          <input
            id="search"
            type="search"
            placeholder="記事を検索..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="form-input-select blog-search w-full"
          />
          {/* search mode */}
          <SearchModeSelect value={searchMode} onChange={setSearchMode} />
          {/* topic */}
          <TopicSelect
            topics={topicsData?.data ?? [] as TopicBucket[]}
            value={selectedTopics[0] ?? ""}
            onChange={(v) => setSelectedTopics(v ? [v] : [])}
          />
        </div>
        <div className="min-h-76 flex items-center justify-center blog-carousel">
          {!isLoading &&
            !error &&
            (slides.length > 0 ? (
              <EmblaCarousel
                key={`${searchMode}-${selectedTopics.join(",")}`}
                slides={slides}
                isFetching={isFetching}
                options={CAROUSEL_OPTIONS}
                onReachEnd={() => {
                  if (hasNextPage && !isFetchingNextPage) fetchNextPage();
                }}
              />
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500">
                記事が見つかりませんでした
              </p>
            ))}
        </div>
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

package blogsearch

// ── Document types ───────────────────────────────────────────────────────────

// BlogDocument is the full document shape, used for indexing and single-blog retrieval (GetBlogBySlug).
type BlogDocument struct {
	Slug      string   `json:"slug"`
	URL       string   `json:"url"`
	Title     string   `json:"title"`
	Emoji     string   `json:"emoji"`
	Type      string   `json:"type"`
	Topics    []string `json:"topics"`
	Content   string   `json:"content"`
	Summary   string   `json:"summary"`
	CreatedAt string   `json:"created_at"`
}

// BlogListItem is a trimmed document shape for list APIs; content is intentionally excluded.
type BlogListItem struct {
	Slug      string   `json:"slug"`
	URL       string   `json:"url"`
	Title     string   `json:"title"`
	Emoji     string   `json:"emoji"`
	Type      string   `json:"type"`
	Topics    []string `json:"topics"`
	Summary   string   `json:"summary"`
	CreatedAt string   `json:"created_at"`
}

// ChunkDocument is the embedding-index document shape (aliasNameEmbedding).
type ChunkDocument struct {
	Slug           string    `json:"slug"`
	URL            string    `json:"url"`
	Title          string    `json:"title"`
	Emoji          string    `json:"emoji"`
	Type           string    `json:"type"`
	Topics         []string  `json:"topics"`
	Chunk          string    `json:"chunk"`
	ChunkEmbedding []float64 `json:"chunk_embedding"`
	Summary        string    `json:"summary"`
	CreatedAt      string    `json:"created_at"`
}

// ── OpenSearch query builder types ───────────────────────────────────────────

type MatchAllQuery struct {
	MatchAll struct{} `json:"match_all"`
}

type MultiMatch struct {
	Query      string   `json:"query"`
	Fields     []string `json:"fields"`
	Type       string   `json:"type,omitempty"`
	TieBreaker float64  `json:"tie_breaker,omitempty"`
	Fuzziness  string   `json:"fuzziness,omitempty"`
}

type MultiMatchQuery struct {
	MultiMatch MultiMatch `json:"multi_match"`
}

type MatchQuery struct {
	Match map[string]any `json:"match"`
}

type TermQuery struct {
	Term map[string]any `json:"term"`
}

type BoolQuery struct {
	Bool struct {
		Filter []any `json:"filter,omitempty"`
		Must   []any `json:"must,omitempty"`
	} `json:"bool"`
}

type HighlightField struct {
	FragmentSize      int `json:"fragment_size,omitempty"`
	NumberOfFragments int `json:"number_of_fragments,omitempty"`
}

type Highlight struct {
	Fields map[string]HighlightField `json:"fields"`
}

type Collapse struct {
	Field string `json:"field"`
}

type KnnQueryDetail struct {
	Vector []float64      `json:"vector"`
	K      int            `json:"k"`
	Filter map[string]any `json:"filter,omitempty"`
}

type KnnQuery struct {
	Knn map[string]KnnQueryDetail `json:"knn"`
}

type HybridQuery struct {
	Hybrid struct {
		Queries []any `json:"queries"`
	} `json:"hybrid"`
}

type SearchRequest struct {
	From        int        `json:"from,omitempty"`
	Size        int        `json:"size,omitempty"`
	Sort        []any      `json:"sort,omitempty"`
	SearchAfter []any      `json:"search_after,omitempty"`
	Source      []string   `json:"_source,omitempty"`
	Query       any        `json:"query"`
	Highlight   *Highlight `json:"highlight,omitempty"`
	Collapse    *Collapse  `json:"collapse,omitempty"`
	Aggs        any        `json:"aggs,omitempty"`
	TrackScores *bool      `json:"track_scores,omitempty"`
}

type SearchResponse[T any] struct {
	Hits struct {
		Hits []struct {
			Source    T                   `json:"_source"`
			Score     *float64            `json:"_score,omitempty"`
			Sort      []any               `json:"sort,omitempty"`
			Highlight map[string][]string `json:"highlight,omitempty"`
		} `json:"hits"`
		Total struct {
			Value int `json:"value"`
		} `json:"total"`
	} `json:"hits"`
}

// ── Service param / result types ─────────────────────────────────────────────

type ListBlogsParams struct {
	Limit          int
	Cursor         []any
	Topic          string
	Type           string
	Query          string
	SearchPipeline string
}

type BlogSearchResultItem struct {
	BlogListItem
	Score      *float64            `json:"score,omitempty"`
	Highlights map[string][]string `json:"highlights,omitempty"`
}

type ListBlogsResult struct {
	Blogs      []BlogSearchResultItem `json:"blogs"`
	NextCursor []any                  `json:"next_cursor"`
}

// ── Aggregation types ─────────────────────────────────────────────────────────

type AggsResponse struct {
	Aggregations struct {
		AllTopics struct {
			Buckets []TopicBucket `json:"buckets"`
		} `json:"all_topics"`
	} `json:"aggregations"`
}

type TopicBucket struct {
	Key      string `json:"key"`
	DocCount int    `json:"doc_count"`
}

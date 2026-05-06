package blogsearch

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"

	"github.com/opensearch-project/opensearch-go/v2/opensearchapi"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/middleware"
)

type MatchAllQuery struct {
	MatchAll struct{} `json:"match_all"`
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

type SearchRequest struct {
	From        int      `json:"from,omitempty"`
	Size        int      `json:"size,omitempty"`
	Sort        []any    `json:"sort,omitempty"`
	SearchAfter []any    `json:"search_after,omitempty"` // Fromは利用せず、CursorベースのPagination方針
	Source      []string `json:"_source,omitempty"`
	Query       any      `json:"query"`
	Aggs        any      `json:"aggs,omitempty"`
}

type SearchResponse[T any] struct {
	Hits struct {
		Hits []struct {
			Source T     `json:"_source"`
			Sort   []any `json:"sort,omitempty"`
		} `json:"hits"`
		Total struct {
			Value int `json:"value"`
		} `json:"total"`
	} `json:"hits"`
}

func (r *Repository) Ping(ctx context.Context) error {
	req := opensearchapi.PingRequest{}
	res, err := req.Do(ctx, r.client)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("ping failed with status: %w", middleware.ErrServer)
	}
	return nil
}

func (r *Repository) GetBlogBySlug(c context.Context, slug string) (*BlogDocument, error) {
	query := SearchRequest{
		Size:   1,
		Source: []string{"slug", "url", "title", "emoji", "type", "topics", "content", "summary", "created_at"},
		Query: TermQuery{
			Term: map[string]any{
				"slug": slug,
			},
		},
	}

	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(query); err != nil {
		return nil, fmt.Errorf("failed to encode query: %w", errors.Join(err, middleware.ErrServer))
	}

	searchReq := opensearchapi.SearchRequest{
		Index: []string{r.aliasName},
		Body:  &buf,
	}

	res, err := searchReq.Do(c, r.client)
	if err != nil {
		return nil, fmt.Errorf("opensearch request failed: %w", errors.Join(err, middleware.ErrServer))
	}
	defer res.Body.Close()

	if res.IsError() {
		return nil, fmt.Errorf("opensearch error response: %s: %w", res.String(), middleware.ErrServer)
	}

	var osRes SearchResponse[BlogDocument]
	if err := json.NewDecoder(res.Body).Decode(&osRes); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", errors.Join(err, middleware.ErrServer))
	}

	if len(osRes.Hits.Hits) == 0 {
		return nil, fmt.Errorf("blog not found for slug %q: %w", slug, middleware.ErrNotFound)
	}

	return &osRes.Hits.Hits[0].Source, nil
}

type ListBlogsParams struct {
	Limit  int
	Cursor []any // 前回のレスポンスで返した Sort の配列
	Topic  string
	Type   string
	Query  string
}

type ListBlogsResult struct {
	Blogs      []BlogDocument `json:"blogs"`
	NextCursor []any          `json:"next_cursor"`
}

func (r *Repository) ListBlogs(c context.Context, params ListBlogsParams) (*ListBlogsResult, error) {
	logger := middleware.GetLogger(c)
	logger.Debug("ListBlogs called",
		slog.Int("limit", params.Limit),
		slog.String("cursor", fmt.Sprintf("%v", params.Cursor)),
		slog.String("topic", params.Topic),
		slog.String("type", params.Type),
	)

	// Build Query
	var filters []any
	var musts []any

	if params.Topic != "" {
		filters = append(filters, TermQuery{
			Term: map[string]any{"topics": params.Topic},
		})
	}
	if params.Type != "" {
		filters = append(filters, TermQuery{
			Term: map[string]any{"type": params.Type},
		})
	}
	if params.Query != "" {
		musts = append(musts, MatchQuery{
			Match: map[string]any{
				"content": params.Query,
			},
		})
	}

	// If no filters or musts, use match_all
	var query any
	if len(filters) > 0 || len(musts) > 0 {
		query = BoolQuery{
			Bool: struct {
				Filter []any `json:"filter,omitempty"`
				Must   []any `json:"must,omitempty"`
			}{
				Filter: filters,
				Must:   musts,
			},
		}
	} else {
		query = MatchAllQuery{}
	}

	searchReqBody := SearchRequest{
		Size:   params.Limit,
		Source: []string{"slug", "url", "title", "emoji", "type", "topics", "summary", "created_at"}, // exclude content
		Query:  query,
		Sort: []any{
			map[string]any{
				"created_at": map[string]any{
					"order": "desc",
				},
			},
			map[string]any{"_id": "desc"}, // cursor用のunique key
		},
		SearchAfter: params.Cursor,
	}

	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(searchReqBody); err != nil {
		return nil, fmt.Errorf("failed to encode search request: %w", errors.Join(err, middleware.ErrServer))
	}

	// Send request to OpenSearch
	searchReq := opensearchapi.SearchRequest{
		Index: []string{r.aliasName},
		Body:  &buf,
	}

	res, err := searchReq.Do(c, r.client)
	if err != nil {
		return nil, fmt.Errorf("opensearch request failed: %w", errors.Join(err, middleware.ErrServer))
	}
	defer res.Body.Close()

	if res.IsError() {
		return nil, fmt.Errorf("opensearch error response: %s: %w", res.String(), middleware.ErrServer)
	}

	// Decode response
	var osRes SearchResponse[BlogDocument]
	decoder := json.NewDecoder(res.Body)
	decoder.UseNumber()
	if err := decoder.Decode(&osRes); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", errors.Join(err, middleware.ErrServer))
	}

	if len(osRes.Hits.Hits) > 0 {
		slog.Debug("Check pagination state",
			"total_hits", osRes.Hits.Total.Value,
			"returned_count", len(osRes.Hits.Hits),
			"last_hit_sort", osRes.Hits.Hits[len(osRes.Hits.Hits)-1].Sort,
		)
	} else {
		slog.Debug("No blogs found", "total_hits", osRes.Hits.Total.Value)
	}

	// Repackage results
	result := &ListBlogsResult{
		Blogs:      make([]BlogDocument, 0, len(osRes.Hits.Hits)),
		NextCursor: nil,
	}
	for _, hit := range osRes.Hits.Hits {
		result.Blogs = append(result.Blogs, hit.Source)
	}

	// Set last hit's sort value as next cursor for pagination
	if len(osRes.Hits.Hits) == params.Limit {
		lastHit := osRes.Hits.Hits[len(osRes.Hits.Hits)-1]
		result.NextCursor = lastHit.Sort
	}

	logger.Debug("ListBlogs completed",
		slog.Any("returned_blogs", result.Blogs),
	)

	return result, nil
}

// aggregation レスポンス用の型
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

func (r *Repository) ListTopics(c context.Context) ([]TopicBucket, error) {
	query := SearchRequest{
		Size: 0,
		Aggs: map[string]any{
			"all_topics": map[string]any{
				"terms": map[string]any{
					"field": "topics",
					"size":  1000,
					"order": map[string]any{
						"_count": "desc",
					},
				},
			},
		},
		Query: MatchAllQuery{},
	}

	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(query); err != nil {
		return nil, fmt.Errorf("failed to encode query: %w", errors.Join(err, middleware.ErrServer))
	}

	searchReq := opensearchapi.SearchRequest{
		Index: []string{r.aliasName},
		Body:  &buf,
	}

	res, err := searchReq.Do(c, r.client)
	if err != nil {
		return nil, fmt.Errorf("opensearch request failed: %w", errors.Join(err, middleware.ErrServer))
	}
	defer res.Body.Close()

	if res.IsError() {
		return nil, fmt.Errorf("opensearch error response: %s: %w", res.String(), middleware.ErrServer)
	}

	var osRes AggsResponse
	if err := json.NewDecoder(res.Body).Decode(&osRes); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", errors.Join(err, middleware.ErrServer))
	}

	return osRes.Aggregations.AllTopics.Buckets, nil
}

package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/opensearch-project/opensearch-go/v2"
	"github.com/opensearch-project/opensearch-go/v2/opensearchapi"
)

type BlogDocument struct {
	Slug      string   `json:"slug"`
	URL       string   `json:"url"`
	Title     string   `json:"title"`
	Emoji     string   `json:"emoji"`
	Type      string   `json:"type"`
	Topics    []string `json:"topics"`
	Content   string   `json:"content"`
	CreatedAt string   `json:"created_at"`
}

type TermQuery struct {
	Term map[string]any `json:"term"`
}

type SearchRequest struct {
	From   int      `json:"from,omitempty"`
	Size   int      `json:"size,omitempty"`
	Sort   []any    `json:"sort,omitempty"`
	Source []string `json:"_source,omitempty"`
	Query  any      `json:"query"`
	Aggrs  any      `json:"aggs,omitempty"`
}

type SearchResponse[T any] struct {
	Hits struct {
		Hits []struct {
			Source T `json:"_source"`
		} `json:"hits"`
	} `json:"hits"`
}

func AllSearch(ctx context.Context, client *opensearch.Client) ([]BlogDocument, error) {
	query := `{"query": {"match_all": {}}, "size": 20}`

	searchReq := opensearchapi.SearchRequest{
		Index: []string{"tech-blog"},
		Body:  strings.NewReader(query),
	}

	res, err := searchReq.Do(ctx, client)
	if err != nil {
		return nil, fmt.Errorf("opensearch request failed: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return nil, fmt.Errorf("opensearch error response: %s", res.String())
	}

	var osRes struct {
		Hits struct {
			Hits []struct {
				Source BlogDocument `json:"_source"`
			} `json:"hits"`
		} `json:"hits"`
	}

	if err := json.NewDecoder(res.Body).Decode(&osRes); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	docs := make([]BlogDocument, 0, len(osRes.Hits.Hits))
	for _, hit := range osRes.Hits.Hits {
		docs = append(docs, hit.Source)
	}

	return docs, nil
}

func GetBlogBySlug(ctx context.Context, client *opensearch.Client, slug string) (*BlogDocument, error) {
	query := SearchRequest{
		Size:   1,
		Source: []string{"slug", "url", "title", "emoji", "type", "topics", "content", "created_at"},
		Query: TermQuery{
			Term: map[string]any{
				"slug": slug,
			},
		},
	}
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(query); err != nil {
		return nil, fmt.Errorf("failed to encode query: %w", err)
	}

	searchReq := opensearchapi.SearchRequest{
		Index: []string{"tech-blog"},
		Body:  &buf,
	}

	res, err := searchReq.Do(ctx, client)
	if err != nil {
		return nil, fmt.Errorf("GetBlogBySlug request failed: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return nil, fmt.Errorf("GetBlogBySlug error response: %s", res.String())
	}

	var osRes SearchResponse[BlogDocument]
	if err := json.NewDecoder(res.Body).Decode(&osRes); err != nil {
		return nil, fmt.Errorf("GetBlogBySlug failed to decode response: %w", err)
	}

	if len(osRes.Hits.Hits) == 0 {
		return nil, fmt.Errorf("blog not found for slug: %s", slug)
	}

	return &osRes.Hits.Hits[0].Source, nil
}

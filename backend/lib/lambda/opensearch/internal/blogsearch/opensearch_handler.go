package blogsearch

import (
	"bytes"
	"context"
	"encoding/json"

	"github.com/danielgtaylor/huma/v2"
)

type Handler struct {
	s *BlogSearchService
}

func NewHandler(s *BlogSearchService) *Handler {
	return &Handler{s: s}
}

type GetBlogBySlugInput struct {
	Slug string `path:"slug" minLength:"1" maxLength:"100" doc:"Blog slug"`
}

type GetBlogBySlugOutput struct {
	Body *BlogDocument
}

func (h *Handler) GetBlogBySlug(ctx context.Context, input *GetBlogBySlugInput) (*GetBlogBySlugOutput, error) {
	blog, err := h.s.GetBlogBySlug(ctx, input.Slug)
	if err != nil {
		return nil, err
	}
	return &GetBlogBySlugOutput{Body: blog}, nil
}

type ListBlogsInput struct {
	Limit          int    `query:"limit"           minimum:"1" maximum:"100" default:"20" doc:"Number of results (default 20)"`
	Cursor         string `query:"cursor"          maxLength:"200"            doc:"Pagination cursor [created_at_ms, id]"`
	Topic          string `query:"topic"           maxLength:"100"            doc:"Filter by topic"`
	Type           string `query:"type"            enum:"tech,idea"           doc:"Filter by blog type"`
	Query          string `query:"query"           maxLength:"500"            doc:"Full-text search query"`
	SearchMode     string `query:"search_mode"     enum:"fulltext,vector,hybrid" doc:"Search mode (default: fulltext)"`
	SearchPipeline string `query:"search_pipeline" maxLength:"100"            doc:"OpenSearch pipeline name for hybrid search"`
}

type ListBlogsBody struct {
	Data       []BlogSearchResultItem `json:"data"`
	NextCursor *json.RawMessage       `json:"next_cursor" nullable:"true" doc:"null or [timestamp_ms, id]"`
}

type ListBlogsOutput struct {
	Body ListBlogsBody
}

func encodeNextCursor(cursor []any) *json.RawMessage {
	if len(cursor) == 0 {
		return nil
	}
	b, err := json.Marshal(cursor)
	if err != nil {
		return nil
	}
	raw := json.RawMessage(b)
	return &raw
}

func (h *Handler) ListBlogs(ctx context.Context, input *ListBlogsInput) (*ListBlogsOutput, error) {
	var cursorObj []any
	if input.Cursor != "" {
		decoder := json.NewDecoder(bytes.NewReader([]byte(input.Cursor)))
		decoder.UseNumber()
		if err := decoder.Decode(&cursorObj); err != nil || len(cursorObj) != 2 {
			return nil, huma.Error400BadRequest("invalid cursor format")
		}
	}

	params := ListBlogsParams{
		Limit:          input.Limit,
		Cursor:         cursorObj,
		Topic:          input.Topic,
		Type:           input.Type,
		Query:          input.Query,
		SearchPipeline: input.SearchPipeline,
	}

	var (
		result *ListBlogsResult
		err    error
	)
	switch {
	case input.SearchMode == "vector" && input.Query != "":
		result, err = h.s.ListBlogsVector(ctx, params)
	case input.SearchMode == "hybrid" && input.Query != "" && input.SearchPipeline != "":
		result, err = h.s.ListBlogsHybrid(ctx, params)
	default:
		result, err = h.s.ListBlogs(ctx, params)
	}
	if err != nil {
		return nil, err
	}

	return &ListBlogsOutput{Body: ListBlogsBody{
		Data:       result.Blogs,
		NextCursor: encodeNextCursor(result.NextCursor),
	}}, nil
}

type ListTopicsOutput struct {
	Body struct {
		Data []TopicBucket `json:"data"`
	}
}

func (h *Handler) ListTopics(ctx context.Context, _ *struct{}) (*ListTopicsOutput, error) {
	topics, err := h.s.ListTopics(ctx)
	if err != nil {
		return nil, err
	}
	out := &ListTopicsOutput{}
	out.Body.Data = topics
	return out, nil
}

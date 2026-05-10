package blogsearch

import (
	"bytes"
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/middleware"
)

type Handler struct {
	s *BlogSearchService
}

func NewHandler(s *BlogSearchService) *Handler {
	return &Handler{s: s}
}

type GetBlogBySlugUri struct {
	Slug string `uri:"slug" binding:"required,min=1,max=100"`
}

func (h *Handler) GetBlogBySlug(c *gin.Context) {
	var uri GetBlogBySlugUri
	if err := c.ShouldBindUri(&uri); err != nil {
		_ = c.Error(middleware.ErrClient)
		return
	}

	blog, err := h.s.GetBlogBySlug(c.Request.Context(), uri.Slug)
	if err != nil {
		_ = c.Error(err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": blog})
}

type ListBlogsQuery struct {
	Limit          int    `form:"limit"            binding:"omitempty,min=1,max=100"`
	Cursor         string `form:"cursor"           binding:"omitempty,max=200"`
	Topic          string `form:"topic"            binding:"omitempty,max=100"`
	Type           string `form:"type"             binding:"omitempty,oneof=tech idea"`
	Query          string `form:"query"            binding:"omitempty,max=500"`
	SearchMode     string `form:"search_mode"      binding:"omitempty,oneof=fulltext vector hybrid"`
	SearchPipeline string `form:"search_pipeline"  binding:"omitempty,max=100"`
}

type ListBlogsResponse struct {
	Success    bool                   `json:"success"`
	Data       []BlogSearchResultItem `json:"data"`
	NextCursor any                    `json:"next_cursor"`
}

func (h *Handler) ListBlogs(c *gin.Context) {
	var query ListBlogsQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		_ = c.Error(middleware.ErrClient)
		return
	}

	var cursorObj []any
	if query.Cursor != "" {
		decoder := json.NewDecoder(bytes.NewReader([]byte(query.Cursor)))
		decoder.UseNumber()
		if err := decoder.Decode(&cursorObj); err != nil {
			_ = c.Error(middleware.ErrClient)
			return
		}
		// 弱めだがバリデーション
		// cursorは以下のようなcreated_atと_idの配列
		// [1723897971000, "LalN-50BVfQTAJDUMj24"]
		if len(cursorObj) != 2 {
			_ = c.Error(middleware.ErrClient)
			return
		}
	}

	// デフォルトは20件
	if query.Limit == 0 {
		query.Limit = 20
	}

	params := ListBlogsParams{
		Limit:          query.Limit,
		Cursor:         cursorObj,
		Topic:          query.Topic,
		Type:           query.Type,
		Query:          query.Query,
		SearchPipeline: query.SearchPipeline,
	}

	var result *ListBlogsResult
	var err error
	switch {
	case query.SearchMode == "vector" && query.Query != "":
		result, err = h.s.ListBlogsVector(c.Request.Context(), params)
	case query.SearchMode == "hybrid" && query.Query != "" && query.SearchPipeline != "":
		result, err = h.s.ListBlogsHybrid(c.Request.Context(), params)
	default:
		result, err = h.s.ListBlogs(c.Request.Context(), params)
	}
	if err != nil {
		_ = c.Error(err)
		return
	}

	c.JSON(http.StatusOK, ListBlogsResponse{
		Success:    true,
		Data:       result.Blogs,
		NextCursor: result.NextCursor,
	})
}

func (h *Handler) ListTopics(c *gin.Context) {
	topics, err := h.s.ListTopics(c.Request.Context())

	if err != nil {
		_ = c.Error(err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": topics})
}

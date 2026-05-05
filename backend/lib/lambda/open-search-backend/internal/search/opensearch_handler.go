package search

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/middleware"
)

type Handler struct {
	repo *Repository
}

func NewHandler(repo *Repository) *Handler {
	return &Handler{repo: repo}
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

	blog, err := h.repo.GetBlogBySlug(c.Request.Context(), uri.Slug)
	if err != nil {
		_ = c.Error(err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": blog})
}

package blogsearch

import (
	"github.com/gin-gonic/gin"
)

func OpenSearchRoutes(r *gin.RouterGroup, h *Handler) {
	blogGroup := r.Group("/blogs")
	{
		blogGroup.GET("/:slug", h.GetBlogBySlug)
		blogGroup.GET("", h.ListBlogs)
	}

	topicGroup := r.Group("/topics")
	{
		topicGroup.GET("", h.ListTopics)
	}
}

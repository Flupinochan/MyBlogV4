package router

import (
	"github.com/gin-gonic/gin"
	"github.com/opensearch-project/opensearch-go/v2"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/handler"
)

func OpenSearchRoutes(r *gin.RouterGroup, client *opensearch.Client) {
	blogGroup := r.Group("/blogs")
	{
		blogGroup.GET("/", handler.SearchBlogHandler(client))
		blogGroup.GET("/:slug", handler.GetBlogBySlug(client))
	}
}

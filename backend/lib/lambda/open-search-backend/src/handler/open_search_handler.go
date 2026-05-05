package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/opensearch-project/opensearch-go/v2"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/middleware"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/service"
)

func SearchBlogHandler(client *opensearch.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		blogs, err := service.AllSearch(c.Request.Context(), client)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, blogs)
	}
}

type GetBlogBySlugUri struct {
	Slug string `uri:"slug" binding:"required,min=1,max=100"`
}

func GetBlogBySlug(client *opensearch.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var uri GetBlogBySlugUri
		if err := c.ShouldBindUri(&uri); err != nil {
			_ = c.Error(middleware.ErrClient)
			return
		}

		blog, err := service.GetBlogBySlug(c.Request.Context(), client, uri.Slug)
		if err != nil {
			_ = c.Error(err)
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": blog})
	}
}

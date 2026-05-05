package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/opensearch-project/opensearch-go/v2"
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

func GetBlogBySlug(client *opensearch.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		slug := c.Param("slug")
		blog, err := service.GetBlogBySlug(c.Request.Context(), client, slug)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, blog)
	}
}

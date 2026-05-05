package router

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/opensearch-project/opensearch-go/v2"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/middleware"
)

func HostHealthCheckRoutes(r *gin.RouterGroup, client *opensearch.Client) {
	healthGroup := r.Group("/health")
	{
		hostHandler := func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "healthy"})
		}
		healthGroup.GET("/", hostHandler)
		healthGroup.GET("/host", hostHandler)

		healthGroup.GET("/open-search", func(c *gin.Context) {
			logger := middleware.GetLogger(c.Request.Context())

			res, err := client.Ping(
				client.Ping.WithContext(c.Request.Context()),
			)
			if err != nil || res.IsError() {
				logger.Error("OpenSearch health check failed", slog.Any("error", err))
				c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unhealthy"})
				return
			}
			defer res.Body.Close()

			c.JSON(http.StatusOK, gin.H{"status": "healthy"})
		})
	}
}

package healthcheck

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/blogsearch"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/middleware"
)

func HostHealthCheckRoutes(r *gin.RouterGroup, s *blogsearch.BlogSearchService) {
	healthGroup := r.Group("/health")
	{
		hostHandler := func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "healthy"})
		}
		healthGroup.GET("", hostHandler) // /api/v1/health であり、/api/v1/health/ ではないことに注意
		healthGroup.GET("/host", hostHandler)
		healthGroup.GET("/lwa", hostHandler)

		healthGroup.GET("/opensearch", func(c *gin.Context) {
			logger := middleware.GetLogger(c.Request.Context())

			if err := s.Ping(c.Request.Context()); err != nil {
				logger.Error("OpenSearch health check failed", slog.Any("error", err))
				c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unhealthy"})
				return
			}

			c.JSON(http.StatusOK, gin.H{"status": "healthy"})
		})
	}
}

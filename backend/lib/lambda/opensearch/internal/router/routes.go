package router

import (
	"github.com/gin-gonic/gin"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/blogsearch"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/healthcheck"
)

func RegisterRoutes(r *gin.Engine, h *blogsearch.Handler, repo *blogsearch.Repository) {
	v1 := r.Group("/api/v1")
	{
		healthcheck.HostHealthCheckRoutes(v1, repo)
		blogsearch.OpenSearchRoutes(v1, h)
	}
}

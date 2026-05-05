package router

import (
	"github.com/gin-gonic/gin"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/healthcheck"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/search"
)

func RegisterRoutes(r *gin.Engine, h *search.Handler, repo *search.Repository) {
	v1 := r.Group("/api/v1")
	{
		healthcheck.HostHealthCheckRoutes(v1, repo)
		search.OpenSearchRoutes(v1, h)
	}
}

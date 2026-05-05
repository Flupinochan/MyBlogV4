package router

import (
	"github.com/gin-gonic/gin"
	"github.com/opensearch-project/opensearch-go/v2"
)

func RegisterRoutes(r *gin.Engine, client *opensearch.Client) {
	v1 := r.Group("/api/v1")
	{
		HostHealthCheckRoutes(v1, client)
		OpenSearchRoutes(v1, client)
	}
}

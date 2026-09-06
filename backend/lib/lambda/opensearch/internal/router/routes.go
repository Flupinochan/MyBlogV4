package router

import (
	"github.com/danielgtaylor/huma/v2"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/blogsearch"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/healthcheck"
)

func RegisterRoutes(api huma.API, h *blogsearch.Handler, s *blogsearch.BlogSearchService) {
	v1 := huma.NewGroup(api, "/v1")
	healthcheck.HostHealthCheckRoutes(v1, s)
	blogsearch.OpenSearchRoutes(v1, h)
}

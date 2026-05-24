package healthcheck

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/blogsearch"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/middleware"
)

type HealthOutput struct {
	Body struct {
		Status string `json:"status" example:"healthy"`
	}
}

func HostHealthCheckRoutes(api huma.API, s *blogsearch.BlogSearchService) {
	healthyHandler := func(ctx context.Context, _ *struct{}) (*HealthOutput, error) {
		out := &HealthOutput{}
		out.Body.Status = "healthy"
		return out, nil
	}

	for _, path := range []string{"/health", "/health/host", "/health/lwa"} {
		huma.Register(api, huma.Operation{
			OperationID: "health" + path[len("/health"):],
			Method:      http.MethodGet,
			Path:        path,
			Tags:        []string{"health"},
			Summary:     "Health check",
		}, healthyHandler)
	}

	huma.Register(api, huma.Operation{
		OperationID: "health-opensearch",
		Method:      http.MethodGet,
		Path:        "/health/opensearch",
		Tags:        []string{"health"},
		Summary:     "OpenSearch health check",
	}, func(ctx context.Context, _ *struct{}) (*HealthOutput, error) {
		logger := middleware.GetLogger(ctx)
		if err := s.Ping(ctx); err != nil {
			logger.Error("OpenSearch health check failed", slog.Any("error", err))
			return nil, huma.Error503ServiceUnavailable("unhealthy")
		}
		out := &HealthOutput{}
		out.Body.Status = "healthy"
		return out, nil
	})
}

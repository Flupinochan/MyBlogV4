package main

import (
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humago"
	"github.com/joho/godotenv"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/blogsearch"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/config"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/genai"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/middleware"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/mylogger"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/router"
)

// API Design Reference
// https://gin-gonic.com/ja/docs/routing/api-design/

func setupServer() error {
	if os.Getenv("MODE") != "release" {
		if err := godotenv.Load(); err != nil {
			return fmt.Errorf("error loading .env file: %w", err)
		}
	}

	cfg, err := config.GetAppConfig()
	if err != nil {
		return fmt.Errorf("failed to get App config: %w", err)
	}

	mylogger.InitLogger(cfg.Level)

	slog.Info("Application started")

	client, err := blogsearch.NewOpenSearchClient(&blogsearch.OpenSearchConfig{
		Address:  cfg.Address,
		Username: cfg.Username,
		Password: cfg.Password,
	})
	if err != nil {
		return fmt.Errorf("failed to initialize OpenSearch client: %w", err)
	}
	genaiClient, err := genai.NewGenAIClient(&genai.GenAIConfig{
		MaxAttempts:     3,
		MaxBackoffDelay: 2 * time.Second,
	})
	if err != nil {
		return fmt.Errorf("failed to initialize GenAI client: %w", err)
	}
	genaiRepo := genai.NewRepository(genaiClient, cfg.ModelId, cfg.ModelIdEmbedding)
	blogSearchRepo := blogsearch.NewRepository(client, cfg.AliasName, cfg.AliasNameEmbedding)
	blogSearchService := blogsearch.NewBlogSearchService(genaiRepo, blogSearchRepo)
	h := blogsearch.NewHandler(blogSearchService)

	mux := http.NewServeMux()
	api := humago.New(mux, huma.DefaultConfig("Blog Search API", "1.0.0"))
	api.UseMiddleware(middleware.LoggerMiddleware(slog.Default()))

	router.RegisterRoutes(api, h, blogSearchService)

	server := &http.Server{
		Addr:              "0.0.0.0:8080",
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 20,
		ErrorLog:          log.New(os.Stderr, "http: ", log.LstdFlags),
	}
	return server.ListenAndServe()
}

func main() {
	if err := setupServer(); err != nil {
		slog.Error("Failed to set up server", slog.Any("error", err))
	}
}

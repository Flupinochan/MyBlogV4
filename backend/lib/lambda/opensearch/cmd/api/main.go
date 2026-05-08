package main

import (
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
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

func setupRouter() error {
	ginMode := gin.Mode()
	gin.SetMode(ginMode)

	// Load .env file in non-production environments
	if ginMode != gin.ReleaseMode {
		err := godotenv.Load()
		if err != nil {
			return fmt.Errorf("error loading .env file: %w", err)
		}
	}

	// Load Configuration (Environment Variables)
	cfg, err := config.GetAppConfig()
	if err != nil {
		return fmt.Errorf("failed to get App config: %w", err)
	}

	// Logger Initialization
	mylogger.InitLogger(cfg.Level)

	slog.Info("Application started")

	// OpenSearch Client Initialization
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

	// Gin Router Initialization with Middleware
	r := gin.New()
	// r.RedirectTrailingSlash = false
	r.Use(gin.Recovery())
	r.Use(middleware.LoggerMiddleware(slog.Default()))
	r.Use(middleware.ErrorHandler())

	// Register routes
	router.RegisterRoutes(r, h, blogSearchService)

	// Run the server (Using "localhost:8080" instead of "127.0.0.1:8080")
	server := &http.Server{
		Addr:              "0.0.0.0:8080",
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 20,
		ErrorLog:          log.New(os.Stderr, "http: ", log.LstdFlags),
	}
	server.ListenAndServe()

	return nil
}

func main() {
	err := setupRouter()
	if err != nil {
		slog.Error("Failed to set up router", slog.Any("error", err))
		return
	}
}

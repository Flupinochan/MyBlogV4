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
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/config"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/logger"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/middleware"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/router"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/search"
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
	logger.InitLogger(&config.AppConfig{
		Level: cfg.Level,
	})

	slog.Info("Application started")

	// OpenSearch Client Initialization
	client, err := search.NewOpenSearchClient(cfg)
	if err != nil {
		return fmt.Errorf("failed to initialize OpenSearch client: %w", err)
	}
	repo := search.NewRepository(client)
	h := search.NewHandler(repo)

	// Gin Router Initialization with Middleware
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.LoggerMiddleware(slog.Default()))
	r.Use(middleware.ErrorHandler())

	// Register routes
	router.RegisterRoutes(r, h, repo)

	// Run the server
	s := &http.Server{
		Addr:              ":8080",
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 20,
		ErrorLog:          log.New(os.Stderr, "http: ", log.LstdFlags),
	}
	s.ListenAndServe()

	return nil
}

func main() {
	err := setupRouter()
	if err != nil {
		slog.Error("Failed to set up router", slog.Any("error", err))
		return
	}
}

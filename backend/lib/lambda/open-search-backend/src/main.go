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
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/client"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/config"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/middleware"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/router"
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
	middleware.InitLogger(&config.AppConfig{
		Level: cfg.Level,
	})

	slog.Info("Application started")

	// OpenSearch Client Initialization
	client, err := client.NewOpenSearchClient(cfg)
	if err != nil {
		return fmt.Errorf("failed to initialize OpenSearch client: %w", err)
	}

	// Gin Router Initialization with Middleware
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.LoggerMiddleware(slog.Default()))
	r.Use(middleware.ErrorHandler())

	// Register routes
	router.RegisterRoutes(r, client)

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

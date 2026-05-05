package main

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/aws/aws-lambda-go/lambda"
	"golang.org/x/sync/errgroup"
	"golang.org/x/sync/semaphore"
)

func run(ctx context.Context) error {
	// Load Configuration (Lambda Environment Variables)
	config, err := GetAppConfig()
	if err != nil {
		return fmt.Errorf("failed to get OpenSearch config: %w", err)
	}

	// Logger Initialization
	InitLogger(&AppConfig{
		Level: config.Level,
	})

	slog.Info("Application started")

	// OpenSearch Client Initialization
	client, err := NewOpenSearchClient(config)
	if err != nil {
		return fmt.Errorf("failed to initialize OpenSearch client: %w", err)
	}

	// Create Index
	now := time.Now()
	indexName := fmt.Sprintf("%s_%s", config.AliasName, now.Format("20060102_150405"))
	err = CreateIndex(ctx, client, CreateIndexParams{
		IndexName: indexName,
		FilePath:  "index.json",
	})
	if err != nil {
		return fmt.Errorf("failed to create index: %w", err)
	}

	// Initialize Http Client
	httpClient := NewHttpClient()

	// Initialize GitHub Client
	githubClient, err := NewGitHubHttpClient(config, httpClient)
	if err != nil {
		return fmt.Errorf("failed to initialize GitHub client: %w", err)
	}

	// Get Blog Files from GitHub
	blogDetails, err := GetAllBlogDetails(ctx, githubClient, httpClient, config)
	if err != nil {
		return fmt.Errorf("failed to get blog details: %w", err)
	}
	slog.Info("Successfully retrieved blog details", slog.Int("count", len(blogDetails)))

	// Build Blog Documents
	const maxConcurrency = 10
	sem := semaphore.NewWeighted(maxConcurrency)

	var mu sync.Mutex
	var documents []BlogDocument

	g, gctx := errgroup.WithContext(ctx)
	for _, blogDetail := range blogDetails {
		g.Go(func() error {
			if err := sem.Acquire(gctx, 1); err != nil {
				return fmt.Errorf("semaphore acquire failed: %w", err)
			}
			defer sem.Release(1)

			slog.Info("Processing blog detail",
				slog.String("file", blogDetail.FileName),
			)
			parsed, err := ParseBlogContent(blogDetail.Content)
			if err != nil {
				slog.Error("Failed to parse blog content",
					slog.String("file", blogDetail.FileName),
					slog.String("error", err.Error()),
				)
				return nil
			}

			mu.Lock()
			documents = append(documents, BlogDocument{
				Slug:      blogDetail.FileName,
				URL:       "https://zenn.dev/metalmental/articles/" + blogDetail.FileName,
				Title:     parsed.Title,
				Emoji:     parsed.Emoji,
				Type:      parsed.Type,
				Topics:    parsed.Topics,
				Content:   parsed.Content,
				CreatedAt: blogDetail.CreatedAt.Format("2006-01-02 15:04:05"),
			})
			mu.Unlock()

			return nil
		})
	}
	if err := g.Wait(); err != nil {
		return fmt.Errorf("failed to build blog documents: %w", err)
	}
	slog.Info("Successfully built blog documents", slog.Int("count", len(documents)))

	// Bulk Index Documents
	err = BulkIndexDocuments(ctx, client, BulkIndexDocumentsParams{
		IndexName: indexName,
		Documents: documents,
	})
	if err != nil {
		return fmt.Errorf("failed to bulk index documents: %w", err)
	}

	// Update Alias
	err = UpdateAlias(ctx, client, UpdateAliasParams{
		AliasName: config.AliasName,
		IndexName: indexName,
	})
	if err != nil {
		return fmt.Errorf("failed to update alias: %w", err)
	}

	return nil
}

// Entry Point for AWS Lambda
func main() {
	lambda.Start(func(ctx context.Context) error {
		err := run(ctx)
		if err != nil {
			slog.Error("Application error", slog.Any("error", err))
			return err
		}
		slog.Info("Application finished successfully")
		return nil
	})
}

// メモ
// OpenSearchはまだTyped APIが提供されていないため利用しない

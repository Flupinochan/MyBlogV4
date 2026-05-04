package main

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/aws/aws-lambda-go/lambda"
)

const aliasName = "tech-blog"

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
	indexName := fmt.Sprintf("%s_%s", aliasName, now.Format("20060102_150405"))
	err = CreateIndexFromFile(client, indexName, "index.json")
	if err != nil {
		return fmt.Errorf("failed to create index: %w", err)
	}

	// Update Alias
	err = CreateOrUpdateAlias(client, aliasName, indexName)
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
			slog.Error("Application error", "error", err)
			return err
		}
		slog.Info("Application finished successfully")
		return nil
	})
}

// メモ
// OpenSearchはまだTyped APIが提供されていないため利用しない

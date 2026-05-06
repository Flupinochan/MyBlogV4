package main

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/aws/aws-lambda-go/lambda"
	blogsource "metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/cmd/batch/github"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/cmd/batch/myhttp"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/blogsearch"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/mylogger"
)

func run(ctx context.Context) error {
	// Load Configuration (Lambda Environment Variables)
	config, err := GetAppConfig()
	if err != nil {
		return fmt.Errorf("failed to get App config: %w", err)
	}

	// Logger Initialization
	mylogger.InitLogger(config.Level)

	slog.Info("Application started")

	// OpenSearch Client Initialization
	client, err := blogsearch.NewOpenSearchClient(&blogsearch.OpenSearchConfig{
		Address:  config.Address,
		Username: config.Username,
		Password: config.Password,
	})
	if err != nil {
		return fmt.Errorf("failed to initialize OpenSearch client: %w", err)
	}
	repo := blogsearch.NewRepository(client, config.AliasName)

	// Create Index
	now := time.Now()
	indexName := fmt.Sprintf("%s_%s", config.AliasName, now.Format("20060102_150405"))
	err = repo.CreateIndex(ctx, blogsearch.CreateIndexParams{
		IndexName: indexName,
		FilePath:  "index.json",
	})
	if err != nil {
		return fmt.Errorf("failed to create index: %w", err)
	}

	// Initialize Http Client
	httpClient := myhttp.NewHttpClient()
	httpRepo := myhttp.NewHttpRepository(httpClient)

	// Initialize GitHub Client
	githubConfig := blogsource.GitHubConfig{
		Owner:          config.GithubOwner,
		Repo:           config.GithubRepo,
		Path:           config.GithubPath,
		AppsPrivateKey: config.GithubAppsPrivateKey,
		AppsId:         config.GitHubAppsId,
		InstallationId: config.GitHubInstallationId,
	}
	githubClient, err := blogsource.NewGitHubClient(&githubConfig, httpRepo.Client())
	if err != nil {
		return fmt.Errorf("failed to initialize GitHub client: %w", err)
	}
	githubRepo := blogsource.NewGitHubRepository(githubConfig, githubClient)

	blogService := blogsource.NewBlogService(httpRepo, githubRepo)

	// Get Blog Files from GitHub
	blogDetails, err := blogService.GetAllBlogDetails(ctx)
	if err != nil {
		return fmt.Errorf("failed to get blog details: %w", err)
	}
	slog.Info("Successfully retrieved blog details", slog.Int("count", len(blogDetails)))

	// Build Blog Documents
	documents, err := BuildBlogDocuments(ctx, blogDetails)
	if err != nil {
		return fmt.Errorf("failed to build blog documents: %w", err)
	}
	slog.Info("Successfully built blog documents", slog.Int("count", len(documents)))

	// Bulk Index Documents
	err = repo.BulkIndexDocuments(ctx, blogsearch.BulkIndexDocumentsParams{
		IndexName: indexName,
		Documents: documents,
	})
	if err != nil {
		return fmt.Errorf("failed to bulk index documents: %w", err)
	}

	// Update Alias
	err = repo.UpdateAlias(ctx, blogsearch.UpdateAliasParams{
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

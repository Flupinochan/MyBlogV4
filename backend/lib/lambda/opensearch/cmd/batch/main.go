package main

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/codepipeline"
	"github.com/aws/aws-sdk-go-v2/service/codepipeline/types"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/cmd/batch/blogsource"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/cmd/batch/myhttp"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/blogsearch"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/genai"
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
	repo := blogsearch.NewRepository(client, config.AliasName, config.AliasNameEmbedding)

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

	// Create Hybrid Index
	hybridIndexName := fmt.Sprintf("%s_%s", config.AliasNameEmbedding, now.Format("20060102_150405"))
	err = repo.CreateIndex(ctx, blogsearch.CreateIndexParams{
		IndexName: hybridIndexName,
		FilePath:  "index_hybrid.json",
	})
	if err != nil {
		return fmt.Errorf("failed to create hybrid index: %w", err)
	}

	// Create Search Pipelines
	err = repo.CreateSearchPipeline(ctx, blogsearch.CreateSearchPipelineParams{
		PipelineID: "hybrid-rrf-pipeline",
		FilePath:   "hybrid-rrf-pipeline.json",
	})
	if err != nil {
		return fmt.Errorf("failed to create rrf search pipeline: %w", err)
	}

	err = repo.CreateSearchPipeline(ctx, blogsearch.CreateSearchPipelineParams{
		PipelineID: "hybrid-norm-pipeline",
		FilePath:   "hybrid-norm-pipeline.json",
	})
	if err != nil {
		return fmt.Errorf("failed to create norm search pipeline: %w", err)
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

	// GenAI Client Initialization
	genaiClient, err := genai.NewGenAIClient(&genai.GenAIConfig{
		MaxAttempts:     3,
		MaxBackoffDelay: 2 * time.Second,
	})
	if err != nil {
		return fmt.Errorf("failed to initialize GenAI client: %w", err)
	}
	genaiRepo := genai.NewRepository(genaiClient, config.ModelId, config.EmbeddingModelId)

	// Build Blog Documents and Summarize Content
	documents, err := BuildBlogDocuments(ctx, blogDetails, genaiRepo)
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

	// Chunking Markdown Content for Embedding and Building Chunk Documents
	chunkDocuments, err := BuildChunkDocuments(ctx, documents, genaiRepo, config.EmbeddingModelId)
	if err != nil {
		return fmt.Errorf("failed to build chunk documents: %w", err)
	}
	slog.Info("Successfully built chunk documents", slog.Int("count", len(chunkDocuments)))

	// Bulk Index Chunk Documents into Hybrid Index
	err = repo.BulkIndexChunkDocuments(ctx, blogsearch.BulkIndexChunkDocumentsParams{
		IndexName: hybridIndexName,
		Documents: chunkDocuments,
	})
	if err != nil {
		return fmt.Errorf("failed to bulk index chunk documents: %w", err)
	}

	// Update Alias
	err = repo.UpdateAlias(ctx, blogsearch.UpdateAliasParams{
		AliasName: config.AliasName,
		IndexName: indexName,
	})
	if err != nil {
		return fmt.Errorf("failed to update alias: %w", err)
	}

	// Update Hybrid Alias
	err = repo.UpdateAlias(ctx, blogsearch.UpdateAliasParams{
		AliasName: config.AliasNameEmbedding,
		IndexName: hybridIndexName,
	})
	if err != nil {
		return fmt.Errorf("failed to update hybrid alias: %w", err)
	}

	return nil
}

// Entry Point for AWS Lambda
// Invoked by CodePipeline
func main() {
	lambda.Start(func(ctx context.Context, event events.CodePipelineJobEvent) error {
		if err := handler(ctx, event); err != nil {
			slog.Error("OpenSearch Sync Batch error", slog.Any("error", err))
			return err
		}
		slog.Info("OpenSearch Sync Batch finished successfully")
		return nil
	})
}

func handler(ctx context.Context, event events.CodePipelineJobEvent) error {
	jobID := event.CodePipelineJob.ID

	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return fmt.Errorf("failed to load AWS config: %w", err)
	}
	cp := codepipeline.NewFromConfig(cfg)

	if runErr := run(ctx); runErr != nil {
		msg := runErr.Error()
		if _, err := cp.PutJobFailureResult(ctx, &codepipeline.PutJobFailureResultInput{
			JobId: &jobID,
			FailureDetails: &types.FailureDetails{
				Type:    types.FailureTypeJobFailed,
				Message: &msg,
			},
		}); err != nil {
			return fmt.Errorf("failed to notify CodePipeline failure: %w", err)
		}
		return runErr
	}

	if _, err := cp.PutJobSuccessResult(ctx, &codepipeline.PutJobSuccessResultInput{
		JobId: &jobID,
	}); err != nil {
		return fmt.Errorf("failed to notify CodePipeline success: %w", err)
	}

	return nil
}

// メモ
// OpenSearchはまだTyped APIが提供されていないため利用しない

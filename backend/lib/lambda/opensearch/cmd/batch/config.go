package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strconv"

	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/secrets"
)

// Lambda環境変数
type AppConfig struct {
	Address              string
	Username             string
	Password             string
	Level                slog.Level
	AliasName            string
	AliasNameEmbedding   string
	GithubOwner          string
	GithubRepo           string
	GithubPath           string
	GithubAppsPrivateKey string
	GitHubAppsId         int64
	GitHubInstallationId int64
	ModelId              string
	EmbeddingModelId     string
}

func GetAppConfig() (*AppConfig, error) {
	ctx := context.Background()

	// Lambda環境変数取得
	getRequired := func(key string) (string, error) {
		val := os.Getenv(key)
		if val == "" {
			return "", fmt.Errorf("environment variable %s is required but not set", key)
		}
		return val, nil
	}

	address, err := getRequired("OPEN_SEARCH_URL")
	if err != nil {
		return nil, err
	}
	port, err := getRequired("OPEN_SEARCH_PORT")
	if err != nil {
		return nil, err
	}
	aliasName, err := getRequired("ALIAS_NAME")
	if err != nil {
		return nil, err
	}
	aliasNameEmbedding, err := getRequired("ALIAS_NAME_EMBEDDING")
	if err != nil {
		return nil, err
	}
	githubOwner, err := getRequired("GITHUB_OWNER")
	if err != nil {
		return nil, err
	}
	githubRepo, err := getRequired("GITHUB_REPO")
	if err != nil {
		return nil, err
	}
	githubPath, err := getRequired("GITHUB_PATH")
	if err != nil {
		return nil, err
	}
	modelId, err := getRequired("MODEL_ID")
	if err != nil {
		return nil, fmt.Errorf("failed to get MODEL_ID: %w", err)
	}
	embeddingModelId, err := getRequired("EMBEDDING_MODEL_ID")
	if err != nil {
		return nil, fmt.Errorf("failed to get EMBEDDING_MODEL_ID: %w", err)
	}

	// Retrieve secret names from env vars (these hold Secrets Manager secret names, not actual secrets)
	openSearchUserSecretName, err := getRequired("OPEN_SEARCH_USER_SECRET_NAME")
	if err != nil {
		return nil, err
	}
	openSearchPassSecretName, err := getRequired("OPEN_SEARCH_PASS_SECRET_NAME")
	if err != nil {
		return nil, err
	}
	githubAppsPrivateKeySecretName, err := getRequired("GITHUB_APPS_PRIVATE_KEY_SECRET_NAME")
	if err != nil {
		return nil, err
	}
	githubAppsIdSecretName, err := getRequired("GITHUB_APPS_ID_SECRET_NAME")
	if err != nil {
		return nil, err
	}
	githubInstallationIdSecretName, err := getRequired("GITHUB_INSTALLATION_ID_SECRET_NAME")
	if err != nil {
		return nil, err
	}

	// Fetch actual secret values from AWS Secrets Manager
	smClient, err := secrets.NewClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to create Secrets Manager client: %w", err)
	}

	username, err := smClient.GetSecretValue(ctx, openSearchUserSecretName)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve OpenSearch username: %w", err)
	}
	password, err := smClient.GetSecretValue(ctx, openSearchPassSecretName)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve OpenSearch password: %w", err)
	}
	githubAppsPrivateKey, err := smClient.GetSecretValue(ctx, githubAppsPrivateKeySecretName)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve GitHub Apps private key: %w", err)
	}
	githubAppsIdString, err := smClient.GetSecretValue(ctx, githubAppsIdSecretName)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve GitHub Apps ID: %w", err)
	}
	githubAppsId, err := strconv.ParseInt(githubAppsIdString, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid GITHUB_APPS_ID: %w", err)
	}
	githubInstallationIdString, err := smClient.GetSecretValue(ctx, githubInstallationIdSecretName)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve GitHub Installation ID: %w", err)
	}
	gitHubInstallationId, err := strconv.ParseInt(githubInstallationIdString, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid GITHUB_INSTALLATION_ID: %w", err)
	}

	var logLevel slog.Level
	if lvl, err := strconv.Atoi(os.Getenv("LOG_LEVEL")); err == nil {
		logLevel = slog.Level(lvl)
	}

	return &AppConfig{
		Address:              fmt.Sprintf("%s:%s", address, port),
		Username:             username,
		Password:             password,
		Level:                logLevel,
		AliasName:            aliasName,
		AliasNameEmbedding:   aliasNameEmbedding,
		GithubOwner:          githubOwner,
		GithubRepo:           githubRepo,
		GithubPath:           githubPath,
		GithubAppsPrivateKey: githubAppsPrivateKey,
		GitHubAppsId:         githubAppsId,
		GitHubInstallationId: gitHubInstallationId,
		ModelId:              modelId,
		EmbeddingModelId:     embeddingModelId,
	}, nil
}

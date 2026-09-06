package main

import (
	"fmt"
	"log/slog"
	"os"
	"strconv"
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
	username, err := getRequired("OPEN_SEARCH_USER")
	if err != nil {
		return nil, err
	}
	password, err := getRequired("OPEN_SEARCH_PASS")
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
	githubAppsPrivateKey, err := getRequired("GITHUB_APPS_PRIVATE_KEY")
	if err != nil {
		return nil, err
	}
	githubAppsIdString, err := getRequired("GITHUB_APPS_ID")
	if err != nil {
		return nil, err
	}
	githubAppsId, err := strconv.ParseInt(githubAppsIdString, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid GITHUB_APPS_ID: %w", err)
	}
	githubInstallationIdString, err := getRequired("GITHUB_INSTALLATION_ID")
	if err != nil {
		return nil, err
	}
	gitHubInstallationId, err := strconv.ParseInt(githubInstallationIdString, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid GITHUB_INSTALLATION_ID: %w", err)
	}
	modelId, err := getRequired("MODEL_ID")
	if err != nil {
		return nil, fmt.Errorf("failed to get MODEL_ID: %w", err)
	}
	embeddingModelId, err := getRequired("EMBEDDING_MODEL_ID")
	if err != nil {
		return nil, fmt.Errorf("failed to get EMBEDDING_MODEL_ID: %w", err)
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

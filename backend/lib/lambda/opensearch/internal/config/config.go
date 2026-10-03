package config

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
	Address            string
	Username           string
	Password           string
	AliasName          string
	AliasNameEmbedding string
	ModelId            string
	ModelIdEmbedding   string
	Level              slog.Level
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
	modelId, err := getRequired("MODEL_ID")
	if err != nil {
		return nil, err
	}
	modelIdEmbedding, err := getRequired("MODEL_ID_EMBEDDING")
	if err != nil {
		return nil, err
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

	var logLevel slog.Level
	if lvl, err := strconv.Atoi(os.Getenv("LOG_LEVEL")); err == nil {
		logLevel = slog.Level(lvl)
	}

	return &AppConfig{
		Address:            fmt.Sprintf("%s:%s", address, port),
		Username:           username,
		Password:           password,
		AliasName:          aliasName,
		AliasNameEmbedding: aliasNameEmbedding,
		ModelId:            modelId,
		ModelIdEmbedding:   modelIdEmbedding,
		Level:              logLevel,
	}, nil
}

package config

import (
	"fmt"
	"log/slog"
	"os"
	"strconv"
)

// Lambda環境変数
type AppConfig struct {
	Address   string
	Username  string
	Password  string
	AliasName string
	Level     slog.Level
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

	var logLevel slog.Level
	if lvl, err := strconv.Atoi(os.Getenv("LOG_LEVEL")); err == nil {
		logLevel = slog.Level(lvl)
	}

	return &AppConfig{
		Address:   fmt.Sprintf("%s:%s", address, port),
		Username:  username,
		Password:  password,
		AliasName: aliasName,
		Level:     logLevel,
	}, nil
}

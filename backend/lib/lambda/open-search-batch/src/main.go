package main

import (
	"bytes"
	"context"
	"crypto/tls"
	"embed"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/opensearch-project/opensearch-go/v2"
	"github.com/opensearch-project/opensearch-go/v2/opensearchutil"
)

//go:embed index.json
var indexFiles embed.FS

// OpenSearch API Error Response
type OpenSearchError struct {
	StatusCode int    // HTTP Response Status Code
	Status     string // HTTP Response Status Text
	Body       string // HTTP Response Body
	Message    string // 独自のエラーメッセージ
}

// Logger Handler
type OpenSearchLogHandler struct {
	slog.Handler
}

func (h *OpenSearchLogHandler) Handle(ctx context.Context, r slog.Record) error {
	r.Attrs(func(a slog.Attr) bool {
		if a.Key == "error" {
			// OpenSearchErrorの場合は、StatusCodeやStatus、Bodyなどをログに追加
			if osErr, ok := a.Value.Any().(*OpenSearchError); ok {
				r.AddAttrs(
					slog.Int("status_code", osErr.StatusCode),
					slog.String("status_text", osErr.Status),
					slog.String("detail", osErr.Body),
				)
			}
		}
		return true
	})
	return h.Handler.Handle(ctx, r)
}

// Logger Config
type LoggerConfig struct {
	Level slog.Level
}

// ロガー定義
func InitLogger(config *AppConfig) {
	option := &slog.HandlerOptions{
		Level:     config.Level,
		AddSource: true,
	}

	baseHandler := slog.NewJSONHandler(os.Stdout, option)
	customHandler := &OpenSearchLogHandler{Handler: baseHandler}

	logger := slog.New(customHandler)
	// logger := logger.With("memo", "共通メッセージ")

	// slogのルートデフォルトロガーに設定
	// 以降、ロガーインスタンスを明示的に渡さなくても、slog.Infoなどでログ出力できるようになる
	slog.SetDefault(logger)
}

// .envファイルからOpenSearch接続情報
type AppConfig struct {
	Address  string
	Username string
	Password string
	Level    slog.Level
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
	var logLevel slog.Level
	if lvl, err := strconv.Atoi(os.Getenv("LOG_LEVEL")); err == nil {
		logLevel = slog.Level(lvl)
	}

	return &AppConfig{
		Address:  fmt.Sprintf("%s:%s", address, port),
		Username: username,
		Password: password,
		Level:    logLevel,
	}, nil
}

// OpenSearch Create Index API
func CreateIndexFromFile(client *opensearch.Client, indexName string, filePath string) error {
	body, err := indexFiles.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read embedded index file [%s]: %w", filePath, err)
	}

	res, err := client.Indices.Create(
		indexName,
		client.Indices.Create.WithBody(bytes.NewReader(body)),
	)
	if err != nil {
		return fmt.Errorf("opensearch api call failed: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("opensearch error [%s]: %s", res.Status(), res.String())
	}

	slog.Info("Successfully created index", "name", indexName)

	return nil
}

// OpenSearch Update Alias API
func CreateOrUpdateAlias(client *opensearch.Client, aliasName string, indexName string) error {
	getAliasRes, err := client.Indices.GetAlias(client.Indices.GetAlias.WithName(aliasName))

	// atomic update (RDBのtransactionに近い)
	var actions []string
	var indicesToDelete []string

	// aliasが存在する場合は、aliasから全てのindexの関連付けを解除するactionを追加
	// (avienでは*ワイルドカード処理が無効)
	if err == nil && !getAliasRes.IsError() {
		var aliasInfo map[string]interface{}
		if err := json.NewDecoder(getAliasRes.Body).Decode(&aliasInfo); err == nil {
			for oldIndex := range aliasInfo {
				actions = append(actions, fmt.Sprintf(`{ "remove": { "index": "%s", "alias": "%s" } }`, oldIndex, aliasName))
				indicesToDelete = append(indicesToDelete, oldIndex)
			}
		}
	}
	if getAliasRes != nil && getAliasRes.Body != nil {
		defer getAliasRes.Body.Close()
	}

	// 新しいindexをaliasに関連付けるactionを追加
	actions = append(actions, fmt.Sprintf(`{ "add": { "index": "%s", "alias": "%s" } }`, indexName, aliasName))

	// update alias
	body := fmt.Sprintf(`{ "actions": [ %s ] }`, strings.Join(actions, ","))
	updateAliasRes, err := client.Indices.UpdateAliases(strings.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to update alias: %w", err)
	}
	defer updateAliasRes.Body.Close()

	if updateAliasRes.IsError() {
		return fmt.Errorf("opensearch alias error [%s]: %s", updateAliasRes.Status(), updateAliasRes.String())
	}
	slog.Info("Successfully updated alias", "alias", aliasName, "new_index", indexName, "removed_indices", indicesToDelete)

	// delete old indices
	if len(indicesToDelete) > 0 {
		if deleteRes, err := client.Indices.Delete(indicesToDelete); err == nil {
			defer deleteRes.Body.Close()
		}
		slog.Info("Deleted old indices", "indices", indicesToDelete)
	}

	return nil
}

type BlogDocument struct {
	Slug      string   `json:"slug"`
	URL       string   `json:"url"`
	Title     string   `json:"title"`
	Emoji     string   `json:"emoji"`
	Type      string   `json:"type"`
	Topics    []string `json:"topics"`
	Content   string   `json:"content"`
	CreatedAt string   `json:"created_at"` // yyyy-MM-dd HH:mm:ss (プログラム上ではstringで扱う)
}

// OpenSearch Add Document API (Bulk)
func BulkIndexDocuments(client *opensearch.Client, ctx context.Context, indexName string, docs []BlogDocument) error {
	// Create the indexer
	indexer, err := opensearchutil.NewBulkIndexer(opensearchutil.BulkIndexerConfig{
		Client:     client,
		Index:      indexName,
		NumWorkers: 2,
	})
	if err != nil {
		return fmt.Errorf("Error creating the indexer: %w", err)
	}

	// Add documents to the indexer
	for _, doc := range docs {
		data, err := json.Marshal(doc)
		if err != nil {
			slog.Error("Failed to marshal document",
				slog.String("error", err.Error()),
				slog.Any("document", doc),
			)
		}

		err = indexer.Add(
			ctx,
			opensearchutil.BulkIndexerItem{
				Action: "index",
				Body:   bytes.NewReader(data),
				OnFailure: func(
					ctx context.Context,
					item opensearchutil.BulkIndexerItem,
					res opensearchutil.BulkIndexerResponseItem,
					err error,
				) {
					if err != nil {
						slog.Error("Failed to index document", slog.String("error", err.Error()))
					} else {
						slog.Error("Failed to index document",
							slog.Int("status", res.Status),
							slog.String("type", res.Error.Type),
							slog.String("reason", res.Error.Reason),
						)
					}
				},
			},
		)
		if err != nil {
			slog.Error("Unexpected error while adding document to indexer", slog.String("error", err.Error()))
		}
	}

	// Close the indexer and flush any remaining documents
	if err := indexer.Close(ctx); err != nil {
		return fmt.Errorf("Error closing the indexer: %w", err)
	}

	stats := indexer.Stats()
	if stats.NumFailed > 0 {
		return fmt.Errorf("Indexed [%d] documents with [%d] errors", stats.NumFlushed, stats.NumFailed)
	}

	slog.Info("Bulk indexing completed",
		"total", stats.NumAdded,
		"flushed", stats.NumFlushed,
		"failed", stats.NumFailed,
	)

	return nil
}

const aliasName = "tech-blog"
const logLevel = slog.LevelInfo

func run(ctx context.Context) error {
	// Logger Initialization
	InitLogger(&AppConfig{
		Level: logLevel,
	})
	slog.Info("Application started")

	// OpenSearch Client Setup
	config, err := GetAppConfig()
	if err != nil {
		return fmt.Errorf("failed to get OpenSearch config: %w", err)
	}

	// 429 (Too Many Requests) を追加
	// 指数バックオフ (100ms, 200ms, 400ms, ...) を設定
	cfg := opensearch.Config{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
		Addresses:           []string{config.Address},
		Username:            config.Username,
		Password:            config.Password,
		RetryOnStatus:       []int{429, 502, 503, 504},
		RetryBackoff:        func(i int) time.Duration { return time.Duration(1<<uint(i)) * 100 * time.Millisecond },
		MaxRetries:          5,
		CompressRequestBody: true,
	}

	client, err := opensearch.NewClient(cfg)
	if err != nil {
		return fmt.Errorf("OpenSearch client setup failed: %w", err)
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

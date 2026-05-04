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
	"strings"
	"time"

	"github.com/opensearch-project/opensearch-go/v2"
	"github.com/opensearch-project/opensearch-go/v2/opensearchutil"
)

//go:embed index.json
var indexFiles embed.FS

func NewOpenSearchClient(config *AppConfig) (*opensearch.Client, error) {
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
		return nil, fmt.Errorf("OpenSearch client setup failed: %w", err)
	}
	return client, nil
}

// Create Index
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

// Update Alias
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

// Bulk Index Documents
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

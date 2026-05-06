package blogsearch

import (
	"bytes"
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"

	"github.com/opensearch-project/opensearch-go/v2/opensearchutil"
)

//go:embed index.json
var indexFiles embed.FS

// Create Index
type CreateIndexParams struct {
	IndexName string
	FilePath  string
}

func (r *Repository) CreateIndex(ctx context.Context, params CreateIndexParams) error {
	body, err := indexFiles.ReadFile(params.FilePath)
	if err != nil {
		return fmt.Errorf("failed to read embedded index file [%s]: %w", params.FilePath, err)
	}

	res, err := r.client.Indices.Create(
		params.IndexName,
		r.client.Indices.Create.WithBody(bytes.NewReader(body)),
		r.client.Indices.Create.WithContext(ctx),
	)
	if err != nil {
		return fmt.Errorf("opensearch api call failed: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("opensearch error [%s]: %s", res.Status(), res.String())
	}

	slog.Info("Successfully created index", slog.String("indexName", params.IndexName))

	return nil
}

// Update Alias
type UpdateAliasParams struct {
	AliasName string
	IndexName string
}

func (r *Repository) UpdateAlias(ctx context.Context, params UpdateAliasParams) error {
	getAliasRes, err := r.client.Indices.GetAlias(
		r.client.Indices.GetAlias.WithName(params.AliasName),
		r.client.Indices.GetAlias.WithContext(ctx),
	)

	// atomic update (RDBのtransactionに近い)
	var actions []string
	var indicesToDelete []string

	// aliasが存在する場合は、aliasから全てのindexの関連付けを解除するactionを追加
	// (avienでは*ワイルドカード処理が無効)
	if err == nil && !getAliasRes.IsError() {
		var aliasInfo map[string]interface{}
		if err := json.NewDecoder(getAliasRes.Body).Decode(&aliasInfo); err == nil {
			for oldIndex := range aliasInfo {
				actions = append(actions, fmt.Sprintf(`{ "remove": { "index": "%s", "alias": "%s" } }`, oldIndex, params.AliasName))
				indicesToDelete = append(indicesToDelete, oldIndex)
			}
		}
	}
	if getAliasRes != nil && getAliasRes.Body != nil {
		defer getAliasRes.Body.Close()
	}

	// 新しいindexをaliasに関連付けるactionを追加
	actions = append(actions, fmt.Sprintf(`{ "add": { "index": "%s", "alias": "%s" } }`, params.IndexName, params.AliasName))

	// update alias
	body := fmt.Sprintf(`{ "actions": [ %s ] }`, strings.Join(actions, ","))
	updateAliasRes, err := r.client.Indices.UpdateAliases(
		strings.NewReader(body),
		r.client.Indices.UpdateAliases.WithContext(ctx),
	)
	if err != nil {
		return fmt.Errorf("failed to update alias: %w", err)
	}
	defer updateAliasRes.Body.Close()

	if updateAliasRes.IsError() {
		return fmt.Errorf("opensearch alias error [%s]: %s", updateAliasRes.Status(), updateAliasRes.String())
	}
	slog.Info("Successfully updated alias",
		slog.String("aliasName", params.AliasName),
		slog.String("indexName", params.IndexName),
	)

	// delete old indices
	if len(indicesToDelete) > 0 {
		if deleteRes, err := r.client.Indices.Delete(
			indicesToDelete,
			r.client.Indices.Delete.WithContext(ctx),
		); err == nil {
			defer deleteRes.Body.Close()
		}
		slog.Info("Deleted old indices", slog.Any("indices", indicesToDelete))
	}

	return nil
}

// Bulk Indexing
type BulkIndexDocumentsParams struct {
	IndexName string
	Documents []BlogDocument
}

func (r *Repository) BulkIndexDocuments(ctx context.Context, params BulkIndexDocumentsParams) error {
	// Create the indexer
	indexer, err := opensearchutil.NewBulkIndexer(opensearchutil.BulkIndexerConfig{
		Client:     r.client,
		Index:      params.IndexName,
		NumWorkers: 2,
	})
	if err != nil {
		return fmt.Errorf("Error creating the indexer: %w", err)
	}

	// Add documents to the indexer
	for _, doc := range params.Documents {
		data, err := json.Marshal(doc)
		if err != nil {
			slog.Error("Failed to marshal document",
				slog.String("error", err.Error()),
				slog.Any("document", doc),
			)
			continue
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
			if ctx.Err() != nil {
				return fmt.Errorf("bulk indexing canceled: %w", ctx.Err())
			}
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
		slog.String("indexName", params.IndexName),
		slog.Int("total", int(stats.NumAdded)),
		slog.Int("flushed", int(stats.NumFlushed)),
		slog.Int("failed", int(stats.NumFailed)),
	)

	return nil
}

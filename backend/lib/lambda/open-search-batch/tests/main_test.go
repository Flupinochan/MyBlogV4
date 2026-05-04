package main

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"reflect"
	"testing"

	"github.com/opensearch-project/opensearch-go/v2"
)

func TestOpenSearchLogHandler_Handle(t *testing.T) {
	type args struct {
		ctx context.Context
		r   slog.Record
	}
	tests := []struct {
		name    string
		h       *OpenSearchLogHandler
		args    args
		wantErr bool
	}{
		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := tt.h.Handle(tt.args.ctx, tt.args.r); (err != nil) != tt.wantErr {
				t.Errorf("OpenSearchLogHandler.Handle() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestInitLogger(t *testing.T) {
	type args struct {
		config LoggerConfig
	}
	tests := []struct {
		name    string
		args    args
		want    *os.File
		wantErr bool
	}{
		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := InitLogger(tt.args.config)
			if (err != nil) != tt.wantErr {
				t.Fatalf("InitLogger() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantErr {
				return
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("InitLogger() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestGetOpenSearchConfig(t *testing.T) {
	tests := []struct {
		name    string
		want    *OpenSearchConfig
		wantErr bool
	}{
		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := GetOpenSearchConfig()
			if (err != nil) != tt.wantErr {
				t.Fatalf("GetOpenSearchConfig() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantErr {
				return
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("GetOpenSearchConfig() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestCreateIndexFromFile(t *testing.T) {
	type args struct {
		client    *opensearch.Client
		indexName string
		filePath  string
	}
	tests := []struct {
		name    string
		args    args
		wantErr bool
	}{
		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := CreateIndexFromFile(tt.args.client, tt.args.indexName, tt.args.filePath); (err != nil) != tt.wantErr {
				t.Errorf("CreateIndexFromFile() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestCreateOrUpdateAlias(t *testing.T) {
	type args struct {
		client    *opensearch.Client
		aliasName string
		indexName string
	}
	tests := []struct {
		name    string
		args    args
		wantErr bool
	}{
		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := CreateOrUpdateAlias(tt.args.client, tt.args.aliasName, tt.args.indexName); (err != nil) != tt.wantErr {
				t.Errorf("CreateOrUpdateAlias() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestBulkIndexDocuments(t *testing.T) {
	type args struct {
		client    *opensearch.Client
		ctx       context.Context
		indexName string
		docs      []BlogDocument
	}
	tests := []struct {
		name    string
		args    args
		wantErr bool
	}{
		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := BulkIndexDocuments(tt.args.client, tt.args.ctx, tt.args.indexName, tt.args.docs); (err != nil) != tt.wantErr {
				t.Errorf("BulkIndexDocuments() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func Test_run(t *testing.T) {
	tests := []struct {
		name    string
		wantErr bool
	}{
		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := run(); (err != nil) != tt.wantErr {
				t.Errorf("run() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func Test_main(t *testing.T) {
	tests := []struct {
		name string
	}{
		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			main()
		})
	}
}

func TestBulkIndexDocuments_Integration(t *testing.T) {
	// 1. 環境設定とクライアント準備
	config, err := GetOpenSearchConfig()
	if err != nil {
		t.Fatalf("config error: %v", err)
	}

	client, _ := opensearch.NewClient(opensearch.Config{
		Addresses: []string{config.Address},
		Username:  config.Username,
		Password:  config.Password,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	})

	// 2. テスト用インデックスの作成
	testIndexName := "test-index"
	if err := CreateIndexFromFile(client, testIndexName, "index.json"); err != nil {
		t.Fatalf("failed to create index: %v. check if index.json exists.", err)
	}

	// 3. テストデータの準備 (型やフォーマットに細心の注意を払ったデータ)
	testDocs := []BlogDocument{
		{
			Slug:      "go-opensearch-integration",
			URL:       "https://zenn.dev/example/articles/go-opensearch",
			Title:     "GoとOpenSearchの高度な統合方法",
			Emoji:     "💙",
			Type:      "tech",
			Topics:    []string{"Go", "OpenSearch", "Backend"},
			Content:   "この記事では、Go言語を使用してOpenSearchにバルクインデックスする方法を解説します。MetalMentalなエンジニアに捧げます。",
			CreatedAt: "2026-05-04 10:00:00",
		},
		{
			Slug:      "opensearch-mapping-tips",
			URL:       "https://zenn.dev/example/articles/opensearch-mapping",
			Title:     "OpenSearchのマッピング定義でハマらないためのコツ",
			Emoji:     "💡",
			Type:      "idea",
			Topics:    []string{"OpenSearch", "Tips"},
			Content:   "dynamic strict設定は非常に強力ですが、正確な構造体定義が求められます。日付フォーマットには特に注意しましょう。",
			CreatedAt: "2026-05-04 12:30:00",
		},
		{
			Slug:      "kuromoji-analyzer-test",
			URL:       "https://zenn.dev/example/articles/kuromoji-test",
			Title:     "形態素解析エンジンの挙動確認",
			Emoji:     "🔍",
			Type:      "tech",
			Topics:    []string{"NLP", "Japanese"},
			Content:   "日本語の検索精度を上げるためには、kuromoji_tokenizerの設定が重要です。MetalMentalという造語もユーザー辞書で正しく認識されます。",
			CreatedAt: "2026-05-04 20:45:00",
		},
	}

	// 4. ドキュメント追加の実行
	t.Run("BulkIndexWithDetailLog", func(t *testing.T) {
		ctx := context.Background()
		err := BulkIndexDocuments(client, ctx, testIndexName, testDocs)

		if err != nil {
			// ここで失敗した場合、OpenSearchから返ってきた生の「拒絶理由」をログに出します
			t.Errorf("--- BULK INDEX FAILED ---")
			t.Errorf("Error Summary: %v", err)
			t.Errorf("--------------------------")
			t.Fatalf("上記エラーが発生しました。index.json の定義と BlogDocument の中身が一致しているか確認してください。")
		}
	})

	// 5. 反映の保証と検証
	client.Indices.Refresh(client.Indices.Refresh.WithIndex(testIndexName))
	countRes, _ := client.Count(client.Count.WithIndex(testIndexName))

	// 結果の表示
	var r map[string]interface{}
	json.NewDecoder(countRes.Body).Decode(&r)
	slog.Info("Final count result", "count", r["count"])

	// 6. クリーンアップ
	// t.Cleanup(func() {
	// 	client.Indices.Delete([]string{testIndexName})
	// })
}

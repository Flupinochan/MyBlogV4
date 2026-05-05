package search

import (
	"crypto/tls"
	"fmt"
	"net/http"
	"time"

	"github.com/opensearch-project/opensearch-go/v2"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/config"
)

func NewOpenSearchClient(config *config.AppConfig) (*opensearch.Client, error) {
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

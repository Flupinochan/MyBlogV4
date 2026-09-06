package myhttp

import (
	"net/http"
	"time"

	"github.com/hashicorp/go-retryablehttp"
)

func NewHttpClient() *http.Client {
	client := retryablehttp.NewClient()
	client.RetryMax = 3
	client.Backoff = func(_, _ time.Duration, i int, _ *http.Response) time.Duration {
		return time.Duration(1<<uint(i)) * 100 * time.Millisecond
	}
	client.HTTPClient.Timeout = 30 * time.Second
	client.CheckRetry = retryablehttp.DefaultRetryPolicy
	client.Logger = nil
	return client.StandardClient()
}

type HttpRepository struct {
	client *http.Client
}

func NewHttpRepository(client *http.Client) *HttpRepository {
	return &HttpRepository{client: client}
}

func (r *HttpRepository) Client() *http.Client {
	return r.client
}

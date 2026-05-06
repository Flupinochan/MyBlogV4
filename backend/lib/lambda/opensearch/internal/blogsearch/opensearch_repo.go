package blogsearch

import "github.com/opensearch-project/opensearch-go/v2"

type Repository struct {
	client *opensearch.Client
}

func NewRepository(client *opensearch.Client) *Repository {
	return &Repository{client: client}
}

type BlogDocument struct {
	Slug      string   `json:"slug"`
	URL       string   `json:"url"`
	Title     string   `json:"title"`
	Emoji     string   `json:"emoji"`
	Type      string   `json:"type"`
	Topics    []string `json:"topics"`
	Content   string   `json:"content"`
	CreatedAt string   `json:"created_at"`
}

package blogsearch

import "github.com/opensearch-project/opensearch-go/v2"

type Repository struct {
	client             *opensearch.Client
	aliasName          string
	aliasNameEmbedding string
}

func NewRepository(client *opensearch.Client, aliasName string, aliasNameEmbedding string) *Repository {
	return &Repository{client: client, aliasName: aliasName, aliasNameEmbedding: aliasNameEmbedding}
}

type BlogDocument struct {
	Slug      string   `json:"slug"`
	URL       string   `json:"url"`
	Title     string   `json:"title"`
	Emoji     string   `json:"emoji"`
	Type      string   `json:"type"`
	Topics    []string `json:"topics"`
	Content   string   `json:"content"`
	Summary   string   `json:"summary"`
	CreatedAt string   `json:"created_at"`
}

type ChunkDocument struct {
	Slug           string    `json:"slug"`
	URL            string    `json:"url"`
	Title          string    `json:"title"`
	Emoji          string    `json:"emoji"`
	Type           string    `json:"type"`
	Topics         []string  `json:"topics"`
	Chunk          string    `json:"chunk"`
	ChunkEmbedding []float64 `json:"chunk_embedding"`
	Summary        string    `json:"summary"`
	CreatedAt      string    `json:"created_at"`
}

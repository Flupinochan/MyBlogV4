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

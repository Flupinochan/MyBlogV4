package main

import (
	"context"
	"fmt"
	"log/slog"
	"sync"

	"golang.org/x/sync/errgroup"
	"golang.org/x/sync/semaphore"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/cmd/batch/blogsource"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/blogsearch"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/genai"
)

type chunkItem struct {
	doc   blogsearch.BlogDocument
	idx   int
	chunk string
}

func BuildBlogDocuments(ctx context.Context, blogDetails []blogsource.GitHubBlogDetail, repo *genai.Repository) ([]blogsearch.BlogDocument, error) {
	const maxConcurrency = 50
	sem := semaphore.NewWeighted(maxConcurrency)

	var mu sync.Mutex
	var documents []blogsearch.BlogDocument

	g, gctx := errgroup.WithContext(ctx)
	for _, blogDetail := range blogDetails {
		g.Go(func() error {
			if err := sem.Acquire(gctx, 1); err != nil {
				return fmt.Errorf("semaphore acquire failed: %w", err)
			}
			defer sem.Release(1)

			parsed, err := ParseBlogContent(blogDetail.Content)
			if err != nil {
				slog.Error("Failed to parse blog content",
					slog.String("file", blogDetail.FileName),
					slog.String("error", err.Error()),
				)
				return nil
			}

			summary, err := repo.SummaryContent(ctx, parsed.Content)
			if err != nil {
				slog.Error("Failed to summarize blog content",
					slog.String("file", blogDetail.FileName),
					slog.String("error", err.Error()),
				)
				return nil
			}

			mu.Lock()
			documents = append(documents, blogsearch.BlogDocument{
				Slug:      blogDetail.FileName,
				URL:       "https://zenn.dev/metalmental/articles/" + blogDetail.FileName,
				Title:     parsed.Title,
				Emoji:     parsed.Emoji,
				Type:      parsed.Type,
				Topics:    parsed.Topics,
				Content:   parsed.Content,
				Summary:   summary,
				CreatedAt: blogDetail.CreatedAt.Format("2006-01-02 15:04:05"),
			})
			mu.Unlock()

			return nil
		})
	}
	if err := g.Wait(); err != nil {
		return nil, fmt.Errorf("failed to build blog documents: %w", err)
	}

	return documents, nil
}

func BuildChunkDocuments(
	ctx context.Context,
	documents []blogsearch.BlogDocument,
	genaiRepo *genai.Repository,
	embeddingModelId string,
) ([]blogsearch.ChunkDocument, error) {
	var flatChunks []chunkItem
	for _, doc := range documents {
		for i, chunk := range chunkingMarkdown(doc.Content) {
			flatChunks = append(flatChunks, chunkItem{doc: doc, idx: i, chunk: chunk})
		}
	}

	const maxConcurrency = 20
	sem := semaphore.NewWeighted(maxConcurrency)
	var mu sync.Mutex
	var chunkDocuments []blogsearch.ChunkDocument
	g, gctx := errgroup.WithContext(ctx)
	for _, item := range flatChunks {
		g.Go(func() error {
			if err := sem.Acquire(gctx, 1); err != nil {
				return fmt.Errorf("semaphore acquire failed: %w", err)
			}
			defer sem.Release(1)

			embedding, err := genaiRepo.GenerateEmbedding(gctx, item.chunk)
			if err != nil {
				slog.Error("Failed to get embedding for chunk",
					slog.String("slug", item.doc.Slug),
					slog.Int("chunk_index", item.idx),
					slog.String("error", err.Error()),
				)
				return nil
			}

			mu.Lock()
			chunkDocuments = append(chunkDocuments, blogsearch.ChunkDocument{
				Slug:           item.doc.Slug,
				URL:            item.doc.URL,
				Title:          item.doc.Title,
				Emoji:          item.doc.Emoji,
				Type:           item.doc.Type,
				Topics:         item.doc.Topics,
				Chunk:          item.chunk,
				ChunkEmbedding: embedding,
				Summary:        item.doc.Summary,
				CreatedAt:      item.doc.CreatedAt,
			})
			mu.Unlock()

			return nil
		})
	}
	if err := g.Wait(); err != nil {
		return nil, fmt.Errorf("failed to generate embeddings: %w", err)
	}

	return chunkDocuments, nil
}

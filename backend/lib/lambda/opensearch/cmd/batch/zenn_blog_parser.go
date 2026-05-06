package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"sync"

	"golang.org/x/sync/errgroup"
	"golang.org/x/sync/semaphore"
	blogsource "metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/cmd/batch/github"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/blogsearch"
)

type ParsedBlog struct {
	Title   string
	Emoji   string
	Type    string
	Topics  []string
	Content string
}

func ParseBlogContent(content string) (ParsedBlog, error) {
	// 改行区切りで行ごとに分割
	lines := strings.Split(content, "\n")
	// 最初の行が "---" (frontmatter) でない場合はエラー
	if strings.TrimSpace(lines[0]) != "---" {
		return ParsedBlog{}, fmt.Errorf("frontmatter opening delimiter not found")
	}

	// 1行目以降で最初に "---" が出現する行をfrontmatterの終了とみなす
	endLine := -1
	for i := 1; i < len(lines); i++ {
		if strings.TrimSpace(lines[i]) == "---" {
			endLine = i
			break
		}
	}
	if endLine == -1 {
		return ParsedBlog{}, fmt.Errorf("frontmatter closing delimiter not found")
	}

	frontmatterLines := lines[1:endLine]

	parsed := ParsedBlog{
		Topics: []string{},
	}

	for _, line := range frontmatterLines {
		// 「:」でキーと値を分割
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		rawVal := strings.TrimSpace(parts[1])

		switch key {
		// title, emoji, typeはstring
		case "title", "emoji", "type":
			val, err := parseString(rawVal)
			if err != nil {
				slog.Error("Failed to parse frontmatter field",
					slog.String("key", key),
					slog.String("raw", rawVal),
					slog.String("error", err.Error()),
				)
				continue
			}
			switch key {
			case "title":
				parsed.Title = val
			case "emoji":
				parsed.Emoji = val
			case "type":
				parsed.Type = val
			}
		// topicsはlist
		case "topics":
			val, err := parseStringList(rawVal)
			if err != nil {
				slog.Error("Failed to parse topics field",
					slog.String("raw", rawVal),
					slog.String("error", err.Error()),
				)
				continue
			}
			parsed.Topics = val
		}
	}

	parsed.Content = strings.TrimLeft(strings.Join(lines[endLine+1:], "\n"), "\n")

	return parsed, nil
}

func parseStringList(rawVal string) ([]string, error) {
	if len(rawVal) == 0 {
		return []string{}, fmt.Errorf("empty value for string list")
	}

	var result []string
	if err := json.Unmarshal([]byte(rawVal), &result); err != nil {
		return []string{}, fmt.Errorf("failed to parse string list: %w", err)
	}
	return result, nil
}

func parseString(rawVal string) (string, error) {
	if len(rawVal) == 0 {
		return "", fmt.Errorf("empty value for string")
	}

	// 1文字目が"ダブルクォーテーションであること確認
	if rawVal[0] != '"' {
		return "", fmt.Errorf("value does not start with double quote: %s", rawVal)
	}
	// 2文字目以降で最初の"ダブルクォーテーションが閉じる位置を探す
	rest := rawVal[1:]
	idx := strings.Index(rest, `"`)
	if idx == -1 {
		return "", fmt.Errorf("closing double quote not found: %s", rawVal)
	}
	// ダブルクォーテーションで囲まれた部分を返却
	return rest[:idx], nil
}

func BuildBlogDocuments(ctx context.Context, blogDetails []blogsource.GitHubBlogDetail) ([]blogsearch.BlogDocument, error) {
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

			mu.Lock()
			documents = append(documents, blogsearch.BlogDocument{
				Slug:      blogDetail.FileName,
				URL:       "https://zenn.dev/metalmental/articles/" + blogDetail.FileName,
				Title:     parsed.Title,
				Emoji:     parsed.Emoji,
				Type:      parsed.Type,
				Topics:    parsed.Topics,
				Content:   parsed.Content,
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

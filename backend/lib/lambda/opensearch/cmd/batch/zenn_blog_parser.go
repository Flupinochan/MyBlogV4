package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/retry"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime/types"
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

func SummaryContent(ctx context.Context, modelId string, userPrompt string) (string, error) {
	// Prepare the input
	systemPrompt := `読者が学べる内容を把握できるよう、以下の制約で技術ブログの概要を作成してください
- 5文程度で構成すること
- この記事では、この技術ブログでは、などの前置きは禁止
- しています、されています、などの受け身の表現は禁止
- します、しました、などのブログの投稿者視点での能動的、宣言的な文章にすること`

	systemContentBlock := &types.SystemContentBlockMemberText{
		Value: systemPrompt,
	}

	var userContentBlock = types.ContentBlockMemberText{
		Value: userPrompt,
	}

	var message = types.Message{
		Content: []types.ContentBlock{&userContentBlock},
		Role:    types.ConversationRoleUser,
	}
	var converseInput = bedrockruntime.ConverseInput{
		ModelId:  aws.String(modelId),
		System:   []types.SystemContentBlock{systemContentBlock},
		Messages: []types.Message{message},
	}

	// Create an AWS Config
	cfg, err := config.LoadDefaultConfig(ctx,
		config.WithRetryer(func() aws.Retryer {
			var r aws.Retryer = retry.NewStandard()
			r = retry.AddWithMaxAttempts(r, 3)
			r = retry.AddWithMaxBackoffDelay(r, 5*time.Second)
			return r
		}),
	)
	if err != nil {
		return "", fmt.Errorf("unable to load AWS SDK config: %w", err)
	}

	// Call the Converse API
	client := bedrockruntime.NewFromConfig(cfg)
	response, err := client.Converse(ctx, &converseInput)
	if err != nil {
		return "", fmt.Errorf("failed to call Bedrock Converse API: %w", err)
	}

	// Process the response
	responseMsg, ok := response.Output.(*types.ConverseOutputMemberMessage)
	if !ok || len(responseMsg.Value.Content) == 0 {
		return "", fmt.Errorf("unexpected response format from Bedrock")
	}
	textBlock, ok := responseMsg.Value.Content[0].(*types.ContentBlockMemberText)
	if !ok {
		return "", fmt.Errorf("unexpected content block type from Bedrock")
	}

	slog.Debug("Summary", slog.String("text", textBlock.Value))

	return textBlock.Value, nil
}

func BuildBlogDocuments(ctx context.Context, blogDetails []blogsource.GitHubBlogDetail, modelId string) ([]blogsearch.BlogDocument, error) {
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

			summary, err := SummaryContent(ctx, modelId, parsed.Content)
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

package main

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/go-github/v85/github"
	"github.com/hashicorp/go-retryablehttp"
)

type GithubConfig struct {
	Owner       string // Flupinochan
	Repo        string // zenn-content
	Path        string // articles
	AccessToken string
}

// Initialize Http Client
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

func NewGitHubHttpClient(config *GithubConfig, client *http.Client) *github.Client {
	return github.NewClient(client).WithAuthToken(config.AccessToken)
}

// GitHub zenn-contentリポジトリのarticlesディレクトリ内のファイル一覧を取得
type GitHubBlogFile struct {
	FileName    string
	FilePath    string
	DownloadUrl string
}

func FetchGitHubBlogFiles(ctx context.Context, client *github.Client, config *GithubConfig) ([]GitHubBlogFile, error) {
	_, directoryContent, _, err := client.Repositories.GetContents(ctx, config.Owner, config.Repo, config.Path, nil)

	if err != nil {
		return nil, fmt.Errorf("failed to fetch directory contents from GitHub: %w", err)
	}

	var files []GitHubBlogFile
	for _, item := range directoryContent {
		if item.GetType() != "file" {
			continue
		}

		files = append(files, GitHubBlogFile{
			FileName:    item.GetName(),
			FilePath:    item.GetPath(),
			DownloadUrl: item.GetDownloadURL(),
		})
	}

	if len(files) >= 1000 {
		slog.Warn("GitHub API limit reached (1,000 items). Some files may not have been fetched.", "path", config.Path)
	}

	return files, nil
}

// 指定されたファイルの最初のコミット日時を取得 (ブログの作成日として利用)
func fetchInitialCommitDate(ctx context.Context, client *github.Client, config *GithubConfig, filePath string) (time.Time, error) {
	opts := &github.CommitsListOptions{
		Path: filePath,
		ListOptions: github.ListOptions{
			PerPage: 1,
		},
	}

	commits, resp, err := client.Repositories.ListCommits(ctx, config.Owner, config.Repo, opts)
	if err != nil {
		return time.Time{}, fmt.Errorf("failed to fetch initial commit info for %s: %w", filePath, err)
	}

	if len(commits) == 0 {
		return time.Time{}, fmt.Errorf("no commits found for file: %s", filePath)
	}

	// 複数ページ存在する場合は、最後のページから再取得
	if resp.LastPage > 0 {
		opts.Page = resp.LastPage
		commits, _, err = client.Repositories.ListCommits(ctx, config.Owner, config.Repo, opts)
		if err != nil {
			return time.Time{}, fmt.Errorf("failed to fetch first commit for %s: %w", filePath, err)
		}
		if len(commits) == 0 {
			return time.Time{}, fmt.Errorf("no commits found on last page for file: %s", filePath)
		}
	}

	// 最初のコミットはリストの最後の要素
	firstCommit := commits[len(commits)-1]

	return firstCommit.GetCommit().GetAuthor().GetDate().Time, nil
}

// DownloadUrlを使用してファイルの内容を取得
func FetchBlogBody(ctx context.Context, client *http.Client, file GitHubBlogFile) (string, error) {
	if file.DownloadUrl == "" {
		return "", fmt.Errorf("download URL is empty for file: %s", file.FileName)
	}

	req, err := http.NewRequestWithContext(ctx, "GET", file.DownloadUrl, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request for %s: %w", file.FileName, err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to fetch body from GitHub (%s): %w", file.FileName, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected status code %d for file %s", resp.StatusCode, file.FileName)
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body for %s: %w", file.FileName, err)
	}

	return string(bodyBytes), nil
}

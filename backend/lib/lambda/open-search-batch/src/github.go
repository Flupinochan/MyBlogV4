package main

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/bradleyfalzon/ghinstallation/v2"
	"github.com/google/go-github/v85/github"
	"github.com/hashicorp/go-retryablehttp"
	"golang.org/x/sync/errgroup"
	"golang.org/x/sync/semaphore"
)

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

func NewGitHubHttpClient(config *AppConfig, client *http.Client) (*github.Client, error) {
	tr := client.Transport
	if tr == nil {
		tr = http.DefaultTransport
	}

	itr, err := ghinstallation.New(
		tr,
		config.GitHubAppsId,
		config.GitHubInstallationId,
		[]byte(config.GithubAppsPrivateKey),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create GitHub Apps transport: %w", err)
	}

	githubAuthenticatedClient := *client
	githubAuthenticatedClient.Transport = itr

	return github.NewClient(&githubAuthenticatedClient), nil
}

// GitHub zenn-contentリポジトリのarticlesディレクトリ内のファイル一覧を取得
type GitHubBlogFile struct {
	FileName    string
	FilePath    string
	DownloadUrl string
}

func GetBlogFiles(ctx context.Context, client *github.Client, config *AppConfig) ([]GitHubBlogFile, error) {
	_, directoryContent, _, err := client.Repositories.GetContents(ctx, config.GithubOwner, config.GithubRepo, config.GithubPath, nil)

	if err != nil {
		return nil, fmt.Errorf("failed to fetch directory contents from GitHub: %w", err)
	}

	var files []GitHubBlogFile
	for _, item := range directoryContent {
		if item.GetType() != "file" {
			continue
		}

		if !strings.HasSuffix(item.GetName(), ".md") {
			continue
		}

		files = append(files, GitHubBlogFile{
			FileName:    strings.TrimSuffix(item.GetName(), ".md"),
			FilePath:    item.GetPath(),
			DownloadUrl: item.GetDownloadURL(),
		})
	}

	if len(files) >= 1000 {
		slog.Warn("GitHub API limit reached (1,000 items). Some files may not have been fetched.", slog.String("path", config.GithubPath))
	}

	return files, nil
}

// 指定されたファイルの最初のコミット日時を取得 (ブログの作成日として利用)
type GetFirstCommitDateParams struct {
	FilePath string
}

func getFirstCommitDate(ctx context.Context, client *github.Client, config *AppConfig, params GetFirstCommitDateParams) (time.Time, error) {
	opts := &github.CommitsListOptions{
		Path: params.FilePath,
		ListOptions: github.ListOptions{
			PerPage: 1,
		},
	}

	commits, resp, err := client.Repositories.ListCommits(ctx, config.GithubOwner, config.GithubRepo, opts)
	if err != nil {
		return time.Time{}, fmt.Errorf("failed to fetch initial commit info for %s: %w", params.FilePath, err)
	}

	if len(commits) == 0 {
		return time.Time{}, fmt.Errorf("no commits found for file: %s", params.FilePath)
	}

	// 複数ページ存在する場合は、最後のページから再取得
	if resp.LastPage > 0 {
		opts.Page = resp.LastPage
		commits, _, err = client.Repositories.ListCommits(ctx, config.GithubOwner, config.GithubRepo, opts)
		if err != nil {
			return time.Time{}, fmt.Errorf("failed to fetch first commit for %s: %w", params.FilePath, err)
		}
		if len(commits) == 0 {
			return time.Time{}, fmt.Errorf("no commits found on last page for file: %s", params.FilePath)
		}
	}

	// 最初のコミットはリストの最後の要素
	firstCommit := commits[len(commits)-1]

	return firstCommit.GetCommit().GetAuthor().GetDate().Time, nil
}

// DownloadUrlを使用してファイルの内容を取得
func GetBlogBody(ctx context.Context, client *http.Client, file GitHubBlogFile) (string, error) {
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

type GitHubBlogDetail struct {
	FileName    string
	FilePath    string
	DownloadUrl string
	Content     string
	CreatedAt   time.Time
}

// メイン処理
func GetAllBlogDetails(ctx context.Context, ghClient *github.Client, httpClient *http.Client, config *AppConfig) ([]GitHubBlogDetail, error) {
	// 1. ブログファイル一覧を取得
	baseFiles, err := GetBlogFiles(ctx, ghClient, config)
	if err != nil {
		return nil, err
	}

	// 以下でGitHub APIのレートリミットを参考に設定 (思ったより余裕はありそう)
	// curl -H "Authorization: Bearer YOUR_TOKEN" https://api.github.com/rate_limit
	const maxConcurrency = 30
	sem := semaphore.NewWeighted(maxConcurrency)

	var mu sync.Mutex
	var details []GitHubBlogDetail

	g, gctx := errgroup.WithContext(ctx)

	for _, file := range baseFiles {
		g.Go(func() error {
			if err := sem.Acquire(gctx, 1); err != nil {
				return fmt.Errorf("semaphore acquire failed: %w", err)
			}
			defer sem.Release(1)

			// 2. ブログファイルのBodyを取得
			body, err := GetBlogBody(gctx, httpClient, file)
			if err != nil {
				slog.Error("failed to fetch body", slog.String("file", file.FileName), slog.Any("error", err))
				return nil
			}

			// 3. ブログファイルの最初のコミット日時を取得
			createdAt, err := getFirstCommitDate(gctx, ghClient, config, GetFirstCommitDateParams{
				FilePath: file.FilePath,
			})
			if err != nil {
				slog.Error("failed to fetch commit date", slog.String("file", file.FileName), slog.Any("error", err))
				return nil
			}

			// 3. データを統合
			mu.Lock()
			details = append(details, GitHubBlogDetail{
				FileName:    file.FileName,
				FilePath:    file.FilePath,
				DownloadUrl: file.DownloadUrl,
				Content:     body,
				CreatedAt:   createdAt,
			})
			mu.Unlock()

			return nil
		})
	}

	if err := g.Wait(); err != nil {
		return nil, err
	}

	slog.Debug("Get all blog details (first 3 items)",
		slog.String("count", fmt.Sprintf("%d", len(details))),
		slog.Any("samples", details[:min(3, len(details))]),
	)

	return details, nil
}

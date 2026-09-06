package blogsource

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/google/go-github/v85/github"
	"golang.org/x/sync/errgroup"
	"golang.org/x/sync/semaphore"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/cmd/batch/myhttp"
)

type BlogService struct {
	httpRepo   *myhttp.HttpRepository
	githubRepo *GitHubRepository
}

func NewBlogService(httpRepo *myhttp.HttpRepository, githubRepo *GitHubRepository) *BlogService {
	return &BlogService{
		httpRepo:   httpRepo,
		githubRepo: githubRepo,
	}
}

// GitHub zenn-contentリポジトリのarticlesディレクトリ内のファイル一覧を取得
type gitHubBlogFile struct {
	fileName    string
	filePath    string
	downloadUrl string
}

func (s *BlogService) getBlogFiles(ctx context.Context) ([]gitHubBlogFile, error) {
	_, directoryContent, _, err := s.githubRepo.client.Repositories.GetContents(
		ctx,
		s.githubRepo.cfg.Owner,
		s.githubRepo.cfg.Repo,
		s.githubRepo.cfg.Path,
		nil,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to fetch directory contents from GitHub: %w", err)
	}

	var files []gitHubBlogFile
	for _, item := range directoryContent {
		if item.GetType() != "file" {
			continue
		}

		if !strings.HasSuffix(item.GetName(), ".md") {
			continue
		}

		files = append(files, gitHubBlogFile{
			fileName:    strings.TrimSuffix(item.GetName(), ".md"),
			filePath:    item.GetPath(),
			downloadUrl: item.GetDownloadURL(),
		})
	}

	if len(files) >= 1000 {
		slog.Warn("GitHub API limit reached (1,000 items). Some files may not have been fetched.", slog.String("path", s.githubRepo.cfg.Path))
	}

	return files, nil
}

// 指定されたファイルの最初のコミット日時を取得 (ブログの作成日として利用)
type getFirstCommitDateParams struct {
	filePath string
}

func (r *GitHubRepository) getFirstCommitDate(ctx context.Context, params getFirstCommitDateParams) (time.Time, error) {
	opts := &github.CommitsListOptions{
		Path: params.filePath,
		ListOptions: github.ListOptions{
			PerPage: 1,
		},
	}

	commits, resp, err := r.client.Repositories.ListCommits(ctx, r.cfg.Owner, r.cfg.Repo, opts)
	if err != nil {
		return time.Time{}, fmt.Errorf("failed to fetch initial commit info for %s: %w", params.filePath, err)
	}

	if len(commits) == 0 {
		return time.Time{}, fmt.Errorf("no commits found for file: %s", params.filePath)
	}

	// 複数ページ存在する場合は、最後のページから再取得
	if resp.LastPage > 0 {
		opts.Page = resp.LastPage
		commits, _, err = r.client.Repositories.ListCommits(ctx, r.cfg.Owner, r.cfg.Repo, opts)
		if err != nil {
			return time.Time{}, fmt.Errorf("failed to fetch first commit for %s: %w", params.filePath, err)
		}
		if len(commits) == 0 {
			return time.Time{}, fmt.Errorf("no commits found on last page for file: %s", params.filePath)
		}
	}

	// 最初のコミットはリストの最後の要素
	firstCommit := commits[len(commits)-1]

	return firstCommit.GetCommit().GetAuthor().GetDate().Time, nil
}

// DownloadUrlを使用してファイルの内容を取得
func (s *BlogService) getBlogBody(ctx context.Context, file gitHubBlogFile) (string, error) {
	if file.downloadUrl == "" {
		return "", fmt.Errorf("download URL is empty for file: %s", file.fileName)
	}

	req, err := http.NewRequestWithContext(ctx, "GET", file.downloadUrl, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request for %s: %w", file.fileName, err)
	}

	resp, err := s.httpRepo.Client().Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to fetch body from GitHub (%s): %w", file.fileName, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected status code %d for file %s", resp.StatusCode, file.fileName)
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body for %s: %w", file.fileName, err)
	}

	return string(bodyBytes), nil
}

// メイン処理
type GitHubBlogDetail struct {
	FileName    string
	FilePath    string
	DownloadUrl string
	Content     string
	CreatedAt   time.Time
}

func (s *BlogService) GetAllBlogDetails(ctx context.Context) ([]GitHubBlogDetail, error) {
	// 1. ブログファイル一覧を取得
	baseFiles, err := s.getBlogFiles(ctx)
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
			body, err := s.getBlogBody(gctx, file)
			if err != nil {
				slog.Error("failed to fetch body", slog.String("file", file.fileName), slog.Any("error", err))
				return nil
			}

			// 3. ブログファイルの最初のコミット日時を取得
			createdAt, err := s.githubRepo.getFirstCommitDate(gctx, getFirstCommitDateParams{
				filePath: file.filePath,
			})
			if err != nil {
				slog.Error("failed to fetch commit date", slog.String("file", file.fileName), slog.Any("error", err))
				return nil
			}

			// 3. データを統合
			mu.Lock()
			details = append(details, GitHubBlogDetail{
				FileName:    file.fileName,
				FilePath:    file.filePath,
				DownloadUrl: file.downloadUrl,
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

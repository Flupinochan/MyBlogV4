package blogsource

import (
	"fmt"
	"net/http"

	"github.com/bradleyfalzon/ghinstallation/v2"
	"github.com/google/go-github/v85/github"
)

func NewGitHubClient(config *GitHubConfig, client *http.Client) (*github.Client, error) {
	tr := client.Transport
	if tr == nil {
		tr = http.DefaultTransport
	}

	itr, err := ghinstallation.New(
		tr,
		config.AppsId,
		config.InstallationId,
		[]byte(config.AppsPrivateKey),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create GitHub Apps transport: %w", err)
	}

	githubAuthenticatedClient := *client
	githubAuthenticatedClient.Transport = itr

	return github.NewClient(&githubAuthenticatedClient), nil
}

type GitHubRepository struct {
	cfg    GitHubConfig
	client *github.Client
}

func NewGitHubRepository(cfg GitHubConfig, client *github.Client) *GitHubRepository {
	return &GitHubRepository{cfg: cfg, client: client}
}

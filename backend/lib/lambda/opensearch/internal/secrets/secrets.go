package secrets

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager"
)

// Client wraps the AWS Secrets Manager client for retrieving secret values.
type Client struct {
	sm *secretsmanager.Client
}

// NewClient creates a new Secrets Manager client using the default AWS config.
func NewClient(ctx context.Context) (*Client, error) {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config for Secrets Manager: %w", err)
	}
	return &Client{sm: secretsmanager.NewFromConfig(cfg)}, nil
}

// GetSecretValue retrieves the plaintext value of a secret by its name or ARN.
func (c *Client) GetSecretValue(ctx context.Context, secretName string) (string, error) {
	out, err := c.sm.GetSecretValue(ctx, &secretsmanager.GetSecretValueInput{
		SecretId: &secretName,
	})
	if err != nil {
		return "", fmt.Errorf("failed to get secret %q: %w", secretName, err)
	}
	if out.SecretString == nil {
		return "", fmt.Errorf("secret %q has no string value", secretName)
	}
	return *out.SecretString, nil
}

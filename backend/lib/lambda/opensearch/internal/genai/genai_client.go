package genai

import (
	"context"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/retry"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
)

type GenAIConfig struct {
	MaxAttempts     int
	MaxBackoffDelay time.Duration
}

// func NewGenAIClient(cfg *GenAIConfig) (*bedrockruntime.Client, error) {
func NewGenAIClient(cfg *GenAIConfig) (*bedrockruntime.Client, error) {
	// Config初期化時は空のContextを利用し、Client呼び出し時に実際のContextを利用
	awsCfg, err := config.LoadDefaultConfig(
		context.TODO(),
		config.WithRetryer(func() aws.Retryer {
			var r aws.Retryer = retry.NewStandard()
			r = retry.AddWithMaxAttempts(r, cfg.MaxAttempts)
			r = retry.AddWithMaxBackoffDelay(r, cfg.MaxBackoffDelay)
			return r
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("unable to load AWS SDK config: %w", err)
	}
	return bedrockruntime.NewFromConfig(awsCfg), nil
}

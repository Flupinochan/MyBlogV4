package genai

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime/types"
)

type Repository struct {
	client           *bedrockruntime.Client
	modelId          string
	modelIdEmbedding string
}

func NewRepository(client *bedrockruntime.Client, modelId string, modelIdEmbedding string) *Repository {
	return &Repository{client: client, modelId: modelId, modelIdEmbedding: modelIdEmbedding}
}

func (r *Repository) SummaryContent(c context.Context, userPrompt string) (string, error) {
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
		ModelId:  aws.String(r.modelId),
		System:   []types.SystemContentBlock{systemContentBlock},
		Messages: []types.Message{message},
	}

	response, err := r.client.Converse(c, &converseInput)
	if err != nil {
		return "", fmt.Errorf("failed to call Bedrock Converse API: %w", err)
	}

	responseMsg, ok := response.Output.(*types.ConverseOutputMemberMessage)
	if !ok || len(responseMsg.Value.Content) == 0 {
		return "", fmt.Errorf("unexpected response format from Bedrock")
	}
	textBlock, ok := responseMsg.Value.Content[0].(*types.ContentBlockMemberText)
	if !ok {
		return "", fmt.Errorf("unexpected content block type from Bedrock")
	}

	return textBlock.Value, nil
}

// https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-titan-embed-text.html
type EmbeddingRequest struct {
	InputText      string   `json:"inputText"`
	Dimensions     int      `json:"dimensions"`
	Normalize      bool     `json:"normalize"`
	EmbeddingTypes []string `json:"embeddingTypes"`
}

type EmbeddingResponse struct {
	Embedding           []float64        `json:"embedding"`
	InputTextTokenCount int              `json:"inputTextTokenCount"`
	EmbeddingsByType    EmbeddingsByType `json:"embeddingsByType"`
}

type EmbeddingsByType struct {
	Binary []int     `json:"binary"`
	Float  []float64 `json:"float"`
}

func (r *Repository) GenerateEmbedding(ctx context.Context, chunk string) ([]float64, error) {
	request := EmbeddingRequest{
		InputText:      chunk,
		Dimensions:     1024,
		Normalize:      true,
		EmbeddingTypes: []string{"float"},
	}

	requestBytes, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal embedding request: %w", err)
	}

	response, err := r.client.InvokeModel(ctx, &bedrockruntime.InvokeModelInput{
		Body:        requestBytes,
		ModelId:     aws.String(r.modelIdEmbedding),
		ContentType: aws.String("application/json"),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to call Bedrock InvokeModel API: %w", err)
	}

	var embeddingResponse EmbeddingResponse
	err = json.Unmarshal(response.Body, &embeddingResponse)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal embedding response: %w", err)
	}

	return embeddingResponse.Embedding, nil
}

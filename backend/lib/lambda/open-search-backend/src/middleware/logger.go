package middleware

import (
	"context"
	"log/slog"
	"os"

	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/config"
)

// OpenSearch API Error Response
type OpenSearchError struct {
	StatusCode int    // HTTP Response Status Code
	Status     string // HTTP Response Status Text
	Body       string // HTTP Response Body
	Message    string // 独自のエラーメッセージ
}

// Enabled (ログレベル判定に必要)
func (h *OpenSearchLogHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return h.Handler.Enabled(ctx, level)
}

// Handler
type OpenSearchLogHandler struct {
	slog.Handler
}

func (h *OpenSearchLogHandler) Handle(ctx context.Context, r slog.Record) error {
	r.Attrs(func(a slog.Attr) bool {
		if a.Key == "error" {
			// OpenSearchErrorの場合は、StatusCodeやStatus、Bodyなどをログに追加
			if osErr, ok := a.Value.Any().(*OpenSearchError); ok {
				r.AddAttrs(
					slog.Int("status_code", osErr.StatusCode),
					slog.String("status_text", osErr.Status),
					slog.String("detail", osErr.Body),
				)
			}
		}
		return true
	})
	return h.Handler.Handle(ctx, r)
}

// ロガー定義
func InitLogger(config *config.AppConfig) {
	option := &slog.HandlerOptions{
		Level:     config.Level,
		AddSource: true,
	}

	baseHandler := slog.NewJSONHandler(os.Stdout, option)
	customHandler := &OpenSearchLogHandler{Handler: baseHandler}

	logger := slog.New(customHandler)
	// logger := logger.With("memo", "共通メッセージ")

	// slogのルートデフォルトロガーに設定
	// 以降、ロガーインスタンスを明示的に渡さなくても、slog.Infoなどでログ出力できるようになる
	slog.SetDefault(logger)
}

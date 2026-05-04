package main

import (
	"context"
	"log/slog"
	"os"
)

// OpenSearch API Error Response
type OpenSearchError struct {
	StatusCode int    // HTTP Response Status Code
	Status     string // HTTP Response Status Text
	Body       string // HTTP Response Body
	Message    string // 独自のエラーメッセージ
}

// Logger Handler
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

// Logger Config
type LoggerConfig struct {
	Level slog.Level
}

// ロガー定義
func InitLogger(config *AppConfig) {
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

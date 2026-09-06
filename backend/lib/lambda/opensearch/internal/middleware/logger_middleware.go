package middleware

import (
	"context"
	"log/slog"
	"strconv"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
)

type ctxKey struct{}

var loggerKey = ctxKey{}

// Get logger from context. If not found, return default logger.
func GetLogger(ctx context.Context) *slog.Logger {
	if l, ok := ctx.Value(loggerKey).(*slog.Logger); ok {
		return l
	}
	return slog.Default()
}

func LoggerMiddleware(logger *slog.Logger) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		start := time.Now()
		reqID := uuid.NewString()
		reqLogger := logger.With(
			slog.String("request_id", reqID),
			slog.String("method", ctx.Method()),
			slog.String("path", ctx.URL().Path),
		)

		// loggerをcontextにセット
		// ★仕組みとしては各処理でcontextからloggerを取り出して使う
		ctx = huma.WithValue(ctx, loggerKey, reqLogger)

		next(ctx)

		status := ctx.Status()
		latency := time.Since(start)

		var contentLength int64 = -1
		if cl := ctx.Header("Content-Length"); cl != "" {
			if n, err := strconv.ParseInt(cl, 10, 64); err == nil {
				contentLength = n
			}
		}

		switch {
		case status >= 500:
			reqLogger.Error("request completed with server error",
				slog.Int("status", status),
				slog.Duration("latency", latency),
				slog.String("client_ip", ctx.Header("X-Forwarded-For")),
				slog.String("host", ctx.Host()),
				slog.Int64("content_length", contentLength),
			)
		case status >= 400:
			reqLogger.Warn("request completed with client error",
				slog.Int("status", status),
				slog.Duration("latency", latency),
				slog.String("client_ip", ctx.Header("X-Forwarded-For")),
				slog.String("host", ctx.Host()),
				slog.Int64("content_length", contentLength),
			)
		default:
			reqLogger.Info("request completed successfully",
				slog.Int("status", status),
				slog.Duration("latency", latency),
			)
		}
	}
}

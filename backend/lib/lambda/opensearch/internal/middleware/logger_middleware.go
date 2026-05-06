package middleware

import (
	"context"
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
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

func LoggerMiddleware(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// request_id生成
		reqID := uuid.NewString()

		// リクエスト単位のloggerを作成
		reqLogger := logger.With(
			slog.String("request_id", reqID),
			slog.String("method", c.Request.Method),
			slog.String("path", c.Request.URL.Path),
		)

		// loggerをcontextにセット
		// ★仕組みとしては各処理でcontextからloggerを取り出して使う
		ctx := context.WithValue(c.Request.Context(), loggerKey, reqLogger)
		c.Request = c.Request.WithContext(ctx)

		// リクエスト前
		c.Next()

		// リクエスト後
		status := c.Writer.Status()

		switch {
		case len(c.Errors) > 0:
			for _, err := range c.Errors {
				reqLogger.Error("request completed with errors",
					slog.Duration("latency", time.Since(start)),
					slog.String("client_ip", c.ClientIP()),
					slog.String("host", c.Request.Host),
					slog.Int64("content_length", c.Request.ContentLength),
					slog.Int("status", status),
					slog.Int("body_size", c.Writer.Size()),
					slog.String("error_message", err.Error()),
				)
			}
		case status >= 500:
			reqLogger.Error("request completed with server error",
				slog.Duration("latency", time.Since(start)),
				slog.String("client_ip", c.ClientIP()),
				slog.String("host", c.Request.Host),
				slog.Int64("content_length", c.Request.ContentLength),
				slog.Int("status", status),
				slog.Int("body_size", c.Writer.Size()),
			)
		case status >= 400:
			reqLogger.Warn("request completed with client error",
				slog.Duration("latency", time.Since(start)),
				slog.String("client_ip", c.ClientIP()),
				slog.String("host", c.Request.Host),
				slog.Int64("content_length", c.Request.ContentLength),
				slog.Int("status", status),
				slog.Int("body_size", c.Writer.Size()),
			)
		default:
			reqLogger.Info("request completed successfully",
				slog.Duration("latency", time.Since(start)),
				slog.Int("status", status),
			)
		}
	}
}

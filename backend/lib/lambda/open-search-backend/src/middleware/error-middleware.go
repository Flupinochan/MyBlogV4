package middleware

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

type AppError struct {
	Status  int    `json:"-"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (e *AppError) Error() string {
	return e.Message
}

var (
	ErrClient   = &AppError{Status: 400, Code: "BAD_REQUEST", Message: "invalid request"}
	ErrNotFound = &AppError{Status: 404, Code: "NOT_FOUND", Message: "resource not found"}
	ErrServer   = &AppError{Status: 500, Code: "INTERNAL_SERVER_ERROR", Message: "an unexpected error occurred"}
)

// handlerでは以下どちらかを実行することを想定
// 1. 正常時: c.JSON
// 2. エラー時: c.Errors

// serviceでのエラー時は以下を返却し、クライアント or サーバ側 どちらに原因があるか最低限伝える
// ※+αで404とか必要に応じて定義
// 1. クライアント側のエラー: ErrClient
// 2. サーバー側のエラー: ErrServer

// c.Errorsをc.JSONに変換するミドルウェア
func ErrorHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		if len(c.Errors) == 0 {
			return
		}

		err := c.Errors.Last().Err
		var appErr *AppError
		if errors.As(err, &appErr) {
			c.JSON(appErr.Status, gin.H{
				"success": false,
				"error":   gin.H{"code": appErr.Code, "message": appErr.Message},
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   gin.H{"code": "INTERNAL", "message": "an unexpected error occurred"},
			})
		}
	}
}

package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humago"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/blogsearch"
	"metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src/internal/router"
)

func main() {
	mux := http.NewServeMux()
	api := humago.New(mux, huma.DefaultConfig("Blog Search API", "1.0.0"))
	router.RegisterRoutes(api, blogsearch.NewHandler(nil), nil)

	b, err := json.MarshalIndent(api.OpenAPI(), "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to marshal OpenAPI spec: %v\n", err)
		os.Exit(1)
	}
	fmt.Println(string(b))
}

package blogsearch

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

func OpenSearchRoutes(api huma.API, h *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-blog-by-slug",
		Method:      http.MethodGet,
		Path:        "/blogs/{slug}",
		Summary:     "Get a blog post by slug",
		Tags:        []string{"blogs"},
	}, h.GetBlogBySlug)

	huma.Register(api, huma.Operation{
		OperationID: "list-blogs",
		Method:      http.MethodGet,
		Path:        "/blogs",
		Summary:     "List blog posts",
		Tags:        []string{"blogs"},
	}, h.ListBlogs)

	huma.Register(api, huma.Operation{
		OperationID: "list-topics",
		Method:      http.MethodGet,
		Path:        "/topics",
		Summary:     "List all topics",
		Tags:        []string{"topics"},
	}, h.ListTopics)
}

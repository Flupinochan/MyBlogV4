# OpenSearch Highlight Display Design

**Date:** 2026-05-09  
**Scope:** Frontend only — BlogSection.tsx + blog.css  
**Status:** Approved

## Background

OpenSearch's highlight feature is already fully implemented in the backend:
- `ListBlogs` in `opensearch_service.go` requests highlights for `title` and `content` fields when a search query is provided (fragment_size: 150, number_of_fragments: 3)
- The `BlogSearchResultItem` struct includes `Highlights map[string][]string`
- The API response already sends highlights to the frontend
- `BlogItem` in `BlogSection.tsx` already has `highlights?: Record<string, string[]>`

The gap is that the frontend never renders the highlights data.

## Goal

Display OpenSearch content highlights in blog search result cards so users can see exactly which part of the article matched their query.

## Architecture

No backend changes required. All changes are in:
- `frontend/src/components/home/blog/BlogSection.tsx`
- `frontend/src/components/home/blog/blog.css`
- `frontend/package.json` (add dompurify + @types/dompurify)

### Data Flow

```
OpenSearch API Response
  └── highlights: { "content": ["...片<em>検索語</em>...", ...] }
        │
        ▼ (already included in BlogItem)
  BlogSection.tsx
        │
        ├── Summary (always shown)
        └── HighlightSnippet (shown only during search + content highlights exist)
              └── DOMPurify.sanitize(fragments.join(" ... ")) → dangerouslySetInnerHTML
```

## Component Design

### New: `HighlightSnippet` component (inside BlogSection.tsx)

```tsx
import DOMPurify from "dompurify";

function HighlightSnippet({ fragments }: { fragments: string[] }) {
  if (fragments.length === 0) return null;
  const raw = fragments.join(" ... ");
  const html = DOMPurify.sanitize(raw, { ALLOWED_TAGS: ["em"] });
  return (
    <p
      className="highlight-snippet text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-3 mt-2"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
```

- `ALLOWED_TAGS: ["em"]` — OpenSearch が生成するタグは `<em>` のみ。それ以外は全てストリップ。
- `DOMPurify.sanitize` により、インデックス内に万一HTMLが混入していても無害化される。

### Rendering condition (in blog card)

Display `HighlightSnippet` below the Summary section when:
- `isSearching === true` (search query is active)
- `blog.highlights?.content` has at least one fragment

### Styling (blog.css additions)

```css
.highlight-snippet em {
  font-style: normal;
  font-weight: 600;
  color: #7c3aed;           /* violet-600 */
  background-color: #ede9fe; /* violet-100 */
  border-radius: 2px;
  padding: 0 2px;
}

.dark .highlight-snippet em {
  color: #c4b5fd;                      /* violet-300 */
  background-color: rgba(109, 40, 217, 0.3); /* violet-900/30 */
}
```

## Dependencies

Add to `frontend/package.json`:
```
dompurify
@types/dompurify
```

Install via `bun add dompurify` and `bun add -d @types/dompurify`.

## Display Logic Summary

| State | Summary | HighlightSnippet |
|-------|---------|-----------------|
| No search query | Shown | Hidden |
| Search query, no highlights | Shown | Hidden |
| Search query, highlights available | Shown | Shown below summary |

## Out of Scope

- Title highlight rendering (title field highlights from OpenSearch are not displayed)
- Vector search highlights (KNN search does not support highlights in OpenSearch)
- Backend changes

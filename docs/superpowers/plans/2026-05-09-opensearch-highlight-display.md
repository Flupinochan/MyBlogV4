# OpenSearch Highlight Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display OpenSearch content highlight snippets in blog search result cards so users see which part of each article matched their query.

**Architecture:** Pure frontend change. The backend already requests highlights from OpenSearch and includes them in the API response (`highlights.content: string[]`). We add a `HighlightSnippet` React component that renders those fragments below the existing summary. The component joins fragments with ` ... `, sanitizes the OpenSearch-generated `<em>` tags with DOMPurify (ALLOWED_TAGS: ["em"]) before rendering as HTML.

**Tech Stack:** React 19, TypeScript, Tailwind v4, DOMPurify, Bun (package manager), Astro

---

## File Map

| File | Change |
|------|--------|
| `frontend/package.json` | Add `dompurify` + `@types/dompurify` |
| `frontend/bun.lock` | Auto-updated by `bun add` |
| `frontend/src/components/home/blog/blog.css` | Add `.highlight-snippet em` styles (light + dark mode) |
| `frontend/src/components/home/blog/BlogSection.tsx` | Add `HighlightSnippet` component + render in card |

---

## Task 1: Install DOMPurify

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/bun.lock` (auto)

- [ ] **Step 1: Install packages**

```bash
cd /home/metalmental/MyBlogV4/frontend
bun add dompurify
bun add -d @types/dompurify
```

Expected output: packages added, `bun.lock` updated.

- [ ] **Step 2: Verify the import resolves**

```bash
cd /home/metalmental/MyBlogV4/frontend
node -e "import('dompurify').then(() => console.log('ok'))"
```

Expected: prints `ok` (no error).

- [ ] **Step 3: Commit**

```bash
cd /home/metalmental/MyBlogV4
git add frontend/package.json frontend/bun.lock
git commit -m "chore(frontend): add dompurify for highlight sanitization"
```

---

## Task 2: Add highlight-snippet CSS

**Files:**
- Modify: `frontend/src/components/home/blog/blog.css`

- [ ] **Step 1: Append highlight styles at end of blog.css**

Add the following at the **end** of `frontend/src/components/home/blog/blog.css` (after the `.blog-carousel-item::scroll-marker:target-current` closing brace, around line 93):

```css
/* highlight fragment from OpenSearch */
.highlight-snippet em {
  font-style: normal;
  font-weight: 600;
  color: var(--color-violet-600);
  background-color: var(--color-violet-100);
  border-radius: 2px;
  padding: 0 2px;
}

@media (prefers-color-scheme: dark) {
  .highlight-snippet em {
    color: var(--color-violet-300);
    background-color: color-mix(in srgb, var(--color-violet-900) 30%, transparent);
  }
}
```

The variables `--color-violet-*` are already used elsewhere in `blog.css` (e.g., `var(--color-violet-500)`) — no additional config needed.

- [ ] **Step 2: Commit**

```bash
cd /home/metalmental/MyBlogV4
git add frontend/src/components/home/blog/blog.css
git commit -m "style(blog): add highlight-snippet em styles for search matches"
```

---

## Task 3: Add HighlightSnippet component and render it

**Files:**
- Modify: `frontend/src/components/home/blog/BlogSection.tsx`

- [ ] **Step 1: Add DOMPurify import**

At the top of `BlogSection.tsx`, add after the existing imports (after `import "./blog.css";`):

```tsx
import DOMPurify from "dompurify";
```

- [ ] **Step 2: Verify TypeScript compiles with the new import**

```bash
cd /home/metalmental/MyBlogV4/frontend
bunx astro check
```

Expected: no `dompurify` type errors.

- [ ] **Step 3: Add HighlightSnippet component**

Insert the following component just before the `// ── Inner component ───` comment (around line 173 in the original file), after the `TopicSelect` function closing brace:

```tsx
// ── Highlight Snippet ─────────────────────────────────────────────────────────

function HighlightSnippet({ fragments }: { fragments: string[] }) {
  if (fragments.length === 0) return null;
  const raw = fragments.join(" ... ");
  // DOMPurify sanitizes OpenSearch-generated HTML; only <em> tags are allowed
  const html = DOMPurify.sanitize(raw, { ALLOWED_TAGS: ["em"] });
  const htmlProp = { __html: html };
  return (
    <p
      className="highlight-snippet text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-3 mt-2"
      dangerouslySetInnerHTML={htmlProp}
    />
  );
}
```

- [ ] **Step 4: Render HighlightSnippet below the Summary in the blog card**

In the blog card JSX (around line 317), find the Summary block:

```tsx
{/* Summary */}
<p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-4 mb-4">
  {blog.summary}
</p>
```

Add the highlight snippet immediately after it:

```tsx
{/* Highlight snippets — shown only during search when OpenSearch returns fragments */}
{isSearching && blog.highlights?.content && (
  <HighlightSnippet fragments={blog.highlights.content} />
)}
```

`isSearching` is already defined in `BlogCarousel` as `const isSearching = query.length > 0;` and is in scope here.

- [ ] **Step 5: Verify TypeScript**

```bash
cd /home/metalmental/MyBlogV4/frontend
bunx astro check
```

Expected: no errors.

- [ ] **Step 6: Manual smoke test**

```bash
cd /home/metalmental/MyBlogV4/frontend
bun run dev
```

Open `http://localhost:4321`. In the Blog section:
1. Type a search term (e.g. `AWS` or `React`)
2. Wait 400ms for debounce
3. Confirm: below the gray summary, a smaller snippet appears with matched keywords in **violet bold** on a light violet background
4. Confirm: cards with no `content` highlights show summary only (no snippet)
5. Toggle dark mode: keywords appear in violet-300 on a semi-transparent dark violet background

- [ ] **Step 7: Commit**

```bash
cd /home/metalmental/MyBlogV4
git add frontend/src/components/home/blog/BlogSection.tsx
git commit -m "feat(blog): display OpenSearch highlight snippets in search results"
```

---

## Self-Review Against Spec

| Spec requirement | Covered by |
|-----------------|-----------|
| Content highlights only (not title) | Task 3 Step 4 — only `blog.highlights?.content` rendered |
| DOMPurify with `ALLOWED_TAGS: ["em"]` | Task 3 Step 3 — HighlightSnippet component |
| Fragments joined with ` ... ` | Task 3 Step 3 — `fragments.join(" ... ")` |
| Shown only during search | Task 3 Step 4 — `isSearching &&` guard |
| Shown only when highlights exist | Task 3 Step 4 — `blog.highlights?.content &&` guard |
| Summary always shown | Task 3 Step 4 — summary `<p>` unchanged |
| em styled violet bold + bg | Task 2 — `.highlight-snippet em` CSS |
| Dark mode em styling | Task 2 — `@media (prefers-color-scheme: dark)` block |
| No backend changes | Confirmed — all tasks are frontend only |

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Monorepo with two workspaces:
- `frontend/` — Astro 6 + React 19 + TypeScript (SSG portfolio/blog)
- `backend/` — AWS CDK + Lambda (Go, Python, TypeScript) + OpenSearch

Package manager: **Bun** (frontend), **npm** (backend CDK).

## Frontend Commands

```bash
cd frontend
bun run dev                    # Dev server; proxies /api/* to localhost:8080
bun run build                  # astro check + astro build
bun run preview                # Preview production build
bun run generate:github-stats  # Regenerate GitHub stats JSON (requires GITHUB_TOKEN)
```

Requires `frontend/.env` containing `GITHUB_TOKEN`.

## Backend Commands

See `backend/CLAUDE.md` for full CDK and Lambda details. Quick reference:

```bash
cd backend
npm run build      # TypeScript compile
npm test           # Jest tests
npm run deploy     # cdk deploy --all (dev env)
cdk deploy --context env=prod  # Deploy to prod
```

Go Lambda local dev: requires `.env` at `backend/lib/lambda/opensearch/cmd/api/` — see `backend/CLAUDE.md` for required vars. Go version is managed via `backend/mise.toml` (`mise install`).

## Frontend Architecture

**Astro Islands**: Pages (`pages/index.astro`, `pages/used-tech.astro`) are server-rendered Astro templates. Interactive widgets are React components hydrated with `client:load`. Minimizing the hydrated surface area is intentional — don't add `client:load` unless the component needs browser interactivity.

**Key React components** (`frontend/src/components/`):
- `avatar/` — 3D avatar via Three.js + React Three Fiber (GLB model with shape keys)
- `home/blog/` — blog carousel with TanStack Query infinite pagination
- `home/tool/` — TanStack Table + TanStack Virtual (virtualized rows, View Transitions for sorting)
- `home/charts/` — D3.js charts animated with GSAP; animation state via Nanostores

**Data fetching**: Client-side fetch to `/api/v1/*` endpoints, managed by TanStack React Query. The Astro dev server proxies `/api/*` to `http://localhost:8080` (Go Lambda local server).

**State**: TanStack Query for server state; Nanostores atoms for cross-component UI state (e.g., animation locks); React hooks for local UI state. `localStorage` for dark/light theme persistence.

## Backend Architecture

See `backend/CLAUDE.md` for stack descriptions, Lambda function details, OpenSearch index design, and Bedrock agent setup.

**Key principle**: Never use CloudFormation Outputs to share values between stacks. All resource names are pre-declared in `backend/bin/env/dev.ts` and `backend/bin/env/prod.ts` and passed via props.

## Code Rules

### TypeScript
- No `any` — use explicit types or `unknown` for unavoidable cases
- No `null` — use `undefined`

### Frontend CSS
- No `.css` files — use **Tailwind CSS** only
- Avoid `<style>` tags in `.astro` files; use them only when Tailwind cannot express the style
- Color palette: **violet** (primary), cyan/amber/rose/emerald (accents), white/gray/slate/indigo (light/dark surfaces)

### Comments
- Preserve existing comments; do not add new comments unless the code cannot be made self-explanatory

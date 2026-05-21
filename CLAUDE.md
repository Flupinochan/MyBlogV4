# CLAUDE.md

## Project Overview

Monorepo with two workspaces:

- `frontend/` — Astro 6 + React 19
- `backend/` — AWS CDK + Lambda (Go Gin, Python FastApi)

## Commands

Use `make help` from the repository root to see all available commands.

## Code Rules

### TypeScript

- No `any` — use explicit types or `unknown` for unavoidable cases
- No `null` — use `undefined`

### Comments

- Preserve existing comments; do not add new comments unless the code cannot be made self-explanatory

## Safety Rules

- Before writing or modifying any file, ask the user for confirmation.
- Before running any deploy or release command, ask the user for confirmation.
- Never perform destructive operations (overwrite, delete, deploy) autonomously.

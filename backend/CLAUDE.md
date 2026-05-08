# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### CDK (TypeScript)
```bash
npm run build          # TypeScript compile
npm run watch          # TypeScript watch mode
npm test               # Jest tests
npm run deploy         # cdk deploy --all --parallel --ci --require-approval never
```

Deploy to a specific environment (default: `dev`):
```bash
cdk deploy --context env=prod
# or
CDK_ENV=prod cdk deploy --all
```

### Go Lambda (opensearch)
```bash
cd lib/lambda/opensearch
go build ./...
go test ./...
```

Local dev for the API Lambda requires a `.env` file at `lib/lambda/opensearch/cmd/api/` with: `OPEN_SEARCH_URL`, `OPEN_SEARCH_PORT`, `OPEN_SEARCH_USER`, `OPEN_SEARCH_PASS`, `ALIAS_NAME`, `ALIAS_NAME_EMBEDDING`, `MODEL_ID`, `MODEL_ID_EMBEDDING`. Set `GIN_MODE` to anything other than `release` to trigger `.env` loading.

Go version is managed by `mise.toml` (`mise install` to apply).

### Notes from README
- After deploying `AgentCoreStack`, manually set the CloudWatch LogGroup retention to **1 day** (cannot be set in code).
- When changing CodePipeline/CodeBuild configuration, deploy locally rather than through the pipeline.
- List available Bedrock models: `aws bedrock list-foundation-models --region ap-northeast-1`

## Architecture

### CDK App (`bin/backend.ts`)
The entry point instantiates all stacks in dependency order. Environment config is resolved from `bin/env/dev.ts` or `bin/env/prod.ts` via `--context env=<name>` or `CDK_ENV`. **Stack Outputs are intentionally not used to pass values between stacks** — all resource names are pre-declared in the env config to avoid CloudFormation circular dependencies.

### Stacks (`lib/`)
| Stack | Purpose |
|-------|---------|
| `ApiStack` | API Gateway REST API; routes `/api/*` to `OpenSearchApiStack` (proxy), `/v1/users/{id}/sessions/{id}/messages` GET→`ChatSessionStack`, POST→`ChatAudioStack` |
| `HostingStack` | CloudFront distribution + S3 bucket; adds `/api/*` behavior pointing at `ApiStack` |
| `BlogKBStack` | Bedrock Knowledge Base backed by S3 (source blog articles) and a vector store |
| `BlogKBPipelineStack` | CodePipeline triggered by GitHub (zenn-content repo) to sync articles into the KB |
| `AgentCoreStack` | Deploys the Python Strands agent to Bedrock AgentCore |
| `PipelineStack` | CodePipeline for frontend deployment (build + S3 sync + CloudFront invalidation) |
| `BuildAssetsStack` | S3 bucket for build artifacts |
| `SynthesizeVoiceEcrStack` | ECR repository for the VOICEVOX Docker image |
| `SynthesizeVoiceStack` | Lambda (container image) running VOICEVOX TTS, output audio to S3 |

### Lambda Functions

**`lib/lambda/opensearch/cmd/api`** — Go/Gin REST API  
Runs a full Gin HTTP server inside Lambda via the [Lambda Web Adapter](https://github.com/awslabs/aws-lambda-web-adapter) layer (port 8080). API Gateway forwards requests as HTTP to the adapter. Routes: `GET /api/v1/health`, `GET /api/v1/blogs`, `GET /api/v1/blogs/:slug`, `GET /api/v1/topics`. Supports keyword search (multi-match BoolQuery) and vector/KNN search toggled by `?vector=true`. Pagination uses cursor-based `search_after` (never offset). Log level controlled by `LOG_LEVEL` env var (numeric: DEBUG=-4, INFO=0, WARN=4, ERROR=8).

**`lib/lambda/opensearch/cmd/batch`** — Go batch indexer  
Triggered by Lambda invocation. Fetches Zenn Markdown articles from GitHub via GitHub Apps auth, parses frontmatter, generates AI summaries (Bedrock Nova), builds keyword index documents, chunks Markdown content, generates embeddings (Titan), and bulk-indexes into two OpenSearch aliases. Uses `errgroup` + semaphore for bounded parallel processing (50 concurrent summaries, 20 concurrent embeddings).

**`lib/lambda/chat-audio/src/index.ts`** — TypeScript (Node.js)  
Receives POST with `{ message }`, calls Bedrock AgentCore runtime, then invokes `SynthesizeVoice` Lambda to get audio. Returns `{ message, audioPath }`.

**`lib/lambda/chat-session`** — Python  
Session management Lambda (reads/lists chat sessions).

**`lib/agentcore/src/main.py`** — Python Strands agent  
Two-pass strategy: first attempts to answer from session context + tools; if `requires_additional_info=True`, runs all tools and feeds collected data back for a final answer. Uses `S3SessionManager` for conversation persistence. System prompt enforces plain Japanese text, max 2 sentences, no Markdown.

**`lib/lambda/synthesize-voice/src/main.py`** — Python (Docker/ECR)  
VOICEVOX TTS running in a Lambda container image; outputs WAV to S3.

### Go Module
Module path: `metalmental.net/flupinochan/myblogv4/backend/lib/lambda/open-search-backend/src`  
Internal packages under `internal/`: `blogsearch`, `config`, `genai`, `middleware`, `mylogger`, `router`, `healthcheck`.  
Batch-only packages under `cmd/batch/`: `blogsource` (GitHub client), `myhttp`.

### OpenSearch Index Design
Two aliases per environment:
- `aliasName` (e.g. `tech-blog`) — keyword index with per-document summaries
- `aliasNameEmbedding` (e.g. `tech-blog-embedding`) — hybrid index with chunked content + embeddings (`chunk_embedding` knn field, collapsed by `slug` at query time)

New indexes are created with a timestamp suffix; aliases are atomically swapped after bulk indexing completes.

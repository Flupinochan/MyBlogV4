# CLAUDE.md

## Commands

**Note for Claude**: Do NOT run `npm run build` or `tsc`. These commands generate local JS/.d.ts files that pollute the working tree. Use `npx tsc --noEmit` for type-checking only.

## Architecture

### CDK App (`bin/backend.ts`)

| Directory                           | Role                                                                  |
| ----------------------------------- | --------------------------------------------------------------------- |
| `bin/env/dev.ts`, `bin/env/prod.ts` | Environment config (resolved via `--context env=<name>` or `CDK_ENV`) |
| `lib/`                              | Stack definitions                                                     |

**Stack Outputs are intentionally not used to pass values between stacks** — all resource names are pre-declared in the env config to avoid CloudFormation circular dependencies.

**Deployment order:**

| Stack                | Role                                                                           |
| -------------------- | ------------------------------------------------------------------------------ |
| VoicevoxBucketStack  | S3 for VoiceVox engine resources (used by CodeBuild to build the Docker image) |
| VoicevoxEcrStack     | ECR for Docker image                                                           |
| VoicevoxLambdaStack  | Python FastAPI (chat + voice synthesis)                                        |
| OpenSearchBatchStack | Go batch (content indexing)                                                    |
| OpenSearchApiStack   | Go Gin API (blog search)                                                       |
| ApiStack             | API Gateway REST API (backend)                                                 |
| HostingStack         | S3 + CloudFront (frontend)                                                     |
| HostingPipelineStack | CodePipeline (frontend deploy)                                                 |

### Lambda Functions

| Entry Point                               | Role                               |
| ----------------------------------------- | ---------------------------------- |
| `lib/lambda/opensearch/cmd/api/main.go`   | Blog search API (Go Gin)           |
| `lib/lambda/opensearch/cmd/batch/main.go` | GitHub → OpenSearch batch indexing |
| `lib/lambda/voicevox/src/main.py`         | Chat + voice synthesis (FastAPI)   |

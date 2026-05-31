# CLAUDE.md

## Build Rules

Do NOT run `npm run build` or `tsc`. These commands generate local JS/.d.ts files that pollute the working tree. Use `npx tsc --noEmit` for type-checking only.

## AWS CDK (`bin/backend.ts`)

**Stack Outputs are intentionally not used to pass values between stacks** — all resource names are pre-declared in the env config to avoid CloudFormation circular dependencies.

| Path                                | Description                                                           |
| ----------------------------------- | --------------------------------------------------------------------- |
| `bin/env/dev.ts`, `bin/env/prod.ts` | Environment config (resolved via `--context env=<name>` or `CDK_ENV`) |
| `lib/`                              | Each stack definitions                                                |

| Main Stack                      | Description                                |
| ------------------------------- | ------------------------------------------ |
| `lib/hosting-stack.ts`          | S3 + CloudFront                            |
| `lib/hosting-pipeline-stack.ts` | CodePipeline (Deploy Frontend and Backend) |

| Python Stack                                       | Description                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------ |
| `lib/lambda/voicevox/voicevox-bucket-stack.ts`     | S3 for Voicevox engine resources (used by CodeBuild to build the Docker image) |
| `lib/lambda/voicevox/voicevox-ecr-stack.ts`        | ECR for Voicevox Docker image                                                  |
| `lib/lambda/voicevox/voicevox-api-lambda-stack.ts` | Python FastAPI Lambda (generative ai chat + voicevox)                          |
| `lib/lambda/voicevox/voicevox-apigateway-stack.ts` | API Gateway REST API (for FastAPI)                                             |

| Go Stack                                                 | Description                                                |
| -------------------------------------------------------- | ---------------------------------------------------------- |
| `lib/lambda/opensearch/opensearch-batch-lambda-stack.ts` | GitHub blog articles → OpenSearch document insert by batch |
| `lib/lambda/opensearch/opensearch-api-lambda-stack.ts`   | Go Huma Lambda (blog search)                               |
| `lib/lambda/opensearch/opensearch-apigateway-stack.ts`   | API Gateway REST API (for Huma)                            |

## API Design Policy

**Backend-first (Code-first)**:

- Pydantic models in `lib/lambda/voicevox/src/schemas.py` are the Single Source of Truth for the Python API schema. FastAPI auto-generates the OpenAPI spec from them — do not write OpenAPI YAML by hand.
- Go struct definitions in `lib/lambda/opensearch/` are the Single Source of Truth for the Go API schema. Huma auto-generates the OpenAPI spec from them — do not write OpenAPI YAML by hand.
- Frontend TypeScript types are derived from these specs via `openapi-typescript`.

## Python FastAPI (`lib/lambda/voicevox/`)

### Database

Reference `lib/lambda/voicevox/DATABASE.md`

| Item           | Description                                      |
| -------------- | ------------------------------------------------ |
| Provider       | Neon PostgreSQL 18                               |
| Migration tool | Atlas — `lib/lambda/voicevox/atlas.hcl`          |
| ORM            | SQLAlchemy — `lib/lambda/voicevox/src/models.py` |

**Tables:**

| Table           | Description                      |
| --------------- | -------------------------------- |
| `conversations` | Chat session                     |
| `messages`      | Message history per conversation |

## Go Huma (`lib/lambda/opensearch/`)

### OpenSearch

| Item     | Description            |
| -------- | ---------------------- |
| Provider | Aiven OpenSearch 3.3.2 |

**Index:**

| Index                                   | Description                   |
| --------------------------------------- | ----------------------------- |
| `internal/blogsearch/index.json`        | Full-text search index        |
| `internal/blogsearch/index_hybrid.json` | Hybrid or Vector search index |

.ONESHELL:
SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c

ENV_NAME := dev
AWS_REGION := ap-northeast-1
ECR_NAME := $(ENV_NAME)-myblogv4-voicevox-ecr

.PHONY: help fastapi huma astro list deploy-all deploy-target _deploy \
        _gen-openapi-voicevox _gen-ts-types-voicevox gen-api-types-voicevox \
        _gen-openapi-opensearch _gen-ts-types-opensearch gen-api-types-opensearch


help:
	@echo ""
	@echo "Usage: make <command>"
	@grep -E '^##@|^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "} /^##@/ { printf "\n%s\n\n", substr($$0, 5) } /^[a-zA-Z_-]+:.*?## / { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }'

##@ generate openapi and typescript types

_gen-openapi-voicevox:
	mkdir -p $(CURDIR)/frontend/src/types
	cd backend/lib/lambda/voicevox && \
		PYTHONPATH=src uv run \
		$(if $(wildcard $(CURDIR)/backend/lib/lambda/voicevox/.env),--env-file $(CURDIR)/backend/lib/lambda/voicevox/.env,) \
		python -c \
		"import json; from main import app; print(json.dumps(app.openapi(), indent=2))" \
		> $(CURDIR)/frontend/src/types/openapi-voicevox.json

_gen-ts-types-voicevox:
	cd frontend && \
		bunx openapi-typescript src/types/openapi-voicevox.json \
		-o src/types/api-voicevox.generated.ts

gen-api-types-voicevox: ## Voicevox型生成
	$(MAKE) _gen-openapi-voicevox
	$(MAKE) _gen-ts-types-voicevox

_gen-openapi-opensearch:
	mkdir -p $(CURDIR)/frontend/src/types
	cd backend/lib/lambda/opensearch && \
		go run ./cmd/openapi-gen \
		> $(CURDIR)/frontend/src/types/openapi-opensearch.json

_gen-ts-types-opensearch:
	cd frontend && \
		bunx openapi-typescript src/types/openapi-opensearch.json \
		-o src/types/api-opensearch.generated.ts

gen-api-types-opensearch: ## OpenSearch型生成
	$(MAKE) _gen-openapi-opensearch
	$(MAKE) _gen-ts-types-opensearch

##@ local run

fastapi: ## FastAPIバックエンド起動
	$(MAKE) _gen-openapi-voicevox
	cd backend/lib/lambda/voicevox && \
		PYTHONPATH=src uv run --env-file .env fastapi run src/main.py --port 8081

huma: ## Humaバックエンド起動
	$(MAKE) _gen-openapi-opensearch
	cd backend/lib/lambda/opensearch && \
		air

astro: ## Astroフロントエンド起動
	cd frontend && \
		bun run dev

##@ cdk deploy

list: ## List Stacks
	cd backend && \
		bun run cdk list

deploy-all: ## Deploy All Stack
	$(MAKE) _deploy CDK_ARGS="--all --parallel --ci --require-approval never"

deploy-target: ## Deploy Specific Stack (STACK_NAME=<stack-name>)
ifndef STACK_NAME
	$(error STACK_NAME is required. Usage: make deploy-target STACK_NAME=<stack-name>)
endif
	$(MAKE) _deploy CDK_ARGS="$(STACK_NAME)"

_deploy:
	# build and push Docker image for synthesizeVoice Lambda
	export VOICEVOX_LAMBDA_IMAGE_TAG=$$(date -u +%Y%m%d%H%M%S)
	export ACCOUNT_ID=$$(aws sts get-caller-identity --query Account --output text)
	export ECR_URI=$$ACCOUNT_ID.dkr.ecr.$(AWS_REGION).amazonaws.com/$(ECR_NAME)

	aws ecr get-login-password --region $(AWS_REGION) | \
		docker login \
			--username AWS \
			--password-stdin \
			$$ACCOUNT_ID.dkr.ecr.$(AWS_REGION).amazonaws.com

	DOCKER_BUILDKIT=1 docker build \
		-t $(ECR_NAME):$$VOICEVOX_LAMBDA_IMAGE_TAG \
		backend/lib/lambda/voicevox/

	docker tag \
		$(ECR_NAME):$$VOICEVOX_LAMBDA_IMAGE_TAG \
		$$ECR_URI:$$VOICEVOX_LAMBDA_IMAGE_TAG

	docker push $$ECR_URI:$$VOICEVOX_LAMBDA_IMAGE_TAG

	# deploy backend
	cd backend

	bun install --frozen-lockfile --ignore-scripts

	# all deploy
	# bun run cdk -- deploy --all --parallel --ci --require-approval never --context env=$(ENV_NAME) --context voicevoxLambdaImageTag=$$VOICEVOX_LAMBDA_IMAGE_TAG

	# deploy voicevox lambda only
	# bun run cdk -- deploy dev-myblogv4-VoicevoxLambdaStack --context env=$(ENV_NAME) --context voicevoxLambdaImageTag=$$VOICEVOX_LAMBDA_IMAGE_TAG

	bun run cdk -- deploy $(CDK_ARGS) \
		--context env=$(ENV_NAME) \
		--context voicevoxLambdaImageTag=$$VOICEVOX_LAMBDA_IMAGE_TAG

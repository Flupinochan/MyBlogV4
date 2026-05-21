.ONESHELL:
SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c

.PHONY: help fastapi gin astro deploy-all deploy-target _deploy

##@ local run command

help:
	@echo ""
	@echo "Usage: make <command>"
	@grep -E '^##@|^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "} /^##@/ { printf "\n%s\n\n", substr($$0, 5) } /^[a-zA-Z_-]+:.*?## / { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }'


fastapi: ## FastAPIバックエンド起動
	cd backend/lib/lambda/voicevox && PYTHONPATH=src uv run --env-file .env fastapi run src/main.py --port 8081

gin: ## Goバックエンド起動
	cd backend/lib/lambda/opensearch/ && air

astro: ## Astroフロントエンド起動
	cd frontend/ && bun run dev

##@ deploy command

list: ## List Stacks
	cd backend
	bun run cdk list

all: ## Deploy All Stack
	$(MAKE) _deploy CDK_ARGS="--all --parallel --ci --require-approval never"

target: ## Deploy Specific Stack (stack-name=<stack-name>)
ifndef stack-name
	$(error stack-name is required. Usage: make deploy-target stack-name=<stack-name>)
endif
	$(MAKE) _deploy CDK_ARGS="$(stack-name)"

_deploy:
	export ECR_NAME="dev-myblogv4-voicevox-ecr"
	export ENV_NAME="dev"
	export AWS_REGION="ap-northeast-1"
	# build and push Docker image for synthesizeVoice Lambda
	export VOICEVOX_LAMBDA_IMAGE_TAG=$$(date -u +%Y%m%d%H%M%S)
	export ACCOUNT_ID=$$(aws sts get-caller-identity --query Account --output text)
	export ECR_URI=$$ACCOUNT_ID.dkr.ecr.$$AWS_REGION.amazonaws.com/$${ECR_NAME}
	aws ecr get-login-password --region $$AWS_REGION | docker login --username AWS --password-stdin $$ACCOUNT_ID.dkr.ecr.$$AWS_REGION.amazonaws.com
	docker build -t $${ECR_NAME}:$$VOICEVOX_LAMBDA_IMAGE_TAG backend/lib/lambda/voicevox/
	docker tag $${ECR_NAME}:$$VOICEVOX_LAMBDA_IMAGE_TAG $$ECR_URI:$$VOICEVOX_LAMBDA_IMAGE_TAG
	docker push $$ECR_URI:$$VOICEVOX_LAMBDA_IMAGE_TAG
	# deploy backend
	cd backend
	bun install --frozen-lockfile --ignore-scripts
	# all deploy
	# bun run cdk -- deploy --all --parallel --ci --require-approval never --context env=$${ENV_NAME} --context voicevoxLambdaImageTag=$$VOICEVOX_LAMBDA_IMAGE_TAG
	# deploy voicevox lambda only
	# bun run cdk -- deploy dev-myblogv4-VoicevoxLambdaStack --context env=$${ENV_NAME} --context voicevoxLambdaImageTag=$$VOICEVOX_LAMBDA_IMAGE_TAG
	bun run cdk -- deploy $(CDK_ARGS) --context env=$$ENV_NAME --context voicevoxLambdaImageTag=$$VOICEVOX_LAMBDA_IMAGE_TAG

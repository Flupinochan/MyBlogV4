## 利用可能なModelId確認方法

```bash
aws bedrock list-foundation-models \
    --region ap-northeast-1 \
    --query 'modelSummaries[*].[modelId, modelName]' \
    --output table

aws bedrock list-inference-profiles \
    --region ap-northeast-1 \
    --query 'inferenceProfileSummaries[*].[inferenceProfileId, status]' \
    --output table
```

## ローカルでデプロイする場合

```bash
export ECR_NAME="dev-myblogv4-voicevox-ecr"
export ENV_NAME="dev"
export AWS_REGION="ap-northeast-1"

# build and push Docker image for synthesizeVoice Lambda
export VOICEVOX_LAMBDA_IMAGE_TAG=$(date -u +%Y%m%d%H%M%S)
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export ECR_URI=$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/${ECR_NAME}
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
docker build -t ${ECR_NAME}:$VOICEVOX_LAMBDA_IMAGE_TAG backend/lib/lambda/voicevox/
docker tag ${ECR_NAME}:$VOICEVOX_LAMBDA_IMAGE_TAG $ECR_URI:$VOICEVOX_LAMBDA_IMAGE_TAG
docker push $ECR_URI:$VOICEVOX_LAMBDA_IMAGE_TAG
# deploy backend
cd backend
bun install --frozen-lockfile --ignore-scripts
# all deploy
bun run cdk -- deploy --all --parallel --ci --require-approval never --context env=${ENV_NAME} --context voicevoxLambdaImageTag=$VOICEVOX_LAMBDA_IMAGE_TAG
# deploy voicevox lambda only
bun run cdk -- deploy dev-myblogv4-VoicevoxLambdaStack --context env=${ENV_NAME} --context voicevoxLambdaImageTag=$VOICEVOX_LAMBDA_IMAGE_TAG
```

## 注意点

CodePipelineやCodeBuildの設定を変更する場合はローカルでデプロイすること

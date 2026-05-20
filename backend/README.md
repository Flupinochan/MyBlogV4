## ローカルでデプロイする場合

```bash
cd backend
./local-deploy.sh
```

## 注意点

CodePipelineやCodeBuildの設定を変更する場合はローカルでデプロイすること

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

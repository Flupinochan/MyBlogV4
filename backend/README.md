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

AgentCoreのログ設定はコードからはできない  
デプロイ後に自動作成されたCloudWatch LogGroupの保存期間を `1日` にすること

CodePipelineやCodeBuildの設定を変更する場合はローカルでデプロイすること
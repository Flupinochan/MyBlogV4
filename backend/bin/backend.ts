#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { ApiStack } from "../lib/api-stack";
import { HostingPipelineStack } from "../lib/hosting-pipeline-stack";
import { HostingStack } from "../lib/hosting-stack";
import { OpenSearchApiStack } from "../lib/lambda/opensearch/opensearch-api-stack";
import { OpenSearchBatchStack } from "../lib/lambda/opensearch/opensearch-batch-stack";
import { VoicevoxBucketStack } from "../lib/lambda/voicevox/voicevox-bucket";
import { VoicevoxEcrStack } from "../lib/lambda/voicevox/voicevox-ecr-stack";
import { VoicevoxLambdaStack } from "../lib/lambda/voicevox/voicevox-lambda-stack";
import { getEnvConfig, isProd } from "./env";

const app = new cdk.App();

const envName =
  (app.node.tryGetContext("env") as string) || process.env.CDK_ENV || "dev";
const cfg = getEnvConfig(envName);
const stackPrefixName = "myblogv4";
const stackBaseName = `${envName}-${stackPrefixName}`;
const apiPath = "api";
const hostingRepoName = "MyBlogV4";
const certificateArnParam = "certificate-arn";
const githubConnectionArnParam = "github-connection-arn";
const blogBranchName = "master";
const aliasName = "tech-blog";
const aliasNameEmbedding = "tech-blog-embedding";
const githubOwner = "Flupinochan";
const githubRepo = "zenn-content";
const githubPath = "articles";
const githubAppsPrivateKeyParam = "github-apps-private-key-zenn-blog";
const githubAppsIdParam = "github-apps-app-id-zenn-blog";
const githubInstallationIdParam = "github-apps-installation-id-zenn-blog";
const hostingBucketName = `${stackBaseName}-hosting-bucket`;
const voicevoxBucketName = `${stackBaseName}-voicevox-bucket`;
const voicevoxEcrName = `${stackBaseName}-voicevox-ecr`;
const voicevoxLambdaName = `${stackBaseName}-voicevox-lambda`;
const openSearchBatchLambdaName = `${stackBaseName}-opensearch-batch`;
const openSearchApiLambdaName = `${stackBaseName}-opensearch-api`;

// voicevox engineアップロード用
// ★最初にこのS3 Bucketだけ単体でデプロイし、voicevox engine関連のリソースをzipでアップロードしておくこと
new VoicevoxBucketStack(app, `${stackBaseName}-VoicevoxBucketStack`, {
  voicevoxBucketName,
});

new VoicevoxEcrStack(app, `${stackBaseName}-VoicevoxEcrStack`, {
  voicevoxEcrName,
});

// CodeBuildでビルドした際に引数からImageTag名を取得
// ローカルからデプロイする際は注意
const imageTag =
  process.env.SYNTHESIZE_VOICE_IMAGE_REF ??
  app.node.tryGetContext("voicevoxLambdaImageTag");

// if (!synthesizeVoiceImageTagOrDigest) {
//   throw new Error("SYNTHESIZE_VOICE_IMAGE_REF is required");
// }

new VoicevoxLambdaStack(app, `${stackBaseName}-VoicevoxLambdaStack`, {
  voicevoxLambdaName,
  voicevoxEcrName,
  imageTag,
  createdVoiceOutputBucketName: hostingBucketName,
});

new OpenSearchBatchStack(app, `${stackBaseName}-OpenSearchBatchStack`, {
  openSearchBatchLambdaName,
  openSearchUrlParam: cfg.openSearchUrlParam,
  openSearchPortParam: cfg.openSearchPortParam,
  openSearchUserParam: cfg.openSearchUserParam,
  openSearchPassParam: cfg.openSearchPassParam,
  aliasName,
  githubOwner,
  githubRepo,
  githubPath,
  githubAppsPrivateKeyParam,
  githubAppsIdParam,
  githubInstallationIdParam,
  modelId: cfg.modelId,
  embeddingModelId: cfg.modelIdEmbedding,
  githubConnectionArnParam,
  blogBranchName,
});

new OpenSearchApiStack(app, `${stackBaseName}-OpenSearchApiStack`, {
  openSearchApiFunctionName: openSearchApiLambdaName,
  openSearchUrlParam: cfg.openSearchUrlParam,
  openSearchPortParam: cfg.openSearchPortParam,
  openSearchUserParam: cfg.openSearchUserParam,
  openSearchPassParam: cfg.openSearchPassParam,
  aliasName,
  aliasNameEmbedding,
  modelId: cfg.modelId,
  modelIdEmbedding: cfg.modelIdEmbedding,
});

const apiStack = new ApiStack(app, `${stackBaseName}-ApiStack`, {
  domainName: cfg.hostingDomainName,
  apiPath,
  isProd: isProd(envName),
  openSearchApiLambdaName,
});

const hostingStack = new HostingStack(app, `${stackBaseName}-HostingStack`, {
  envName,
  hostingBucketName,
  domainName: cfg.hostingDomainName,
  certificateArnParam,
  apiStack,
  apiPath,
});

new HostingPipelineStack(app, `${stackBaseName}-HostingPipelineStack`, {
  envName,
  githubConnectionArnParam,
  repoName: hostingRepoName,
  branchName: cfg.hostingBranchName,
  hostingBucketName,
  hostingDistributionId: hostingStack.distribution.distributionId,
  voicevoxBucketName,
  voicevoxEcrName,
});

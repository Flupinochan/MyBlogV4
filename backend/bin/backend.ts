#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { HostingPipelineStack } from "../lib/hosting-pipeline-stack";
import { HostingStack } from "../lib/hosting-stack";
import { OpenSearchApiLambdaStack } from "../lib/lambda/opensearch/opensearch-api-lambda-stack";
import { OpenSearchApiGatewayStack } from "../lib/lambda/opensearch/opensearch-apigateway-stack";
import { OpenSearchBatchLambdaStack } from "../lib/lambda/opensearch/opensearch-batch-lambda-stack";
import { VoicevoxApiLambdaStack } from "../lib/lambda/voicevox/voicevox-api-lambda-stack";
import { VoicevoxApiGatewayStack } from "../lib/lambda/voicevox/voicevox-apigateway-stack";
import { VoicevoxBucketStack } from "../lib/lambda/voicevox/voicevox-bucket-stack";
import { VoicevoxEcrStack } from "../lib/lambda/voicevox/voicevox-ecr-stack";
import { getEnvConfig, isProd } from "./env";

const app = new cdk.App();

const envName =
  (app.node.tryGetContext("env") as string) || process.env.CDK_ENV || "dev";
const cfg = getEnvConfig(envName);
const stackPrefixName = "myblogv4";
const stackBaseName = `${envName}-${stackPrefixName}`;
const blogSearchApiPath = "opensearch-api";
const voicevoxApiPath = "voicevox-api";
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
const claudeApiKeyParam = "claude-platform-api-key";
const claudeWorkspaceIdParam = "claude-platform-workspace-id";
const postgresqlUrlParam = "myblogv4-postgresql-url";
const dockerhubUserParam = "dockerhub-user";
const dockerhubPasswordParam = "dockerhub-password";
const contactEmailAddress = "flupino@metalmental.net";
const contactConfigurationSetName = "my-first-configuration-set";

// voicevox engineアップロード用
// ★最初にこのS3 Bucketだけ単体でデプロイし、voicevox engine関連のリソースをzipでアップロードしておくこと
new VoicevoxBucketStack(app, `${stackBaseName}-VoicevoxBucketStack`, {
  voicevoxBucketName,
});

const voicevoxEcrStack = new VoicevoxEcrStack(
  app,
  `${stackBaseName}-VoicevoxEcrStack`,
  {
    voicevoxEcrName,
  },
);

// CodeBuildでビルドした際に引数からImageTag名を取得
// ローカルからデプロイする際は注意
const imageTag =
  process.env.SYNTHESIZE_VOICE_IMAGE_REF ??
  app.node.tryGetContext("voicevoxLambdaImageTag");

// if (!synthesizeVoiceImageTagOrDigest) {
//   throw new Error("SYNTHESIZE_VOICE_IMAGE_REF is required");
// }

const voicevoxLambdaStack = new VoicevoxApiLambdaStack(
  app,
  `${stackBaseName}-VoicevoxLambdaStack`,
  {
    voicevoxLambdaName,
    voicevoxEcrName,
    imageTag,
    createdVoiceOutputBucketName: hostingBucketName,
    claudeApiKeyParam,
    claudeWorkspaceIdParam,
    postgresqlUrlParam,
    contactEmailAddress,
    contactConfigurationSetName,
  },
);

new OpenSearchBatchLambdaStack(app, `${stackBaseName}-OpenSearchBatchStack`, {
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

const openSearchApiLambdaStack = new OpenSearchApiLambdaStack(
  app,
  `${stackBaseName}-OpenSearchApiStack`,
  {
    openSearchApiFunctionName: openSearchApiLambdaName,
    openSearchUrlParam: cfg.openSearchUrlParam,
    openSearchPortParam: cfg.openSearchPortParam,
    openSearchUserParam: cfg.openSearchUserParam,
    openSearchPassParam: cfg.openSearchPassParam,
    aliasName,
    aliasNameEmbedding,
    modelId: cfg.modelId,
    modelIdEmbedding: cfg.modelIdEmbedding,
  },
);

const blogSearchApiStack = new OpenSearchApiGatewayStack(
  app,
  `${stackBaseName}-BlogSearchApiStack`,
  {
    domainName: cfg.hostingDomainName,
    blogSearchApiPath,
    isProd: isProd(envName),
    openSearchApiLambdaName,
  },
);

const voicevoxApiStack = new VoicevoxApiGatewayStack(
  app,
  `${stackBaseName}-VoicevoxApiStack`,
  {
    domainName: cfg.hostingDomainName,
    voicevoxApiPath,
    isProd: isProd(envName),
    voicevoxLambdaName,
  },
);

const hostingStack = new HostingStack(app, `${stackBaseName}-HostingStack`, {
  envName,
  hostingBucketName,
  domainName: cfg.hostingDomainName,
  alternateDomainName: cfg.alternateDomainName,
  certificateArnParam,
  blogSearchApiStack,
  blogSearchApiPath,
  voicevoxApiStack,
  voicevoxApiPath,
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
  dockerhubUserParam,
  dockerhubPasswordParam,
});

// スタック名の文字列渡しはCloudFormationの参照を生成せず、CDKが依存関係を認識できないため明示する
// 逆に作りなおしたい場合などで依存を消したい場合はコメントアウトすること
voicevoxLambdaStack.addDependency(voicevoxEcrStack);
voicevoxApiStack.addDependency(voicevoxLambdaStack);
blogSearchApiStack.addDependency(openSearchApiLambdaStack);

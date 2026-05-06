#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { AgentCoreStack } from "../lib/agentcore/agentcore-stack";
import { ApiStack } from "../lib/api-stack";
import { BlogKBPipelineStack } from "../lib/blog-kb-pipeline-stack";
import { BlogKBStack } from "../lib/blog-kb-stack";
import { BuildAssetsStack } from "../lib/build-assets-stack";
import { HostingStack } from "../lib/hosting-stack";
import { ChatAudioStack } from "../lib/lambda/chat-audio/chat-audio-stack";
import { ChatSessionStack } from "../lib/lambda/chat-session/chat-session-stack";
import { OpenSearchBatchStack } from "../lib/lambda/opensearch/opensearch-batch-stack";
import { SynthesizeVoiceEcrStack } from "../lib/lambda/synthesize-voice/synthesize-voice-ecr-stack";
import { SynthesizeVoiceStack } from "../lib/lambda/synthesize-voice/synthesize-voice-stack";
import { PipelineStack } from "../lib/pipeline-stack";
import { getEnvConfig, isProd } from "./env";
import { OpenSearchApiStack } from "../lib/lambda/opensearch/opensearch-api-stack";

const app = new cdk.App();

const envName =
  (app.node.tryGetContext("env") as string) || process.env.CDK_ENV || "dev";
const cfg = getEnvConfig(envName);

const baseName = "myblogv4";
const prefix = `${envName}-${baseName}`;

new BuildAssetsStack(app, `${prefix}-BuildAssetsStack`, {
  bucketName: cfg.buildAssetsBucketName,
});

const synthesizeVoiceEcrStack = new SynthesizeVoiceEcrStack(
  app,
  `${prefix}-SynthesizeVoiceEcrStack`,
  {
    repositoryName: cfg.synthesizeVoiceRepositoryName,
  },
);

const synthesizeVoiceImageTagOrDigest =
  process.env.SYNTHESIZE_VOICE_IMAGE_REF ??
  app.node.tryGetContext("synthesizeVoiceImageRef");

// if (!synthesizeVoiceImageTagOrDigest) {
//   throw new Error("SYNTHESIZE_VOICE_IMAGE_REF is required");
// }

new SynthesizeVoiceStack(app, `${prefix}-SynthesizeVoiceStack`, {
  functionName: cfg.synthesizeVoiceFunctionName,
  repository: synthesizeVoiceEcrStack.repository,
  imageTagOrDigest: synthesizeVoiceImageTagOrDigest,
  voiceOutputBucketName: cfg.hostingBucketName,
});

const blogKBStack = new BlogKBStack(app, `${prefix}-BlogKBStack`, {
  sourceBucketName: cfg.sourceBucketName,
  vectorBucketName: cfg.vectorBucketName,
  kbName: cfg.kbName,
  dataSourceName: cfg.dataSourceName,
  embeddingModelId: cfg.embeddingModelId,
  enrichingModelId: cfg.enrichingModelId,
});

new BlogKBPipelineStack(app, `${prefix}-BlogKBPipelineStack`, {
  githubConnectionArnParam: cfg.githubConnectionArnParam,
  repositoryName: cfg.blogRepoName,
  branchName: cfg.blogBranchName,
  sourceBucketName: cfg.sourceBucketName,
  kbid: blogKBStack.kb.attrKnowledgeBaseId,
  dataSourceId: blogKBStack.dataSource.attrDataSourceId,
});

const agentCoreStack = new AgentCoreStack(app, `${prefix}-AgentCoreStack`, {
  kbid: blogKBStack.kb.attrKnowledgeBaseId,
  entryPoint: cfg.entryPoint,
  agentRuntimeName: cfg.agentRuntimeName,
  embeddingModelId: cfg.embeddingModelId,
  sourceBucketName: cfg.sourceBucketName,
  sessionBucketName: cfg.sessionBucketName,
  agentId: cfg.agentId,
  platform: cfg.agentCorePlatform,
});

const chatAudioStack = new ChatAudioStack(app, `${prefix}-ChatAudioStack`, {
  functionName: cfg.chatAudioFunctionName,
  agentCoreArn: agentCoreStack.agentCoreRuntime.attrAgentRuntimeArn,
  synthesizeVoiceFunctionName: cfg.synthesizeVoiceFunctionName,
  domainName: cfg.domainName,
});

const chatSessionStack = new ChatSessionStack(
  app,
  `${prefix}-ChatSessionStack`,
  {
    functionName: `${prefix}-ChatSessionFunction`,
    sessionBucketName: cfg.sessionBucketName,
    agentId: cfg.agentId,
    domainName: cfg.domainName,
  },
);

const apiPath = "api";
const apiStack = new ApiStack(app, `${prefix}-ApiStack`, {
  domainName: cfg.domainName,
  apiPath,
  isProd: isProd(envName),
  chatSessionLambda: chatSessionStack.function,
  chatAudioLambda: chatAudioStack.function,
});

const hostingStack = new HostingStack(app, `${prefix}-HostingStack`, {
  envName,
  bucketName: cfg.hostingBucketName,
  domainName: cfg.domainName,
  certificateArn: cfg.certificateArnParam,
  apiStack,
  apiPath,
});

new PipelineStack(app, `${prefix}-PipelineStack`, {
  envName,
  hostingBucketName: cfg.hostingBucketName,
  buildAssetsBucketName: cfg.buildAssetsBucketName,
  hostingDistributionId: hostingStack.distribution.distributionId,
  githubConnectionArn: cfg.githubConnectionArnParam,
  repoName: cfg.repoName,
  branchName: cfg.branchName,
  synthesizeVoiceRepositoryName: cfg.synthesizeVoiceRepositoryName,
});

new OpenSearchBatchStack(app, `${prefix}-OpenSearchBatchStack`, {
  openSearchBatchFunctionName: cfg.openSearchBatchFunctionName,
  openSearchUrlParam: cfg.openSearchUrlParam,
  openSearchPortParam: cfg.openSearchPortParam,
  openSearchUserParam: cfg.openSearchUserParam,
  openSearchPassParam: cfg.openSearchPassParam,
  aliasName: cfg.aliasName,
  githubOwner: cfg.githubOwner,
  githubRepo: cfg.githubRepo,
  githubPath: cfg.githubPath,
  githubAppsPrivateKey: cfg.githubAppsPrivateKeyParam,
  githubAppsId: cfg.githubAppsIdParam,
  githubInstallationId: cfg.githubInstallationIdParam,
});

new OpenSearchApiStack(app, `${prefix}-OpenSearchApiStack`, {
  openSearchApiFunctionName: cfg.openSearchApiFunctionName,
  openSearchUrlParam: cfg.openSearchUrlParam,
  openSearchPortParam: cfg.openSearchPortParam,
  openSearchUserParam: cfg.openSearchUserParam,
  openSearchPassParam: cfg.openSearchPassParam,
  aliasName: cfg.aliasName,
});

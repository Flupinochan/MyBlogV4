#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { AgentCoreStack } from "../lib/agentcore/agentcore-stack";
import { CreateZipAssetStack } from "../lib/agentcore/create-zip-asset-stack";
import { BlogKBPipelineStack } from "../lib/blog-kb-pipeline-stack";
import { BlogKBStack } from "../lib/blog-kb-stack";
import { BuildAssetsStack } from "../lib/build-assets-stack";
import { HostingStack } from "../lib/hosting-stack";
import { ChatAudioDurableStack } from "../lib/lambda/chat-audio-durable/chat-audio-durable-stack";
import { SynthesizeVoiceEcrStack } from "../lib/lambda/synthesize-voice/synthesize-voice-ecr-stack";
import { SynthesizeVoiceStack } from "../lib/lambda/synthesize-voice/synthesize-voice-stack";
import { PipelineStack } from "../lib/pipeline-stack";
import { getEnvConfig } from "./env";

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

if (!synthesizeVoiceImageTagOrDigest) {
  throw new Error("SYNTHESIZE_VOICE_IMAGE_REF is required");
}

new SynthesizeVoiceStack(app, `${prefix}-SynthesizeVoiceStack`, {
  functionName: cfg.synthesizeVoiceFunctionName,
  repository: synthesizeVoiceEcrStack.repository,
  imageTagOrDigest: synthesizeVoiceImageTagOrDigest,
  voiceOutputBucketName: cfg.hostingBucketName,
});

const hostingStack = new HostingStack(app, `${prefix}-HostingStack`, {
  envName,
  bucketName: cfg.hostingBucketName,
  domainName: cfg.domainName,
  certificateArn: cfg.certificateArnParam,
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

const createZipAssetStack = new CreateZipAssetStack(
  app,
  `${prefix}-CreateZipAssetStack`,
  {
    platform: cfg.agentCorePlatform,
  },
);

const agentCoreStack = new AgentCoreStack(app, `${prefix}-AgentCoreStack`, {
  kbid: blogKBStack.kb.attrKnowledgeBaseId,
  assetBucketName: createZipAssetStack.asset.s3BucketName,
  assetPrefix: createZipAssetStack.asset.s3ObjectKey,
  entryPoint: cfg.entryPoint,
  agentRuntimeName: cfg.agentRuntimeName,
  embeddingModelId: cfg.embeddingModelId,
  hostingBucketName: cfg.hostingBucketName,
});

const chatAudioDurableStack = new ChatAudioDurableStack(
  app,
  `${prefix}-ChatAudioDurableStack`,
  {
    functionName: cfg.chatAudioDurableFunctionName,
    agentCoreArn: agentCoreStack.agentCoreRuntime.attrAgentRuntimeArn,
    synthesizeVoiceFunctionName: cfg.synthesizeVoiceFunctionName,
  },
);

#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { BuildAssetsStack } from "../lib/build-assets-stack";
import { HostingStack } from "../lib/hosting-stack";
import { SynthesizeVoiceEcrStack } from "../lib/lambda/synthesize-voice-ecr-stack";
import { SynthesizeVoiceStack } from "../lib/lambda/synthesize-voice-stack";
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

new SynthesizeVoiceStack(app, `${prefix}-SynthesizeVoiceStack`, {
  functionName: cfg.synthesizeVoiceFunctionName,
  repository: synthesizeVoiceEcrStack.repository,
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
});

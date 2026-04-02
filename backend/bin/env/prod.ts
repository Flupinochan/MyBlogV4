import { EnvConfig } from "./index";

export const config: EnvConfig = {
  name: "prod",
  domainName: "blog.metalmental.net",
  repoName: "MyBlogV4",
  branchName: "master",
  certificateArnParam: "certificate-arn",
  githubConnectionArnParam: "github-connection-arn",
  hostingBucketName: "prod-myblogv4-bucket",
  buildAssetsBucketName: "prod-myblogv4-build-assets",
  synthesizeVoiceFunctionName: "prod-myblogv4-synthesize-voice",
  synthesizeVoiceRepositoryName: "prod-myblogv4-synthesize-voice",
  sourceBucketName: "prod-myblogv4-blog-kb-source",
  vectorBucketName: "prod-myblogv4-blog-kb-vector",
  kbName: "prod-myblogv4-blog-kb",
  dataSourceName: "prod-myblogv4-blog-datasource",
  embeddingModelId: "amazon.titan-embed-text-v2:0",
  enrichingModelId: "amazon.nova-micro-v1:0",
  blogRepoName: "zenn-content",
  blogBranchName: "master",
};

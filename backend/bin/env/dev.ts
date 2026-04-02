import { EnvConfig } from "./index";

export const config: EnvConfig = {
  name: "dev",
  domainName: "dev-blog.metalmental.net",
  repoName: "MyBlogV4",
  branchName: "develop",
  certificateArnParam: "certificate-arn",
  githubConnectionArnParam: "github-connection-arn",
  hostingBucketName: "dev-myblogv4-bucket",
  buildAssetsBucketName: "dev-myblogv4-build-assets",
  synthesizeVoiceFunctionName: "dev-myblogv4-synthesize-voice",
  synthesizeVoiceRepositoryName: "dev-myblogv4-synthesize-voice",
  sourceBucketName: "dev-myblogv4-blog-kb-source",
  vectorBucketName: "dev-myblogv4-blog-kb-vector",
  kbName: "dev-myblogv4-blog-kb",
  dataSourceName: "dev-myblogv4-blog-datasource",
  embeddingModelId: "amazon.titan-embed-text-v2:0",
  enrichingModelId: "amazon.nova-micro-v1:0",
  blogRepoName: "zenn-content",
  blogBranchName: "master",
};

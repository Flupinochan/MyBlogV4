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
};

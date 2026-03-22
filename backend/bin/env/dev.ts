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
};

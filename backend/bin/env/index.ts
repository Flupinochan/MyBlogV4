import { config as devConfig } from "./dev";
import { config as prodConfig } from "./prod";

export interface EnvConfig {
  name: string;
  domainName: string;
  repoName: string;
  branchName: string;
  certificateArnParam: string;
  githubConnectionArnParam: string;
  // Stack間の依存関係を断つためにOutputは利用せず、事前にリソース名は定義しておく
  hostingBucketName: string;
  buildAssetsBucketName: string;
  chatAudioFunctionName: string;
  synthesizeVoiceFunctionName: string;
  synthesizeVoiceRepositoryName: string;
  sourceBucketName: string;
  vectorBucketName: string;
  kbName: string;
  dataSourceName: string;
  embeddingModelId: string;
  enrichingModelId: string;
  blogRepoName: string;
  blogBranchName: string;
  entryPoint: string[];
  agentRuntimeName: string;
  agentCorePlatform:
    | "aarch64-manylinux2014"
    | "aarch64-manylinux_2_28"
    | "aarch64-manylinux_2_34";
  sessionBucketName: string;
  agentId: string;
  openSearchBatchFunctionName: string;
  openSearchApiFunctionName: string;
  openSearchUrlParam: string;
  openSearchPortParam: string;
  openSearchUserParam: string;
  openSearchPassParam: string;
  aliasName: string;
  githubOwner: string;
  githubRepo: string;
  githubPath: string;
  githubAppsPrivateKeyParam: string;
  githubAppsIdParam: string;
  githubInstallationIdParam: string;
}

export function getEnvConfig(env: string): EnvConfig {
  switch (env) {
    case "dev":
      return devConfig;
    case "prod":
      return prodConfig;
    default:
      return devConfig;
  }
}

export function isProd(env: string): boolean {
  return env === "prod";
}

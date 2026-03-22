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
  synthesizeVoiceFunctionName: string;
  synthesizeVoiceRepositoryName: string;
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

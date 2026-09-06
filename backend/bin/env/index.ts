import { config as devConfig } from "./dev";
import { config as prodConfig } from "./prod";

// Stack間の依存関係を断つためにOutputは利用せず、事前にリソース名は定義しておく
export interface EnvConfig {
  envName: string;
  hostingDomainName: string;
  hostingBranchName: string;
  modelId: string;
  modelIdEmbedding: string;
  openSearchUrlParam: string;
  openSearchPortParam: string;
  openSearchUserParam: string;
  openSearchPassParam: string;
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

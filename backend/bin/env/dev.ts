import { EnvConfig } from "./index";

export const config: EnvConfig = {
  envName: "dev",
  hostingDomainName: "dev-blog.metalmental.net",
  hostingBranchName: "develop",
  modelId: "apac.amazon.nova-micro-v1:0",
  modelIdEmbedding: "amazon.titan-embed-text-v2:0",
  openSearchUrlParam: "zenn-open-search-url",
  openSearchPortParam: "zenn-open-search-port",
  openSearchUserSecretName: "zenn-open-search-user",
  openSearchPassSecretName: "zenn-open-search-pass",
};

import { EnvConfig } from "./index";

export const config: EnvConfig = {
  envName: "prod",
  hostingDomainName: "www.metalmental.net",
  alternateDomainName: "metalmental.net",
  hostingBranchName: "master",
  modelId: "apac.amazon.nova-micro-v1:0",
  modelIdEmbedding: "amazon.titan-embed-text-v2:0",
  openSearchUrlParam: "zenn-open-search-url",
  openSearchPortParam: "zenn-open-search-port",
  openSearchUserSecretName: "zenn-open-search-user",
  openSearchPassSecretName: "zenn-open-search-pass",
};

import { EnvConfig } from "./index";

export const config: EnvConfig = {
  envName: "prod",
  hostingDomainName: "www.metalmental.net",
  hostingBranchName: "master",
  modelId: "apac.amazon.nova-micro-v1:0",
  modelIdEmbedding: "amazon.titan-embed-text-v2:0",
  openSearchUrlParam: "zenn-open-search-url",
  openSearchPortParam: "zenn-open-search-port",
  openSearchUserParam: "zenn-open-search-user",
  openSearchPassParam: "zenn-open-search-pass",
};

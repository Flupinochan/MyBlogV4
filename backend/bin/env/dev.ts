import { EnvConfig } from "./index";

export const config: EnvConfig = {
  envName: "dev",
  hostingDomainName: "dev-blog.metalmental.net",
  hostingBranchName: "develop",
  modelId: "apac.amazon.nova-micro-v1:0",
  modelIdEmbedding: "amazon.titan-embed-text-v2:0",
  openSearchUrlParam: "zenn-open-search-url",
  openSearchPortParam: "zenn-open-search-port",
  openSearchUserParam: "zenn-open-search-user",
  openSearchPassParam: "zenn-open-search-pass",
};

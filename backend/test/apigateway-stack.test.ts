import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { OpenSearchApiGatewayStack } from "../lib/lambda/opensearch/opensearch-apigateway-stack";

const localOrigin = "http://127.0.0.1:4321";

const synthesize = (isProd: boolean): string => {
  const app = new cdk.App();
  const stack = new OpenSearchApiGatewayStack(app, "ApiStack", {
    domainName: "example.com",
    blogSearchApiPath: "opensearch-api",
    isProd,
    openSearchApiLambdaName: "search-api",
  });
  return JSON.stringify(Template.fromStack(stack).toJSON());
};

describe("OpenSearchApiGatewayStack", () => {
  test("本番ではCORSの許可オリジンにローカル開発用オリジンを含めない", () => {
    expect(synthesize(true)).not.toContain(localOrigin);
  });

  test("本番以外ではCORSの許可オリジンにローカル開発用オリジンを含める", () => {
    expect(synthesize(false)).toContain(localOrigin);
  });
});

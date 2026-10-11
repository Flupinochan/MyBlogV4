import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { HostingStack } from "../lib/hosting-stack";
import { OpenSearchApiGatewayStack } from "../lib/lambda/opensearch/opensearch-apigateway-stack";

const blogSearchApiPath = "opensearch-api";

const createTemplate = (): Template => {
  const app = new cdk.App();
  const apiStack = new OpenSearchApiGatewayStack(app, "ApiStack", {
    domainName: "example.com",
    blogSearchApiPath,
    isProd: false,
    openSearchApiLambdaName: "search-api",
  });
  const stack = new HostingStack(app, "HostingStack", {
    envName: "dev",
    hostingBucketName: "test-hosting-bucket",
    domainName: "example.com",
    certificateArnParam: "certificate-arn",
    blogSearchApiStack: apiStack,
    blogSearchApiPath,
  });
  return Template.fromStack(stack);
};

describe("HostingStack", () => {
  const template = createTemplate();

  test("S3バケットのパブリックアクセスを全てブロックする", () => {
    template.hasResourceProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  test("S3バケットへのHTTPアクセスを拒否する", () => {
    template.hasResourceProperties("AWS::S3::BucketPolicy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: "Deny",
            Condition: { Bool: { "aws:SecureTransport": "false" } },
          }),
        ]),
      },
    });
  });

  test("CloudFrontはHTTPSへリダイレクトし、index.htmlをルートにする", () => {
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        DefaultRootObject: "index.html",
        DefaultCacheBehavior: Match.objectLike({
          ViewerProtocolPolicy: "redirect-to-https",
        }),
      }),
    });
  });

  test("404をindex.htmlの200レスポンスに置き換える", () => {
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        CustomErrorResponses: Match.arrayWith([
          Match.objectLike({
            ErrorCode: 404,
            ResponseCode: 200,
            ResponsePagePath: "/index.html",
          }),
        ]),
      }),
    });
  });

  test("検索APIのパスに対するビヘイビアを生成する", () => {
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        CacheBehaviors: Match.arrayWith([
          Match.objectLike({ PathPattern: `/${blogSearchApiPath}/*` }),
        ]),
      }),
    });
  });
});

import { RemovalPolicy } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";

interface HostingStackProps extends cdk.StackProps {
  envName: string;
  hostingBucketName: string;
  domainName: string;
  alternateDomainName?: string;
  certificateArnParam: string;
  blogSearchApiStack?: { api: apigateway.RestApi };
  blogSearchApiPath?: string;
  voicevoxApiStack?: { api: apigateway.RestApi };
  voicevoxApiPath?: string;
}

export class HostingStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: HostingStackProps) {
    super(scope, id, props);

    // CORS設定を変更する場合はbucket名を変えて再ビルドしないと安定しないため注意
    this.bucket = new s3.Bucket(this, "bucket", {
      bucketName: props.hostingBucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedOrigins: [
            `https://${props.domainName}`,
            props.envName === "prod" ? "" : "http://localhost:4321",
          ],
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.HEAD,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE,
          ],
          allowedHeaders: ["*"],
          maxAge: 3000,
        },
      ],
    });

    const certificateArn = ssm.StringParameter.fromStringParameterAttributes(
      this,
      "CertificateArn",
      {
        parameterName: props.certificateArnParam,
      },
    ).stringValue;

    const certificate = acm.Certificate.fromCertificateArn(
      this,
      "Certificate",
      certificateArn,
    );

    this.distribution = new cloudfront.Distribution(this, "distribution", {
      domainNames: props.alternateDomainName
        ? [props.domainName, props.alternateDomainName]
        : [props.domainName],
      certificate: certificate,
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket, {
          originAccessLevels: [
            cloudfront.AccessLevel.READ,
            cloudfront.AccessLevel.LIST,
          ],
        }),
        originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy:
          cloudfront.ResponseHeadersPolicy
            .CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT_AND_SECURITY_HEADERS,
      },
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.minutes(0),
        },
      ],
    });

    const { blogSearchApiStack, blogSearchApiPath } = props;
    if (blogSearchApiStack && blogSearchApiPath) {
      const origin = new origins.HttpOrigin(
        `${blogSearchApiStack.api.restApiId}.execute-api.${this.region}.amazonaws.com`,
        { readTimeout: cdk.Duration.seconds(60) },
      );
      this.distribution.addBehavior(`/${blogSearchApiPath}/*`, origin, {
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy:
          cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      });
    }

    const { voicevoxApiStack, voicevoxApiPath } = props;
    if (voicevoxApiStack && voicevoxApiPath) {
      const voicevoxOrigin = new origins.HttpOrigin(
        `${voicevoxApiStack.api.restApiId}.execute-api.${this.region}.amazonaws.com`,
        { readTimeout: cdk.Duration.seconds(60) },
      );
      this.distribution.addBehavior(`/${voicevoxApiPath}/*`, voicevoxOrigin, {
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy:
          cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      });
    }
  }
}

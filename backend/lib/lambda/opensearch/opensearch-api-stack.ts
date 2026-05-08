import * as go from "@aws-cdk/aws-lambda-go-alpha";
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import * as path from "path";

interface OpenSearchApiStackProps extends cdk.StackProps {
  openSearchApiFunctionName: string;
  openSearchUrlParam: string;
  openSearchPortParam: string;
  openSearchUserParam: string;
  openSearchPassParam: string;
  aliasName: string;
  aliasNameEmbedding: string;
  modelId: string;
  modelIdEmbedding: string;
}

export class OpenSearchApiStack extends cdk.Stack {
  public readonly function: lambda.Function;
  public readonly logGroup: logs.LogGroup;
  public readonly role: iam.Role;

  constructor(scope: Construct, id: string, props: OpenSearchApiStackProps) {
    super(scope, id, props);

    const openSearchUrl = ssm.StringParameter.valueForStringParameter(
      this,
      props.openSearchUrlParam,
    );
    const openSearchPort = ssm.StringParameter.valueForStringParameter(
      this,
      props.openSearchPortParam,
    );
    const openSearchUser = ssm.StringParameter.valueForStringParameter(
      this,
      props.openSearchUserParam,
    );
    const openSearchPass = ssm.StringParameter.valueForStringParameter(
      this,
      props.openSearchPassParam,
    );

    this.logGroup = new logs.LogGroup(this, "OpenSearchApiLogGroup", {
      logGroupName: `/aws/lambda/${props.openSearchApiFunctionName}`,
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.role = new iam.Role(this, "OpenSearchApiRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole",
        ),
      ],
    });

    this.role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ],
        resources: [
          `arn:aws:bedrock:*:${cdk.Aws.ACCOUNT_ID}:inference-profile/*`,
          "arn:aws:bedrock:*::foundation-model/*",
        ],
      }),
    );

    this.function = new go.GoFunction(this, "OpenSearchApiFunction", {
      functionName: props.openSearchApiFunctionName,
      entry: path.join(__dirname, "cmd/api"),
      runtime: lambda.Runtime.PROVIDED_AL2023,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.minutes(3),
      memorySize: 256,
      logGroup: this.logGroup,
      loggingFormat: lambda.LoggingFormat.JSON,
      // 常にDEBUGにしておいて、slog側のログレベル(Lambda環境変数)で制御
      applicationLogLevelV2: lambda.ApplicationLogLevel.DEBUG,
      role: this.role,
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        OPEN_SEARCH_URL: openSearchUrl,
        OPEN_SEARCH_PORT: openSearchPort,
        OPEN_SEARCH_USER: openSearchUser,
        OPEN_SEARCH_PASS: openSearchPass,
        ALIAS_NAME: props.aliasName,
        ALIAS_NAME_EMBEDDING: props.aliasNameEmbedding,
        MODEL_ID: props.modelId,
        MODEL_ID_EMBEDDING: props.modelIdEmbedding,
        GIN_MODE: "release",
        LOG_LEVEL: "0", // DEBUG:-4、INFO:0、WARN:4、ERROR:8
        AWS_LAMBDA_LOG_LEVEL: "INFO",
        AWS_LAMBDA_LOG_FORMAT: "JSON",
        AWS_LAMBDA_EXEC_WRAPPER: "/opt/bootstrap",
        AWS_LWA_PORT: "8080",
        AWS_LWA_READINESS_CHECK_PORT: "8080",
        AWS_LWA_READINESS_CHECK_PATH: "/api/v1/health/lwa",
      },
      bundling: {
        goBuildFlags: ['-ldflags "-s -w"'],
      },
      layers: [
        lambda.LayerVersion.fromLayerVersionArn(
          this,
          "LambdaAdapterLayer",
          `arn:aws:lambda:${this.region}:753240598075:layer:LambdaAdapterLayerArm64:27`,
        ),
      ],
    });
  }
}

/**
 * Lambdaでテストする場合は以下で確認可能 (LambdaWebAdapterでAPI Gatewayイベントで呼び出せる)
{
  "version": "2.0",
  "routeKey": "GET /api/v1/health",
  "rawPath": "/api/v1/health",
  "requestContext": {
    "http": {
      "method": "GET",
      "path": "/api/v1/health"
    }
  }
}
 */

import * as go from "@aws-cdk/aws-lambda-go-alpha";
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import * as path from "path";

interface OpenSearchBatchStackProps extends cdk.StackProps {
  openSearchBatchFunctionName: string;
  openSearchUrlParam: string;
  openSearchPortParam: string;
  openSearchUserParam: string;
  openSearchPassParam: string;
  aliasName: string;
  githubOwner: string;
  githubRepo: string;
  githubPath: string;
  githubAppsPrivateKey: string;
  githubAppsId: string;
  githubInstallationId: string;
  modelId: string;
  embeddingModelId: string;
}

export class OpenSearchBatchStack extends cdk.Stack {
  public readonly function: lambda.Function;
  public readonly logGroup: logs.LogGroup;
  public readonly role: iam.Role;

  constructor(scope: Construct, id: string, props: OpenSearchBatchStackProps) {
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
    const githubAppsPrivateKey = ssm.StringParameter.valueForStringParameter(
      this,
      props.githubAppsPrivateKey,
    );
    const githubAppsId = ssm.StringParameter.valueForStringParameter(
      this,
      props.githubAppsId,
    );
    const githubInstallationId = ssm.StringParameter.valueForStringParameter(
      this,
      props.githubInstallationId,
    );

    this.logGroup = new logs.LogGroup(this, "OpenSearchBatchLogGroup", {
      logGroupName: `/aws/lambda/${props.openSearchBatchFunctionName}`,
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.role = new iam.Role(this, "OpenSearchBatchRole", {
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

    new go.GoFunction(this, "MyGoFunction", {
      functionName: props.openSearchBatchFunctionName,
      entry: path.join(__dirname, "cmd/batch"),
      runtime: lambda.Runtime.PROVIDED_AL2023,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.minutes(3),
      memorySize: 256,
      logGroup: this.logGroup,
      loggingFormat: lambda.LoggingFormat.JSON,
      // 常にDEBUGにしておいて、slog側で制御
      applicationLogLevelV2: lambda.ApplicationLogLevel.DEBUG,
      role: this.role,
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        OPEN_SEARCH_URL: openSearchUrl,
        OPEN_SEARCH_PORT: openSearchPort,
        OPEN_SEARCH_USER: openSearchUser,
        OPEN_SEARCH_PASS: openSearchPass,
        LOG_LEVEL: "-4", // DEBUG:-4、INFO:0、WARN:4、ERROR:8
        ALIAS_NAME: props.aliasName,
        ALIAS_NAME_EMBEDDING: `${props.aliasName}-embedding`,
        GITHUB_OWNER: props.githubOwner,
        GITHUB_REPO: props.githubRepo,
        GITHUB_PATH: props.githubPath,
        GITHUB_APPS_PRIVATE_KEY: githubAppsPrivateKey,
        GITHUB_APPS_ID: githubAppsId,
        GITHUB_INSTALLATION_ID: githubInstallationId,
        MODEL_ID: props.modelId,
        EMBEDDING_MODEL_ID: props.embeddingModelId,
      },
      bundling: {
        goBuildFlags: ['-ldflags "-s -w"'],
      },
    });
  }
}

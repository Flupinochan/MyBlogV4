import * as go from "@aws-cdk/aws-lambda-go-alpha";
import * as cdk from "aws-cdk-lib";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import * as path from "path";

interface OpenSearchBatchLambdaStackProps extends cdk.StackProps {
  openSearchBatchLambdaName: string;
  openSearchUrlParam: string;
  openSearchPortParam: string;
  openSearchUserParam: string;
  openSearchPassParam: string;
  aliasName: string;
  githubOwner: string;
  githubRepo: string;
  githubPath: string;
  githubAppsPrivateKeyParam: string;
  githubAppsIdParam: string;
  githubInstallationIdParam: string;
  modelId: string;
  embeddingModelId: string;
  githubConnectionArnParam: string;
  blogBranchName: string;
}

export class OpenSearchBatchLambdaStack extends cdk.Stack {
  public readonly function: lambda.Function;
  public readonly logGroup: logs.LogGroup;
  public readonly role: iam.Role;
  public readonly pipeline: codepipeline.Pipeline;

  constructor(scope: Construct, id: string, props: OpenSearchBatchLambdaStackProps) {
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
      props.githubAppsPrivateKeyParam,
    );
    const githubAppsId = ssm.StringParameter.valueForStringParameter(
      this,
      props.githubAppsIdParam,
    );
    const githubInstallationId = ssm.StringParameter.valueForStringParameter(
      this,
      props.githubInstallationIdParam,
    );

    this.logGroup = new logs.LogGroup(this, "OpenSearchBatchLogGroup", {
      logGroupName: `/aws/lambda/${props.openSearchBatchLambdaName}`,
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

    this.role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "codepipeline:PutJobSuccessResult",
          "codepipeline:PutJobFailureResult",
        ],
        resources: ["*"],
      }),
    );

    new go.GoFunction(this, "OpenSearchBatchFunction", {
      functionName: props.openSearchBatchLambdaName,
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

    const connectionArn = ssm.StringParameter.fromStringParameterAttributes(
      this,
      "GitHubConnectionArn",
      {
        parameterName: props.githubConnectionArnParam,
      },
    ).stringValue;

    const artifactBucket = new s3.Bucket(this, "ArtifactBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(1),
        },
      ],
    });

    this.pipeline = new codepipeline.Pipeline(this, "Pipeline", {
      artifactBucket,
      crossAccountKeys: false,
    });

    this.pipeline.addStage({
      stageName: "Source",
      actions: [
        new codepipeline_actions.CodeStarConnectionsSourceAction({
          actionName: "GitHub_Source",
          connectionArn: connectionArn,
          owner: props.githubOwner,
          repo: props.githubRepo,
          branch: props.blogBranchName,
          output: new codepipeline.Artifact("SourceOutput"),
        }),
      ],
    });

    this.pipeline.addStage({
      stageName: "Build",
      actions: [
        new codepipeline_actions.LambdaInvokeAction({
          actionName: "OpenSearchBlogSync",
          lambda: cdk.aws_lambda.Function.fromFunctionArn(
            this,
            "OpenSearchApiFunctionRef",
            `arn:aws:lambda:${this.region}:${this.account}:function:${props.openSearchBatchLambdaName}`,
          ),
        }),
      ],
    });
  }
}

import { Duration } from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";

interface VoicevoxLambdaStackProps extends cdk.StackProps {
  voicevoxLambdaName: string;
  voicevoxEcrName: string;
  imageTag: string;
  createdVoiceOutputBucketName: string;
  claudeApiKeyParam: string;
  claudeWorkspaceIdParam: string;
  postgresqlUrlParam: string;
}

export class VoicevoxLambdaStack extends cdk.Stack {
  public readonly function: lambda.DockerImageFunction;
  public readonly logGroup: logs.LogGroup;
  public readonly role: iam.Role;

  constructor(scope: Construct, id: string, props: VoicevoxLambdaStackProps) {
    super(scope, id, props);

    const claudeApiKey = ssm.StringParameter.valueForStringParameter(
      this,
      props.claudeApiKeyParam,
    );

    const claudeWorkspaceId = ssm.StringParameter.valueForStringParameter(
      this,
      props.claudeWorkspaceIdParam,
    );

    const postgresqlUrl = ssm.StringParameter.valueForStringParameter(
      this,
      props.postgresqlUrlParam,
    );

    this.logGroup = new logs.LogGroup(this, "logGroup", {
      logGroupName: `/aws/lambda/${props.voicevoxLambdaName}`,
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.role = new iam.Role(this, "role", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole",
        ),
      ],
      inlinePolicies: {
        SynthesizeVoicePolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ["s3:*"],
              resources: [
                `arn:aws:s3:::${props.createdVoiceOutputBucketName}`,
                `arn:aws:s3:::${props.createdVoiceOutputBucketName}/*`,
              ],
            }),
          ],
        }),
        ClaudeAgentSdkPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ["aws-external-anthropic:*"],
              resources: ["*"],
            }),
          ],
        }),
      },
    });

    const voicevoxEcr = ecr.Repository.fromRepositoryName(
      this,
      "EcrRepository",
      props.voicevoxEcrName,
    );

    this.function = new lambda.DockerImageFunction(this, "function", {
      functionName: props.voicevoxLambdaName,
      code: lambda.DockerImageCode.fromEcr(voicevoxEcr, {
        tagOrDigest: props.imageTag,
      }),
      architecture: lambda.Architecture.X86_64,
      timeout: Duration.seconds(60),
      memorySize: 1024,
      logGroup: this.logGroup,
      loggingFormat: lambda.LoggingFormat.JSON,
      applicationLogLevelV2: lambda.ApplicationLogLevel.DEBUG,
      role: this.role,
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        VOICE_OUTPUT_BUCKET_NAME: props.createdVoiceOutputBucketName,
        ANTHROPIC_AWS_API_KEY: claudeApiKey,
        CLAUDE_CODE_USE_ANTHROPIC_AWS: "1",
        ANTHROPIC_AWS_WORKSPACE_ID: claudeWorkspaceId,
        POSTGRESQL_URL: postgresqlUrl,
        HOME: "/tmp",
        POWERTOOLS_LOG_LEVEL: "INFO",
        AWS_LAMBDA_LOG_LEVEL: "INFO",
        AWS_LAMBDA_LOG_FORMAT: "JSON",
        AWS_LWA_PORT: "8080",
        AWS_LWA_READINESS_CHECK_PORT: "8080",
        AWS_LWA_READINESS_CHECK_PATH: "/v1/health",
      },
    });
  }
}

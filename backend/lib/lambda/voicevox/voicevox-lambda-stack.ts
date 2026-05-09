import { Duration } from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";

interface VoicevoxLambdaStackProps extends cdk.StackProps {
  voicevoxLambdaName: string;
  voicevoxEcrName: string;
  imageTag: string;
  createdVoiceOutputBucketName: string;
}

export class VoicevoxLambdaStack extends cdk.Stack {
  public readonly function: lambda.DockerImageFunction;
  public readonly logGroup: logs.LogGroup;
  public readonly role: iam.Role;

  constructor(scope: Construct, id: string, props: VoicevoxLambdaStackProps) {
    super(scope, id, props);

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
      timeout: Duration.seconds(900),
      memorySize: 1024,
      logGroup: this.logGroup,
      loggingFormat: lambda.LoggingFormat.JSON,
      role: this.role,
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        VOICE_OUTPUT_BUCKET_NAME: props.createdVoiceOutputBucketName,
      },
    });
  }
}

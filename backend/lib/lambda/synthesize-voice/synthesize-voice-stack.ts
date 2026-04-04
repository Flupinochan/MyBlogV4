import { Duration } from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";

interface SynthesizeVoiceStackProps extends cdk.StackProps {
  functionName: string;
  repository: ecr.IRepository;
  imageTagOrDigest: string;
  voiceOutputBucketName: string;
}

export class SynthesizeVoiceStack extends cdk.Stack {
  public readonly function: lambda.DockerImageFunction;
  public readonly logGroup: logs.LogGroup;
  public readonly role: iam.Role;

  constructor(scope: Construct, id: string, props: SynthesizeVoiceStackProps) {
    super(scope, id, props);

    this.logGroup = new logs.LogGroup(this, "logGroup", {
      logGroupName: `/aws/lambda/${props.functionName}`,
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
                `arn:aws:s3:::${props.voiceOutputBucketName}`,
                `arn:aws:s3:::${props.voiceOutputBucketName}/*`,
              ],
            }),
          ],
        }),
      },
    });

    this.function = new lambda.DockerImageFunction(this, "function", {
      functionName: props.functionName,
      code: lambda.DockerImageCode.fromEcr(props.repository, {
        tagOrDigest: props.imageTagOrDigest,
      }),
      architecture: lambda.Architecture.X86_64,
      timeout: Duration.seconds(300),
      memorySize: 1024,
      logGroup: this.logGroup,
      loggingFormat: lambda.LoggingFormat.JSON,
      role: this.role,
      environment: {
        VOICE_OUTPUT_BUCKET_NAME: props.voiceOutputBucketName,
      },
    });
  }
}

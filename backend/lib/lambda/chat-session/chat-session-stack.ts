import { PythonFunction } from "@aws-cdk/aws-lambda-python-alpha";
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import path from "path";

interface ChatSessionStackProps extends cdk.StackProps {
  functionName: string;
  sessionBucketName: string;
}

export class ChatSessionStack extends cdk.Stack {
  public readonly function: lambda.Function;
  public readonly logGroup: logs.LogGroup;
  public readonly role: iam.Role;

  constructor(scope: Construct, id: string, props: ChatSessionStackProps) {
    super(scope, id, props);

    this.logGroup = new logs.LogGroup(this, "ChatSessionLogGroup", {
      logGroupName: `/aws/lambda/${props.functionName}`,
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.role = new iam.Role(this, "ChatSessionRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole",
        ),
      ],
      inlinePolicies: {
        AccessSessionBucket: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ["s3:*"],
              resources: [
                `arn:aws:s3:::${props.sessionBucketName}`,
                `arn:aws:s3:::${props.sessionBucketName}/*`,
              ],
            }),
          ],
        }),
      },
    });

    this.function = new PythonFunction(this, "ChatSessionFunction", {
      functionName: props.functionName,
      runtime: lambda.Runtime.PYTHON_3_13,
      entry: path.join(__dirname, "src"),
      index: "index.py",
      handler: "lambda_handler",
      timeout: cdk.Duration.minutes(5),
      memorySize: 128,
      logGroup: this.logGroup,
      loggingFormat: lambda.LoggingFormat.JSON,
      role: this.role,
      architecture: lambda.Architecture.X86_64,
      layers: [
        lambda.LayerVersion.fromLayerVersionArn(
          this,
          "AWSLambdaPowertoolsPython",
          `arn:aws:lambda:${this.region}:017000801446:layer:AWSLambdaPowertoolsPythonV3-python313-x86_64:27`,
        ),
      ],
      environment: {
        TZ: "Asia/Tokyo",
        POWERTOOLS_LOGGER_LOG_EVENT: "true",
        S3_SESSION_BUCKET_NAME: props.sessionBucketName,
      },
    });
  }
}

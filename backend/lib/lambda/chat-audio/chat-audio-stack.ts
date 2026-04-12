import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import path from "path";

interface ChatAudioStackProps extends cdk.StackProps {
  functionName: string;
  agentCoreArn: string;
  synthesizeVoiceFunctionName: string;
  domainName: string;
}

export class ChatAudioStack extends cdk.Stack {
  public readonly function: lambda.Function;
  public readonly logGroup: logs.LogGroup;
  public readonly role: iam.Role;

  constructor(scope: Construct, id: string, props: ChatAudioStackProps) {
    super(scope, id, props);

    const synthesizeVoiceFunctionArn = `arn:aws:lambda:${this.region}:${this.account}:function:${props.synthesizeVoiceFunctionName}`;

    this.logGroup = new logs.LogGroup(this, "ChatAudioLogGroup", {
      logGroupName: `/aws/lambda/${props.functionName}`,
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.role = new iam.Role(this, "ChatAudioRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole",
        ),
      ],
      inlinePolicies: {
        InvokeBedrockAgentCore: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ["bedrock-agentcore:InvokeAgentRuntime"],
              resources: [`${props.agentCoreArn}`, `${props.agentCoreArn}/*`],
            }),
          ],
        }),
        InvokeSynthesizeVoiceFunction: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ["lambda:InvokeFunction"],
              resources: [synthesizeVoiceFunctionArn],
            }),
          ],
        }),
      },
    });

    this.function = new NodejsFunction(this, "ChatAudioFunction", {
      functionName: props.functionName,
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: "index.handler",
      entry: path.join(__dirname, "src/index.ts"),
      timeout: cdk.Duration.minutes(15),
      memorySize: 128,
      logGroup: this.logGroup,
      loggingFormat: lambda.LoggingFormat.JSON,
      role: this.role,
      layers: [
        lambda.LayerVersion.fromLayerVersionArn(
          this,
          "AWSLambdaPowertoolsTypeScript",
          `arn:aws:lambda:${this.region}:094274105915:layer:AWSLambdaPowertoolsTypeScriptV2:46`,
        ),
      ],
      environment: {
        TZ: "Asia/Tokyo",
        POWERTOOLS_LOGGER_LOG_EVENT: "true",
        AGENT_RUNTIME_ARN: props.agentCoreArn,
        SYNTHESIZE_VOICE_FUNCTION_ARN: synthesizeVoiceFunctionArn,
        DOMAIN_NAME: props.domainName,
      },
    });
  }
}

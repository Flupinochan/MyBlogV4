import * as cdk from "aws-cdk-lib";
import * as bedrockagentcore from "aws-cdk-lib/aws-bedrockagentcore";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

interface AgentCoreStackProps extends cdk.StackProps {
  kbid: string;
  assetBucketName: string;
  assetPrefix: string;
  entryPoint: string[];
  agentRuntimeName: string;
  embeddingModelId: string;
}

export class AgentCoreStack extends cdk.Stack {
  public readonly agentCoreRole: iam.Role;
  public readonly agentCoreRuntime: bedrockagentcore.CfnRuntime;

  constructor(scope: Construct, id: string, props: AgentCoreStackProps) {
    super(scope, id, props);

    this.agentCoreRole = new iam.Role(this, "AgentCoreRole", {
      assumedBy: new iam.ServicePrincipal("bedrock-agentcore.amazonaws.com"),
    });

    this.agentCoreRole.addToPolicy(
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

    this.agentCoreRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "logs:DescribeLogGroups",
          "xray:PutTelemetryRecords",
          "xray:PutTraceSegments",
        ],
        resources: ["*"],
      }),
    );

    this.agentCoreRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:DescribeLogStreams",
          "logs:FilterLogEvents",
          "logs:GetLogEvents",
          "logs:PutLogEvents",
        ],
        resources: [
          `arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/bedrock-agentcore/runtimes/*`,
        ],
      }),
    );

    this.agentCoreRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["bedrock:Retrieve", "bedrock:RetrieveAndGenerate"],
        resources: [
          `arn:aws:bedrock:*:${cdk.Aws.ACCOUNT_ID}:knowledge-base/${props.kbid}`,
        ],
      }),
    );

    this.agentCoreRuntime = new bedrockagentcore.CfnRuntime(
      this,
      "AgentCoreRuntime",
      {
        agentRuntimeName: props.agentRuntimeName,
        agentRuntimeArtifact: {
          codeConfiguration: {
            runtime: "PYTHON_3_13",
            entryPoint: props.entryPoint,
            code: {
              s3: {
                bucket: props.assetBucketName,
                prefix: props.assetPrefix,
              },
            },
          },
        },
        roleArn: this.agentCoreRole.roleArn,
        networkConfiguration: {
          networkMode: "PUBLIC",
        },
        lifecycleConfiguration: {
          maxLifetime: 1800,
          idleRuntimeSessionTimeout: 900,
        },
        environmentVariables: {
          KNOWLEDGE_BASE_ID: props.kbid,
          EMBEDDING_MODEL_ARN: `arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/${props.embeddingModelId}`,
        },
      },
    );
  }
}

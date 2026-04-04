import * as cdk from "aws-cdk-lib";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

interface BlogKBPipelineStackProps extends cdk.StackProps {
  githubConnectionArnParam: string;
  repositoryName: string;
  branchName: string;
  sourceBucketName: string;
  kbid: string;
  dataSourceId: string;
}

export class BlogKBPipelineStack extends cdk.Stack {
  public readonly codeBuildLogGroup: logs.LogGroup;
  public readonly artifactBucket: s3.Bucket;
  public readonly codeBuild: codebuild.Project;
  public readonly pipeline: codepipeline.Pipeline;

  constructor(scope: Construct, id: string, props: BlogKBPipelineStackProps) {
    super(scope, id, props);

    const connectionArn = ssm.StringParameter.fromStringParameterAttributes(
      this,
      "GitHubConnectionArn",
      {
        parameterName: props.githubConnectionArnParam,
      },
    ).stringValue;

    this.codeBuildLogGroup = new logs.LogGroup(this, "CodeBuildLogGroup", {
      logGroupName: `/aws/codebuild/${this.stackName}-build-logs`,
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.artifactBucket = new s3.Bucket(this, "ArtifactBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(1),
        },
      ],
    });

    this.codeBuild = new codebuild.PipelineProject(this, "CodeBuildProject", {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
        privileged: true,
      },
      logging: {
        cloudWatch: {
          logGroup: this.codeBuildLogGroup,
        },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          install: {
            commands: ["aws --version"],
          },
          build: {
            commands: [
              `aws s3 sync articles/ s3://${props.sourceBucketName}/ \
                --delete \
                --exclude "*" \
                --include "*.md"`,
            ],
          },
          post_build: {
            commands: [
              `aws bedrock-agent start-ingestion-job \
                --knowledge-base-id ${props.kbid} \
                --data-source-id ${props.dataSourceId}`,
            ],
          },
        },
      }),
    });

    this.codeBuild.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["s3:*"],
        resources: [
          `arn:aws:s3:::${props.sourceBucketName}`,
          `arn:aws:s3:::${props.sourceBucketName}/*`,
        ],
      }),
    );

    this.codeBuild.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["bedrock:StartIngestionJob"],
        resources: [
          `arn:aws:bedrock:${this.region}:${this.account}:knowledge-base/${props.kbid}`,
        ],
      }),
    );

    this.pipeline = new codepipeline.Pipeline(this, "Pipeline", {
      artifactBucket: this.artifactBucket,
      crossAccountKeys: false,
    });

    const sourceOutput = new codepipeline.Artifact("SourceOutput");

    this.pipeline.addStage({
      stageName: "Source",
      actions: [
        new codepipeline_actions.CodeStarConnectionsSourceAction({
          actionName: "GitHub_Source",
          connectionArn: connectionArn,
          owner: "Flupinochan",
          repo: props.repositoryName,
          branch: props.branchName,
          output: sourceOutput,
        }),
      ],
    });

    this.pipeline.addStage({
      stageName: "Build",
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: "Build_And_Deploy",
          project: this.codeBuild,
          input: sourceOutput,
          outputs: [new codepipeline.Artifact("BuildOutput")],
        }),
      ],
    });
  }
}

import * as cdk from "aws-cdk-lib";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

interface HostingPipelineStackProps extends cdk.StackProps {
  envName: string;
  githubConnectionArnParam: string;
  repoName: string;
  branchName: string;
  hostingBucketName: string;
  hostingDistributionId: string;
  voicevoxBucketName: string;
  voicevoxEcrName: string;
}

export class HostingPipelineStack extends cdk.Stack {
  public readonly codeBuildLogGroup: logs.LogGroup;
  public readonly artifactBucket: s3.Bucket;
  public readonly codebuild: codebuild.PipelineProject;
  public readonly pipeline: codepipeline.Pipeline;

  constructor(scope: Construct, id: string, props: HostingPipelineStackProps) {
    super(scope, id, props);

    const connectionArn = ssm.StringParameter.fromStringParameterAttributes(
      this,
      "GitHubConnectionArn",
      {
        parameterName: props.githubConnectionArnParam,
      },
    ).stringValue;

    this.codeBuildLogGroup = new logs.LogGroup(this, "CodeBuildLogGroup", {
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

    this.codebuild = new codebuild.PipelineProject(this, "BuildProject", {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
        privileged: true,
      },
      environmentVariables: {
        // husky対策
        CI: { value: "true" },
        HUSKY: { value: "0" },
        GITHUB_TOKEN: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: "github-zenn-token",
        },
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
            "runtime-versions": {
              nodejs: "24",
              golang: "1.26",
            },
            "on-failure": "ABORT",
            commands: [
              // prepare bun
              "node -v",
              "curl -fsSL https://bun.com/install | bash",
              'export BUN_INSTALL="$HOME/.bun"',
              'export PATH="$BUN_INSTALL/bin:$PATH"',
              "ln -s $HOME/.bun/bin/bun /usr/local/bin/bun",
              "bun -v",
              // prepare voicevox assets
              "mkdir -p backend/lib/lambda/voicevox",
              `aws s3 cp s3://${props.voicevoxBucketName}/voicevox.tar.gz voicevox.tar.gz`,
              "tar -xzf voicevox.tar.gz -C backend/lib/lambda/voicevox",
            ],
          },
          // build & deploy backend
          pre_build: {
            "on-failure": "ABORT",
            commands: [
              // build and push Docker image for synthesizeVoice Lambda
              `export VOICEVOX_LAMBDA_IMAGE_TAG=$(date -u +%Y%m%d%H%M%S)`,
              `export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)`,
              `export ECR_URI=$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/${props.voicevoxEcrName}`,
              `aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com`,
              `docker build -t ${props.voicevoxEcrName}:$VOICEVOX_LAMBDA_IMAGE_TAG backend/lib/lambda/voicevox`,
              `docker tag ${props.voicevoxEcrName}:$VOICEVOX_LAMBDA_IMAGE_TAG $ECR_URI:$VOICEVOX_LAMBDA_IMAGE_TAG`,
              `docker push $ECR_URI:$VOICEVOX_LAMBDA_IMAGE_TAG`,
              "cd $CODEBUILD_SRC_DIR/backend",
              // install uv
              "pip install uv",
              // deploy backend
              `bun install --frozen-lockfile --ignore-scripts`,
              `bun run cdk -- deploy --all --parallel --ci --require-approval never --context env=${props.envName} --context voicevoxLambdaImageTag=$VOICEVOX_LAMBDA_IMAGE_TAG`,
            ],
          },
          // build frontend
          build: {
            "on-failure": "ABORT",
            commands: [
              "cd $CODEBUILD_SRC_DIR/frontend",
              `bun install --frozen-lockfile --ignore-scripts`,
              `bun run build -- --mode ${props.envName}`,
            ],
          },
          // deploy frontend
          post_build: {
            "on-failure": "ABORT",
            commands: [
              // upload built assets to hosting bucket
              `aws s3 sync $CODEBUILD_SRC_DIR/frontend/dist/ s3://${props.hostingBucketName}/ --delete`,
              // finally invalidate CloudFront
              `aws cloudfront create-invalidation --distribution-id ${props.hostingDistributionId} --paths "/*"`,
            ],
          },
        },
      }),
    });

    this.codebuild.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["s3:*"],
        resources: [
          `arn:aws:s3:::${props.hostingBucketName}`,
          `arn:aws:s3:::${props.hostingBucketName}/*`,
          `arn:aws:s3:::${props.voicevoxBucketName}`,
          `arn:aws:s3:::${props.voicevoxBucketName}/*`,
        ],
      }),
    );

    this.codebuild.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["cloudfront:CreateInvalidation"],
        resources: [
          `arn:aws:cloudfront::${this.account}:distribution/${props.hostingDistributionId}`,
        ],
      }),
    );

    this.codebuild.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["sts:AssumeRole"],
        resources: ["*"],
        conditions: {
          "ForAnyValue:StringEquals": {
            "iam:ResourceTag/aws-cdk:bootstrap-role": [
              "image-publishing",
              "file-publishing",
              "deploy",
              "lookup",
            ],
          },
        },
      }),
    );

    this.codebuild.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["ecr:*"],
        resources: [
          `arn:aws:ecr:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:repository/${props.voicevoxEcrName}`,
        ],
      }),
    );
    this.codebuild.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["ecr:GetAuthorizationToken"],
        resources: ["*"],
      }),
    );

    this.codebuild.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["ssm:GetParameter"],
        resources: ["*"],
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
          repo: props.repoName,
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
          project: this.codebuild,
          input: sourceOutput,
          outputs: [new codepipeline.Artifact("BuildOutput")],
        }),
      ],
    });
  }
}

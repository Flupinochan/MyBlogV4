import { RemovalPolicy } from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";

interface VoicevoxEcrStackProps extends cdk.StackProps {
  voicevoxEcrName: string;
}

// CodeBuildでビルドしたImageを格納するECRリポジトリ
export class VoicevoxEcrStack extends cdk.Stack {
  public readonly repository: ecr.Repository;

  constructor(scope: Construct, id: string, props: VoicevoxEcrStackProps) {
    super(scope, id, props);

    this.repository = new ecr.Repository(this, "repository", {
      repositoryName: props.voicevoxEcrName,
      removalPolicy: RemovalPolicy.DESTROY,
      emptyOnDelete: true,
      lifecycleRules: [
        {
          description: "Keep only one image in the repository.",
          maxImageCount: 1,
        },
      ],
    });
  }
}

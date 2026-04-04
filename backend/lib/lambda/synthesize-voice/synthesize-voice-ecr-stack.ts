import { RemovalPolicy } from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";

interface SynthesizeVoiceEcrStackProps extends cdk.StackProps {
  repositoryName: string;
}

export class SynthesizeVoiceEcrStack extends cdk.Stack {
  public readonly repository: ecr.Repository;

  constructor(
    scope: Construct,
    id: string,
    props: SynthesizeVoiceEcrStackProps,
  ) {
    super(scope, id, props);

    this.repository = new ecr.Repository(this, "repository", {
      repositoryName: props.repositoryName,
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

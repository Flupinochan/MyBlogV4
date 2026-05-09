import { RemovalPolicy } from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";

interface VoicevoxBucketStackProps extends cdk.StackProps {
  voicevoxBucketName: string;
}

// 事前にここにvoicevox engine関連のリソースをアップロードしておき、
// CodeBuildからダウンロードしてImageをビルドする
export class VoicevoxBucketStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: VoicevoxBucketStackProps) {
    super(scope, id, props);

    this.bucket = new s3.Bucket(this, "bucket", {
      bucketName: props.voicevoxBucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
  }
}

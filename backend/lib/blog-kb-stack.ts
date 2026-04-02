import * as cdk from "aws-cdk-lib";
import {
  aws_bedrock as bedrock,
  aws_s3vectors as s3vectors,
} from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

interface BlogKBStackProps extends cdk.StackProps {
  sourceBucketName: string;
  vectorBucketName: string;
  kbName: string;
  dataSourceName: string;
  embeddingModelId: string;
  enrichingModelId: string;
}

export class BlogKBStack extends cdk.Stack {
  public readonly sourceS3Bucket: s3.Bucket;
  public readonly vectorBucket: s3vectors.CfnVectorBucket;
  public readonly vectorBucketIndex: s3vectors.CfnIndex;
  public readonly kbRole: iam.Role;
  public readonly kb: bedrock.CfnKnowledgeBase;
  public readonly dataSource: bedrock.CfnDataSource;

  constructor(scope: Construct, id: string, props: BlogKBStackProps) {
    super(scope, id, props);

    this.sourceS3Bucket = new s3.Bucket(this, "SourceS3Bucket", {
      bucketName: props.sourceBucketName,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(1),
        },
      ],
    });

    this.vectorBucket = new s3vectors.CfnVectorBucket(this, " VectorBucket", {
      vectorBucketName: props.vectorBucketName,
    });
    this.vectorBucketIndex = new s3vectors.CfnIndex(this, "VectorBucketIndex", {
      vectorBucketArn: this.vectorBucket.attrVectorBucketArn,
      dataType: "float32",
      distanceMetric: "cosine",
      dimension: 1024,
      metadataConfiguration: {
        nonFilterableMetadataKeys: [
          "AMAZON_BEDROCK_TEXT",
          "AMAZON_BEDROCK_METADATA",
        ],
      },
    });

    this.kbRole = new iam.Role(this, "KBRole", {
      assumedBy: new iam.ServicePrincipal("bedrock.amazonaws.com"),
      inlinePolicies: {
        BedrockKBPolicy: new iam.PolicyDocument({
          statements: [
            // addToPolicyだと依存関係が解決されないため、インラインポリシーで定義
            new iam.PolicyStatement({
              actions: ["s3:*"],
              resources: [
                this.sourceS3Bucket.bucketArn,
                `${this.sourceS3Bucket.bucketArn}/*`,
              ],
            }),
            new iam.PolicyStatement({
              actions: ["s3vectors:*"],
              resources: [
                this.vectorBucket.attrVectorBucketArn,
                this.vectorBucketIndex.attrIndexArn,
              ],
            }),
            new iam.PolicyStatement({
              actions: ["bedrock:InvokeModel", "bedrock:GetInferenceProfile"],
              resources: ["*"],
            }),
            new iam.PolicyStatement({
              actions: [
                "aws-marketplace:Subscribe",
                "aws-marketplace:ViewSubscriptions",
                "aws-marketplace:Unsubscribe",
              ],
              resources: ["*"],
            }),
          ],
        }),
      },
    });

    this.kb = new bedrock.CfnKnowledgeBase(this, "KB", {
      name: props.kbName,
      roleArn: this.kbRole.roleArn,
      knowledgeBaseConfiguration: {
        type: "VECTOR",
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: `arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/${props.embeddingModelId}`,
        },
      },
      storageConfiguration: {
        type: "S3_VECTORS",
        s3VectorsConfiguration: {
          vectorBucketArn: this.vectorBucket.attrVectorBucketArn,
          indexArn: this.vectorBucketIndex.attrIndexArn,
        },
      },
    });

    const parsingPromptText = `You are an expert document parser. Your task is to extract and structure the content of the provided Markdown document to ensure high-quality retrieval in a RAG system.

Please follow these instructions:
1. Maintain the original Markdown heading hierarchy (#, ##, ###) to preserve the document's logical structure.
2. Ensure all tables are extracted in their Markdown table format. Do not simplify them into plain text.
3. Keep all lists (bulleted or numbered) exactly as they appear.
4. For code blocks, preserve the syntax, indentation, and language identifiers (e.g., \`\`\`python).
5. If the document contains images or diagrams with descriptive text, include those descriptions in the context of the surrounding text.
6. Remove any unnecessary boilerplate such as page numbers, navigation headers, or footers that do not contribute to the core content.
7. Output the final result as clean, structured Markdown text optimized for semantic understanding.`;

    this.dataSource = new bedrock.CfnDataSource(this, "DataSource", {
      name: props.dataSourceName,
      knowledgeBaseId: this.kb.attrKnowledgeBaseId,
      dataDeletionPolicy: "DELETE",
      dataSourceConfiguration: {
        type: "S3",
        s3Configuration: {
          bucketArn: this.sourceS3Bucket.bucketArn,
        },
      },
      vectorIngestionConfiguration: {
        chunkingConfiguration: {
          chunkingStrategy: "SEMANTIC",
          semanticChunkingConfiguration: {
            breakpointPercentileThreshold: 95,
            bufferSize: 1,
            maxTokens: 1024,
          },
        },
        parsingConfiguration: {
          parsingStrategy: "BEDROCK_FOUNDATION_MODEL",
          bedrockFoundationModelConfiguration: {
            modelArn: `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/apac.${props.enrichingModelId}`,
            parsingPrompt: {
              parsingPromptText,
            },
          },
        },
      },
    });
  }
}

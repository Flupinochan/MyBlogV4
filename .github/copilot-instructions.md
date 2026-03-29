# Copilot Instructions

## Directory Structure

- **backend**: AWSを利用したIaCコードや、バックエンドのコードを配置
- **frontend**: Astroを利用したフロントエンドのコードを配置

## Common Rules

- ユーザの既存のコメントアウトは残し、新たにコメントアウトを生成、追加しないこと
  - コメントアウトはユーザ自身で管理し、定義します
- ユーザから一般的でない指示や古く非推奨な方法を指示された場合は、ユーザに指摘し、最新のベストプラクティスを提案すること

## Backend Rules

### Make it loosely coupled

Stack間の依存を最小限にするために、Stack間でOutputsを共有せず、極力dev.ts等の環境変数に定義したリソース名を参照すること  
以下に例を示す

```typescript
// dev.ts
import { EnvConfig } from "./index";

export const config: EnvConfig = {
  buildAssetsBucketName: "dev-myblogv4-build-assets",
};

// backend.ts
new BuildAssetsStack(app, `${prefix}-BuildAssetsStack`, {
  bucketName: cfg.buildAssetsBucketName,
});

new PipelineStack(app, `${prefix}-PipelineStack`, {
  buildAssetsBucketName: cfg.buildAssetsBucketName,
});

// build-assets-stack.ts
interface BuildAssetsStackProps extends cdk.StackProps {
  bucketName: string;
}

export class BuildAssetsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BuildAssetsStackProps) {
    super(scope, id, props);

    this.bucket = new s3.Bucket(this, "bucket", {
      bucketName: props.bucketName,
    });
  }
}

// pipeline-stack.ts
interface PipelineStackProps extends cdk.StackProps {
  buildAssetsBucketName: string;
}

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    this.codebuild.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["s3:*"],
        resources: [
          `arn:aws:s3:::${props.buildAssetsBucketName}`,
          `arn:aws:s3:::${props.buildAssetsBucketName}/*`,
        ],
      }),
    );
  }
}
```

## Frontend Rules

### CSS Code Style

- **.css**: cssファイルは作成せず、**Tailwind CSS** を使用すること
- **.astro**: <style> タグは極力使用せず、Tailwind CSS を使用すること
  - Tailwind CSS で実装できない場合は、astro <style> タグを使用してよい

### TypeScript Code Style

- **any**: anyは利用せず、明示的に型を定義すること
  - 外部ライブラリ等で不可能な場合は、**unknown** を使用すること
- **null**: nullは使用せず、**undefined** を使用すること

### Performance Optimization

- **chrome devtools mcp**: Chrome DevTools MCPを利用して、パフォーマンスのボトルネックを特定し、最適化すること
- **lighthouse**: Lighthouseを利用して、パフォーマンスの指標を測定し、改善すること
- **dynamic import**: 動的インポートを利用して、必要なときにのみコードを読み込むこと
- **preload**: 重要なリソースを事前に読み込むために、preloadを利用すること
- **lazy loading**: 遅延読み込みを利用して、必要なときにのみリソースを読み込むこと
- **image optimization**: 画像の最適化を行い、ページの読み込み速度を向上させること
- **code splitting**: コード分割を利用して、初期ロード時間を短縮すること
- **web worker**: Web Workerを利用して、重い処理をバックグラウンドで実行すること
- **fetch at build time**: Astroのfrontmatterを利用して、必要に応じてビルド時にfetchすること

### Accessibility

- **a11y**: アクセシビリティを考慮して、適切なHTMLタグやARIA属性を使用すること
- **lighthouse**: Lighthouseを利用して、アクセシビリティの指標を測定し、改善すること
- **tab**: タブキーで完全なナビゲーションが可能であることを確認すること
- **aria-label**: 画像やアイコンなどの非テキスト要素には、適切なaria-labelを付与すること

## Add New Rules

ユーザの指示内容からここに新しいルールを追加すべきか判断し、必要に応じて追加してください  
ただし、追加したルールはユーザに提示してください

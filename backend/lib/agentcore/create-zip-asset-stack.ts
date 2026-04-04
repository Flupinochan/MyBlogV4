import { Stack, StackProps } from 'aws-cdk-lib';
import { Asset } from 'aws-cdk-lib/aws-s3-assets';
import { Construct } from 'constructs';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, cpSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PYTHON_VERSION = '3.13';
const PROJECT_ROOT = resolve(__dirname, '.');

function buildStaging(projectRoot: string, platform: string): string {
  // パス定義
  const root = resolve(projectRoot);
  const stagingDir = join(root, '.cache', 'staging');
  const pyprojectPath = join(root, 'pyproject.toml');

  // クリーン
  rmSync(stagingDir, { recursive: true, force: true });
  mkdirSync(stagingDir, { recursive: true });

  // uvで外部ライブラリをインストール
  const result = spawnSync(
    'uv',
    [
      'pip',
      'install',
      '-r',
      pyprojectPath,
      '--target',
      stagingDir,
      '--python-version',
      PYTHON_VERSION,
      '--python-platform',
      platform,
      '--only-binary',
      ':all:',
    ],
    {
      cwd: root,
      stdio: 'pipe',
    }
  );

  if (result.status !== 0) {
    console.error('error:', result.error);
    throw new Error('uv pip install failed');
  }

  // アプリケーションコードコピー
  cpSync(join(root, 'src'), stagingDir, { recursive: true });

  return stagingDir;
}

interface CreateZipAssetStackProps extends StackProps {
  platform: 'aarch64-manylinux2014' | 'aarch64-manylinux_2_28' | 'aarch64-manylinux_2_34';
}

export class CreateZipAssetStack extends Stack {
  public readonly asset: Asset;

  constructor(scope: Construct, id: string, props: CreateZipAssetStackProps) {
    super(scope, id, props);

    const stagingDir = buildStaging(PROJECT_ROOT, props.platform);

    this.asset = new Asset(this, 'CodeAsset', {
      path: stagingDir,
    });
  }
}
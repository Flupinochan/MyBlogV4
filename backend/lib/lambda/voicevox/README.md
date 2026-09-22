# Voicevox Tutorial

## Build & Deploy


### Manual

```bash
# ビルド
uv pip compile pyproject.toml -o requirements.txt
docker build -t voicevox-lambda .

# 初回はECR Stackだけ作成し、仮でimageをpushしておく必要がある > Lambdaデプロイ時にImageが必須のため
# 必要なmodel等は事前にS3に配置し、S3からビルド時にダウンロードする (GitHubからのダウンロードは重すぎるため)
cd backend/lambda/synthesizeVoice
tar -czf voicevox.tar.gz voicevox
aws s3 cp voicevox.tar.gz s3://dev-myblogv4-build-assets/voicevox.tar.gz

# ローカルでの実行1
docker run --rm -it \
  --entrypoint python \
  -v "$(pwd):/var/task" \
  voicevox-lambda \
  -c "from src.main import handler; handler({}, None)"

# ローカルでの実行2
docker run --rm -it \
  -v "$(pwd):/var/task" \
  -e AWS_REGION=ap-northeast-1 \
  -p 9000:8080 \
  voicevox-lambda
## 別ターミナルから呼び出す
curl -X POST http://localhost:9000/2015-03-31/functions/function/invocations -d '{}'
```

[Guide](https://github.com/VOICEVOX/voicevox_core/blob/main/docs/guide/user/usage.md)

### Prod

#### 設定ファイル

`backend/bin/env/prod.ts`

#### 初回

```bash
# 1. tar化
tar -czf backend/lib/lambda/voicevox/voicevox.tar.gz -C backend/lib/lambda/voicevox voicevox
# 2. VoicevoxBucketStackのみデプロイ
make deploy-target ENV_NAME=prod STACK_NAME=prod-myblogv4-VoicevoxBucketStack
# 3. S3へアップロード
aws s3 cp backend/lib/lambda/voicevox/voicevox.tar.gz s3://prod-myblogv4-voicevox-bucket/voicevox.tar.gz
# 4. VoicevoxEcrStackのみデプロイ
make deploy-target ENV_NAME=prod STACK_NAME=prod-myblogv4-VoicevoxEcrStack
# 5. 残り全スタックをデプロイ
make deploy-all ENV_NAME=prod
# 6. Route53へのドメイン設定
```

#### 2回目以降

```bash
make deploy-all ENV_NAME=prod
# もしくはmasterへのPRマージでトリガー
```

## Downloaderを利用

- [voicevox_core](https://github.com/VOICEVOX/voicevox_core/releases/tag/0.16.4) のdownloaderを利用してONNX RUNTIMEやMODELをダウンロード可能
- [docs](https://github.com/VOICEVOX/voicevox_core/blob/main/docs/guide/user/downloader.md)

## ONNX RUNTIMEの手動ダウンロード

[onnxruntime-builder](https://github.com/VOICEVOX/onnxruntime-builder/releases)

Lambda Containerで動かす前提なので以下の組み合わせの [voicevox_onnxruntime-linux-x64-1.17.3.tgz](https://github.com/VOICEVOX/onnxruntime-builder/releases/download/voicevox_onnxruntime-1.17.3/voicevox_onnxruntime-linux-x64-1.17.3.tgz) をダウンロード

- OS: Linux
- アーキテクチャ: x86_64
- デバイス: CPUのみ

## MODELの手動ダウンロード

[voicevox](https://github.com/VOICEVOX/voicevox/releases) から `voicevox-linux-cpu-x64-0.25.1.tar.gz
` をダウンロード
Modelの話者についてはREADME.mdを参照

## Coreのインストール

※以下はLinux x86用

```bash
uv add https://github.com/VOICEVOX/voicevox_core/releases/download/0.16.4/voicevox_core-0.16.4-cp310-abi3-manylinux_2_34_x86_64.whl
# pip install https://github.com/VOICEVOX/voicevox_core/releases/download/0.16.4/voicevox_core-0.16.4-cp310-abi3-manylinux_2_34_x86_64.whl
```

## API Document

[docs](https://voicevox.github.io/voicevox_core/apis/python_api/autoapi/voicevox_core/blocking/index.html)

## pip compile

```bash
uv pip compile -o requirements.txt pyproject.toml
```

## Kubernetes (blog namespace)

k8s manifest本体はマニフェスト用リポジトリ (`home-k8s/blog-voicevox`) 側で管理

### DBマイグレーション

`env "prod"` はAtlas Cloudを使わないローカル完結の設定 (`atlas.hcl` に `cloud`/`repo`/`lint.review` は含めない)

```bash
cd backend/lib/lambda/voicevox

# パスワードはURLエンコードすること (^ & % などが含まれる場合はnet/url: invalid userinfoになる)
# python3 -c "import urllib.parse; print(urllib.parse.quote('<パスワード>', safe=''))"
ATLAS_DB_URL="postgres://<ユーザ名>:<URLエンコード済みパスワード>@192.168.1.4:30006/blog?sslmode=disable" \
  atlas schema apply --env prod --auto-approve
```

- 接続先はk8s内の `pg-cluster-app` (CloudNativePG) の `blog` DB
- 実行端末はクラスタ外のためNodePort (`192.168.1.4:30006`) 経由。クラスタ内Service名 (`pg-cluster-rw.postgres.svc.cluster.local`) は名前解決できない
- `dev = "docker://postgres/16/dev"` を使うため、実行環境にDockerが必要

### 動作確認

```bash
kubectl run curl-test --rm -it --image=curlimages/curl -n blog --restart=Never -- \
  curl -X POST http://voicevox/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"user_id": "11111111-1111-1111-1111-111111111111", "messages": [{"role": "user", "content": "こんにちは"}]}'
```

`user_id` はUUID形式が必須

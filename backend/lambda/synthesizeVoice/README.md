# Voicevox Tutorial

## Build & Deploy

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

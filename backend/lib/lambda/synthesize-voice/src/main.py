"""VoiceVoxを使用してテキスト音声合成を行う"""

import multiprocessing
import os
import tempfile
from pathlib import Path

import boto3
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.parser import event_parser
from aws_lambda_powertools.utilities.typing import LambdaContext
from pydantic import BaseModel
from voicevox_core.blocking import Onnxruntime, OpenJtalk, Synthesizer, VoiceModelFile

# ロガー初期化
logger = Logger()

# 環境変数定義
try:
    ONNX_RUNTIME_PATH = "voicevox/onnxruntime/lib/libvoicevox_onnxruntime.so"
    MODEL_PATH = "voicevox/model/0.vvm"
    OPEN_JTALK_PATH = "voicevox/open_jtalk"
    MODEL_STYLE_ID = 0  # あまあま
    VOICE_OUTPUT_BUCKET_NAME = os.environ["VOICE_OUTPUT_BUCKET_NAME"]
    OUTPUT_PREFIX = "voice"
except KeyError:
    logger.exception("環境変数が設定されていません")
    raise

s3_client = boto3.client("s3")

# 1. Synthesizerの初期化
## Lambdaの場合は1,769MBで1vCPU相当
synthesizer = Synthesizer(
    Onnxruntime.load_once(filename=ONNX_RUNTIME_PATH),
    OpenJtalk(OPEN_JTALK_PATH),
    acceleration_mode="CPU",
    cpu_num_threads=multiprocessing.cpu_count(),
)

# 2. 音声モデルの読み込み
with VoiceModelFile.open(MODEL_PATH) as model:
    synthesizer.load_voice_model(model)


class HandlerEvent(BaseModel):
    """Handler event model"""

    message: str


@event_parser(model=HandlerEvent)
def handler(event: HandlerEvent, _context: LambdaContext) -> dict:
    """Entry Point"""
    # 3. テキスト音声合成
    wav = synthesizer.tts(event.message, MODEL_STYLE_ID)
    with tempfile.NamedTemporaryFile() as file:
        file.write(wav)

        # 4. S3にアップロード
        output_key = f"{OUTPUT_PREFIX}/{Path(file.name).name}.wav"
        s3_client.upload_file(
            file.name,
            VOICE_OUTPUT_BUCKET_NAME,
            output_key,
        )

    if not output_key:
        log_message = f"Failed to upload voice to S3. bucket: {VOICE_OUTPUT_BUCKET_NAME}, key: {output_key}"
        logger.error(log_message)
        raise ValueError(log_message)

    return {"bucket": VOICE_OUTPUT_BUCKET_NAME, "key": output_key}

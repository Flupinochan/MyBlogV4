"""VoiceVoxを使用してテキスト音声合成を行う"""

import multiprocessing
import os
import tempfile
import uuid

import boto3
from anthropic import AnthropicAWS
from anthropic.types import TextBlock
from aws_lambda_powertools import Logger
from fastapi import APIRouter, FastAPI
from pydantic import BaseModel
from voicevox_core import UserDictWord
from voicevox_core.blocking import (
    Onnxruntime,
    OpenJtalk,
    Synthesizer,
    UserDict,
    VoiceModelFile,
)

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

# ユーザ辞書の定義
# surface 入力テキスト
# pronunciation カタカナで発音を指定
# accent_type メタルメンタルは、7文字のため1から7の整数で指定
user_dict_word = UserDictWord(
    surface="MetalMental",
    pronunciation="メタルメンタル",
    word_type="PROPER_NOUN",
    priority=9,
    accent_type=4,  # メタルメの4拍目にアクセント
)
user_dict = UserDict()
user_dict.add_word(user_dict_word)
open_jtalk = OpenJtalk(OPEN_JTALK_PATH)
open_jtalk.use_user_dict(user_dict)

# 1. Synthesizerの初期化
## Lambdaの場合は1,769MBで1vCPU相当
synthesizer = Synthesizer(
    Onnxruntime.load_once(filename=ONNX_RUNTIME_PATH),
    open_jtalk,
    acceleration_mode="CPU",
    cpu_num_threads=multiprocessing.cpu_count(),
)

# 2. 音声モデルの読み込み
with VoiceModelFile.open(MODEL_PATH) as model:
    synthesizer.load_voice_model(model)

anthropic_client = AnthropicAWS()

app = FastAPI()
# Go GinのLayerベースと違い、Dockerベースの場合は/apiは不要
router = APIRouter(prefix="/v1/fastapi")


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    result: str


class VoicevoxRequest(BaseModel):
    message: str


class VoicevoxResponse(BaseModel):
    bucket: str
    key: str


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/voicevox")
def voicevox(request: VoicevoxRequest) -> VoicevoxResponse:
    # 3. テキスト音声合成
    wav = synthesizer.tts(request.message, MODEL_STYLE_ID)
    with tempfile.NamedTemporaryFile() as file:
        file.write(wav)
        file.flush()

        # 4. S3にアップロード
        output_key = f"{OUTPUT_PREFIX}/{uuid.uuid4().hex}.wav"
        try:
            s3_client.upload_file(
                file.name,
                VOICE_OUTPUT_BUCKET_NAME,
                output_key,
            )
        except Exception:
            logger.exception(
                "Failed to upload voice to S3. bucket: %s, key: %s",
                VOICE_OUTPUT_BUCKET_NAME,
                output_key,
            )
            raise

    return VoicevoxResponse(bucket=VOICE_OUTPUT_BUCKET_NAME, key=output_key)


@router.post("/chat")
def chat(request: ChatRequest) -> ChatResponse:
    message = anthropic_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": request.message}],
    )
    result = next(
        block.text for block in message.content if isinstance(block, TextBlock)
    )
    logger.info("Agent result", extra={"result": result})
    return ChatResponse(result=result)


app.include_router(router)

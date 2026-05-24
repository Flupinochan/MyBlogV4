"""FastAPI: テキストと音声付きチャットBackend"""

import logging
import multiprocessing
import os
from typing import Literal

import boto3
from anthropic import AnthropicAWS
from anthropic.types import MessageParam
from aws_lambda_powertools import Logger
from aws_lambda_powertools.logging.formatter import LambdaPowertoolsFormatter
from fastapi import APIRouter, FastAPI
from pydantic import BaseModel
from service.chat_service import ChatService  # ty:ignore[unresolved-import]
from service.voice_service import VoiceService  # ty:ignore[unresolved-import]
from voicevox_core import UserDictWord
from voicevox_core.blocking import (
    Onnxruntime,
    OpenJtalk,
    Synthesizer,
    UserDict,
    VoiceModelFile,
)

# ルートレベル(外部ライブラリのログ)はWARNINGで設定
logging.basicConfig(level=logging.WARNING)

formatter = LambdaPowertoolsFormatter(
    log_record_order=["level", "message", "timestamp", "location"],
)
logger = Logger(logger_formatter=formatter)


try:
    ONNX_RUNTIME_PATH = "voicevox/onnxruntime/lib/libvoicevox_onnxruntime.so"
    MODEL_PATH = "voicevox/model/0.vvm"
    OPEN_JTALK_PATH = "voicevox/open_jtalk"
    VOICE_OUTPUT_BUCKET_NAME = os.environ["VOICE_OUTPUT_BUCKET_NAME"]
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

chat_service = ChatService(client=AnthropicAWS())
voice_service = VoiceService(
    synthesizer=synthesizer,
    s3_client=s3_client,
    bucket_name=VOICE_OUTPUT_BUCKET_NAME,
)

# Go GinのLayerベースと違い、Dockerベースの場合は/apiは不要
app = FastAPI()
router = APIRouter(prefix="/v1")


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]


class ChatResponse(BaseModel):
    message: str


class VoiceChatResponse(ChatResponse):
    voice_path: str


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/chat")
def chat(request: ChatRequest) -> ChatResponse:
    message = chat_service.generate_message(
        [MessageParam(role=m.role, content=m.content) for m in request.messages],
    )
    return ChatResponse(message=message)


@router.post("/chat/voice")
def chat_with_voice(request: ChatRequest) -> VoiceChatResponse:
    message = chat_service.generate_message(
        [MessageParam(role=m.role, content=m.content) for m in request.messages],
    )
    voice_path = voice_service.synthesize_and_upload(message)
    return VoiceChatResponse(message=message, voice_path=voice_path)


# FastAPIのOpenAPI自動生成の仕組み上、moduleレベルでの標準出力は避けること
app.include_router(router)

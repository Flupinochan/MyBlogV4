"""FastAPI: テキストと音声付きチャットBackend"""

import logging
import multiprocessing
import os
from contextlib import asynccontextmanager

import boto3
from anthropic import AnthropicAWS
from aws_lambda_powertools import Logger
from aws_lambda_powertools.logging.formatter import LambdaPowertoolsFormatter
from fastapi import APIRouter, FastAPI
from routers import chat, conversation, health  # ty:ignore[unresolved-import]
from services.chat_service import ChatService  # ty:ignore[unresolved-import]
from services.db_service import DbService  # ty:ignore[unresolved-import]
from services.voice_service import VoiceService  # ty:ignore[unresolved-import]
from sqlalchemy.ext.asyncio import create_async_engine
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
    POSTGRESQL_URL = os.environ["POSTGRESQL_URL"]
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine = create_async_engine(POSTGRESQL_URL, echo=False)
    app.state.engine = engine
    app.state.chat_service = ChatService(client=AnthropicAWS())
    app.state.voice_service = VoiceService(
        synthesizer=synthesizer,
        s3_client=s3_client,
        bucket_name=VOICE_OUTPUT_BUCKET_NAME,
    )
    app.state.db_service = DbService(engine=engine)
    yield
    await engine.dispose()


# Go GinのLayerベースと違い、Dockerベースの場合は/apiは不要
app = FastAPI(lifespan=lifespan)

# FastAPIのOpenAPI自動生成の仕組み上、moduleレベルでの標準出力は避けること
v1 = APIRouter(prefix="/v1")
v1.include_router(health.router)
v1.include_router(chat.router)
v1.include_router(conversation.router)
app.include_router(v1)

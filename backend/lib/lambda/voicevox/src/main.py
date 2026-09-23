"""FastAPI: テキストと音声付きチャットBackend"""

import logging
import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import boto3
import pyroscope
from anthropic import AnthropicAWS
from aws_lambda_powertools import Logger
from aws_lambda_powertools.logging.formatter import LambdaPowertoolsFormatter
from fastapi import APIRouter, FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from routers import chat, contact, conversation, health  # ty:ignore[unresolved-import]
from services.chat_service import ChatService  # ty:ignore[unresolved-import]
from services.contact_service import ContactService  # ty:ignore[unresolved-import]
from services.db_service import DbService  # ty:ignore[unresolved-import]
from services.voice_service import VoiceService  # ty:ignore[unresolved-import]
from sqlalchemy.ext.asyncio import create_async_engine
from user_dict_words import RESUME_USER_DICT_WORDS  # ty:ignore[unresolved-import]
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
    CONTACT_EMAIL_ADDRESS = os.environ["CONTACT_EMAIL_ADDRESS"]
    PYROSCOPE_SERVER_ADDRESS = os.environ["PYROSCOPE_SERVER_ADDRESS"]
    TEMPO_SERVER_ADDRESS = os.environ["TEMPO_SERVER_ADDRESS"]
    ENV_NAME = os.environ["ENV_NAME"]
except KeyError:
    logger.exception("環境変数が設定されていません")
    raise

s3_client = boto3.client("s3")

pyroscope.configure(
    application_name="myblogv4.voicevox-api",
    server_address=PYROSCOPE_SERVER_ADDRESS,
    tags={"env": ENV_NAME},
    mem_enabled=True,
    gil_only=False,
)

tracer_provider = TracerProvider(
    resource=Resource.create(
        {
            "service.name": "myblogv4.voicevox-api",
            "deployment.environment": ENV_NAME,
        },
    ),
)
tracer_provider.add_span_processor(
    BatchSpanProcessor(OTLPSpanExporter(endpoint=TEMPO_SERVER_ADDRESS, insecure=True)),
)
trace.set_tracer_provider(tracer_provider)

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
kawagoe_word = UserDictWord(
    surface="川越",
    pronunciation="カワゴエ",
    word_type="PROPER_NOUN",
    priority=9,
    accent_type=0,
)
tetsurou_word = UserDictWord(
    surface="鉄郎",
    pronunciation="テツロウ",
    word_type="PROPER_NOUN",
    priority=9,
    accent_type=1,
)
user_dict = UserDict()
user_dict.add_word(user_dict_word)
user_dict.add_word(kawagoe_word)
user_dict.add_word(tetsurou_word)
for resume_word in RESUME_USER_DICT_WORDS:
    user_dict.add_word(resume_word)
open_jtalk = OpenJtalk(OPEN_JTALK_PATH)
open_jtalk.use_user_dict(user_dict)
onnxruntime = Onnxruntime.load_once(filename=ONNX_RUNTIME_PATH)


def create_synthesizer() -> Synthesizer:
    # ONNX Runtimeのメモリアリーナがリクエストを重ねるたびに肥大化するため
    # VoiceServiceが一定回数ごとにSynthesizerを作り直せるようファクトリ化している
    synthesizer = Synthesizer(
        onnxruntime,
        open_jtalk,
        acceleration_mode="CPU",
        cpu_num_threads=2,
    )
    with VoiceModelFile.open(MODEL_PATH) as model:
        synthesizer.load_voice_model(model)
    return synthesizer


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    engine = create_async_engine(
        POSTGRESQL_URL,
        echo=False,
        pool_pre_ping=True,
        pool_recycle=300,
    )
    app.state.engine = engine
    app.state.chat_service = ChatService(client=AnthropicAWS())
    app.state.voice_service = VoiceService(
        synthesizer_factory=create_synthesizer,
        s3_client=s3_client,
        bucket_name=VOICE_OUTPUT_BUCKET_NAME,
    )
    app.state.db_service = DbService(engine=engine)
    # sesv2はs3と違いグローバルエンドポイントがなくclient生成時にregionが必須
    # moduleレベルで生成するとregion未設定環境でのOpenAPI生成がimportで落ちる
    app.state.contact_service = ContactService(
        ses_client=boto3.client("sesv2"),
        from_address=CONTACT_EMAIL_ADDRESS,
    )
    yield
    await engine.dispose()


# Go GinのLayerベースと違い、Dockerベースの場合は/apiは不要
app = FastAPI(lifespan=lifespan)
FastAPIInstrumentor.instrument_app(app)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    _request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=jsonable_encoder({"detail": exc.errors(), "body": exc.body}),
    )


# FastAPIのOpenAPI自動生成の仕組み上、moduleレベルでの標準出力は避けること
v1 = APIRouter(prefix="/v1")
v1.include_router(health.router)
v1.include_router(chat.router)
v1.include_router(conversation.router)
v1.include_router(contact.router)
app.include_router(v1)

"""FastAPI: テキストと音声付きチャットBackend"""

import logging
import multiprocessing
import os
from datetime import datetime
from typing import Annotated, Literal

import boto3
from anthropic import AnthropicAWS
from anthropic.types import MessageParam
from aws_lambda_powertools import Logger
from aws_lambda_powertools.logging.formatter import LambdaPowertoolsFormatter
from fastapi import APIRouter, FastAPI, Header, HTTPException
from pydantic import BaseModel
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

engine = create_async_engine(POSTGRESQL_URL, echo=False)
chat_service = ChatService(client=AnthropicAWS())
voice_service = VoiceService(
    synthesizer=synthesizer,
    s3_client=s3_client,
    bucket_name=VOICE_OUTPUT_BUCKET_NAME,
)
db_service = DbService(engine=engine)

# Go GinのLayerベースと違い、Dockerベースの場合は/apiは不要
app = FastAPI()
router = APIRouter(prefix="/v1")


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]
    user_id: str
    conversation_id: str | None = None


class ChatResponse(BaseModel):
    message: str
    conversation_id: str


class VoiceChatResponse(ChatResponse):
    voice_path: str


class ConversationMessage(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str


class ConversationResponse(BaseModel):
    id: str
    title: str
    updated_at: datetime
    messages: list[ConversationMessage]


class UpdateTitleRequest(BaseModel):
    title: str


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/chat")
async def chat(request: ChatRequest) -> ChatResponse:
    conversation_id = request.conversation_id
    if conversation_id is None:
        conversation_id = await db_service.create_conversation(request.user_id, "新しいチャット")

    user_msg_position = len(request.messages) - 1
    new_user_msg = request.messages[-1]

    message = chat_service.generate_message(
        [MessageParam(role=m.role, content=m.content) for m in request.messages],
    )

    await db_service.save_messages(
        conversation_id,
        [
            (new_user_msg.role, new_user_msg.content, user_msg_position),
            ("assistant", message, user_msg_position + 1),
        ],
    )

    return ChatResponse(message=message, conversation_id=conversation_id)


@router.post("/chat/voice")
async def chat_with_voice(request: ChatRequest) -> VoiceChatResponse:
    conversation_id = request.conversation_id
    if conversation_id is None:
        conversation_id = await db_service.create_conversation(request.user_id, "新しいチャット")

    user_msg_position = len(request.messages) - 1
    new_user_msg = request.messages[-1]

    message = chat_service.generate_message(
        [MessageParam(role=m.role, content=m.content) for m in request.messages],
    )
    voice_path = voice_service.synthesize_and_upload(message)

    await db_service.save_messages(
        conversation_id,
        [
            (new_user_msg.role, new_user_msg.content, user_msg_position),
            ("assistant", message, user_msg_position + 1),
        ],
    )

    return VoiceChatResponse(message=message, voice_path=voice_path, conversation_id=conversation_id)


@router.get("/conversations")
async def get_conversations(
    x_user_id: Annotated[str, Header()],
) -> list[ConversationResponse]:
    conversations = await db_service.get_conversations_with_messages(x_user_id)
    return [
        ConversationResponse(
            id=c.id,
            title=c.title,
            updated_at=c.updated_at,
            messages=[ConversationMessage(id=m.id, role=m.role, content=m.content) for m in c.messages],
        )
        for c in conversations
    ]


@router.patch("/conversations/{conversation_id}", status_code=204)
async def update_conversation_title(
    conversation_id: str,
    request: UpdateTitleRequest,
    x_user_id: Annotated[str, Header()],
) -> None:
    updated = await db_service.update_conversation_title(
        conversation_id, x_user_id, request.title
    )
    if not updated:
        raise HTTPException(status_code=404)


# FastAPIのOpenAPI自動生成の仕組み上、moduleレベルでの標準出力は避けること
app.include_router(router)

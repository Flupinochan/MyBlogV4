"""Chat履歴を管理"""

import os
from typing import cast

from aws_lambda_powertools import Logger
from aws_lambda_powertools.event_handler import APIGatewayRestResolver, CORSConfig
from aws_lambda_powertools.utilities.typing import LambdaContext
from pydantic import BaseModel, ConfigDict
from strands.session.s3_session_manager import S3SessionManager, SessionMessage

# Logger定義
logger = Logger()

# 環境変数
try:
    S3_SESSION_BUCKET_NAME = os.environ["S3_SESSION_BUCKET_NAME"]
    AGENT_ID = os.environ["AGENT_ID"]
    DOMAIN_NAME = os.environ["DOMAIN_NAME"]
except KeyError:
    logger.exception("環境変数が不足しています")
    raise

# Resolver初期化
cors_config = CORSConfig(
    allow_origin=f"https://{DOMAIN_NAME}",
    max_age=3600,
)
app = APIGatewayRestResolver(enable_validation=True, cors=cors_config)


class ChatMessage(BaseModel):
    """会話のメッセージ"""

    role: str
    content: str

    model_config = ConfigDict(extra="forbid")


class ChatMessages(BaseModel):
    """会話のメッセージ一覧"""

    messages: list[ChatMessage]

    model_config = ConfigDict(extra="forbid")


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> dict:
    """Entry Point"""
    return app.resolve(event, context)


@app.get("/v1/users/<user_id>/sessions/<session_id>/messages")
def get_messages(user_id: str, session_id: str) -> ChatMessages:
    """会話のメッセージ一覧を取得"""
    session_manager = S3SessionManager(
        session_id=session_id,
        bucket=S3_SESSION_BUCKET_NAME,
        prefix=f"{user_id}/{session_id}/",
    )

    session_messages = session_manager.list_messages(
        agent_id=AGENT_ID,
        session_id=session_id,
    )

    chat_messages = convert(session_messages)

    logger.info(
        "会話のメッセージ一覧を取得しました",
        extra={
            "messages": chat_messages.model_dump_json(),
        },
    )

    return chat_messages


def convert(session_messages: list[SessionMessage]) -> ChatMessages:
    """SessionMessageのリストをChatMessagesに変換"""
    return ChatMessages(
        messages=[
            ChatMessage(
                role=cast("str", session_message.to_message()["role"]),
                content="".join(
                    block["text"]
                    for block in session_message.to_message()["content"]
                    if "text" in block
                ),
            )
            for session_message in session_messages
        ],
    )

"""Chat履歴を管理"""

import os

from aws_lambda_powertools import Logger
from aws_lambda_powertools.event_handler import APIGatewayRestResolver
from aws_lambda_powertools.utilities.typing import LambdaContext
from pydantic import BaseModel, ConfigDict
from strands.session.s3_session_manager import S3SessionManager

# Resolver初期化
app = APIGatewayRestResolver()

# Logger定義
logger = Logger()

# 環境変数
try:
    S3_SESSION_BUCKET_NAME = os.environ["S3_SESSION_BUCKET_NAME"]
    AGENT_ID = os.environ["AGENT_ID"]
except KeyError:
    logger.exception("環境変数が不足しています")
    raise


class Message(BaseModel):
    """会話のメッセージ"""

    role: str
    content: str

    model_config = ConfigDict(extra="forbid")


class Messages(BaseModel):
    """会話のメッセージ一覧"""

    messages: list[Message]

    model_config = ConfigDict(extra="forbid")


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> dict:
    """Entry Point"""
    return app.resolve(event, context)


@app.get("/v1/users/<userId>/sessions/<sessionId>/messages")
def get_messages(userId: str, sessionId: str) -> Messages:  # noqa: N803
    """会話のメッセージ一覧を取得"""
    session_manager = S3SessionManager(
        session_id=sessionId,
        bucket=S3_SESSION_BUCKET_NAME,
        prefix=f"{userId}/{sessionId}/",
    )

    session_messages = session_manager.list_messages(
        agent_id=AGENT_ID,
        session_id=sessionId,
    )

    messages = Messages(
        messages=[
            Message.model_validate(session_message.to_message())
            for session_message in session_messages
        ],
    )

    logger.info(
        "会話のメッセージ一覧を取得しました",
        extra={
            "messages": messages.model_dump_json(),
        },
    )

    return messages

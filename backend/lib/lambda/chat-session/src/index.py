"""Chat履歴を管理"""

import os

from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext
from strands.session.s3_session_manager import S3SessionManager

# Logger定義
logger = Logger()

# 環境変数
try:
    S3_SESSION_BUCKET_NAME = os.environ["S3_SESSION_BUCKET_NAME"]
    AGENT_ID = os.environ["AGENT_ID"]
except KeyError:
    logger.exception("環境変数が不足しています")
    raise


@logger.inject_lambda_context
def lambda_handler(event: dict, _context: LambdaContext) -> None:
    """Entry Point"""
    session_id = event.get("session_id", "default-session")
    session_manager = S3SessionManager(
        session_id=session_id,
        bucket=S3_SESSION_BUCKET_NAME,
        prefix=f"user-id/{session_id}/",
    )

    messages = session_manager.list_messages(
        agent_id=AGENT_ID,
        session_id=session_id,
    )

    logger.info(
        "会話履歴",
        extra={"session_id": session_id, "agent_id": AGENT_ID, "messages": messages},
    )

"""履歴書を取得するツール"""

from pathlib import Path

from anthropic.types import ToolParam
from aws_lambda_powertools import Logger

logger = Logger(child=True)

RESUME_PATH = Path(__file__).resolve().with_name("resume.md")
RESUME_TOOL: ToolParam = {
    "name": "get_resume_content",
    "description": "川越鉄郎 (MetalMental) に関する情報や履歴書を取得し、内容を返却",
    "strict": True,
    "input_schema": {
        "type": "object",
        "properties": {},
        "required": [],
        "additionalProperties": False,
    },
}


def get_resume_content() -> str:
    try:
        content = RESUME_PATH.read_text(encoding="utf-8")
        logger.info(
            "Successfully read resume content",
            extra={
                "resume_path": str(RESUME_PATH),
                "content": content[:100],
            },
        )
    except FileNotFoundError:
        logger.exception(
            "履歴書ファイルが見つかりませんでした",
            extra={"resume_path": str(RESUME_PATH)},
        )
        raise
    except Exception:
        logger.exception(
            "履歴書ファイルの読み込み中にエラーが発生しました",
            extra={"resume_path": str(RESUME_PATH)},
        )
        raise

    return content

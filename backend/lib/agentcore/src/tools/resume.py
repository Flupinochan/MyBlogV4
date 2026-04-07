"""履歴書を取得するツール"""

import logging
from pathlib import Path

from strands import tool

logger = logging.getLogger(f"bedrock_agentcore.app.{__name__}")

RESUME_FILE_NAME = "resume.md"


@tool
def get_resume_content() -> str:
    """川越鉄郎 (MetalMental) に関する情報や履歴書を取得し、内容を返却

    Returns:
        str: 履歴書 (Markdown形式) の内容

    """
    resume_path = Path(__file__).resolve().with_name(RESUME_FILE_NAME)

    try:
        return resume_path.read_text(encoding="utf-8")
    except FileNotFoundError:
        logger.exception("履歴書ファイルが見つかりません: %s", resume_path)
        raise
    except Exception:
        logger.exception("履歴書の読み込み中にエラーが発生しました: %s", resume_path)
        raise

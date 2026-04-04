from pathlib import Path

from strands import tool

RESUME_FILE_NAME = "resume.md"


@tool
def get_resume_content() -> str:
    """川越鉄郎 (MetalMental) の履歴書を取得する

    Returns:
        str: 履歴書の内容

    """
    with Path(RESUME_FILE_NAME).open() as f:
        return f.read()

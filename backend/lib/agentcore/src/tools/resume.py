from pathlib import Path

from strands import tool

RESUME_FILE_NAME = "resume.md"


@tool
def get_resume_content() -> str:
    """川越鉄郎 (MetalMental) に関する情報や履歴書を取得し、内容を返却

    Returns:
        str: 履歴書 (Markdown形式) の内容

    """
    with Path(RESUME_FILE_NAME).open() as f:
        return f.read()

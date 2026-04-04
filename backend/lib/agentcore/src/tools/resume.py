from pathlib import Path

from strands import tool

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
    except FileNotFoundError as error:
        raise RuntimeError(f"履歴書ファイルが見つかりません: {resume_path}") from error
    except OSError as error:
        raise RuntimeError(f"履歴書ファイルを読み込めませんでした: {resume_path}") from error

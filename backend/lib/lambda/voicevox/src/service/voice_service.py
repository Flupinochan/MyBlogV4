"""VoiceVoxを使用して音声合成しS3にアップロードするサービス"""

from __future__ import annotations

import tempfile
import uuid
from typing import TYPE_CHECKING

from aws_lambda_powertools import Logger

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client
    from voicevox_core.blocking import Synthesizer

logger = Logger(child=True)

MODEL_STYLE_ID = 0
OUTPUT_PREFIX = "voice"


class VoiceService:
    def __init__(
        self,
        synthesizer: Synthesizer,
        s3_client: S3Client,
        bucket_name: str,
    ) -> None:
        self._synthesizer = synthesizer
        self._s3_client = s3_client
        self._bucket_name = bucket_name

    def synthesize_and_upload(self, text: str) -> tuple[str, str]:
        # テキスト音声合成
        wav = self._synthesizer.tts(text, MODEL_STYLE_ID)
        key = f"{OUTPUT_PREFIX}/{uuid.uuid4().hex}.wav"
        with tempfile.NamedTemporaryFile() as file:
            file.write(wav)
            file.flush()
            try:
                # S3にwavファイルをアップロード
                self._s3_client.upload_file(file.name, self._bucket_name, key)
                logger.info(
                    "wav file voice upload",
                    extra={
                        "Bucket": self._bucket_name,
                        "Key": key,
                    },
                )
            except Exception:
                logger.exception(
                    "Failed to upload voice to S3. bucket: %s, key: %s",
                    self._bucket_name,
                    key,
                )
                raise
        return self._bucket_name, key

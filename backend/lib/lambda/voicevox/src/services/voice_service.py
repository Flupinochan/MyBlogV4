"""VoiceVoxを使用して音声合成しS3にアップロードするサービス"""

from __future__ import annotations

import io
import re
import tempfile
import uuid
import wave
from typing import TYPE_CHECKING, Callable

from aws_lambda_powertools import Logger

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client
    from voicevox_core.blocking import Synthesizer

logger = Logger(child=True)

MODEL_STYLE_ID = 0
OUTPUT_PREFIX = "voice"

# ONNX Runtimeのメモリアリーナは要求サイズの最大値を再利用ブロックとして
# 保持し続け縮小しないため、1回のtts呼び出しが扱うテキストを短く保つ
MAX_CHUNK_LENGTH = 60
SENTENCE_DELIMITERS = re.compile(r"(?<=[。！？])")
CLAUSE_DELIMITERS = re.compile(r"(?<=、)")

# 長期稼働時の微小な蓄積に備え、一定回数ごとにSynthesizerを作り直す
MAX_SYNTHESIS_COUNT = 30


def split_text_for_synthesis(text: str) -> list[str]:
    sentences = [s for s in SENTENCE_DELIMITERS.split(text) if s]
    chunks: list[str] = []
    for sentence in sentences:
        if len(sentence) <= MAX_CHUNK_LENGTH:
            chunks.append(sentence)
            continue
        chunks.extend(c for c in CLAUSE_DELIMITERS.split(sentence) if c)
    return chunks or [text]


def concat_wavs(wav_list: list[bytes]) -> bytes:
    if len(wav_list) == 1:
        return wav_list[0]

    output_buffer = io.BytesIO()
    with wave.open(io.BytesIO(wav_list[0])) as first_segment:
        params = first_segment.getparams()
    with wave.open(output_buffer, "wb") as output_wav:
        output_wav.setparams(params)
        for wav_bytes in wav_list:
            with wave.open(io.BytesIO(wav_bytes)) as segment:
                output_wav.writeframes(segment.readframes(segment.getnframes()))
    return output_buffer.getvalue()


class VoiceService:
    def __init__(
        self,
        synthesizer_factory: Callable[[], Synthesizer],
        s3_client: S3Client,
        bucket_name: str,
    ) -> None:
        self._synthesizer_factory = synthesizer_factory
        self._synthesizer = synthesizer_factory()
        self._s3_client = s3_client
        self._bucket_name = bucket_name
        self._synthesis_count = 0

    def synthesize_and_upload(self, text: str) -> str:
        wav = self._synthesize(text)
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
        return key

    def _synthesize(self, text: str) -> bytes:
        chunks = split_text_for_synthesis(text)
        wav_list = [self._synthesizer.tts(chunk, MODEL_STYLE_ID) for chunk in chunks]
        self._recreate_synthesizer_if_needed()
        return concat_wavs(wav_list)

    def _recreate_synthesizer_if_needed(self) -> None:
        self._synthesis_count += 1
        if self._synthesis_count < MAX_SYNTHESIS_COUNT:
            return
        self._synthesizer.close()
        self._synthesizer = self._synthesizer_factory()
        self._synthesis_count = 0
        logger.info("Synthesizer recreated to reset ONNX Runtime memory arena")

"""ロガー"""

import logging
import sys

from bedrock_agentcore.runtime.app import RequestContextFormatter


def get_logger(name: str | None = None, level: int = logging.INFO) -> logging.Logger:
    """ロガー取得用"""
    name = name or __name__
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(stream=sys.stderr)
        handler.setFormatter(RequestContextFormatter())
        logger.addHandler(handler)
    logger.setLevel(level)
    logger.propagate = False
    return logger

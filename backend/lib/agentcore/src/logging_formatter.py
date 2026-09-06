"""AgentCore App LoggerとPowerTools Loggerを組み合わせたLogger Formatter"""

import json
import logging
from datetime import datetime
from logging import LogRecord
from zoneinfo import ZoneInfo

from bedrock_agentcore import BedrockAgentCoreContext

JST = ZoneInfo("Asia/Tokyo")
RESERVED_OR_EXCLUDES_LOG_ATTRS = frozenset(
    {
        "name",
        "msg",
        "args",
        "levelname",
        "levelno",
        "pathname",
        "filename",
        "module",
        "exc_info",
        "exc_text",
        "stack_info",
        "lineno",
        "funcName",
        "created",
        "msecs",
        "relativeCreated",
        "thread",
        "threadName",
        "processName",
        "process",
        "message",
        "taskName",
        "otelSpanID",
        "otelTraceID",
        "otelTraceSampled",
        "otelServiceName",
    },
)


class LoggingFormatter(logging.Formatter):
    """Formatter including request and session IDs."""

    def format(self, record: LogRecord) -> str:
        """Format log record as AWS Lambda JSON."""
        # Base log entry with standard attributes
        log_entry = {
            "level": record.levelname,
            "message": record.getMessage(),
            "timestamp": datetime.now(JST).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3]
            + "+09:00",
            "location": f"{record.funcName}:{record.lineno}",
            "logger": record.name,
        }

        # extra attributes
        extras = {
            k: v
            for k, v in record.__dict__.items()
            if k not in RESERVED_OR_EXCLUDES_LOG_ATTRS
        }
        log_entry.update(extras)

        # Bedrock AgentCore context information
        request_id = BedrockAgentCoreContext.get_request_id()
        if request_id:
            log_entry["request_id"] = request_id
        session_id = BedrockAgentCoreContext.get_session_id()
        if session_id:
            log_entry["session_id"] = session_id

        # exception information
        exception, exception_name, exception_notes = self._extract_log_exception(record)
        if exception_name:
            log_entry["exception_name"] = exception_name
        if exception:
            log_entry["exception"] = exception
        if exception_notes:
            log_entry["exception_notes"] = exception_notes  # ty:ignore[invalid-assignment]

        return json.dumps(log_entry, default=str, indent=None, ensure_ascii=False)

    def _extract_log_exception(
        self,
        log_record: LogRecord,
    ) -> tuple[str, str, list | None] | tuple[None, None, None]:
        """Format traceback information, if available

        Parameters
        ----------
        log_record : LogRecord
            Log record to extract message from

        Returns
        -------
        log_record: tuple[str, str] | tuple[None, None]
            Log record with constant traceback info and exception name

        """
        if isinstance(log_record.exc_info, tuple) and hasattr(
            log_record.exc_info[0],
            "__name__",
        ):
            exception_notes = getattr(log_record.exc_info[1], "__notes__", None)
            return (
                self.formatException(log_record.exc_info),
                log_record.exc_info[0].__name__,
                exception_notes,
            )

        return None, None, None

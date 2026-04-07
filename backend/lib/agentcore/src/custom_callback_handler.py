"""Agent用カスタムコールバックハンドラー"""

import logging
from typing import Any

logger = logging.getLogger(f"bedrock_agentcore.app.{__name__}")
logger.setLevel(logging.DEBUG)


class CustomCallbackHandler:
    """Handler for streaming text output and tool invocations to stdout."""

    def __init__(self) -> None:
        """Initialize handler."""
        self.tool_count = 0

    def __call__(self, **kwargs: Any) -> None:  # noqa: ANN401
        """Stream text output and tool invocations to stdout.

        Args:
            **kwargs: Callback event data including:
                - reasoningText (Optional[str]): Reasoning text to print if provided.
                - data (str): Text content to stream.
                - complete (bool): Whether this is the final chunk of a response.
                - event (dict): ModelStreamChunkEvent.

        """
        reasoning_text = kwargs.get("reasoningText", False)
        data = kwargs.get("data", "")
        tool_use = (
            kwargs.get("event", {})
            .get("contentBlockStart", {})
            .get("start", {})
            .get("toolUse")
        )

        if reasoning_text:
            logger.debug("[Reasoning]: %s", reasoning_text)

        if data:
            logger.debug("[Model Output]: %s", data)

        if tool_use:
            self.tool_count += 1
            tool_name = tool_use["name"]
            logger.debug(
                "[Using tool: %s] (Tool use count: %d)",
                tool_name,
                self.tool_count,
            )

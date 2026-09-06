"""Agent用ロギングフック"""

import logging

from strands.hooks import HookProvider, HookRegistry
from strands.hooks.events import (
    AfterToolCallEvent,
)

logger = logging.getLogger(f"bedrock_agentcore.app.{__name__}")
logger.setLevel(logging.DEBUG)


class LoggingHookProvider(HookProvider):
    """ツール呼び出しとレスポンスをログ出力するHookProvider"""

    def register_hooks(self, registry: HookRegistry) -> None:  # noqa: D102  # ty:ignore[invalid-method-override]
        registry.add_callback(AfterToolCallEvent, self.on_after_tool_call)

    def on_after_tool_call(self, event: AfterToolCallEvent) -> None:
        """Tool呼び出し後のHook"""
        status = event.result.get("status", "unknown")
        tool_name = event.selected_tool.tool_name if event.selected_tool else "unknown"
        logger.debug("Tool called", extra={"tool_name": tool_name, "status": status})

"""Agent用ロギングフック"""

import logging

from strands.hooks import HookProvider, HookRegistry
from strands.hooks.events import (
    AfterInvocationEvent,
    AfterToolCallEvent,
)

logger = logging.getLogger(f"bedrock_agentcore.app.{__name__}")
logger.setLevel(logging.DEBUG)


class LoggingHookProvider(HookProvider):
    """ツール呼び出しとレスポンスをログ出力するHookProvider"""

    def register_hooks(self, registry: HookRegistry) -> None:  # noqa: D102  # ty:ignore[invalid-method-override]
        registry.add_callback(AfterToolCallEvent, self.on_after_tool_call)
        registry.add_callback(AfterInvocationEvent, self.on_after_invocation)

    def on_after_tool_call(self, event: AfterToolCallEvent) -> None:
        """Tool呼び出し後のHook"""
        status = event.result.get("status", "unknown")
        content = event.result.get("content", "nothing")
        tool_name = event.selected_tool.tool_name if event.selected_tool else "unknown"
        logger.debug(
            "[Tool call completed] Tool: %s, Status: %s, Content: %s",
            tool_name,
            status,
            content,
        )

    def on_after_invocation(self, event: AfterInvocationEvent) -> None:
        """レスポンス後のHook"""
        if event.result:
            content = event.result.message.get("content", [])
            logger.debug("[Invocation completed] Final response content: %s", content)
        else:
            logger.debug("[Invocation completed] No result returned.")

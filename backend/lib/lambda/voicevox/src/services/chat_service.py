"""Claude AIを使用してチャットメッセージを生成するサービス"""

from collections.abc import Iterable
from typing import cast

from anthropic import AnthropicAWS
from anthropic.types import (
    ContentBlockParam,
    MessageParam,
    ToolResultBlockParam,
    ToolUseBlock,
)
from aws_lambda_powertools import Logger
from pydantic import BaseModel, Field
from tools.resume import RESUME_TOOL, get_resume_content  # ty:ignore[unresolved-import]

logger = Logger(child=True)

MODEL = "claude-haiku-4-5"
MAX_TOKEN = 1024

SYSTEM_PROMPT = """質問に対する答えが分からない場合は全てのツールを利用してください。
「提供された情報」や「コンテキスト」という言葉は使わず、自身の知識として自然に回答してください。
Markdown、箇条書き、表、記号、特殊文字を使用せず、句読点を適切に用いた最大3文の文章を改行せず1行で出力してください。
回答した文章は「音声」で読み上げられる可能性があるためです。
"""


class AgentResponseParseError(RuntimeError):
    def __init__(self) -> None:
        super().__init__("Failed to parse AgentResponse from structured output")


class AgentResponse(BaseModel):
    answer: str = Field(
        description="The final response to the user. Provide the answer if resolved, or describe the current status if unresolved.",  # noqa: E501
    )
    requires_additional_info: bool = Field(
        description="MUST be set to True if the answer is not found within the provided data or if more detailed information is required to provide an accurate answer.",  # noqa: E501
    )


class ChatService:
    def __init__(self, client: AnthropicAWS) -> None:
        self._client = client

    def generate_message(self, messages: Iterable[MessageParam]) -> str:
        message_list = list(messages)

        # 1.生成AIに通常リクエスト
        conversation: list[MessageParam] = list(message_list)
        response = self._client.messages.parse(
            model=MODEL,
            max_tokens=MAX_TOKEN,
            system=SYSTEM_PROMPT,
            tools=[RESUME_TOOL],
            output_format=AgentResponse,
            messages=conversation,
        )
        parsed_response = response.parsed_output
        logger.debug(
            "Initial response",
            extra={
                "stop_reason": response.stop_reason,
                "answer": parsed_response.answer if parsed_response else None,
            },
        )

        while response.stop_reason == "tool_use":
            tool_results: list[ToolResultBlockParam] = [
                {
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": get_resume_content(),
                }
                for block in response.content
                if isinstance(block, ToolUseBlock)
            ]
            conversation = [
                *conversation,
                {
                    "role": "assistant",
                    "content": cast("list[ContentBlockParam]", response.content),
                },
                {"role": "user", "content": tool_results},
            ]
            response = self._client.messages.parse(
                model=MODEL,
                max_tokens=MAX_TOKEN,
                system=SYSTEM_PROMPT,
                tools=[RESUME_TOOL],
                output_format=AgentResponse,
                messages=conversation,
            )
            parsed_response = response.parsed_output
            logger.debug(
                "Tool loop response",
                extra={
                    "stop_reason": response.stop_reason,
                    "answer": parsed_response.answer if parsed_response else None,
                },
            )

        if parsed_response is None:
            raise AgentResponseParseError
        logger.debug(
            "First Response",
            extra={
                "requires_additional_info": parsed_response.requires_additional_info,
                "answer": parsed_response.answer,
            },
        )
        if not parsed_response.requires_additional_info:
            return parsed_response.answer

        # 2.回答が得られなかった場合はツールを呼び出して再度リクエスト
        resume_content = get_resume_content()
        last_user_content = message_list[-1]["content"]
        question = last_user_content if isinstance(last_user_content, str) else ""
        messages_with_resume: list[MessageParam] = [
            *message_list[:-1],
            {
                "role": "user",
                "content": (
                    f"User Request: {question}\n\n"
                    f"Collected Detailed Information:\n{resume_content}"
                ),
            },
        ]

        final_response = self._client.messages.parse(
            model=MODEL,
            max_tokens=MAX_TOKEN,
            system=SYSTEM_PROMPT,
            output_format=AgentResponse,
            messages=messages_with_resume,
        )
        final_parsed_response = final_response.parsed_output
        if final_parsed_response is None:
            raise AgentResponseParseError
        logger.debug("Final response", extra={"answer": final_parsed_response.answer})
        return final_parsed_response.answer

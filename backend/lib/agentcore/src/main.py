"""BedrockAgentCoreメインコード"""

import logging
import os
import re
import uuid
from typing import cast
from zoneinfo import ZoneInfo

from bedrock_agentcore import RequestContext
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from bedrock_agentcore.runtime.app import RequestContextFormatter
from logging_hook_provider import LoggingHookProvider  # ty:ignore[unresolved-import]
from pydantic import BaseModel, Field, field_validator
from strands import Agent, ModelRetryStrategy
from strands.agent.conversation_manager import SlidingWindowConversationManager
from strands.models.bedrock import BedrockModel
from strands.session.s3_session_manager import S3SessionManager
from strands.tools.executors import SequentialToolExecutor
from tools.knowledgebase import get_tech_blog_content  # ty:ignore[unresolved-import]
from tools.resume import get_resume_content  # ty:ignore[unresolved-import]

app = BedrockAgentCoreApp()

logger = logging.getLogger("bedrock_agentcore.app")
logger.handlers.clear()
handler = logging.StreamHandler()
formatter = RequestContextFormatter()
handler.setFormatter(formatter)
logger.addHandler(handler)
logger.setLevel(logging.INFO)
logger.propagate = False

# 環境変数
try:
    JST = ZoneInfo("Asia/Tokyo")
    MODEL_ID = "apac.amazon.nova-micro-v1:0"
    UNIFIED_PROMPT = "質問に対する答えが分からない場合は全てのツールを利用してください。「提供された情報」や「コンテキスト」という言葉は使わず、自身の知識として自然に回答してください。Markdown、箇条書き、表、記号、特殊文字を使用せず、句読点を適切に用いた最大2文の文章を改行せず1行で出力してください。"  # noqa: E501
    S3_SESSION_BUCKET_NAME = os.environ["S3_SESSION_BUCKET_NAME"]
    AGENT_ID = os.environ["AGENT_ID"]
except KeyError:
    logger.exception("環境変数が設定されていません")
    raise


def clean_response(text: str) -> str:
    """Remove <thinking> tags and their content using a regular expression"""
    return re.sub(r"<thinking>.*?</thinking>", "", text, flags=re.DOTALL).strip()


class AgentResponse(BaseModel):
    """Definition for deciding whether to finalize the response based on current knowledge or to request more detailed information for further review."""  # noqa: E501

    answer: str = Field(
        description="The final response to the user. Provide the answer if resolved, or describe the current status if unresolved.",  # noqa: E501
    )
    s3_uri: str | None = Field(
        default=None,
        description="The S3 URI of the source document used to generate the answer. Set to null if no specific source is identified.",  # noqa: E501
    )
    requires_additional_info: bool = Field(
        description="MUST be set to True if the answer is not found within the provided data or if more detailed information is required to provide an accurate answer.",  # noqa: E501
    )

    @field_validator("s3_uri")
    @classmethod
    def validate_s3_uri(cls, value: str | None) -> str | None:
        """Validate that the s3_uri, if provided, is in a valid S3 URI format."""
        if value is None:
            return value
        s3_uri_pattern = re.compile(r"^s3://.+")
        if not re.match(s3_uri_pattern, value):
            log_message = f"Invalid S3 URI format: {value}. Expected format: s3://bucket-name/path/"
            raise ValueError(log_message)
        return value


@app.entrypoint
def invoke(payload, context: RequestContext) -> str:  # noqa: ANN001
    """Entry Point"""
    session_id = context.session_id or f"default-{uuid.uuid4()}"
    user_input = payload.get("prompt")
    logger.info("Session ID: %s, User input: %s", session_id, user_input)

    # 1. まずはAgentにまかせて回答させる
    agent = Agent(
        agent_id=AGENT_ID,
        model=BedrockModel(model_id=MODEL_ID, max_tokens=256),
        system_prompt=UNIFIED_PROMPT,
        tools=[get_tech_blog_content, get_resume_content],
        callback_handler=None,
        hooks=[LoggingHookProvider()],
        conversation_manager=SlidingWindowConversationManager(window_size=10),
        tool_executor=SequentialToolExecutor(),
        # list_messagesやread_messagesでメッセージは取得可能
        # ※仮でuser-idをハードコーディング
        session_manager=S3SessionManager(
            session_id=session_id,
            bucket=S3_SESSION_BUCKET_NAME,
            prefix=f"user-id/{session_id}/",
        ),
        retry_strategy=ModelRetryStrategy(initial_delay=1, max_attempts=2, max_delay=3),
    )
    custom_input = user_input + " " + UNIFIED_PROMPT
    first_result = agent(custom_input, structured_output_model=AgentResponse)
    first_agent_response = cast("AgentResponse", first_result.structured_output)
    logger.info(
        "Agent initial response: %s, S3 URI: %s, requires_additional_info: %s",
        first_agent_response.answer,
        first_agent_response.s3_uri,
        first_agent_response.requires_additional_info,
    )
    if not first_agent_response.requires_additional_info:
        return clean_response(first_agent_response.answer)

    # 2. 分からなかった場合(requires_additional_info=True)は、
    #    全ツールを実行して収集した情報をもとにAgentに回答させる
    logger.info("全ツールの実行開始")
    all_tools_result = (
        f"{get_resume_content()}\n{get_tech_blog_content(user_input).content}"
    )
    logger.info("全ツールの実行完了: %s", all_tools_result)

    final_prompt = (
        f"User Request: {user_input}\n\n"
        f"Collected Detailed Information:\n{all_tools_result}\n\n"
        f"Finalize the answer based on the information above. {UNIFIED_PROMPT}"
    )
    final_result = agent(final_prompt, structured_output_model=AgentResponse)
    final_agent_response = cast("AgentResponse", final_result.structured_output)
    logger.info(
        "Agent final response: %s, S3 URI: %s, requires_additional_info: %s",
        final_agent_response.answer,
        final_agent_response.s3_uri,
        final_agent_response.requires_additional_info,
    )
    return clean_response(final_agent_response.answer)


if __name__ == "__main__":
    app.run()

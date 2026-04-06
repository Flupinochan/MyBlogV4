"""BedrockAgentCoreメインコード"""

import re
from typing import cast

from bedrock_agentcore.runtime import BedrockAgentCoreApp
from pydantic import BaseModel, Field
from strands import Agent
from strands.models.bedrock import BedrockModel
from tools.knowledgebase import get_tech_blog_content  # ty:ignore[unresolved-import]
from tools.resume import get_resume_content  # ty:ignore[unresolved-import]

# 環境変数
MODEL_ID = "apac.amazon.nova-micro-v1:0"
UNIFIED_PROMPT = "質問に対する答えが分からない場合は全てのツールを利用してください。「提供された情報」や「コンテキスト」という言葉は使わず、自身の知識として自然に回答してください。Markdown、箇条書き、表、記号、特殊文字を使用せず、句読点を適切に用いた最大2文の文章を改行せず1行で出力してください。"  # noqa: E501
AGENT: Agent | None = None

app = BedrockAgentCoreApp()
log = app.logger
tools = []
tools.extend([get_tech_blog_content, get_resume_content])


def get_or_create_agent(agent: Agent | None) -> Agent:
    """Get or create an agent instance"""
    if agent is None:
        agent = Agent(
            model=BedrockModel(model_id=MODEL_ID, max_tokens=256),
            system_prompt=UNIFIED_PROMPT,
            tools=tools,
        )
    return agent


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


@app.entrypoint
def invoke(request) -> str:  # noqa: ANN001
    """Entry Point"""
    agent = get_or_create_agent(AGENT)

    user_input = request.get("prompt")
    log.info("User input: %s", user_input)
    custom_input = user_input + " " + UNIFIED_PROMPT

    # 1. まずはAgentにまかせて回答させる
    result = agent(custom_input, structured_output_model=AgentResponse)
    agent_response = cast("AgentResponse", result.structured_output)
    log.info(
        "Agent initial response: %s, S3 URI: %s, requires_additional_info: %s",
        agent_response.answer,
        agent_response.s3_uri,
        agent_response.requires_additional_info,
    )
    if not agent_response.requires_additional_info:
        return clean_response(agent_response.answer)

    # 2. 分からなかった場合(requires_additional_info=True)は、
    #    全ツールを実行して収集した情報をもとにAgentに回答させる
    log.info("全ツールの実行開始")
    all_tools_result = (
        f"{get_resume_content()}\n{get_tech_blog_content(user_input).content}"
    )
    log.info("全ツールの実行完了, collected_information: %s", all_tools_result)

    final_prompt = (
        f"User Request: {user_input}\n\n"
        f"Collected Detailed Information:\n{all_tools_result}\n\n"
        f"Finalize the answer based on the information above. {UNIFIED_PROMPT}"
    )
    final_result = agent(final_prompt, structured_output_model=AgentResponse)
    final_agent_response = cast("AgentResponse", final_result.structured_output)
    log.info(
        "Agent final response: %s, S3 URI: %s, requires_additional_info: %s",
        final_agent_response.answer,
        final_agent_response.s3_uri,
        final_agent_response.requires_additional_info,
    )

    return clean_response(final_agent_response.answer)


if __name__ == "__main__":
    app.run()

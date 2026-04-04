import re

from bedrock_agentcore.runtime import BedrockAgentCoreApp
from strands import Agent
from strands.models.bedrock import BedrockModel
from tools.knowledgebase import get_tech_blog_content  # ty:ignore[unresolved-import]
from tools.resume import get_resume_content  # ty:ignore[unresolved-import]
from pydantic import BaseModel, Field
import inspect

# 環境変数
MODEL_ID = "jp.amazon.nova-2-lite-v1:0"
UNIFIED_PROMPT = """Markdown、箇条書き、表、記号、特殊文字を使用しないで出力してください。文章では、。等の句読点を適切に使ってください。改行せず1行で出力し、必ず最大2文に収めてください。"""  # noqa: E501
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
    """
    Definition for deciding whether to finalize the response based on current knowledge 
    or to request more detailed information for further review.
    """
    answer: str = Field(
        description="The final response to the user. Provide the answer if resolved, or describe the current status if unresolved."
    )
    requires_additional_info: bool = Field(
        description="Set to True if current knowledge is insufficient and more detailed information is required to provide an accurate answer."
    )

@app.entrypoint
def invoke(request):
    agent = get_or_create_agent(AGENT)

    user_input = request.get("prompt")
    log.info("User input: %s", user_input)
    custom_input = user_input + " " + UNIFIED_PROMPT

    # 1. まずはAgentにまかせて回答させる
    result = agent(custom_input, structured_output_model=AgentResponse)
    agentResponse: AgentResponse = result.structured_output
    log.info("Agent initial response: %s, requires_additional_info: %s", agentResponse.answer, agentResponse.requires_additional_info)
    if not agentResponse.requires_additional_info:
        return clean_response(agentResponse.answer)

    # 2. 分からなかった場合(requires_additional_info=True)は、全ツールを実行して収集した情報をもとにAgentに回答させる
    all_tools_result = []
    for tool in tools:
        try:
            sig = inspect.signature(tool)
            if sig.parameters:
                tool_result = tool(user_input)
            else:
                tool_result = tool()
            all_tools_result.append(tool_result)
        except Exception:
            log.exception("Error executing tool %s", tool.__name__)
            continue

    final_prompt = (
            f"User Request: {user_input}\n\n"
            f"Collected Detailed Information:\n" + "\n".join(all_tools_result) + "\n\n"
            f"Finalize the answer based on the information above. {UNIFIED_PROMPT}"
    )
    final_result = agent(final_prompt, structured_output_model=AgentResponse)
    return clean_response(final_result.structured_output.answer)


if __name__ == "__main__":
    app.run()

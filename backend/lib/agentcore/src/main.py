import re

from bedrock_agentcore.runtime import BedrockAgentCoreApp
from strands import Agent
from strands.models.bedrock import BedrockModel

from backend.lib.agentcore.src.tools.knowledgebase import get_tech_blog_content

# 環境変数
MODEL_ID = "jp.amazon.nova-2-lite-v1:0"
UNIFIED_PROMPT = """Markdown、箇条書き、表、記号、特殊文字を使用しないで出力してください。文章では、。等の句読点を適切に使ってください。改行せず1行で出力し、必ず最大2文に収めてください。"""  # noqa: E501
AGENT: Agent | None = None

app = BedrockAgentCoreApp()
log = app.logger
tools = []
tools.append(get_tech_blog_content)


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


@app.entrypoint
def invoke(payload, _context):
    agent = get_or_create_agent(AGENT)

    # Execute and format response
    user_input = payload.get("prompt")
    log.info("User input: %s", user_input)
    custom_input = user_input + " " + UNIFIED_PROMPT

    response = agent(custom_input)
    return clean_response(response.message["content"][0]["text"])


if __name__ == "__main__":
    app.run()

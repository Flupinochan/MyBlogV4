
from strands import Agent, tool
from strands.models.bedrock import BedrockModel
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from strands_tools import retrieve
import re

# 環境変数
MODEL_ID = "jp.amazon.nova-2-lite-v1:0"

app = BedrockAgentCoreApp()
log = app.logger

# Define a collection of tools used by the model
tools = [retrieve]

# Define a simple function tool
@tool
def add_numbers(a: int, b: int) -> int:
    """Return the sum of two numbers"""
    return a+b
tools.append(add_numbers)

_agent = None

def get_or_create_agent():
    global _agent
    if _agent is None:
        _agent = Agent(
            model=BedrockModel(model_id=MODEL_ID, max_tokens=256),
            system_prompt="""This response will be read aloud, so prioritize auditory clarity above all else. Do not use any Markdown formatting, bullet points, tables, or special characters. Output the response in plain text only.
Avoid visual layouts and instead use natural transitions and conjunctions to create a fluid, conversational flow. Keep sentences concise, avoid lists of numbers or symbols, and ensure the content is easy to follow and understand by ear alone.""",
            tools=tools,
        )
    return _agent

def clean_response(text):
    # <thinking>タグとその中身を削除する正規表現
    return re.sub(r'<thinking>.*?</thinking>', '', text, flags=re.DOTALL).strip()

@app.entrypoint
def invoke(payload, context):
    log.info("Invoking Agent.....")

    agent = get_or_create_agent()

    # Execute and format response
    user_input = payload.get("prompt")
    log.info(f"User input: {user_input}")
    custom_input = user_input + "Please provide your response in plain text only without any Markdown formatting, symbols, or bullet points. Most importantly, provide the entire response as a single, continuous line of text without any line breaks and limit your total length to a maximum of two sentences."

    response = agent(custom_input)
    cleaned_response = clean_response(response.message["content"][0]["text"])
    return cleaned_response

    # stream = agent.stream_async(payload.get("prompt"))
    # async for event in stream:
    #     if "data" in event and isinstance(event["data"], str):
    #         yield event["data"]


if __name__ == "__main__":
    app.run()

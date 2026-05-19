"""Claude AIを使用してチャットメッセージを生成するサービス"""

from anthropic import AnthropicAWS
from anthropic.types import TextBlock
from aws_lambda_powertools import Logger

logger = Logger(child=True)

MODEL = "claude-haiku-4-5"
MAX_TOKEN = 1024


class ChatService:
    def __init__(self, client: AnthropicAWS) -> None:
        self._client = client

    def generate_message(self, message: str) -> str:
        response = self._client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKEN,
            messages=[{"role": "user", "content": message}],
        )
        message = next(
            block.text for block in response.content if isinstance(block, TextBlock)
        )
        logger.info("Chat Response Message", extra={"chat-response-message": message})
        return message

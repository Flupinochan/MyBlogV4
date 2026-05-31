from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]
    user_id: str
    conversation_id: str | None = None


class ChatResponse(BaseModel):
    message: str
    conversation_id: str


class VoiceChatResponse(ChatResponse):
    voice_path: str


class ConversationMessage(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str


class ConversationResponse(BaseModel):
    id: str
    title: str
    updated_at: datetime
    messages: list[ConversationMessage]


class UpdateTitleRequest(BaseModel):
    title: str

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class ChatRequest(BaseModel):
    messages: list[Message] = Field(min_length=1, max_length=100)
    user_id: str = Field(min_length=1, max_length=100)
    conversation_id: str | None = Field(default=None, min_length=1, max_length=100)


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
    title: str = Field(min_length=1, max_length=100)


class ContactRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    message: str = Field(min_length=10, max_length=1000)


class ContactResponse(BaseModel):
    message: str

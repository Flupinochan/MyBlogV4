from typing import Annotated

from anthropic.types import MessageParam
from dependencies import (  # ty:ignore[unresolved-import]
    get_chat_service,
    get_db_service,
    get_voice_service,
)
from fastapi import APIRouter, Depends
from schemas import (  # ty:ignore[unresolved-import]
    ChatRequest,
    ChatResponse,
    VoiceChatResponse,
)
from services.chat_service import ChatService  # ty:ignore[unresolved-import]
from services.db_service import DbService  # ty:ignore[unresolved-import]
from services.voice_service import VoiceService  # ty:ignore[unresolved-import]

router = APIRouter()


@router.post("/chat")
async def chat(
    request: ChatRequest,
    chat_service: Annotated[ChatService, Depends(get_chat_service)],
    db_service: Annotated[DbService, Depends(get_db_service)],
) -> ChatResponse:
    conversation_id = request.conversation_id
    if conversation_id is None:
        conversation_id = await db_service.create_conversation(
            request.user_id,
            "新しいチャット",
        )

    new_user_msg = request.messages[-1]

    message = chat_service.generate_message(
        [MessageParam(role=m.role, content=m.content) for m in request.messages],
    )

    await db_service.save_messages(
        conversation_id,
        [
            (new_user_msg.role, new_user_msg.content),
            ("assistant", message),
        ],
    )

    return ChatResponse(message=message, conversation_id=conversation_id)


@router.post("/chat/voice")
async def chat_with_voice(
    request: ChatRequest,
    chat_service: Annotated[ChatService, Depends(get_chat_service)],
    db_service: Annotated[DbService, Depends(get_db_service)],
    voice_service: Annotated[VoiceService, Depends(get_voice_service)],
) -> VoiceChatResponse:
    conversation_id = request.conversation_id
    if conversation_id is None:
        conversation_id = await db_service.create_conversation(
            request.user_id,
            "新しいチャット",
        )

    new_user_msg = request.messages[-1]

    message = chat_service.generate_message(
        [MessageParam(role=m.role, content=m.content) for m in request.messages],
    )
    voice_path = voice_service.synthesize_and_upload(message)

    await db_service.save_messages(
        conversation_id,
        [
            (new_user_msg.role, new_user_msg.content),
            ("assistant", message),
        ],
    )

    return VoiceChatResponse(
        message=message,
        voice_path=voice_path,
        conversation_id=conversation_id,
    )

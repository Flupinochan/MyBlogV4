from typing import Annotated

from dependencies import get_db_service  # ty:ignore[unresolved-import]
from fastapi import APIRouter, Depends, Header, HTTPException
from schemas import (  # ty:ignore[unresolved-import]
    ConversationMessage,
    ConversationResponse,
    UpdateTitleRequest,
)
from services.db_service import DbService  # ty:ignore[unresolved-import]

router = APIRouter()


@router.get("/conversations")
async def get_conversations(
    x_user_id: Annotated[str, Header()],
    db_service: Annotated[DbService, Depends(get_db_service)],
) -> list[ConversationResponse]:
    conversations = await db_service.get_conversations_with_messages(x_user_id)
    return [
        ConversationResponse(
            id=c.id,
            title=c.title,
            updated_at=c.updated_at,
            messages=[
                ConversationMessage(id=m.id, role=m.role, content=m.content)
                for m in c.messages
            ],
        )
        for c in conversations
    ]


@router.patch("/conversations/{conversation_id}", status_code=204)
async def update_conversation_title(
    conversation_id: str,
    request: UpdateTitleRequest,
    x_user_id: Annotated[str, Header()],
    db_service: Annotated[DbService, Depends(get_db_service)],
) -> None:
    updated = await db_service.update_conversation_title(
        conversation_id,
        x_user_id,
        request.title,
    )
    if not updated:
        raise HTTPException(status_code=404)

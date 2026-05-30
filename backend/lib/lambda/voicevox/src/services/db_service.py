"""PostgreSQL DB service using SQLAlchemy async"""

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from aws_lambda_powertools import Logger
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from sqlalchemy.orm import selectinload

from models import ConversationOrm, MessageOrm

logger = Logger(child=True)


@dataclass
class MessageDto:
    id: str
    role: str
    content: str


@dataclass
class ConversationDto:
    id: str
    title: str
    updated_at: datetime
    messages: list[MessageDto] = field(default_factory=list)


class DbService:
    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine

    async def get_conversations_with_messages(self, user_id: str) -> list[ConversationDto]:
        async with AsyncSession(self._engine) as session:
            result = await session.execute(
                select(ConversationOrm)
                .where(ConversationOrm.user_id == uuid.UUID(user_id))
                .options(selectinload(ConversationOrm.messages))
                .order_by(ConversationOrm.created_at.desc())
            )
            conversations = result.scalars().all()
            return [
                ConversationDto(
                    id=str(c.id),
                    title=c.title,
                    updated_at=c.updated_at,
                    messages=[MessageDto(id=str(m.id), role=m.role, content=m.content) for m in c.messages],
                )
                for c in conversations
            ]

    async def create_conversation(self, user_id: str, title: str) -> str:
        now = datetime.now(timezone.utc)
        conversation = ConversationOrm(
            user_id=uuid.UUID(user_id),
            title=title,
            created_at=now,
            updated_at=now,
        )
        async with AsyncSession(self._engine) as session:
            session.add(conversation)
            await session.commit()
            await session.refresh(conversation)
            return str(conversation.id)

    async def save_messages(
        self,
        conversation_id: str,
        messages: list[tuple[str, str, int]],
    ) -> None:
        now = datetime.now(timezone.utc)
        orm_messages = [
            MessageOrm(
                conversation_id=uuid.UUID(conversation_id),
                role=role,
                content=content,
                position=position,
                created_at=now,
                updated_at=now,
            )
            for role, content, position in messages
        ]
        async with AsyncSession(self._engine) as session:
            session.add_all(orm_messages)
            await session.execute(
                update(ConversationOrm)
                .where(ConversationOrm.id == uuid.UUID(conversation_id))
                .values(updated_at=now)
            )
            await session.commit()

    async def update_conversation_title(
        self, conversation_id: str, user_id: str, title: str
    ) -> bool:
        async with AsyncSession(self._engine) as session:
            result = await session.execute(
                select(ConversationOrm).where(
                    ConversationOrm.id == uuid.UUID(conversation_id),
                    ConversationOrm.user_id == uuid.UUID(user_id),
                )
            )
            conversation = result.scalar_one_or_none()
            if conversation is None:
                return False
            conversation.title = title
            conversation.updated_at = datetime.now(timezone.utc)
            await session.commit()
            return True

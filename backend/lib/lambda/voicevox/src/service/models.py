"""SQLAlchemy ORM models"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class ConversationOrm(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID]
    title: Mapped[str] = mapped_column(default="新しいチャット")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    messages: Mapped[list["MessageOrm"]] = relationship(
        back_populates="conversation", order_by="MessageOrm.position"
    )


class MessageOrm(Base):
    __tablename__ = "messages"
    __table_args__ = (UniqueConstraint("conversation_id", "position"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE")
    )
    role: Mapped[str]
    content: Mapped[str]
    position: Mapped[int]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    conversation: Mapped["ConversationOrm"] = relationship(back_populates="messages")

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class MessageOrm(Base):
    __tablename__ = "messages"
    __table_args__ = (
        UniqueConstraint("conversation_id", "position"),
        CheckConstraint("role IN ('user', 'assistant')", name="chk_role_values"),
        {"comment": "会話に紐づくメッセージ"},
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=text("gen_random_uuid()"), comment="一意識別子")
    conversation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), comment="所属するconversationsテーブルのID")
    role: Mapped[str] = mapped_column(comment="ユーザのメッセージの場合はuser、生成AIのメッセージの場合はassistant")
    content: Mapped[str] = mapped_column(server_default=text("''"), comment="メッセージ本文")
    position: Mapped[int] = mapped_column(comment="会話内での順序")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), comment="作成日時")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), comment="更新日時")
    conversation: Mapped["ConversationOrm"] = relationship(back_populates="messages")

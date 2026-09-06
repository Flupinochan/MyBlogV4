import uuid
from datetime import datetime

from sqlalchemy import DateTime, Index, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class ConversationOrm(Base):
    __tablename__ = "conversations"
    __table_args__ = (
        Index("idx_conversations_user_id_created_at", "user_id", text("created_at DESC")),
        {"comment": "チャットの会話セッション"},
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=text("gen_random_uuid()"), comment="一意識別子")
    user_id: Mapped[uuid.UUID] = mapped_column(comment="オーナーのユーザーID")
    title: Mapped[str] = mapped_column(server_default=text("'新しいチャット'"), comment="UI表示用タイトル")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), comment="作成日時")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), comment="更新日時")
    messages: Mapped[list["MessageOrm"]] = relationship(
        back_populates="conversation", order_by="MessageOrm.position"
    )

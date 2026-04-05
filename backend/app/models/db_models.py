"""SQLAlchemy ORM models for SQLite."""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UserPreference(Base):
    __tablename__ = "user_preferences"

    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    preferred_language: Mapped[str] = mapped_column(String(8), default="en")
    favorite_categories: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    voice_id: Mapped[str] = mapped_column(String(32), default="alloy")
    theme: Mapped[str] = mapped_column(String(16), default="system")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class HistoryEntry(Base):
    """Optional: store summary history per user for analytics / replay."""

    __tablename__ = "history_entries"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    kind: Mapped[str] = mapped_column(String(32))  # news_summary, image, video
    title: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    snippet: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

"""Read-only history of summaries and media analyses."""

from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_user_id
from app.models.db_models import HistoryEntry

router = APIRouter()


class HistoryItemOut(BaseModel):
    id: int
    kind: str
    title: str | None
    snippet: str | None
    created_at: str | None


class HistoryListOut(BaseModel):
    items: List[HistoryItemOut]


@router.get("/history/{user_id}", response_model=HistoryListOut)
async def list_history(
    user_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    auth_user_id: Annotated[str, Depends(require_user_id)],
    limit: int = 50,
) -> HistoryListOut:
    if user_id != auth_user_id:
        raise HTTPException(status_code=403, detail="User ID mismatch with X-User-Id")
    if limit < 1 or limit > 200:
        raise HTTPException(status_code=400, detail="limit must be 1-200")

    result = await db.execute(
        select(HistoryEntry)
        .where(HistoryEntry.user_id == user_id)
        .order_by(HistoryEntry.id.desc())
        .limit(limit)
    )
    rows = result.scalars().all()
    items = [
        HistoryItemOut(
            id=r.id,
            kind=r.kind,
            title=r.title,
            snippet=r.snippet,
            created_at=r.created_at.isoformat() if r.created_at else None,
        )
        for r in rows
    ]
    return HistoryListOut(items=items)

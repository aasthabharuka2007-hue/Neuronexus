"""User preferences stored in SQLite."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_user_id
from app.models.db_models import UserPreference
from app.models.schemas import PreferencesIn, PreferencesOut

router = APIRouter()


@router.get("/{user_id}", response_model=PreferencesOut)
async def get_preferences(
    user_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    auth_user_id: Annotated[str, Depends(require_user_id)],
) -> PreferencesOut:
    # Path must match header for simple auth consistency
    if user_id != auth_user_id:
        raise HTTPException(status_code=403, detail="User ID mismatch with X-User-Id")

    result = await db.execute(select(UserPreference).where(UserPreference.user_id == user_id))
    row = result.scalar_one_or_none()
    if not row:
        return PreferencesOut(
            user_id=user_id,
            preferred_language="en",
            favorite_categories=None,
            voice_id="alloy",
            theme="system",
        )
    return PreferencesOut(
        user_id=row.user_id,
        preferred_language=row.preferred_language,  # type: ignore[arg-type]
        favorite_categories=row.favorite_categories,
        voice_id=row.voice_id,
        theme=row.theme,
    )


@router.put("/{user_id}", response_model=PreferencesOut)
async def put_preferences(
    user_id: str,
    body: PreferencesIn,
    db: Annotated[AsyncSession, Depends(get_db)],
    auth_user_id: Annotated[str, Depends(require_user_id)],
) -> PreferencesOut:
    if user_id != auth_user_id:
        raise HTTPException(status_code=403, detail="User ID mismatch with X-User-Id")

    result = await db.execute(select(UserPreference).where(UserPreference.user_id == user_id))
    row = result.scalar_one_or_none()
    if row:
        row.preferred_language = body.preferred_language
        row.favorite_categories = body.favorite_categories
        row.voice_id = body.voice_id
        row.theme = body.theme
    else:
        row = UserPreference(
            user_id=user_id,
            preferred_language=body.preferred_language,
            favorite_categories=body.favorite_categories,
            voice_id=body.voice_id,
            theme=body.theme,
        )
        db.add(row)

    await db.flush()
    return PreferencesOut(
        user_id=user_id,
        preferred_language=body.preferred_language,
        voice_id=body.voice_id,
        theme=body.theme,
        favorite_categories=body.favorite_categories,
    )

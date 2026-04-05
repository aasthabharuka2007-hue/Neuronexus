"""AI summarization endpoint."""

import hashlib
import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from openai import RateLimitError

from app.config import Settings, get_settings
from app.dependencies import get_ai_service, get_cache
from app.models.db_models import HistoryEntry
from app.models.schemas import SummarizeRequest, SummarizeResponse
from app.services.ai_service import AIService
from app.services.cache import TTLCache
from app.utils.validators import is_valid_user_id, validate_article_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("", response_model=SummarizeResponse)
async def summarize(
    body: SummarizeRequest,
    ai: Annotated[AIService, Depends(get_ai_service)],
    cache: Annotated[TTLCache, Depends(get_cache)],
    settings: Annotated[Settings, Depends(get_settings)],
    db: Annotated[AsyncSession, Depends(get_db)],
    x_user_id: Annotated[Optional[str], Header(alias="X-User-Id")] = None,
) -> SummarizeResponse:
    try:
        text = validate_article_text(body.text)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    h = hashlib.sha256(f"{body.language}:{text[:8000]}".encode()).hexdigest()
    cache_key = ("summarize", h)
    hit = cache.get(*cache_key)
    if hit is not None:
        if isinstance(hit, SummarizeResponse):
            return hit.model_copy(update={"cached": True})
        if isinstance(hit, dict):
            payload = {**hit, "cached": True}
            return SummarizeResponse(**payload)

    try:
        out = await ai.summarize_article(text, body.language)
    except RateLimitError as e:
        logger.warning("OpenAI summarize quota / rate limit: %s", e)
        raise HTTPException(
            status_code=429,
            detail=(
                "OpenAI quota exceeded or rate limited. "
                "Add billing at https://platform.openai.com/account/billing or switch to Gemini (GEMINI_API_KEY + AI_PROVIDER=auto)."
            ),
        ) from e
    except Exception as e:
        err = str(e).lower()
        if (
            "429" in str(e)
            or "resource_exhausted" in err
            or ("quota" in err and "exceed" in err)
            or "too many requests" in err
        ):
            logger.warning("Summarize quota / rate limit (Gemini or other): %s", e)
            raise HTTPException(
                status_code=429,
                detail=(
                    "AI quota or rate limit hit (often Gemini free-tier daily limits). "
                    "Wait and retry, try another model (GEMINI_MODEL), or add OpenAI for AI_PROVIDER=openai."
                ),
            ) from e
        logger.exception("Summarize failed")
        raise HTTPException(status_code=502, detail=str(e)) from e

    cache.set(out.model_dump(), *cache_key, ttl=settings.cache_ttl_seconds)

    # Optional history (if valid user id)
    if is_valid_user_id(x_user_id):
        try:
            snippet = out.short_summary[:500]
            db.add(
                HistoryEntry(
                    user_id=x_user_id,
                    kind="news_summary",
                    title=None,
                    snippet=snippet,
                )
            )
        except Exception:
            logger.debug("History write skipped", exc_info=True)

    return out

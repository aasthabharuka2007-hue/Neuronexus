"""News listing from NewsAPI."""

import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.config import Settings, get_settings
from app.dependencies import get_cache, get_news_service
from app.models.schemas import NewsListResponse
from app.services.cache import TTLCache
from app.services.news_service import NewsService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=NewsListResponse)
async def list_news(
    news: Annotated[NewsService, Depends(get_news_service)],
    cache: Annotated[TTLCache, Depends(get_cache)],
    settings: Annotated[Settings, Depends(get_settings)],
    category: Optional[str] = Query(None, max_length=64),
    country: str = Query("us", min_length=2, max_length=2),
    keyword: Optional[str] = Query(None, alias="keyword", max_length=200),
) -> NewsListResponse:
    cache_key_parts = ("news", country, category or "", keyword or "")
    cached = cache.get(*cache_key_parts)
    if cached is not None:
        if isinstance(cached, NewsListResponse):
            return cached.model_copy(update={"cached": True})
        if isinstance(cached, dict):
            payload = {**cached, "cached": True}
            if "relaxed_filters" not in payload:
                payload["relaxed_filters"] = False
            return NewsListResponse(**payload)

    try:
        result = await news.top_headlines(
            category=category,
            country=country.lower(),
            q=keyword,
        )
        # India (and others) often return 0 rows for category + keyword; widen to country-only.
        narrow = bool(category or keyword)
        relaxed = False
        if not result.articles and narrow:
            logger.info(
                "No headlines for country=%s category=%s q=%s; retrying country-only",
                country,
                category,
                keyword,
            )
            result = await news.top_headlines(
                category=None,
                country=country.lower(),
                q=None,
            )
            relaxed = bool(result.articles)
        if not result.articles:
            logger.info(
                "Top-headlines still empty for country=%s; trying /everything fallback",
                country,
            )
            try:
                ev = await news.everything_country_fallback(country.lower())
                if ev.articles:
                    result = ev
                    relaxed = True
            except Exception as ex:
                logger.warning("Everything fallback failed: %s", ex)
        result = result.model_copy(update={"relaxed_filters": relaxed})
    except Exception as e:
        logger.exception("News fetch failed")
        raise HTTPException(status_code=502, detail=str(e)) from e

    # Do not cache empty lists — avoids sticky "no news" after bad filters or transient API issues.
    if result.articles:
        cache.set(
            result.model_dump(),
            *cache_key_parts,
            ttl=settings.cache_ttl_seconds,
        )
    return result

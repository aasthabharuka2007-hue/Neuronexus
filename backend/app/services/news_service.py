"""Fetch headlines from NewsAPI.org."""

import logging
from typing import Any, Optional

import httpx

from app.config import Settings
from app.models.schemas import NewsArticle, NewsListResponse
from app.utils.validators import sanitize_keyword

logger = logging.getLogger(__name__)

NEWS_API_BASE = "https://newsapi.org/v2"

# When /top-headlines returns zero rows, /everything?q=… often still has stories (free tier: recent window).
_COUNTRY_SEARCH_Q: dict[str, str] = {
    "in": "India",
    "us": "United States",
    "gb": "United Kingdom",
    "au": "Australia",
    "ca": "Canada",
}


def _parse_articles(data: dict[str, Any]) -> list[NewsArticle]:
    articles: list[NewsArticle] = []
    for a in data.get("articles", []) or []:
        src = a.get("source") or {}
        articles.append(
            NewsArticle(
                source_id=src.get("id"),
                source_name=src.get("name"),
                author=a.get("author"),
                title=a.get("title") or "Untitled",
                description=a.get("description"),
                url=a.get("url") or "#",
                url_to_image=a.get("urlToImage"),
                published_at=a.get("publishedAt"),
                content=a.get("content"),
            )
        )
    return articles


def _check_newsapi_response(resp: httpx.Response, data: Any) -> None:
    if resp.status_code != 200 or not isinstance(data, dict) or data.get("status") != "ok":
        msg = (data.get("message") if isinstance(data, dict) else None) or f"NewsAPI HTTP {resp.status_code}"
        code = data.get("code") if isinstance(data, dict) else None
        logger.warning("NewsAPI error: %s (%s)", msg, code or resp.status_code)
        raise RuntimeError(msg)


class NewsService:
    def __init__(self, settings: Settings) -> None:
        self._key = settings.news_api_key
        self._client = httpx.AsyncClient(timeout=30.0)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def top_headlines(
        self,
        *,
        category: Optional[str] = None,
        country: str = "us",
        q: Optional[str] = None,
        page_size: int = 20,
    ) -> NewsListResponse:
        params: dict[str, Any] = {
            "apiKey": self._key,
            "pageSize": page_size,
            "country": country or "us",
        }
        if category:
            params["category"] = category
        kw = sanitize_keyword(q)
        if kw:
            params["q"] = kw

        url = f"{NEWS_API_BASE}/top-headlines"
        resp = await self._client.get(url, params=params)
        try:
            data = resp.json()
        except Exception:
            resp.raise_for_status()
            raise RuntimeError("NewsAPI returned non-JSON response") from None

        _check_newsapi_response(resp, data)
        articles = _parse_articles(data)

        return NewsListResponse(
            total_results=int(data.get("totalResults") or 0),
            articles=articles,
        )

    async def everything_country_fallback(
        self,
        country: str,
        page_size: int = 25,
    ) -> NewsListResponse:
        """Broader search when top-headlines is empty (e.g. some IN/region edge cases on NewsAPI)."""
        cc = (country or "us").lower()
        q = _COUNTRY_SEARCH_Q.get(cc, cc)
        params: dict[str, Any] = {
            "apiKey": self._key,
            "q": q,
            "sortBy": "publishedAt",
            "pageSize": page_size,
        }
        url = f"{NEWS_API_BASE}/everything"
        resp = await self._client.get(url, params=params)
        try:
            data = resp.json()
        except Exception:
            resp.raise_for_status()
            raise RuntimeError("NewsAPI returned non-JSON response") from None

        _check_newsapi_response(resp, data)
        articles = _parse_articles(data)

        return NewsListResponse(
            total_results=int(data.get("totalResults") or 0),
            articles=articles,
        )

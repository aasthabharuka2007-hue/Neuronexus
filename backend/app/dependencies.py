"""FastAPI dependencies."""

from typing import Annotated, Optional

from fastapi import Header, HTTPException, Request

from app.config import Settings
from app.services.ai_service import AIService
from app.services.cache import TTLCache
from app.services.news_service import NewsService
from app.utils.validators import _USER_ID_RE


def get_news_service(request: Request) -> NewsService:
    return request.app.state.news_service


def get_ai_service(request: Request) -> AIService:
    return request.app.state.ai_service


def get_cache(request: Request) -> TTLCache:
    return request.app.state.cache


async def require_user_id(
    x_user_id: Annotated[Optional[str], Header(alias="X-User-Id")] = None,
) -> str:
    if x_user_id and _USER_ID_RE.match(x_user_id):
        return x_user_id
    raise HTTPException(
        status_code=400,
        detail="Missing or invalid X-User-Id header (1-64 chars: letters, digits, _, -).",
    )


def check_upload_size(request: Request, settings: Settings) -> None:
    cl = request.headers.get("content-length")
    if cl:
        try:
            n = int(cl)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid Content-Length")
        max_b = settings.max_upload_mb * 1024 * 1024
        if n > max_b:
            raise HTTPException(
                status_code=413,
                detail=f"Upload too large. Max {settings.max_upload_mb} MB.",
            )

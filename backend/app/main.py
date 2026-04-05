"""FastAPI application entrypoint."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.database import init_db
from app.routers import api_router
from app.services.ai_service import AIService
from app.services.cache import TTLCache
from app.services.news_service import NewsService
from app.utils.logging_config import setup_logging

setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    await init_db()
    news = NewsService(settings)
    ai = AIService(settings)
    cache = TTLCache(default_ttl_seconds=settings.cache_ttl_seconds)
    app.state.news_service = news
    app.state.ai_service = ai
    app.state.cache = cache
    logger.info("AI Voice News Reader API started")
    yield
    await news.aclose()
    logger.info("Shutdown complete")


app = FastAPI(
    title="AI Voice News Reader",
    description="News, AI summaries, TTS, and media analysis API",
    version="1.0.0",
    lifespan=lifespan,
)

_settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "code": "validation_error"},
    )


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


app.include_router(api_router)


# Run with: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

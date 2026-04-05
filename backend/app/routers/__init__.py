from fastapi import APIRouter

from app.routers import history, media, news, preferences, summarize, tts

api_router = APIRouter()
api_router.include_router(news.router, prefix="/news", tags=["news"])
api_router.include_router(summarize.router, prefix="/summarize", tags=["summarize"])
api_router.include_router(tts.router, prefix="/tts", tags=["tts"])
api_router.include_router(media.router, tags=["media"])
api_router.include_router(preferences.router, prefix="/preferences", tags=["preferences"])
api_router.include_router(history.router, tags=["history"])

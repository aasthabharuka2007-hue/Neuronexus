"""Text-to-speech streaming (MP3)."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from openai import RateLimitError

from app.dependencies import get_ai_service
from app.models.schemas import TTSRequest
from app.services.ai_service import AIService

logger = logging.getLogger(__name__)

router = APIRouter()

VALID_VOICES = frozenset({"alloy", "echo", "fable", "onyx", "nova", "shimmer"})


@router.post("")
async def text_to_speech(
    body: TTSRequest,
    ai: Annotated[AIService, Depends(get_ai_service)],
) -> Response:
    if not ai.has_openai_tts():
        raise HTTPException(
            status_code=503,
            detail=(
                "Server TTS needs OPENAI_API_KEY in backend/.env. "
                "Summaries use Gemini; OpenAI is only used for MP3 voice here. "
                "Use the Play audio button — the app falls back to your browser’s voice when OpenAI is unset."
            ),
        )
    voice = body.voice or "alloy"
    if voice not in VALID_VOICES:
        raise HTTPException(status_code=400, detail=f"Invalid voice. Use one of: {sorted(VALID_VOICES)}")

    try:
        mp3 = await ai.text_to_speech_mp3(body.text, voice)
    except RateLimitError as e:
        # 429: quota / billing — surface clearly for clients (frontend can fall back to browser TTS).
        msg = str(e)
        logger.warning("OpenAI TTS rate limit / quota: %s", msg)
        raise HTTPException(
            status_code=429,
            detail="OpenAI TTS quota exceeded or rate limited. Add billing/credits at platform.openai.com or use browser speech in the app.",
        ) from e
    except Exception as e:
        logger.exception("TTS failed")
        raise HTTPException(status_code=502, detail=str(e)) from e

    return Response(
        content=mp3,
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": 'inline; filename="speech.mp3"',
            "Cache-Control": "private, max-age=3600",
        },
    )

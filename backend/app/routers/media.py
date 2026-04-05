"""Image and video analysis endpoints."""

import logging
import tempfile
from pathlib import Path
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile

from app.config import Settings, get_settings
from app.dependencies import check_upload_size, get_ai_service, require_user_id
from app.models.db_models import HistoryEntry
from app.models.schemas import AnalyzeImageResponse, AnalyzeVideoResponse, LanguageCode
from app.services.ai_service import AIService
from app.utils.validators import ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/analyze-image", response_model=AnalyzeImageResponse)
async def analyze_image(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    ai: Annotated[AIService, Depends(get_ai_service)],
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: Annotated[str, Depends(require_user_id)],
    file: UploadFile = File(...),
) -> AnalyzeImageResponse:
    check_upload_size(request, settings)
    if not file.content_type or file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image type. Allowed: {sorted(ALLOWED_IMAGE_TYPES)}",
        )

    raw = await file.read()
    max_b = settings.max_upload_mb * 1024 * 1024
    if len(raw) > max_b:
        raise HTTPException(status_code=413, detail="File exceeds upload limit")

    try:
        out = await ai.analyze_image(raw, file.content_type)
    except Exception as e:
        logger.exception("Image analysis failed")
        raise HTTPException(status_code=502, detail=str(e)) from e

    try:
        db.add(
            HistoryEntry(
                user_id=user_id,
                kind="image",
                title=file.filename,
                snippet=out.summary_meaning[:500],
            )
        )
    except Exception:
        logger.debug("History write skipped", exc_info=True)

    return out


@router.post("/analyze-video", response_model=AnalyzeVideoResponse)
async def analyze_video(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    ai: Annotated[AIService, Depends(get_ai_service)],
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: Annotated[str, Depends(require_user_id)],
    language: LanguageCode = Form("en"),
    file: UploadFile = File(...),
) -> AnalyzeVideoResponse:
    check_upload_size(request, settings)
    if not file.content_type or file.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported video type. Allowed: {sorted(ALLOWED_VIDEO_TYPES)}",
        )

    suffix = Path(file.filename or "video.mp4").suffix or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        video_path = Path(tmp.name)
        chunk_size = 1024 * 1024
        total = 0
        max_b = settings.max_upload_mb * 1024 * 1024
        while True:
            chunk = await file.read(chunk_size)
            if not chunk:
                break
            total += len(chunk)
            if total > max_b:
                video_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="File exceeds upload limit")
            tmp.write(chunk)

    try:
        out = await ai.analyze_video_file(video_path, language)
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except Exception as e:
        logger.exception("Video analysis failed")
        raise HTTPException(status_code=502, detail=str(e)) from e
    finally:
        try:
            video_path.unlink(missing_ok=True)
        except OSError:
            pass

    try:
        db.add(
            HistoryEntry(
                user_id=user_id,
                kind="video",
                title=file.filename,
                snippet=out.short_summary[:500],
            )
        )
    except Exception:
        logger.debug("History write skipped", exc_info=True)

    return out

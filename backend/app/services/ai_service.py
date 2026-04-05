"""LLM + media: Google Gemini (default) or OpenAI; OpenAI optional for TTS / Whisper."""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any, Literal, Optional

from openai import AsyncOpenAI

from app.config import Settings
from app.models.schemas import (
    AnalyzeImageResponse,
    AnalyzeVideoResponse,
    SummarizeResponse,
)

logger = logging.getLogger(__name__)

LanguageCode = Literal["en", "hi", "mr"]
LANG_NAMES = {"en": "English", "hi": "Hindi", "mr": "Marathi"}


class AIService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._provider = settings.resolved_ai_provider()
        self._gemini_model = settings.gemini_model.strip() or "gemini-2.0-flash"

        self._gemini_client: Any = None
        if settings.gemini_api_key and settings.gemini_api_key.strip():
            from google import genai

            self._gemini_client = genai.Client(api_key=settings.gemini_api_key.strip())

        self._openai: Optional[AsyncOpenAI] = None
        if settings.openai_api_key and settings.openai_api_key.strip():
            self._openai = AsyncOpenAI(api_key=settings.openai_api_key.strip())

        logger.info("AIService provider=%s gemini_model=%s openai_tts=%s", self._provider, self._gemini_model, bool(self._openai))

    def resolved_provider(self) -> str:
        return self._provider

    def has_openai_tts(self) -> bool:
        return self._openai is not None

    async def summarize_article(self, text: str, language: LanguageCode) -> SummarizeResponse:
        if self._provider == "gemini":
            return await self._gemini_summarize(text, language)
        return await self._openai_summarize(text, language)

    async def analyze_image(self, image_bytes: bytes, mime_type: str) -> AnalyzeImageResponse:
        if self._provider == "gemini":
            return await self._gemini_analyze_image(image_bytes, mime_type)
        return await self._openai_analyze_image(image_bytes, mime_type)

    async def transcribe_audio_file(self, path: Path) -> str:
        if self._provider == "gemini" and self._gemini_client:
            return await asyncio.to_thread(self._gemini_transcribe_sync, path)
        if self._openai:
            with open(path, "rb") as f:
                tr = await self._openai.audio.transcriptions.create(model="whisper-1", file=f)
            return (tr.text or "").strip()
        raise RuntimeError("No AI provider configured for speech transcription.")

    async def summarize_transcript(self, transcript: str, language: LanguageCode) -> SummarizeResponse:
        if len(transcript.strip()) < 10:
            return SummarizeResponse(
                short_summary="No speech detected or transcript too short to summarize.",
                bullet_points=["Try a clip with clearer speech", "Ensure the video has an audio track"],
                simplified_explanation="The model did not produce enough text to build a summary.",
                language=language,
            )
        return await self.summarize_article(transcript, language)

    async def text_to_speech_mp3(self, text: str, voice: str) -> bytes:
        if not self._openai:
            raise RuntimeError(
                "OpenAI API key not set — server-side TTS is unavailable. "
                "Add OPENAI_API_KEY to backend/.env or use the app’s browser speech button."
            )
        speech = await self._openai.audio.speech.create(
            model="tts-1",
            voice=voice,  # type: ignore[arg-type]
            input=text[:4096],
            response_format="mp3",
        )
        return speech.content

    # --- Gemini (sync SDK wrapped in to_thread) ---

    def _gemini_transcribe_sync(self, path: Path) -> str:
        from google.genai import types as genai_types

        assert self._gemini_client is not None
        client = self._gemini_client
        uploaded = client.files.upload(file=str(path))
        name = uploaded.name
        try:
            for _ in range(120):
                f = client.files.get(name=name)
                st = f.state
                if st == genai_types.FileState.ACTIVE:
                    break
                if st == genai_types.FileState.FAILED:
                    raise RuntimeError("Gemini could not process the audio file.")
                time.sleep(1)
            else:
                raise RuntimeError("Gemini audio upload timed out.")

            response = client.models.generate_content(
                model=self._gemini_model,
                contents=[
                    "Transcribe all spoken words in this audio. Output plain transcript text only, no labels or markdown.",
                    uploaded,
                ],
            )
            return (response.text or "").strip()
        finally:
            try:
                client.files.delete(name=name)
            except Exception:
                logger.debug("Gemini file delete skipped", exc_info=True)

    async def _gemini_summarize(self, text: str, language: LanguageCode) -> SummarizeResponse:
        from google.genai import types

        assert self._gemini_client is not None
        lang_name = LANG_NAMES[language]
        prompt = f"""You are a careful news assistant. Output valid JSON only, no markdown fences.
All user-facing string values must be in {lang_name}.

Summarize this article text. Return a JSON object with exactly these keys:
- "short_summary": one concise paragraph (2-4 sentences)
- "bullet_points": array of 4-8 short bullet strings
- "simplified_explanation": explain like to a curious teenager, plain language

Article:
---
{text[:100_000]}
---
"""
        config = types.GenerateContentConfig(
            temperature=0.3,
            response_mime_type="application/json",
        )

        def _run():
            return self._gemini_client.models.generate_content(
                model=self._gemini_model,
                contents=[prompt],
                config=config,
            )

        response = await asyncio.to_thread(_run)
        raw = (response.text or "{}").strip()
        return _parse_summarize_json(raw, language)

    async def _gemini_analyze_image(self, image_bytes: bytes, mime_type: str) -> AnalyzeImageResponse:
        from google.genai import types

        assert self._gemini_client is not None
        part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
        prompt = (
            "Describe the image, extract visible text (OCR), and summarize the meaning. "
            'Reply with JSON only: { "description": string, "extracted_text": string, "summary_meaning": string }'
        )
        config = types.GenerateContentConfig(
            temperature=0.2,
            response_mime_type="application/json",
            max_output_tokens=2048,
        )

        def _run():
            return self._gemini_client.models.generate_content(
                model=self._gemini_model,
                contents=[part, prompt],
                config=config,
            )

        response = await asyncio.to_thread(_run)
        raw = (response.text or "{}").strip()
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            raise ValueError("Gemini vision returned invalid JSON") from None
        return AnalyzeImageResponse(
            description=str(data.get("description", "")).strip(),
            extracted_text=str(data.get("extracted_text", "")).strip(),
            summary_meaning=str(data.get("summary_meaning", "")).strip(),
        )

    # --- OpenAI ---

    async def _openai_summarize(self, text: str, language: LanguageCode) -> SummarizeResponse:
        assert self._openai is not None
        lang_name = LANG_NAMES[language]
        system = (
            "You are a careful news assistant. Output valid JSON only, no markdown. "
            f"All user-facing string values must be in {lang_name} ({language})."
        )
        user = f"""Summarize this article text.

Return a JSON object with exactly these keys:
- "short_summary": one concise paragraph (2-4 sentences)
- "bullet_points": array of 4-8 short bullet strings
- "simplified_explanation": explain like to a curious teenager, plain language

Article:
---
{text[:100_000]}
---
"""
        resp = await self._openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        raw = resp.choices[0].message.content or "{}"
        return _parse_summarize_json(raw, language)

    async def _openai_analyze_image(self, image_bytes: bytes, mime_type: str) -> AnalyzeImageResponse:
        assert self._openai is not None
        b64 = base64.standard_b64encode(image_bytes).decode("ascii")
        data_url = f"data:{mime_type};base64,{b64}"
        system = (
            "You describe images for accessibility and analysis. "
            "Reply with JSON only: description (string), extracted_text (OCR, string), "
            "summary_meaning (string)."
        )
        resp = await self._openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Describe the image, extract visible text (OCR), and summarize the meaning.",
                        },
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                },
            ],
            response_format={"type": "json_object"},
            max_tokens=1200,
        )
        raw = resp.choices[0].message.content or "{}"
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            raise ValueError("Vision model returned invalid JSON") from None
        return AnalyzeImageResponse(
            description=str(data.get("description", "")).strip(),
            extracted_text=str(data.get("extracted_text", "")).strip(),
            summary_meaning=str(data.get("summary_meaning", "")).strip(),
        )

    @staticmethod
    def extract_audio_from_video(video_path: Path, out_wav: Path) -> None:
        cmd = [
            "ffmpeg",
            "-y",
            "-i",
            str(video_path),
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-f",
            "wav",
            str(out_wav),
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if proc.returncode != 0:
            logger.error("ffmpeg failed: %s", proc.stderr[-2000:])
            raise RuntimeError("Could not extract audio from video. Is ffmpeg installed?")

    async def analyze_video_file(self, video_path: Path, language: LanguageCode) -> AnalyzeVideoResponse:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            wav_path = Path(tmp.name)
        try:
            self.extract_audio_from_video(video_path, wav_path)
            transcript = await self.transcribe_audio_file(wav_path)
            summary = await self.summarize_transcript(transcript, language)
            return AnalyzeVideoResponse(
                transcript=transcript,
                short_summary=summary.short_summary,
                bullet_points=summary.bullet_points,
                simplified_explanation=summary.simplified_explanation,
            )
        finally:
            try:
                wav_path.unlink(missing_ok=True)
            except OSError:
                pass


def _parse_summarize_json(raw: str, language: LanguageCode) -> SummarizeResponse:
    try:
        data: dict[str, Any] = json.loads(raw)
    except json.JSONDecodeError:
        logger.error("Invalid JSON from model: %s", raw[:500])
        raise ValueError("Model returned invalid JSON") from None
    bullets = data.get("bullet_points") or []
    if isinstance(bullets, str):
        bullets = [bullets]
    bullets = [str(b).strip() for b in bullets if str(b).strip()]
    return SummarizeResponse(
        short_summary=str(data.get("short_summary", "")).strip(),
        bullet_points=bullets,
        simplified_explanation=str(data.get("simplified_explanation", "")).strip(),
        language=language,
    )

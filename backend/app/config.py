"""Application configuration from environment variables."""

from functools import lru_cache
from pathlib import Path
from typing import Literal, Optional

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Always load .env from the backend package root (parent of app/), not the shell CWD.
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_ENV_FILE = _BACKEND_ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # AI: Gemini (recommended free tier) and/or OpenAI (optional: TTS, Whisper, or full provider)
    ai_provider: Literal["gemini", "openai", "auto"] = Field(
        default="auto",
        description="auto = use Gemini if GEMINI_API_KEY set, else OpenAI",
    )
    gemini_api_key: Optional[str] = Field(default=None, description="Google AI Studio / Gemini API key")
    gemini_model: str = Field(default="gemini-2.0-flash", description="Gemini model id")
    openai_api_key: Optional[str] = Field(default=None, description="OpenAI API key (optional if using Gemini)")

    # NewsAPI.org
    news_api_key: str = Field(..., description="NewsAPI.org API key")

    # Server
    api_host: str = Field(default="0.0.0.0")
    api_port: int = Field(default=8000)
    cors_origins: str = Field(
        default=(
            "http://localhost:5173,http://127.0.0.1:5173,"
            "http://localhost:5174,http://127.0.0.1:5174"
        ),
        description="Comma-separated list of allowed CORS origins",
    )

    # Limits
    max_upload_mb: int = Field(default=50, description="Max multipart upload size in MB")
    cache_ttl_seconds: int = Field(default=300, description="In-memory cache TTL for news/summaries")

    # Database
    database_url: str = Field(default="sqlite+aiosqlite:///./voice_news.db")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def resolved_ai_provider(self) -> Literal["gemini", "openai"]:
        """Which backend handles chat, vision, and (by default) transcription."""
        g = bool(self.gemini_api_key and self.gemini_api_key.strip())
        o = bool(self.openai_api_key and self.openai_api_key.strip())
        if self.ai_provider == "gemini":
            return "gemini"
        if self.ai_provider == "openai":
            return "openai"
        if g:
            return "gemini"
        if o:
            return "openai"
        raise RuntimeError("resolved_ai_provider called without keys")

    @model_validator(mode="after")
    def _validate_ai_keys(self) -> "Settings":
        g = bool(self.gemini_api_key and self.gemini_api_key.strip())
        o = bool(self.openai_api_key and self.openai_api_key.strip())
        if self.ai_provider == "gemini" and not g:
            raise ValueError(
                "GEMINI_API_KEY is required when AI_PROVIDER=gemini. Create a key at https://aistudio.google.com/app/apikey"
            )
        if self.ai_provider == "openai" and not o:
            raise ValueError("OPENAI_API_KEY is required when AI_PROVIDER=openai")
        if self.ai_provider == "auto" and not g and not o:
            raise ValueError(
                "Set GEMINI_API_KEY (recommended) and/or OPENAI_API_KEY. "
                "With AI_PROVIDER=auto, at least one key is required."
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


def clear_settings_cache() -> None:
    get_settings.cache_clear()

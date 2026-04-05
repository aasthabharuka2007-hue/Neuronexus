"""Pydantic request/response models."""

from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

LanguageCode = Literal["en", "hi", "mr"]


class NewsArticle(BaseModel):
    source_id: Optional[str] = None
    source_name: Optional[str] = None
    author: Optional[str] = None
    title: str
    description: Optional[str] = None
    url: str
    url_to_image: Optional[str] = None
    published_at: Optional[str] = None
    content: Optional[str] = None


class NewsListResponse(BaseModel):
    status: str = "ok"
    total_results: int = 0
    articles: List[NewsArticle] = Field(default_factory=list)
    cached: bool = False
    # True when category/keyword were dropped because NewsAPI returned no rows for the narrow query.
    relaxed_filters: bool = False


class SummarizeRequest(BaseModel):
    text: str = Field(..., min_length=10, max_length=120_000)
    language: LanguageCode = "en"

    @field_validator("text")
    @classmethod
    def strip_text(cls, v: str) -> str:
        return v.strip()


class SummarizeResponse(BaseModel):
    short_summary: str
    bullet_points: List[str]
    simplified_explanation: str
    language: LanguageCode
    cached: bool = False


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4096)
    language: LanguageCode = "en"
    voice: Optional[str] = Field(
        default=None,
        description="OpenAI voice: alloy, echo, fable, onyx, nova, shimmer",
    )

    @field_validator("text")
    @classmethod
    def strip_tts(cls, v: str) -> str:
        return v.strip()


class AnalyzeImageResponse(BaseModel):
    description: str
    extracted_text: str
    summary_meaning: str


class AnalyzeVideoResponse(BaseModel):
    transcript: str
    short_summary: str
    bullet_points: List[str]
    simplified_explanation: str


class PreferencesIn(BaseModel):
    preferred_language: LanguageCode = "en"
    favorite_categories: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="Comma-separated category slugs or labels",
    )
    voice_id: str = Field(default="alloy", pattern=r"^(alloy|echo|fable|onyx|nova|shimmer)$")
    theme: Literal["light", "dark", "system"] = "system"


class PreferencesOut(BaseModel):
    user_id: str
    preferred_language: LanguageCode
    favorite_categories: Optional[str] = None
    voice_id: str
    theme: str


class ErrorResponse(BaseModel):
    detail: str
    code: Optional[str] = None

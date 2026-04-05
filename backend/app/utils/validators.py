"""Input validation helpers."""

import re
from typing import Optional

_USER_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")


def is_valid_user_id(user_id: Optional[str]) -> bool:
    return bool(user_id and _USER_ID_RE.match(user_id))

# Reasonable bounds for text payloads
MAX_ARTICLE_CHARS = 120_000
MIN_ARTICLE_CHARS = 10

ALLOWED_IMAGE_TYPES = frozenset(
    {"image/jpeg", "image/png", "image/gif", "image/webp"}
)
ALLOWED_VIDEO_TYPES = frozenset(
    {"video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"}
)


def sanitize_keyword(q: Optional[str], max_len: int = 200) -> Optional[str]:
    if not q:
        return None
    q = q.strip()
    if not q:
        return None
    q = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", q)
    return q[:max_len]


def validate_article_text(text: str) -> str:
    t = text.strip()
    if len(t) < MIN_ARTICLE_CHARS:
        raise ValueError(f"Article text must be at least {MIN_ARTICLE_CHARS} characters.")
    if len(t) > MAX_ARTICLE_CHARS:
        raise ValueError(f"Article text exceeds maximum length ({MAX_ARTICLE_CHARS}).")
    return t

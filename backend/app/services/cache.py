"""Simple in-memory TTL cache for API responses."""

import hashlib
import time
from typing import Any, Optional, TypeVar

T = TypeVar("T")


class TTLCache:
    def __init__(self, default_ttl_seconds: int = 300) -> None:
        self._store: dict[str, tuple[float, Any]] = {}
        self.default_ttl = default_ttl_seconds

    def _key(self, *parts: str) -> str:
        raw = "|".join(parts)
        return hashlib.sha256(raw.encode()).hexdigest()

    def get(self, *key_parts: str) -> Optional[Any]:
        k = self._key(*key_parts)
        item = self._store.get(k)
        if not item:
            return None
        expires_at, value = item
        if time.time() > expires_at:
            del self._store[k]
            return None
        return value

    def set(self, value: Any, *key_parts: str, ttl: Optional[int] = None) -> None:
        k = self._key(*key_parts)
        sec = ttl if ttl is not None else self.default_ttl
        self._store[k] = (time.time() + sec, value)

"""Redis connection helpers for Day2 infrastructure."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from core.settings import load_settings

try:  # pragma: no cover - optional dependency branch
    import redis
except ImportError:  # pragma: no cover - handled at runtime
    redis = None


@dataclass
class RedisHealth:
    connected: bool
    error: str | None = None

    def as_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {"connected": self.connected}
        if self.error:
            payload["error"] = self.error
        return payload


class RedisClient:
    """Thin Redis client with ping-based health checks."""

    def __init__(self, redis_url: str) -> None:
        if not redis_url:
            raise ValueError("REDIS_URL is required")
        self._redis_url = redis_url

    @classmethod
    def from_environment(cls) -> "RedisClient":
        settings = load_settings()
        return cls(settings.redis_url)

    def connect(self):  # pragma: no cover - exercised in integration tests
        if redis is None:
            raise RuntimeError("redis is required for Redis access")
        return redis.Redis.from_url(
            self._redis_url,
            socket_connect_timeout=5,
            socket_timeout=5,
        )

    def health_check(self) -> dict[str, Any]:
        if redis is None:
            return RedisHealth(
                connected=False,
                error="redis package is not installed",
            ).as_dict()

        client = self.connect()
        try:
            return RedisHealth(connected=bool(client.ping())).as_dict()
        except Exception as exc:  # pragma: no cover - integration failure path
            return RedisHealth(connected=False, error=str(exc)).as_dict()
        finally:
            client.close()

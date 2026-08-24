"""SQL tool skeleton for recent event retrieval and persistence."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any


class SQLTool:
    """Stub interface for later PostgreSQL-backed event operations."""

    def get_recent_events(self, user_id: str, days: int = 7) -> list[dict[str, Any]]:
        return []

    def save_life_events(self, events: Iterable[dict[str, Any]]) -> int:
        return len(list(events))

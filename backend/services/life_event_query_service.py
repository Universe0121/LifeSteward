"""Application service for querying persisted life events."""

from typing import Any

from tools.sql_tool import SQLTool


class LifeEventQueryService:
    def __init__(self, sql_tool: SQLTool) -> None:
        self._sql_tool = sql_tool

    def get_recent_events(self, user_id: str, days: int) -> list[dict[str, Any]]:
        normalized_user_id = str(user_id).strip()
        if not normalized_user_id:
            raise ValueError("user_id is required")
        if not 1 <= days <= 30:
            raise ValueError("days must be between 1 and 30")
        return self._sql_tool.get_recent_events(normalized_user_id, days=days)

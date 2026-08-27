"""SQL tool for recent event retrieval and persistence."""

from __future__ import annotations

import json
from datetime import UTC, date, datetime, time, timedelta
from collections.abc import Iterable
from typing import Any
from zoneinfo import ZoneInfo

from core.database import DatabaseClient

SHANGHAI = ZoneInfo("Asia/Shanghai")


def _coerce_datetime(value: Any) -> datetime | None:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    if isinstance(value, str):
        normalized = value.strip().replace("Z", "+00:00")
        if not normalized:
            return None
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError:
            # LLM extraction can return relative phrases such as "昨晚".
            # Preserve the event and let created_at provide timeline ordering.
            return None
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
    raise ValueError("event_time must be a datetime or ISO-8601 string")


class SQLTool:
    """PostgreSQL-backed life event operations."""

    def __init__(self, database_client: DatabaseClient | None = None) -> None:
        self._database_client = database_client or DatabaseClient.from_environment()

    def get_recent_events(self, user_id: str, days: int = 7) -> list[dict[str, Any]]:
        if days <= 0:
            return []

        cutoff = datetime.now(UTC) - timedelta(days=days)
        return self._database_client.fetch_all(
            """
            SELECT
                id AS life_event_id,
                user_id,
                conversation_id,
                event_type,
                event_content,
                event_time,
                emotion,
                importance_score,
                source,
                source_text,
                created_at
            FROM life_events
            WHERE user_id = %s
              AND COALESCE(event_time, created_at) >= %s
            ORDER BY COALESCE(event_time, created_at) DESC, id DESC
            """,
            (str(user_id), cutoff),
        )

    def get_events_in_range(
        self, user_id: str, start_date: date, end_date: date
    ) -> list[dict[str, Any]]:
        if end_date < start_date:
            raise ValueError("end_date must be on or after start_date")
        start_at = datetime.combine(start_date, time.min, tzinfo=SHANGHAI).astimezone(UTC)
        end_at = datetime.combine(
            end_date + timedelta(days=1), time.min, tzinfo=SHANGHAI
        ).astimezone(UTC)
        return self._database_client.fetch_all(
            """
            SELECT
                id AS life_event_id,
                user_id,
                conversation_id,
                event_type,
                event_content,
                event_time,
                emotion,
                importance_score,
                source,
                source_text,
                created_at
            FROM life_events
            WHERE user_id = %s
              AND COALESCE(event_time, created_at) >= %s
              AND COALESCE(event_time, created_at) < %s
            ORDER BY COALESCE(event_time, created_at) DESC, id DESC
            """,
            (str(user_id), start_at, end_at),
        )

    def get_user_profile(self, user_id: str) -> dict[str, Any]:
        row = self._database_client.fetch_one(
            "SELECT profile_data FROM user_profile WHERE user_id = %s",
            (str(user_id),),
        )
        if not row or not isinstance(row.get("profile_data"), dict):
            return {}
        return dict(row["profile_data"])

    def delete_simulation_batch(self, user_id: str, conversation_id: str) -> None:
        """Delete only demo events and their derived memories for one batch."""

        self._database_client.execute(
            """
            WITH deleted_memories AS (
                DELETE FROM memories
                WHERE source_event_id IN (
                    SELECT id FROM life_events
                    WHERE user_id = %s AND conversation_id = %s
                )
                RETURNING id
            )
            DELETE FROM life_events
            WHERE user_id = %s AND conversation_id = %s
            """,
            (str(user_id), str(conversation_id), str(user_id), str(conversation_id)),
        )

    def save_life_events(self, events: Iterable[dict[str, Any]]) -> int:
        inserted_count = 0
        for event in events:
            normalized_event = self._normalize_event(event)
            result = self._database_client.fetch_one(
                """
                INSERT INTO life_events (
                    user_id,
                    conversation_id,
                    event_type,
                    event_content,
                    event_time,
                    emotion,
                    importance_score,
                    source,
                    source_text
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                RETURNING id
                """,
                (
                    normalized_event["user_id"],
                    normalized_event["conversation_id"],
                    normalized_event["event_type"],
                    normalized_event["event_content"],
                    normalized_event["event_time"],
                    normalized_event["emotion"],
                    normalized_event["importance_score"],
                    normalized_event["source"],
                    normalized_event["source_text"],
                ),
            )
            if result is not None:
                inserted_count += 1
        return inserted_count

    def update_user_profile(self, user_id: str, user_profile: dict[str, Any]) -> None:
        normalized_user_id = str(user_id).strip()
        if not normalized_user_id:
            raise ValueError("user_id is required")
        if not isinstance(user_profile, dict):
            raise ValueError("user_profile must be a dict")

        self._database_client.execute(
            """
            INSERT INTO user_profile (
                user_id,
                profile_data,
                updated_at
            ) VALUES (
                %s, %s::jsonb, NOW()
            )
            ON CONFLICT (user_id)
            DO UPDATE SET
                profile_data = EXCLUDED.profile_data,
                updated_at = NOW()
            """,
            (
                normalized_user_id,
                json.dumps(user_profile, ensure_ascii=False),
            ),
        )

    @staticmethod
    def _normalize_event(event: dict[str, Any]) -> dict[str, Any]:
        user_id = str(event.get("user_id", "")).strip()
        event_content = str(event.get("event_content", "")).strip()
        if not user_id:
            raise ValueError("event.user_id is required")
        if not event_content:
            raise ValueError("event.event_content is required")

        event_time = _coerce_datetime(event.get("event_time"))
        source = str(event.get("source", "text")).strip() or "text"
        source_text = str(event.get("source_text", event_content)).strip() or event_content

        return {
            "user_id": user_id,
            "conversation_id": str(event.get("conversation_id", "")).strip(),
            "event_type": str(event.get("event_type", "note")).strip() or "note",
            "event_content": event_content,
            "event_time": event_time,
            "emotion": str(event.get("emotion", "")).strip(),
            "importance_score": float(event.get("importance_score", 0.0) or 0.0),
            "source": source,
            "source_text": source_text,
        }

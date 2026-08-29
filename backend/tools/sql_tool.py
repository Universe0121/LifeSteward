"""SQL tool for event and weekly report persistence."""

from __future__ import annotations

import json
from collections.abc import Iterable
from datetime import UTC, date, datetime, time, timedelta
from typing import Any

from core.database import DatabaseClient


def _coerce_datetime(value: Any) -> datetime | None:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    if isinstance(value, date):
        return datetime.combine(value, time.min, tzinfo=UTC)
    if isinstance(value, str):
        normalized = value.strip().replace("Z", "+00:00")
        if not normalized:
            return None
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError:
            # LLM extraction can return relative phrases such as "鏄ㄦ櫄".
            # Preserve the event and let created_at provide timeline ordering.
            return None
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
    raise ValueError("event_time must be a datetime or ISO-8601 string")


def _coerce_week_bound(value: Any) -> datetime | None:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    if isinstance(value, date):
        return datetime.combine(value, time.min, tzinfo=UTC)
    if isinstance(value, str):
        normalized = value.strip().replace("Z", "+00:00")
        if not normalized:
            return None
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError:
            try:
                parsed_date = date.fromisoformat(normalized)
            except ValueError as exc:
                raise ValueError(
                    "week bound must be a date, datetime, or ISO-8601 string"
                ) from exc
            return datetime.combine(parsed_date, time.min, tzinfo=UTC)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
    raise ValueError("week bound must be a date, datetime, or ISO-8601 string")


class SQLTool:
    """PostgreSQL-backed life event and weekly report operations."""

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
        self,
        user_id: str,
        start: date | datetime | str,
        end: date | datetime | str,
    ) -> list[dict[str, Any]]:
        normalized_user_id = str(user_id).strip()
        if not normalized_user_id:
            raise ValueError("user_id is required")

        start_bound = _coerce_week_bound(start)
        end_bound = _coerce_week_bound(end)
        if start_bound is None or end_bound is None:
            return []
        if start_bound >= end_bound:
            return []

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
            ORDER BY COALESCE(event_time, created_at) ASC, id ASC
            """,
            (normalized_user_id, start_bound, end_bound),
        )

    def list_users_with_events_in_range(
        self,
        start: date | datetime | str,
        end: date | datetime | str,
    ) -> list[str]:
        start_bound = _coerce_week_bound(start)
        end_bound = _coerce_week_bound(end)
        if start_bound is None or end_bound is None:
            return []
        if start_bound >= end_bound:
            return []

        rows = self._database_client.fetch_all(
            """
            SELECT DISTINCT user_id
            FROM life_events
            WHERE COALESCE(event_time, created_at) >= %s
              AND COALESCE(event_time, created_at) < %s
              AND TRIM(COALESCE(user_id, '')) <> ''
            ORDER BY user_id
            """,
            (start_bound, end_bound),
        )
        user_ids: list[str] = []
        for row in rows:
            user_id = str(row.get("user_id", "")).strip()
            if user_id and user_id not in user_ids:
                user_ids.append(user_id)
        return user_ids

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

    def get_weekly_report(
        self,
        user_id: str,
        week_start: date | datetime | str,
    ) -> dict[str, Any] | None:
        normalized_user_id = str(user_id).strip()
        if not normalized_user_id:
            raise ValueError("user_id is required")

        normalized_week_start = _coerce_week_bound(week_start)
        if normalized_week_start is None:
            raise ValueError("week_start is required")

        return self._database_client.fetch_one(
            """
            SELECT
                report_id,
                user_id,
                week_start,
                week_end,
                report_data,
                poster_svg,
                generated_at
            FROM weekly_reports
            WHERE user_id = %s
              AND week_start = %s::date
            """,
            (normalized_user_id, normalized_week_start.date()),
        )

    def get_weekly_report_by_id(self, report_id: int) -> dict[str, Any] | None:
        return self._database_client.fetch_one(
            """
            SELECT
                report_id,
                user_id,
                week_start,
                week_end,
                report_data,
                poster_svg,
                generated_at
            FROM weekly_reports
            WHERE report_id = %s
            """,
            (int(report_id),),
        )

    def list_weekly_reports(
        self,
        user_id: str,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        normalized_user_id = str(user_id).strip()
        if not normalized_user_id:
            raise ValueError("user_id is required")
        if limit <= 0:
            return []

        return self._database_client.fetch_all(
            """
            SELECT
                report_id,
                user_id,
                week_start,
                week_end,
                report_data,
                poster_svg,
                generated_at
            FROM weekly_reports
            WHERE user_id = %s
            ORDER BY week_start DESC, report_id DESC
            LIMIT %s
            """,
            (normalized_user_id, int(limit)),
        )

    def save_weekly_report(self, weekly_report: dict[str, Any]) -> dict[str, Any] | None:
        normalized_report = self._normalize_weekly_report(weekly_report)
        return self._database_client.fetch_one(
            """
            INSERT INTO weekly_reports (
                user_id,
                week_start,
                week_end,
                report_data,
                poster_svg,
                generated_at
            ) VALUES (
                %s,
                %s,
                %s,
                %s::jsonb,
                %s,
                COALESCE(%s, NOW())
            )
            ON CONFLICT (user_id, week_start)
            DO UPDATE SET
                week_end = EXCLUDED.week_end,
                report_data = EXCLUDED.report_data,
                poster_svg = EXCLUDED.poster_svg,
                generated_at = EXCLUDED.generated_at
            RETURNING
                report_id,
                user_id,
                week_start,
                week_end,
                report_data,
                poster_svg,
                generated_at
            """,
            (
                normalized_report["user_id"],
                normalized_report["week_start"],
                normalized_report["week_end"],
                json.dumps(normalized_report["report_data"], ensure_ascii=False),
                normalized_report["poster_svg"],
                normalized_report["generated_at"],
            ),
        )

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

    def get_user_profile(self, user_id: str) -> dict[str, Any] | None:
        normalized_user_id = str(user_id).strip()
        if not normalized_user_id:
            raise ValueError("user_id is required")

        row = self._database_client.fetch_one(
            """
            SELECT
                user_id,
                profile_data,
                updated_at
            FROM user_profile
            WHERE user_id = %s
            """,
            (normalized_user_id,),
        )
        if row is None:
            return None

        profile_data = row.get("profile_data")
        if isinstance(profile_data, dict):
            return profile_data
        return {}

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

    @staticmethod
    def _normalize_weekly_report(weekly_report: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(weekly_report, dict):
            raise ValueError("weekly_report must be a dict")

        user_id = str(weekly_report.get("user_id", "")).strip()
        if not user_id:
            raise ValueError("weekly_report.user_id is required")

        week_start = _coerce_week_bound(weekly_report.get("week_start"))
        week_end = _coerce_week_bound(weekly_report.get("week_end"))
        if week_start is None:
            raise ValueError("weekly_report.week_start is required")
        if week_end is None:
            raise ValueError("weekly_report.week_end is required")
        if week_start >= week_end:
            raise ValueError("weekly_report.week_end must be after week_start")

        report_data = weekly_report.get("report_data", {})
        if not isinstance(report_data, dict):
            raise ValueError("weekly_report.report_data must be a dict")

        poster_svg = str(weekly_report.get("poster_svg", "") or "")
        generated_at = _coerce_week_bound(weekly_report.get("generated_at"))

        return {
            "user_id": user_id,
            "week_start": week_start.date(),
            "week_end": week_end.date(),
            "report_data": report_data,
            "poster_svg": poster_svg,
            "generated_at": generated_at,
        }

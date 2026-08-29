"""Application service for weekly report storage, generation, and retrieval."""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from copy import deepcopy
from datetime import date, datetime, time, timedelta, tzinfo, timezone
from typing import Any

from agents.weekly_report_agent import WeeklyReportAgent
from services.weekly_poster import WeeklyPosterService
from tools.sql_tool import SQLTool

try:  # pragma: no cover - platform dependent timezone database availability
    from zoneinfo import ZoneInfo
except Exception:  # pragma: no cover - fallback for minimal Windows images
    ZoneInfo = None  # type: ignore[assignment]


try:
    _SHANGHAI_TZ = ZoneInfo("Asia/Shanghai") if ZoneInfo is not None else timezone(timedelta(hours=8))
except Exception:  # pragma: no cover - fallback when tzdata is unavailable
    _SHANGHAI_TZ = timezone(timedelta(hours=8))


def _coerce_date(value: Any, field_name: str) -> date:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        normalized = value.strip()
        if not normalized:
            raise ValueError(f"{field_name} is required")
        try:
            return date.fromisoformat(normalized)
        except ValueError:
            try:
                return datetime.fromisoformat(normalized.replace("Z", "+00:00")).date()
            except ValueError as exc:
                raise ValueError(f"{field_name} must be an ISO date") from exc
    raise ValueError(f"{field_name} must be a date or ISO date string")


def _is_mapping(value: Any) -> bool:
    return isinstance(value, Mapping)


def _string_or_none(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


class WeeklyReportService:
    def __init__(
        self,
        sql_tool: SQLTool,
        weekly_report_agent: WeeklyReportAgent | None = None,
        weekly_poster_service: WeeklyPosterService | None = None,
        now_provider: Callable[[tzinfo], datetime] | None = None,
    ) -> None:
        self._sql_tool = sql_tool
        self._weekly_report_agent = weekly_report_agent or WeeklyReportAgent()
        self._weekly_poster_service = weekly_poster_service or WeeklyPosterService()
        self._now_provider = now_provider

    def get_events_for_week(
        self,
        user_id: str,
        week_start: date | datetime | str,
        week_end: date | datetime | str,
    ) -> list[dict[str, Any]]:
        normalized_user_id = str(user_id).strip()
        if not normalized_user_id:
            raise ValueError("user_id is required")

        normalized_week_start = _coerce_date(week_start, "week_start")
        normalized_week_end = _coerce_date(week_end, "week_end")
        if normalized_week_start > normalized_week_end:
            raise ValueError("week_end must be on or after week_start")

        return self._sql_tool.get_events_in_range(
            normalized_user_id,
            normalized_week_start,
            normalized_week_end + timedelta(days=1),
        )

    def get_weekly_report(
        self,
        user_id: str,
        week_start: date | datetime | str,
    ) -> dict[str, Any] | None:
        normalized_user_id = str(user_id).strip()
        if not normalized_user_id:
            raise ValueError("user_id is required")
        return self._sql_tool.get_weekly_report(
            normalized_user_id,
            _coerce_date(week_start, "week_start"),
        )

    def get_weekly_report_by_id(self, report_id: int) -> dict[str, Any] | None:
        return self._sql_tool.get_weekly_report_by_id(report_id)

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
        items = self._sql_tool.list_weekly_reports(normalized_user_id, limit=limit)
        return [self.serialize_weekly_report(item) for item in items]

    def save_weekly_report(self, weekly_report: dict[str, Any]) -> dict[str, Any] | None:
        if not isinstance(weekly_report, dict):
            raise ValueError("weekly_report must be a dict")
        normalized_report = dict(weekly_report)
        normalized_report["user_id"] = str(weekly_report.get("user_id", "")).strip()
        if not normalized_report["user_id"]:
            raise ValueError("weekly_report.user_id is required")
        normalized_report["week_start"] = _coerce_date(
            weekly_report.get("week_start"), "week_start"
        )
        normalized_report["week_end"] = _coerce_date(
            weekly_report.get("week_end"), "week_end"
        )
        if normalized_report["week_end"] < normalized_report["week_start"]:
            raise ValueError("week_end must be on or after week_start")
        normalized_report["report_data"] = self._normalize_report_data(
            weekly_report.get("report_data"),
            normalized_report["week_start"],
            normalized_report["week_end"],
        )
        return self._sql_tool.save_weekly_report(normalized_report)

    def generate_weekly_report(
        self,
        user_id: str | int,
        week_start: date | datetime | str | None = None,
        timezone_name: str = "Asia/Shanghai",
        user_profile: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        normalized_user_id = str(user_id).strip()
        if not normalized_user_id:
            raise ValueError("user_id is required")

        tz = self._resolve_timezone(timezone_name)
        normalized_week_start = self._resolve_week_start(week_start, tz)
        normalized_week_end = normalized_week_start + timedelta(days=6)
        range_start = datetime.combine(normalized_week_start, time.min, tzinfo=tz)
        range_end = datetime.combine(normalized_week_end + timedelta(days=1), time.min, tzinfo=tz)

        events = self._sql_tool.get_events_in_range(
            normalized_user_id,
            range_start,
            range_end,
        )
        report_data = self._weekly_report_agent.generate_for_week(
            normalized_user_id,
            normalized_week_start,
            normalized_week_end,
            events,
            user_profile or {},
        )
        normalized_report_data = self._normalize_report_data(
            report_data,
            normalized_week_start,
            normalized_week_end,
        )
        generated_at = self._current_time(tz)
        report_payload = {
            "user_id": normalized_user_id,
            "week_start": normalized_week_start,
            "week_end": normalized_week_end,
            "report_data": normalized_report_data,
            "generated_at": generated_at,
        }
        poster_svg = self._weekly_poster_service.render_poster(report_payload)
        report_payload["poster_svg"] = poster_svg

        saved_report = self._sql_tool.save_weekly_report(report_payload)
        if saved_report is not None:
            merged_report = dict(report_payload)
            merged_report.update(saved_report)
            report_payload = merged_report

        return self.serialize_weekly_report(report_payload)

    def get_weekly_report_poster(self, report_id: int) -> str | None:
        report = self.get_weekly_report_by_id(report_id)
        if report is None:
            return None
        poster_svg = _string_or_none(report.get("poster_svg"))
        if poster_svg:
            return poster_svg
        return self._weekly_poster_service.render_poster(report)

    def serialize_weekly_report(self, weekly_report: Mapping[str, Any]) -> dict[str, Any]:
        normalized = dict(weekly_report)
        report_id = normalized.get("report_id")
        if report_id is not None:
            normalized["poster_url"] = self.build_poster_url(report_id)
        normalized.pop("poster_svg", None)
        normalized["report_data"] = self._normalize_report_data(
            normalized.get("report_data"),
            normalized.get("week_start"),
            normalized.get("week_end"),
        )
        return normalized

    @staticmethod
    def build_poster_url(report_id: int | str) -> str:
        return f"/api/v1/weekly-reports/{int(report_id)}/poster"

    def _normalize_report_data(
        self,
        report_data: Any,
        week_start: date | None = None,
        week_end: date | None = None,
    ) -> dict[str, Any]:
        if not _is_mapping(report_data):
            return self._empty_report_data(week_start, week_end)

        source = deepcopy(dict(report_data))
        overview = self._normalize_mapping(source.get("overview"))
        activity_analysis = self._normalize_mapping(
            source.get("activity_analysis") or source.get("stats")
        )
        section_reviews = self._normalize_section_reviews(source.get("section_reviews"))
        highlights = self._normalize_list_of_mappings(source.get("highlights"))
        completion = self._normalize_mapping(source.get("completion"))
        suggestions = self._normalize_string_list(
            source.get("next_week_suggestions") or source.get("suggestions")
        )

        if week_start is not None and not _string_or_none(overview.get("week_start")):
            overview["week_start"] = week_start.isoformat()
        if week_end is not None and not _string_or_none(overview.get("week_end")):
            overview["week_end"] = week_end.isoformat()
        if week_start is not None and not _string_or_none(activity_analysis.get("week_start")):
            activity_analysis["week_start"] = week_start.isoformat()
        if week_end is not None and not _string_or_none(activity_analysis.get("week_end")):
            activity_analysis["week_end"] = week_end.isoformat()

        summary = _string_or_none(overview.get("summary")) or _string_or_none(source.get("summary"))
        if summary:
            overview["summary"] = summary

        if completion.get("completion_rate") is None:
            completed = completion.get("completed") if isinstance(completion.get("completed"), list) else []
            unfinished = completion.get("unfinished") if isinstance(completion.get("unfinished"), list) else []
            total = len(completed) + len(unfinished)
            if total:
                completion["completion_rate"] = round(len(completed) / total, 2)
        if summary and not _string_or_none(completion.get("summary")):
            completion["summary"] = summary

        normalized = {
            "overview": overview,
            "activity_analysis": activity_analysis,
            "section_reviews": section_reviews,
            "highlights": highlights,
            "completion": completion,
            "next_week_suggestions": suggestions,
        }
        if summary:
            normalized["summary"] = summary
        normalized["stats"] = activity_analysis
        normalized["suggestions"] = suggestions
        normalized["highlights"] = highlights
        return normalized

    def _empty_report_data(
        self,
        week_start: date | None = None,
        week_end: date | None = None,
    ) -> dict[str, Any]:
        overview: dict[str, Any] = {}
        if week_start is not None:
            overview["week_start"] = week_start.isoformat()
        if week_end is not None:
            overview["week_end"] = week_end.isoformat()
        return {
            "overview": overview,
            "activity_analysis": {},
            "section_reviews": [],
            "highlights": [],
            "completion": {},
            "next_week_suggestions": [],
            "stats": {},
            "suggestions": [],
        }

    @staticmethod
    def _normalize_mapping(value: Any) -> dict[str, Any]:
        if not _is_mapping(value):
            return {}
        return dict(value)

    def _normalize_section_reviews(self, value: Any) -> list[dict[str, Any]]:
        if not isinstance(value, Sequence) or isinstance(value, (str, bytes)):
            return []
        normalized: list[dict[str, Any]] = []
        for item in value:
            if _is_mapping(item):
                normalized.append(dict(item))
        return normalized

    def _normalize_list_of_mappings(self, value: Any) -> list[dict[str, Any]]:
        if not isinstance(value, Sequence) or isinstance(value, (str, bytes)):
            return []
        normalized: list[dict[str, Any]] = []
        for item in value:
            if _is_mapping(item):
                normalized.append(dict(item))
        return normalized

    def _normalize_string_list(self, value: Any) -> list[str]:
        if not isinstance(value, Sequence) or isinstance(value, (str, bytes)):
            return []
        normalized: list[str] = []
        for item in value:
            text = _string_or_none(item)
            if text and text not in normalized:
                normalized.append(text)
        return normalized

    def _resolve_timezone(self, timezone_name: str | None) -> tzinfo:
        normalized = _string_or_none(timezone_name) or "Asia/Shanghai"
        if normalized.upper() in {"UTC", "Z"}:
            return timezone.utc
        if normalized.startswith(("+", "-")) and len(normalized) >= 3:
            sign = 1 if normalized[0] == "+" else -1
            offset_text = normalized[1:]
            hours_text, _, minutes_text = offset_text.partition(":")
            try:
                hours = int(hours_text)
                minutes = int(minutes_text or "0")
            except ValueError as exc:
                raise ValueError("timezone must be an IANA name or UTC offset") from exc
            return timezone(sign * timedelta(hours=hours, minutes=minutes))
        if ZoneInfo is None:
            if normalized == "Asia/Shanghai":
                return _SHANGHAI_TZ
            raise ValueError("timezone must be an IANA name or UTC offset")
        try:
            return ZoneInfo(normalized)
        except Exception as exc:
            raise ValueError("timezone must be an IANA name or UTC offset") from exc

    def _resolve_week_start(
        self,
        week_start: date | datetime | str | None,
        tz: tzinfo,
    ) -> date:
        if week_start is None or (isinstance(week_start, str) and not week_start.strip()):
            today = self._current_time(tz).date()
            return today - timedelta(days=today.weekday() + 7)
        return _coerce_date(week_start, "week_start")

    def _current_time(self, tz: tzinfo) -> datetime:
        if self._now_provider is not None:
            current = self._now_provider(tz)
            if current.tzinfo is None:
                return current.replace(tzinfo=tz)
            return current.astimezone(tz)
        return datetime.now(tz)

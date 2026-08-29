"""Batch generate weekly reports for all users with events in the last full week."""

from __future__ import annotations

import argparse
import json
import logging
import sys
from collections.abc import Iterable, Mapping
from datetime import date, datetime, time, timedelta, tzinfo, timezone
from pathlib import Path
from typing import Any

try:  # pragma: no cover - platform dependent timezone database availability
    from zoneinfo import ZoneInfo
except Exception:  # pragma: no cover - fallback for minimal Windows images
    ZoneInfo = None  # type: ignore[assignment]


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

try:  # pragma: no cover - optional local convenience dependency
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - tests can run without python-dotenv
    def load_dotenv(*args, **kwargs):
        return False

from core.composition_root import build_composition_root


LOGGER = logging.getLogger("generate_weekly_reports")

try:
    _SHANGHAI_TZ = ZoneInfo("Asia/Shanghai") if ZoneInfo is not None else timezone(timedelta(hours=8))
except Exception:  # pragma: no cover - fallback when tzdata is unavailable
    _SHANGHAI_TZ = timezone(timedelta(hours=8))


def resolve_timezone(timezone_name: str | None) -> tzinfo:
    normalized = str(timezone_name or "Asia/Shanghai").strip() or "Asia/Shanghai"
    if normalized.upper() in {"UTC", "Z"}:
        return timezone.utc
    if normalized.startswith(("+", "-")) and len(normalized) >= 3:
        sign = 1 if normalized[0] == "+" else -1
        hours_text, _, minutes_text = normalized[1:].partition(":")
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


def previous_natural_week(
    now: datetime | None = None,
    timezone_name: str = "Asia/Shanghai",
) -> tuple[date, date]:
    tz = resolve_timezone(timezone_name)
    current = now or datetime.now(tz)
    if current.tzinfo is None:
        current = current.replace(tzinfo=tz)
    else:
        current = current.astimezone(tz)
    today = current.date()
    week_start = today - timedelta(days=today.weekday() + 7)
    week_end = week_start + timedelta(days=6)
    return week_start, week_end


def _normalize_user_ids(user_ids: Iterable[Any]) -> list[str]:
    normalized: list[str] = []
    for user_id in user_ids:
        text = str(user_id).strip()
        if text and text not in normalized:
            normalized.append(text)
    return normalized


def _extract_total_events(report: Mapping[str, Any]) -> int:
    report_data = report.get("report_data")
    if isinstance(report_data, Mapping):
        activity = report_data.get("activity_analysis") or report_data.get("stats")
        if isinstance(activity, Mapping):
            total_events = activity.get("total_events")
            try:
                return int(total_events)
            except (TypeError, ValueError):
                return 0
    return 0


def run_weekly_reports(
    root: Any,
    timezone_name: str = "Asia/Shanghai",
    now: datetime | None = None,
    logger: logging.Logger | None = None,
) -> dict[str, Any]:
    logger = logger or LOGGER
    tz = resolve_timezone(timezone_name)
    week_start, week_end = previous_natural_week(now=now, timezone_name=timezone_name)
    range_start = datetime.combine(week_start, time.min, tzinfo=tz)
    range_end = datetime.combine(week_end + timedelta(days=1), time.min, tzinfo=tz)

    user_ids = _normalize_user_ids(
        root.sql_tool.list_users_with_events_in_range(range_start, range_end)
    )
    logger.info(
        "weekly-report-batch start week_start=%s week_end=%s timezone=%s user_count=%s",
        week_start.isoformat(),
        week_end.isoformat(),
        timezone_name,
        len(user_ids),
    )

    results: list[dict[str, Any]] = []
    for user_id in user_ids:
        user_profile = None
        profile_state = "missing"
        try:
            user_profile = root.sql_tool.get_user_profile(user_id)
            profile_state = "present" if user_profile is not None else "missing"
            report = root.weekly_report_service.generate_weekly_report(
                user_id=user_id,
                week_start=week_start,
                timezone_name=timezone_name,
                user_profile=user_profile or {},
            )
            result = {
                "user_id": user_id,
                "status": "success",
                "report_id": report.get("report_id"),
                "total_events": _extract_total_events(report),
                "profile_state": profile_state,
                "poster_url": report.get("poster_url"),
            }
            results.append(result)
            logger.info(
                "weekly-report user_id=%s report_id=%s total_events=%s profile=%s status=success",
                user_id,
                result["report_id"],
                result["total_events"],
                result["profile_state"],
            )
        except Exception as exc:  # noqa: BLE001 - batch jobs must continue
            result = {
                "user_id": user_id,
                "status": "failed",
                "profile_state": profile_state,
                "error": str(exc),
            }
            results.append(result)
            logger.error(
                "weekly-report user_id=%s status=failed error=%s",
                user_id,
                exc,
                exc_info=True,
            )

    summary = {
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "timezone": timezone_name,
        "user_count": len(user_ids),
        "success_count": sum(1 for item in results if item["status"] == "success"),
        "failure_count": sum(1 for item in results if item["status"] == "failed"),
        "results": results,
    }
    logger.info("weekly-report-batch summary=%s", json.dumps(summary, ensure_ascii=False, default=str))
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate weekly reports for active users.")
    parser.add_argument("--timezone", default="Asia/Shanghai")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    load_dotenv(BACKEND_DIR / ".env", override=False)
    root = build_composition_root()
    run_weekly_reports(root, timezone_name=args.timezone, logger=LOGGER)


if __name__ == "__main__":
    main()

from __future__ import annotations

import unittest
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace

from scripts.generate_weekly_reports import previous_natural_week, run_weekly_reports


class FakeSQLTool:
    def __init__(self, user_ids: list[str], profiles: dict[str, dict[str, object] | None] | None = None) -> None:
        self._user_ids = list(user_ids)
        self._profiles = dict(profiles or {})
        self.list_calls: list[tuple[datetime, datetime]] = []
        self.profile_calls: list[str] = []

    def list_users_with_events_in_range(self, start: datetime, end: datetime) -> list[str]:
        self.list_calls.append((start, end))
        return list(self._user_ids)

    def get_user_profile(self, user_id: str) -> dict[str, object] | None:
        self.profile_calls.append(user_id)
        return self._profiles.get(user_id)


class FakeWeeklyReportService:
    def __init__(self, failure_user_ids: set[str] | None = None) -> None:
        self._failure_user_ids = set(failure_user_ids or set())
        self.calls: list[dict[str, object]] = []
        self._reports: dict[tuple[str, datetime.date], dict[str, object]] = {}

    def generate_weekly_report(
        self,
        *,
        user_id: str,
        week_start,
        timezone_name: str,
        user_profile,
    ) -> dict[str, object]:
        self.calls.append(
            {
                "user_id": user_id,
                "week_start": week_start,
                "timezone_name": timezone_name,
                "user_profile": user_profile,
            }
        )
        if user_id in self._failure_user_ids:
            raise RuntimeError("LLM unavailable")
        key = (user_id, week_start)
        if key not in self._reports:
            report_id = len(self._reports) + 1
            self._reports[key] = {
                "report_id": report_id,
                "user_id": user_id,
                "week_start": week_start,
                "week_end": week_start + timedelta(days=6),
                "report_data": {
                    "activity_analysis": {"total_events": 3},
                    "overview": {
                        "title": "weekly report",
                        "summary": "ok",
                    },
                },
                "poster_url": f"/api/v1/weekly-reports/{report_id}/poster",
            }
        return self._reports[key]


class GenerateWeeklyReportsScriptTest(unittest.TestCase):
    def test_previous_natural_week_uses_shanghai_monday_to_sunday_boundaries(self) -> None:
        with self.subTest("sunday"):
            start, end = previous_natural_week(
                datetime(2026, 8, 30, 23, 30, tzinfo=timezone(timedelta(hours=8))),
                "Asia/Shanghai",
            )
            self.assertEqual((start.isoformat(), end.isoformat()), ("2026-08-17", "2026-08-23"))

        with self.subTest("monday"):
            start, end = previous_natural_week(
                datetime(2026, 8, 31, 0, 30, tzinfo=timezone(timedelta(hours=8))),
                "Asia/Shanghai",
            )
            self.assertEqual((start.isoformat(), end.isoformat()), ("2026-08-24", "2026-08-30"))

    def test_run_weekly_reports_continues_after_one_user_fails_and_is_idempotent(self) -> None:
        sql_tool = FakeSQLTool(
            ["10001", "10002", "10003"],
            profiles={
                "10001": {"learning_style": "short_task"},
                "10003": {},
            },
        )
        service = FakeWeeklyReportService(failure_user_ids={"10002"})
        root = SimpleNamespace(sql_tool=sql_tool, weekly_report_service=service)

        first = run_weekly_reports(
            root,
            timezone_name="Asia/Shanghai",
            now=datetime(2026, 8, 29, 12, 0, tzinfo=timezone(timedelta(hours=8))),
        )
        second = run_weekly_reports(
            root,
            timezone_name="Asia/Shanghai",
            now=datetime(2026, 8, 29, 12, 0, tzinfo=timezone(timedelta(hours=8))),
        )

        self.assertEqual(first["week_start"], "2026-08-17")
        self.assertEqual(first["week_end"], "2026-08-23")
        self.assertEqual(first["user_count"], 3)
        self.assertEqual(first["success_count"], 2)
        self.assertEqual(first["failure_count"], 1)
        self.assertEqual(
            [item["status"] for item in first["results"]],
            ["success", "failed", "success"],
        )
        self.assertEqual(first["results"][0]["profile_state"], "present")
        self.assertEqual(first["results"][1]["profile_state"], "missing")
        self.assertEqual(len(service._reports), 2)
        self.assertEqual(service.calls[0]["user_profile"], {"learning_style": "short_task"})
        self.assertEqual(service.calls[2]["user_profile"], {})
        self.assertEqual(second["success_count"], 2)
        self.assertEqual(len(service._reports), 2)
        self.assertEqual(first["results"][0]["report_id"], second["results"][0]["report_id"])
        self.assertEqual(sql_tool.list_calls[0][0].isoformat(), "2026-08-17T00:00:00+08:00")
        self.assertEqual(sql_tool.list_calls[0][1].isoformat(), "2026-08-24T00:00:00+08:00")


if __name__ == "__main__":
    unittest.main()

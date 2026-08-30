"""Unit tests for the weekly report application service."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone
from unittest.mock import Mock

from services.weekly_report_service import WeeklyReportService
from tools.sql_tool import SQLTool


class WeeklyReportServiceTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.sql_tool = Mock(spec=SQLTool)
        self.service = WeeklyReportService(self.sql_tool)

    def test_get_events_for_week_normalizes_inputs_and_expands_end_bound(self) -> None:
        expected = [{"life_event_id": 1}]
        self.sql_tool.get_events_in_range.return_value = expected

        result = self.service.get_events_for_week(
            " 10001 ",
            "2026-08-18",
            "2026-08-24",
        )

        self.assertIs(result, expected)
        self.sql_tool.get_events_in_range.assert_called_once()
        call_args = self.sql_tool.get_events_in_range.call_args.args
        self.assertEqual(call_args[0], "10001")
        self.assertEqual(str(call_args[1]), "2026-08-18")
        self.assertEqual(str(call_args[2]), "2026-08-25")

    def test_get_weekly_report_normalizes_user_id(self) -> None:
        self.sql_tool.get_weekly_report.return_value = {"report_id": 7}

        result = self.service.get_weekly_report(" 10001 ", "2026-08-18")

        self.assertEqual(result, {"report_id": 7})
        self.sql_tool.get_weekly_report.assert_called_once()

    def test_list_weekly_reports_rejects_non_positive_limit(self) -> None:
        self.assertEqual(self.service.list_weekly_reports("10001", limit=0), [])
        self.sql_tool.list_weekly_reports.assert_not_called()

    def test_save_weekly_report_normalizes_payload(self) -> None:
        self.sql_tool.save_weekly_report.return_value = {"report_id": 12}

        result = self.service.save_weekly_report(
            {
                "user_id": " 10001 ",
                "week_start": "2026-08-18",
                "week_end": "2026-08-24",
                "report_data": {"summary": "ok"},
                "poster_svg": "<svg />",
            }
        )

        self.assertEqual(result, {"report_id": 12})
        call_args = self.sql_tool.save_weekly_report.call_args.args[0]
        self.assertEqual(call_args["user_id"], "10001")
        self.assertEqual(str(call_args["week_start"]), "2026-08-18")
        self.assertEqual(str(call_args["week_end"]), "2026-08-24")

    def test_serialize_weekly_report_hides_internal_poster_svg(self) -> None:
        result = self.service.serialize_weekly_report(
            {
                "report_id": 12,
                "user_id": "10001",
                "week_start": datetime(2026, 8, 18, tzinfo=timezone.utc),
                "week_end": datetime(2026, 8, 24, tzinfo=timezone.utc),
                "report_data": {"summary": "ok"},
                "poster_svg": "<svg />",
                "generated_at": datetime(2026, 8, 24, tzinfo=timezone.utc),
            }
        )

        self.assertEqual(result["poster_url"], "/api/v1/weekly-reports/12/poster")
        self.assertNotIn("poster_svg", result)

    def test_get_weekly_report_poster_removes_legacy_web_aria_attributes(self) -> None:
        self.sql_tool.get_weekly_report_by_id.return_value = {
            "report_id": 12,
            "poster_svg": '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="周报"><title>周报</title></svg>',
        }

        result = self.service.get_weekly_report_poster(12)

        self.assertIsNotNone(result)
        self.assertTrue(result.startswith('<svg xmlns="http://www.w3.org/2000/svg"'))
        self.assertNotIn("role=", result)
        self.assertNotIn("aria-label", result)
        self.assertIn("<title>周报</title>", result)

    def test_generate_weekly_report_uses_last_completed_week_and_builds_poster_url(self) -> None:
        agent = Mock()
        poster = Mock()
        service = WeeklyReportService(
            self.sql_tool,
            weekly_report_agent=agent,
            weekly_poster_service=poster,
            now_provider=lambda tz: datetime(2026, 8, 29, 12, 0, tzinfo=tz),
        )
        self.sql_tool.get_events_in_range.return_value = [{"life_event_id": 1}]
        agent.generate_for_week.return_value = {
            "overview": {
                "title": "2026-08-17 至 2026-08-23 周报",
                "theme": "学习 / 工作",
                "summary": "本周总结",
            },
            "activity_analysis": {
                "total_events": 1,
                "category_distribution": [],
                "time_bands": {},
            },
            "section_reviews": [],
            "highlights": [],
            "completion": {},
            "next_week_suggestions": [],
        }
        poster.render_poster.return_value = "<svg />"
        self.sql_tool.save_weekly_report.return_value = {"report_id": 12}

        result = service.generate_weekly_report("10001", timezone_name="Asia/Shanghai")

        self.assertEqual(result["poster_url"], "/api/v1/weekly-reports/12/poster")
        self.assertEqual(str(self.sql_tool.get_events_in_range.call_args.args[1]), "2026-08-17 00:00:00+08:00")
        self.assertEqual(str(self.sql_tool.get_events_in_range.call_args.args[2]), "2026-08-24 00:00:00+08:00")
        poster.render_poster.assert_called_once()
        self.assertEqual(result["report_data"]["summary"], "本周总结")


if __name__ == "__main__":
    unittest.main()

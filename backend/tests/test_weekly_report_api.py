from __future__ import annotations

import unittest
from datetime import date, datetime, timezone
from unittest.mock import Mock

from fastapi.testclient import TestClient

from core.composition_root import CompositionRoot
from main import app


class WeeklyReportApiTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.weekly_report_service = Mock()
        self.root = Mock(spec=CompositionRoot)
        self.root.weekly_report_service = self.weekly_report_service
        app.state.composition_root = self.root
        self.client = TestClient(app, raise_server_exceptions=False)

    def tearDown(self) -> None:
        if hasattr(app.state, "composition_root"):
            del app.state.composition_root

    def test_generate_weekly_report_returns_report_with_poster_url(self) -> None:
        self.weekly_report_service.generate_weekly_report.return_value = {
            "report_id": 12,
            "user_id": "10001",
            "week_start": date(2026, 8, 18),
            "week_end": date(2026, 8, 24),
            "report_data": {
                "overview": {
                    "title": "2026-08-18 至 2026-08-24 周报",
                    "theme": "学习 / 工作",
                    "summary": "本周总结",
                },
                "activity_analysis": {"total_events": 3},
                "section_reviews": [],
                "highlights": [],
                "completion": {},
                "next_week_suggestions": [],
                "summary": "本周总结",
                "stats": {"total_events": 3},
                "suggestions": [],
            },
            "poster_url": "/api/v1/weekly-reports/12/poster",
            "poster_svg": "<svg />",
            "generated_at": datetime(2026, 8, 24, 0, 5, tzinfo=timezone.utc),
        }

        response = self.client.post(
            "/api/v1/weekly-reports/generate",
            json={
                "user_id": 10001,
                "week_start": "2026-08-18",
                "timezone": "Asia/Shanghai",
            },
        )

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["report_id"], 12)
        self.assertEqual(payload["poster_url"], "/api/v1/weekly-reports/12/poster")
        self.assertNotIn("poster_svg", payload)
        self.assertEqual(payload["week_start"], "2026-08-18")
        self.assertEqual(payload["generated_at"], "2026-08-24T00:05:00Z")
        self.weekly_report_service.generate_weekly_report.assert_called_once_with(
            user_id=10001,
            week_start=date(2026, 8, 18),
            timezone_name="Asia/Shanghai",
        )

    def test_list_weekly_reports_returns_items_and_count(self) -> None:
        self.weekly_report_service.list_weekly_reports.return_value = [
            {
                "report_id": 12,
                "user_id": "10001",
                "week_start": date(2026, 8, 18),
                "week_end": date(2026, 8, 24),
                "report_data": {"overview": {"summary": "ok"}},
                "poster_url": "/api/v1/weekly-reports/12/poster",
                "poster_svg": "<svg />",
                "generated_at": datetime(2026, 8, 24, 0, 5, tzinfo=timezone.utc),
            }
        ]

        response = self.client.get(
            "/api/v1/weekly-reports",
            params={"user_id": "10001", "limit": 10},
        )

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["count"], 1)
        self.assertEqual(payload["items"][0]["poster_url"], "/api/v1/weekly-reports/12/poster")
        self.assertNotIn("poster_svg", payload["items"][0])
        self.weekly_report_service.list_weekly_reports.assert_called_once_with(
            "10001",
            limit=10,
        )

    def test_weekly_report_poster_returns_svg_mime_type(self) -> None:
        self.weekly_report_service.get_weekly_report_poster.return_value = (
            '<svg xmlns="http://www.w3.org/2000/svg"></svg>'
        )

        response = self.client.get("/api/v1/weekly-reports/12/poster")

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.headers["content-type"], "image/svg+xml")
        self.assertIn("<svg", response.text)
        self.weekly_report_service.get_weekly_report_poster.assert_called_once_with(12)

    def test_weekly_report_poster_returns_404_when_missing(self) -> None:
        self.weekly_report_service.get_weekly_report_poster.return_value = None

        response = self.client.get("/api/v1/weekly-reports/404/poster")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error_code"], "WEEKLY_REPORT_NOT_FOUND")


if __name__ == "__main__":
    unittest.main()

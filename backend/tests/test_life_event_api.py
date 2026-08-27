from __future__ import annotations

import unittest
from unittest.mock import Mock

from fastapi.testclient import TestClient

from core.composition_root import CompositionRoot
from main import app


class LifeEventApiTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.sql_tool = Mock()
        self.root = Mock(spec=CompositionRoot)
        self.root.sql_tool = self.sql_tool
        app.state.composition_root = self.root
        self.client = TestClient(app, raise_server_exceptions=False)

    def tearDown(self) -> None:
        if hasattr(app.state, "composition_root"):
            del app.state.composition_root

    def test_returns_events_and_count(self) -> None:
        self.sql_tool.get_recent_events.return_value = [
            {
                "life_event_id": 1,
                "user_id": "10001",
                "conversation_id": "demo_xxx",
                "event_type": "study",
                "event_content": "今天学习数学2小时，有点累",
                "event_time": "2026-08-25T10:00:00+08:00",
                "emotion": "tired",
                "importance_score": 0.7,
                "source": "text",
                "source_text": "浠婂ぉ瀛︿範鏁板2灏忔椂锛屾湁鐐圭疮",
                "created_at": "2026-08-25T10:01:00+08:00",
            }
        ]
        response = self.client.get(
            "/api/v1/life-events",
            params={"user_id": "10001", "days": 7},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["count"], 1)
        self.assertEqual(payload["items"][0]["event_type"], "study")
        self.assertEqual(payload["items"][0]["source"], "text")
        self.sql_tool.get_recent_events.assert_called_once_with("10001", days=7)

    def test_empty_result(self) -> None:
        self.sql_tool.get_recent_events.return_value = []
        response = self.client.get(
            "/api/v1/life-events",
            params={"user_id": "10001"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"items": [], "count": 0})
        self.sql_tool.get_recent_events.assert_called_once_with("10001", days=7)

    def test_tool_error_is_not_swallowed(self) -> None:
        self.sql_tool.get_recent_events.side_effect = RuntimeError("database unavailable")
        response = self.client.get(
            "/api/v1/life-events",
            params={"user_id": "10001", "days": 7},
        )
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json()["error_code"], "INTERNAL_SERVER_ERROR")

    def test_invalid_parameters_are_rejected(self) -> None:
        invalid_requests = [
            {},
            {"user_id": ""},
            {"user_id": "10001", "days": 0},
            {"user_id": "10001", "days": 31},
        ]
        for params in invalid_requests:
            with self.subTest(params=params):
                response = self.client.get("/api/v1/life-events", params=params)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json()["error_code"], "INVALID_REQUEST")
        self.sql_tool.get_recent_events.assert_not_called()

    def test_simulation_demo_page_is_available(self) -> None:
        response = self.client.get("/simulation-demo")
        self.assertEqual(response.status_code, 200)
        self.assertIn("真实数据链路 Demo", response.text)


if __name__ == "__main__":
    unittest.main()

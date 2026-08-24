"""Tests for the PostgreSQL SQL tool."""

from __future__ import annotations

import unittest
import json
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from tools.sql_tool import SQLTool


@dataclass
class FakeDatabaseClient:
    fetch_all_result: list[dict[str, Any]] = field(default_factory=list)
    fetch_one_result: dict[str, Any] | None = None
    fetch_all_calls: list[tuple[str, tuple[Any, ...]]] = field(default_factory=list)
    fetch_one_calls: list[tuple[str, tuple[Any, ...]]] = field(default_factory=list)

    def fetch_all(
        self,
        query: str,
        params: tuple[Any, ...] | list[Any] | None = None,
    ) -> list[dict[str, Any]]:
        self.fetch_all_calls.append((query, tuple(params or ())))
        return list(self.fetch_all_result)

    def fetch_one(
        self,
        query: str,
        params: tuple[Any, ...] | list[Any] | None = None,
    ) -> dict[str, Any] | None:
        self.fetch_one_calls.append((query, tuple(params or ())))
        return self.fetch_one_result


class SQLToolTestCase(unittest.TestCase):
    def test_get_recent_events_uses_user_id_and_cutoff(self) -> None:
        client = FakeDatabaseClient(
            fetch_all_result=[
                {
                    "life_event_id": 1,
                    "user_id": "10001",
                    "event_content": "学习数学2小时",
                }
            ]
        )
        tool = SQLTool(database_client=client)

        events = tool.get_recent_events("10001", days=7)

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["life_event_id"], 1)
        self.assertEqual(client.fetch_all_calls[0][1][0], "10001")
        self.assertIsInstance(client.fetch_all_calls[0][1][1], datetime)
        self.assertEqual(client.fetch_all_calls[0][1][1].tzinfo, UTC)

    def test_get_recent_events_returns_empty_for_non_positive_days(self) -> None:
        client = FakeDatabaseClient()
        tool = SQLTool(database_client=client)

        self.assertEqual(tool.get_recent_events("10001", days=0), [])
        self.assertEqual(client.fetch_all_calls, [])

    def test_save_life_events_writes_all_rows(self) -> None:
        client = FakeDatabaseClient(fetch_one_result={"id": 1})
        tool = SQLTool(database_client=client)

        inserted = tool.save_life_events(
            [
                {
                    "user_id": "10001",
                    "conversation_id": "conv_001",
                    "event_type": "study",
                    "event_content": "学习数学2小时",
                    "event_time": "2026-08-23 08:00",
                    "emotion": "tired",
                    "importance_score": 0.7,
                    "source": "text",
                    "source_text": "今天学习数学2小时",
                }
            ]
        )

        self.assertEqual(inserted, 1)
        self.assertEqual(len(client.fetch_one_calls), 1)
        self.assertEqual(client.fetch_one_calls[0][1][0], "10001")
        self.assertEqual(client.fetch_one_calls[0][1][1], "conv_001")
        self.assertEqual(client.fetch_one_calls[0][1][2], "study")
        self.assertEqual(client.fetch_one_calls[0][1][3], "学习数学2小时")
        self.assertIsInstance(client.fetch_one_calls[0][1][4], datetime)

    def test_save_life_events_rejects_missing_content(self) -> None:
        tool = SQLTool(database_client=FakeDatabaseClient())

        with self.assertRaises(ValueError):
            tool.save_life_events([{ "user_id": "10001" }])

    def test_update_user_profile_upserts_json_profile(self) -> None:
        client = FakeDatabaseClient(fetch_one_result={"user_id": "10001"})
        tool = SQLTool(database_client=client)

        tool.update_user_profile("10001", {"sleep_target_hours": 8, "tags": ["study"]})

        query, params = client.fetch_one_calls[0]
        self.assertIn("INSERT INTO user_profile", query)
        self.assertIn("ON CONFLICT (user_id)", query)
        self.assertIn("RETURNING user_id", query)
        self.assertEqual(params[0], "10001")
        self.assertEqual(json.loads(params[1]), {"sleep_target_hours": 8, "tags": ["study"]})

    def test_update_user_profile_validates_arguments(self) -> None:
        tool = SQLTool(database_client=FakeDatabaseClient())

        with self.assertRaises(ValueError):
            tool.update_user_profile("", {})
        with self.assertRaises(ValueError):
            tool.update_user_profile("10001", [])

    def test_database_error_is_visible_to_caller(self) -> None:
        class BrokenDatabaseClient(FakeDatabaseClient):
            def fetch_all(self, query, params=None):
                raise RuntimeError("database unavailable")

        tool = SQLTool(database_client=BrokenDatabaseClient())

        with self.assertRaisesRegex(RuntimeError, "database unavailable"):
            tool.get_recent_events("10001")


if __name__ == "__main__":
    unittest.main()

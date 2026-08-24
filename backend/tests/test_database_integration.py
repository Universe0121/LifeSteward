"""Integration checks for PostgreSQL and pgvector."""

from __future__ import annotations

import os
import unittest
from pathlib import Path

from core.database import DatabaseClient
from tools.sql_tool import SQLTool
from tools.vector_search_tool import VectorSearchTool


class DatabaseIntegrationTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.postgres_dsn = os.getenv("POSTGRES_DSN", "").strip()
        if not self.postgres_dsn:
            self.skipTest("POSTGRES_DSN is not configured")

        self.database_client = DatabaseClient(self.postgres_dsn)
        self.migration_path = (
            Path(__file__).resolve().parents[1]
            / "migrations"
            / "001_initial_memory_schema.sql"
        )

        try:
            self.database_client.execute_script(
                self.migration_path.read_text(encoding="utf-8")
            )
        except Exception as exc:  # pragma: no cover - environment-dependent
            self.skipTest(f"Database migration could not run: {exc}")

    def test_database_health_check_reports_connection_state(self) -> None:
        health = self.database_client.health_check()
        self.assertIn("connected", health)
        self.assertIn("vector_extension_available", health)
        self.assertTrue(health["connected"])
        self.assertTrue(health["vector_extension_available"])

    def test_initial_schema_tables_exist(self) -> None:
        rows = self.database_client.fetch_all(
            """
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
              AND tablename IN (
                  'life_events',
                  'memories',
                  'user_profile',
                  'goals',
                  'plans',
                  'feedbacks',
                  'reflections'
              )
            """
        )

        table_names = {row["tablename"] for row in rows}

        self.assertEqual(
            table_names,
            {
                "life_events",
                "memories",
                "user_profile",
                "goals",
                "plans",
                "feedbacks",
                "reflections",
            },
        )

    def test_sql_tool_roundtrip(self) -> None:
        sql_tool = SQLTool(database_client=self.database_client)
        user_id = "integration-user-day4"

        inserted = sql_tool.save_life_events(
            [
                {
                    "user_id": user_id,
                    "conversation_id": "integration-conv",
                    "event_type": "study",
                    "event_content": "今天学习数学2小时，有点累",
                    "event_time": "2026-08-23 08:00:00+00:00",
                    "emotion": "tired",
                    "importance_score": 0.7,
                    "source": "text",
                    "source_text": "今天学习数学2小时，有点累",
                }
            ]
        )

        events = sql_tool.get_recent_events(user_id, days=7)

        self.assertEqual(inserted, 1)
        self.assertGreaterEqual(len(events), 1)
        self.assertEqual(events[0]["user_id"], user_id)
        self.assertEqual(events[0]["event_content"], "今天学习数学2小时，有点累")

    def test_user_profile_roundtrip(self) -> None:
        sql_tool = SQLTool(database_client=self.database_client)
        user_id = "integration-user-day4-profile"
        user_profile = {
            "learning_style": "short_task",
            "sleep_habit": "late_sleep",
        }

        sql_tool.update_user_profile(user_id, user_profile)

        row = self.database_client.fetch_one(
            """
            SELECT user_id, profile_data
            FROM user_profile
            WHERE user_id = %s
            """,
            (user_id,),
        )

        self.assertIsNotNone(row)
        self.assertEqual(row["user_id"], user_id)
        self.assertEqual(row["profile_data"], user_profile)

    def test_vector_search_roundtrip(self) -> None:
        vector_tool = VectorSearchTool(database_client=self.database_client)
        user_id = "integration-user-day4"

        vector_tool.save_memory(
            {
                "user_id": user_id,
                "memory_type": "habit",
                "memory_content": "用户晚上学习效率较低",
                "embedding": [0.1, 0.2, 0.3],
                "metadata": {"source": "integration"},
            }
        )

        memories = vector_tool.search_memories(user_id, [0.1, 0.2, 0.3], top_k=3)

        self.assertGreaterEqual(len(memories), 1)
        self.assertEqual(memories[0]["user_id"], user_id)
        self.assertIn("similarity_score", memories[0])


if __name__ == "__main__":
    unittest.main()

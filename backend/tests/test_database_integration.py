"""Integration checks for PostgreSQL and pgvector."""

from __future__ import annotations

import os
import unittest
from pathlib import Path

from core.database import DatabaseClient
from core.llm_service import create_llm_service_from_environment
from tools.sql_tool import SQLTool
from tools.vector_search_tool import VectorSearchTool

try:  # pragma: no cover - dependency is validated by requirements tests
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    def load_dotenv(*args, **kwargs):
        return False


_BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(dotenv_path=_BACKEND_DIR / ".env", override=False)


class DatabaseIntegrationTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.postgres_dsn = os.getenv("POSTGRES_DSN", "").strip()
        if not self.postgres_dsn:
            self.skipTest("POSTGRES_DSN is not configured")

        self.database_client = DatabaseClient(self.postgres_dsn)
        self.migration_path = _BACKEND_DIR / "migrations" / "001_initial_memory_schema.sql"

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
        user_id = "integration-user-day5"
        other_user_id = "integration-user-day5-other"

        inserted = sql_tool.save_life_events(
            [
                {
                    "user_id": user_id,
                    "conversation_id": "integration-conv",
                    "event_type": "study",
                    "event_content": "最近学习效率很差",
                    "event_time": "2026-08-25 08:00:00+08:00",
                    "emotion": "tired",
                    "importance_score": 0.7,
                    "source": "text",
                    "source_text": "最近学习效率很差",
                },
                {
                    "user_id": other_user_id,
                    "conversation_id": "integration-conv",
                    "event_type": "sleep",
                    "event_content": "其他用户最近三天每天只睡5小时",
                    "event_time": "2026-08-25 09:00:00+08:00",
                    "emotion": "tired",
                    "importance_score": 0.6,
                    "source": "text",
                    "source_text": "其他用户最近三天每天只睡5小时",
                },
            ]
        )

        events = sql_tool.get_recent_events(user_id, days=7)

        self.assertEqual(inserted, 2)
        self.assertGreaterEqual(len(events), 1)
        self.assertEqual(events[0]["user_id"], user_id)
        self.assertEqual(events[0]["event_content"], "最近学习效率很差")
        self.assertNotIn(other_user_id, {event["user_id"] for event in events})

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
        if not os.getenv("DASHSCOPE_API_KEY", "").strip():
            self.skipTest("DASHSCOPE_API_KEY is not configured")

        llm_service = create_llm_service_from_environment()
        vector_tool = VectorSearchTool(database_client=self.database_client)
        user_id = "integration-user-day5"
        memory_content = "最近三天每天只睡5小时，学习效率很差，压力比较大"
        memory_embedding = llm_service.embed_text(memory_content)
        query_embedding = llm_service.embed_text("最近为什么学习效率下降？")

        self.assertGreater(len(memory_embedding), 3)
        self.assertEqual(len(memory_embedding), len(query_embedding))

        vector_tool.save_memory(
            {
                "user_id": user_id,
                "memory_type": "habit",
                "memory_content": memory_content,
                "embedding": memory_embedding,
                "metadata": {
                    "source": "day5_database_integration",
                    "embedding_model": os.getenv(
                        "EMBEDDING_MODEL_NAME",
                        "text-embedding-v3",
                    ),
                    "embedding_dimension": len(memory_embedding),
                },
            }
        )

        memories = vector_tool.search_memories(user_id, query_embedding, top_k=3)

        self.assertGreaterEqual(len(memories), 1)
        self.assertEqual(memories[0]["user_id"], user_id)
        self.assertEqual(memories[0]["memory_content"], memory_content)
        self.assertIn("memory_id", memories[0])
        self.assertIn("memory_content", memories[0])
        self.assertIn("similarity_score", memories[0])
        self.assertIsInstance(memories[0]["similarity_score"], float)

        row = self.database_client.fetch_one(
            """
            SELECT vector_dims(embedding) AS embedding_dimension
            FROM memories
            WHERE user_id = %s
              AND memory_content = %s
            ORDER BY id DESC
            LIMIT 1
            """,
            (user_id, memory_content),
        )
        self.assertIsNotNone(row)
        self.assertEqual(row["embedding_dimension"], len(memory_embedding))


if __name__ == "__main__":
    unittest.main()

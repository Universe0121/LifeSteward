"""Integration checks for PostgreSQL and pgvector."""

from __future__ import annotations

import os
import unittest
from pathlib import Path

from core.database import DatabaseClient
from core.llm_service import CallableLLMService
from services.memory_service import ToolMemoryService
from agents.master_agent import MasterAgent
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

    def test_sql_tool_roundtrip(self) -> None:
        sql_tool = SQLTool(database_client=self.database_client)
        user_id = "integration-user"

        inserted = sql_tool.save_life_events(
            [
                {
                    "user_id": user_id,
                    "conversation_id": "integration-conv",
                    "event_type": "study",
                    "event_content": "学习数学2小时",
                    "event_time": "2026-08-23 08:00:00+00:00",
                    "emotion": "tired",
                    "importance_score": 0.7,
                    "source": "text",
                    "source_text": "学习数学2小时",
                }
            ]
        )

        events = sql_tool.get_recent_events(user_id, days=7)

        self.assertEqual(inserted, 1)
        self.assertGreaterEqual(len(events), 1)
        self.assertEqual(events[0]["user_id"], user_id)
        self.assertEqual(events[0]["event_content"], "学习数学2小时")

    def test_vector_search_roundtrip(self) -> None:
        vector_tool = VectorSearchTool(database_client=self.database_client)
        user_id = "integration-user"

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

    def test_memory_service_real_record_and_query_roundtrip(self) -> None:
        service = ToolMemoryService(
            SQLTool(database_client=self.database_client),
            VectorSearchTool(database_client=self.database_client),
            CallableLLMService(lambda prompt, variables: "", lambda text: [0.11, 0.22, 0.33]),
        )
        user_id = "integration-memory-service-user"
        service.save_memory(
            user_id,
            [{"event_type": "sleep", "event_content": "最近三天都只睡了5小时"}],
        )
        memories = service.search_memory(user_id, "最近睡眠情况", top_k=3)
        self.assertGreaterEqual(len(memories), 1)
        self.assertEqual(memories[0]["user_id"], user_id)

    def test_real_acceptance_reflection_flow(self) -> None:
        def generate(prompt, variables):
            if set(variables) == {"user_input"}:
                return '{"event_type":"sleep","event_content":"最近三天都只睡了5小时"}'
            if variables.get("intent") == "reflection" or (
                "retrieved_memories" in variables and variables["retrieved_memories"]
            ):
                return '{"status":"high_pressure","problem":"睡眠不足可能影响学习效率","suggestion":"优先补足睡眠并减少当天任务量"}'
            return "已结合你的历史记录完成分析。"

        service = ToolMemoryService(
            SQLTool(database_client=self.database_client),
            VectorSearchTool(database_client=self.database_client),
            CallableLLMService(generate, lambda text: [0.41, 0.52, 0.63]),
        )
        user_id = "integration-acceptance-user"
        master = MasterAgent(memory_service=service, llm_service=CallableLLMService(generate, lambda text: [0.41, 0.52, 0.63]))
        state = {
            "user_id": user_id,
            "conversation_id": "acceptance-conversation",
            "user_input": "最近三天都只睡了5小时",
            "intent": "record_event",
            "extracted_events": [], "retrieved_memories": [], "user_profile": {},
            "current_goal": {}, "generated_plan": [], "reflection_result": {}, "assistant_response": "",
        }
        master.process(state)
        state.update({"user_input": "今天学习效率很差", "intent": "record_event", "extracted_events": []})
        master.process(state)
        state.update({"user_input": "最近为什么学习效率下降？", "intent": "reflection", "extracted_events": []})
        result = master.process(state)
        self.assertGreaterEqual(len(result["retrieved_memories"]), 1)
        self.assertEqual(result["reflection_result"]["status"], "high_pressure")
        self.assertTrue(result["assistant_response"])


if __name__ == "__main__":
    unittest.main()

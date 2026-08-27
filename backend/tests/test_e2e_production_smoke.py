"""Opt-in verification of the real production API, PostgreSQL and pgvector."""

from __future__ import annotations

import json
import os
import unittest
from datetime import datetime, timezone

from fastapi.testclient import TestClient

from main import app


def _enabled() -> bool:
    return os.getenv("LIFE_STEWARD_E2E", "").strip().lower() in {"1", "true", "yes"}


@unittest.skipUnless(_enabled(), "LIFE_STEWARD_E2E is not enabled")
class ProductionChainSmokeTest(unittest.TestCase):
    user_id = 10001
    conversation_id = "e2e-production-smoke"

    def test_web_demo_production_chain(self) -> None:
        summary: dict[str, object] = {
            "started_at": datetime.now(timezone.utc).isoformat(),
        }
        with TestClient(app) as client:
            root = app.state.composition_root
            chat_payload = {
                "user_id": self.user_id,
                "conversation_id": self.conversation_id,
                "user_input": "昨晚睡了6小时，今天学习效率下降，压力有点大。",
            }
            response = client.post("/api/v1/chat", json=chat_payload)
            self.assertEqual(response.status_code, 200, response.text)
            record_payload = response.json()
            self.assertEqual(record_payload["intent"], "record_event")
            self.assertGreaterEqual(len(record_payload["extracted_events"]), 1)

            database_event = root.database_client.fetch_one(
                "SELECT id, conversation_id, event_content FROM life_events "
                "WHERE user_id = %s AND conversation_id = %s "
                "ORDER BY id DESC LIMIT 1",
                (str(self.user_id), self.conversation_id),
            )
            self.assertIsNotNone(database_event)

            timeline = client.get(
                "/api/v1/life-events",
                params={"user_id": self.user_id, "days": 7},
            )
            self.assertEqual(timeline.status_code, 200, timeline.text)
            matching_events = [
                item for item in timeline.json()["items"]
                if item["conversation_id"] == self.conversation_id
            ]
            self.assertGreaterEqual(len(matching_events), 1)

            memory_row = root.database_client.fetch_one(
                "SELECT id, vector_dims(embedding) AS embedding_dimension "
                "FROM memories WHERE user_id = %s AND embedding IS NOT NULL "
                "ORDER BY id DESC LIMIT 1",
                (str(self.user_id),),
            )
            self.assertIsNotNone(memory_row)
            embedding_dimension = int(memory_row["embedding_dimension"])
            self.assertGreater(embedding_dimension, 3)

            reflection = client.post(
                "/api/v1/chat",
                json={
                    **chat_payload,
                    "conversation_id": f"{self.conversation_id}-reflection",
                    "user_input": "最近为什么学习效率下降？",
                },
            )
            self.assertEqual(reflection.status_code, 200, reflection.text)
            reflection_payload = reflection.json()
            self.assertEqual(reflection_payload["intent"], "reflection")
            self.assertGreaterEqual(len(reflection_payload["retrieved_memories"]), 1)
            self.assertTrue(all(
                "similarity_score" in item
                for item in reflection_payload["retrieved_memories"]
            ))

            planning = client.post(
                "/api/v1/chat",
                json={
                    **chat_payload,
                    "conversation_id": f"{self.conversation_id}-planning",
                    "user_input": "根据我最近的状态，帮我安排明天的学习计划。",
                },
            )
            self.assertEqual(planning.status_code, 200, planning.text)
            planning_payload = planning.json()
            self.assertEqual(planning_payload["intent"], "planning")
            plan = planning_payload["generated_plan"]
            self.assertGreaterEqual(len(plan), 1)
            required_fields = {
                "task_name", "start_time", "duration_minutes", "difficulty"
            }
            self.assertTrue(all(set(item) == required_fields for item in plan))

            real_embedding = root.llm_service.embed_text("最近为什么学习效率下降？")
            self.assertEqual(len(real_embedding), embedding_dimension)
            vector_hits = root.vector_search_tool.search_memories(
                str(self.user_id), real_embedding, top_k=3
            )
            self.assertGreaterEqual(len(vector_hits), 1)

        summary.update({
            "record_intent": record_payload["intent"],
            "database_life_event_id": database_event["id"],
            "life_events_api_matches": len(matching_events),
            "reflection_intent": reflection_payload["intent"],
            "reflection_pgvector_memories": len(reflection_payload["retrieved_memories"]),
            "planning_intent": planning_payload["intent"],
            "generated_plan_items": len(plan),
            "generated_plan_fields": sorted(required_fields),
            "embedding_dimension": len(real_embedding),
            "pgvector_hits": len(vector_hits),
            "finished_at": datetime.now(timezone.utc).isoformat(),
        })
        print("E2E_PROOF " + json.dumps(summary, ensure_ascii=False, default=str))


if __name__ == "__main__":
    unittest.main()

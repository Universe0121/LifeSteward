"""Opt-in production-chain smoke test for the web demo.

Run with LIFE_STEWARD_E2E=1 and real POSTGRES_DSN/REDIS_URL/model settings.
The test is intentionally skipped by default so ordinary unit-test runs never
call external services.
"""

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
    """Exercise the real API composition root in the required order."""

    user_id = 10001
    conversation_id = "e2e-production-smoke"

    def test_web_demo_production_chain(self) -> None:
        summary: dict[str, object] = {
            "started_at": datetime.now(timezone.utc).isoformat(),
            "steps": [],
        }
        with TestClient(app) as client:
            chat_payload = {
                "user_id": self.user_id,
                "conversation_id": self.conversation_id,
                "user_input": "昨晚睡了6小时，今天学习效率下降，压力有点大",
            }
            response = client.post("/api/v1/chat", json=chat_payload)
            self.assertEqual(response.status_code, 200, response.text)
            summary["steps"].append("chat_record")

            timeline = client.get(
                "/api/v1/life-events",
                params={"user_id": self.user_id, "days": 7},
            )
            self.assertEqual(timeline.status_code, 200, timeline.text)
            timeline_payload = timeline.json()
            self.assertGreaterEqual(timeline_payload["count"], 1)
            summary["steps"].append("life_events_read")

            reflection = client.post(
                "/api/v1/chat",
                json={
                    **chat_payload,
                    "conversation_id": f"{self.conversation_id}-reflection",
                    "user_input": "最近为什么学习效率下降？",
                },
            )
            self.assertEqual(reflection.status_code, 200, reflection.text)
            summary["steps"].append("reflection")

            planning = client.post(
                "/api/v1/chat",
                json={
                    **chat_payload,
                    "conversation_id": f"{self.conversation_id}-planning",
                    "user_input": "根据我最近的状态，帮我安排明天的学习计划",
                },
            )
            self.assertEqual(planning.status_code, 200, planning.text)
            summary["steps"].append("planning")

        summary["finished_at"] = datetime.now(timezone.utc).isoformat()
        print("E2E_SUMMARY " + json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    unittest.main()

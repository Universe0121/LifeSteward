"""Contract tests for liveness and readiness probes."""

from __future__ import annotations

import unittest
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient

from core.composition_root import CompositionRoot
from main import app


class HealthApiTestCase(unittest.TestCase):
    def tearDown(self) -> None:
        for name in ("composition_root", "composition_root_error"):
            if hasattr(app.state, name):
                delattr(app.state, name)

    def test_live_probe_does_not_require_dependencies(self) -> None:
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/health/live")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "status": "ok",
            "service": "lifeagent-backend",
        })

    @patch("main.load_settings")
    @patch("main.RedisClient.from_environment")
    @patch("main.DatabaseClient.from_environment")
    def test_ready_probe_returns_safe_component_status(
        self,
        database_factory: Mock,
        redis_factory: Mock,
        settings_factory: Mock,
    ) -> None:
        database = Mock()
        database.schema_health_check.return_value = {
            "connected": True,
            "vector_extension_available": True,
            "migrations_applied": True,
            "missing_tables": [],
        }
        database_factory.return_value = database
        redis_factory.return_value.health_check.return_value = {"connected": True}
        settings = Mock(
            llm_provider="qwen",
            model_name="qwen3.8-max",
            speech_to_text_base_url="",
            speech_to_text_api_key="",
            speech_to_text_model="",
        )
        settings_factory.return_value = settings
        with patch.dict("os.environ", {"DASHSCOPE_API_KEY": "configured"}, clear=False):
            app.state.composition_root = Mock(spec=CompositionRoot)
            response = TestClient(app, raise_server_exceptions=False).get("/health/ready")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "ready")
        self.assertTrue(payload["checks"]["database"]["pgvector"])
        self.assertTrue(payload["checks"]["database"]["migrations"])
        self.assertNotIn("password", response.text.lower())
        self.assertNotIn("api_key", response.text.lower())

    @patch("main.load_settings")
    @patch("main.RedisClient.from_environment")
    @patch("main.DatabaseClient.from_environment")
    def test_ready_probe_returns_503_when_database_is_down(
        self,
        database_factory: Mock,
        redis_factory: Mock,
        settings_factory: Mock,
    ) -> None:
        database = Mock()
        database.schema_health_check.return_value = {
            "connected": False,
            "vector_extension_available": False,
            "migrations_applied": False,
            "missing_tables": [],
        }
        database_factory.return_value = database
        redis_factory.return_value.health_check.return_value = {"connected": True}
        settings_factory.return_value = Mock(
            llm_provider="qwen",
            model_name="qwen3.8-max",
            speech_to_text_base_url="",
            speech_to_text_api_key="",
            speech_to_text_model="",
        )
        app.state.composition_root = Mock(spec=CompositionRoot)

        response = TestClient(app, raise_server_exceptions=False).get("/health/ready")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["status"], "not_ready")


if __name__ == "__main__":
    unittest.main()

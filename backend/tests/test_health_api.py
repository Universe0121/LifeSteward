from __future__ import annotations

import os
import unittest
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient

from core.composition_root import CompositionRoot
from main import app


class HealthApiTestCase(unittest.TestCase):
    def tearDown(self) -> None:
        if hasattr(app.state, "composition_root"):
            del app.state.composition_root

    def test_ready_case_reports_database_and_llm_health(self) -> None:
        root = Mock(spec=CompositionRoot)
        root.database_client = Mock()
        root.database_client.health_check.return_value = {
            "connected": True,
            "vector_extension_available": True,
        }
        app.state.composition_root = root

        with patch.dict(
            os.environ,
            {"LLM_PROVIDER": "qwen", "DASHSCOPE_API_KEY": "test-key"},
        ):
            response = TestClient(app, raise_server_exceptions=False).get("/api/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "status": "ok",
                "database": {
                    "connected": True,
                    "vector_extension_available": True,
                },
                "llm": {"configured": True, "provider": "qwen"},
            },
        )

    def test_degraded_database_preserves_error_without_leaking_api_key(self) -> None:
        root = Mock(spec=CompositionRoot)
        root.database_client = Mock()
        root.database_client.health_check.return_value = {
            "connected": False,
            "vector_extension_available": False,
            "error": "database unavailable",
        }
        app.state.composition_root = root

        with patch.dict(
            os.environ,
            {"LLM_PROVIDER": "qwen", "DASHSCOPE_API_KEY": ""},
        ):
            response = TestClient(app, raise_server_exceptions=False).get("/api/health")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "degraded")
        self.assertEqual(payload["database"]["error"], "database unavailable")
        self.assertEqual(payload["llm"], {"configured": False, "provider": "qwen"})
        self.assertNotIn("test-key", response.text)

    def test_uninitialized_root_reports_degraded_health(self) -> None:
        app.state.composition_root = None

        with patch.dict(
            os.environ,
            {"LLM_PROVIDER": "stepfun", "STEP_API_KEY": ""},
        ):
            response = TestClient(app, raise_server_exceptions=False).get("/api/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "status": "degraded",
                "database": {"connected": False},
                "llm": {"configured": False, "provider": "stepfun"},
            },
        )


if __name__ == "__main__":
    unittest.main()

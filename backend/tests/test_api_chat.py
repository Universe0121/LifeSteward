"""API tests for the chat route and error envelope helpers."""

from __future__ import annotations

import asyncio
import unittest
from unittest.mock import Mock, patch

from fastapi.exceptions import RequestValidationError
from fastapi.testclient import TestClient

from core.composition_root import CompositionRoot
from main import chat, validation_exception_handler
from main import app
from schemas.chat_schema import ChatRequest, ChatResponse


class APIChatTestCase(unittest.TestCase):
    def test_chat_route_returns_service_response(self) -> None:
        request = ChatRequest(
            user_id=10001,
            conversation_id="conv001",
            user_input="今天学习数学2小时",
        )

        root = Mock(spec=CompositionRoot)
        root.master_agent = Mock()
        app.state.composition_root = root
        with patch("main.process_chat_message") as mocked_service:
            mocked_service.return_value = ChatResponse(
                assistant_response="收到",
                intent="record_event",
                extracted_events=[{"event_content": "今天学习数学2小时"}],
            )

            response = chat(request)

        self.assertEqual(response.assistant_response, "收到")
        self.assertEqual(response.intent, "record_event")
        self.assertEqual(len(response.extracted_events), 1)

    def test_chat_route_rejects_uninitialized_production_dependencies(self) -> None:
        app.state.composition_root = None
        with patch("main.process_chat_message") as mocked_service:
            mocked_service.return_value = ChatResponse(
                assistant_response="已帮你记录",
                intent="record_event",
                extracted_events=[{"event_content": "学习了两小时"}],
            )
            response = TestClient(app, raise_server_exceptions=False).post(
                "/api/v1/chat",
                json={
                    "user_id": 10001,
                    "conversation_id": "missing-production-root",
                    "user_input": "今天学习了两小时",
                },
            )

        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json()["error_code"], "AGENT_PROCESSING_ERROR")
        self.assertNotIn("已帮你记录", response.text)
        mocked_service.assert_not_called()

    def test_validation_exception_handler_returns_error_envelope(self) -> None:
        error = RequestValidationError([])

        response = asyncio.run(validation_exception_handler(None, error))

        self.assertEqual(response.status_code, 400)
        payload = response.body.decode("utf-8")
        self.assertIn('"success":false', payload)
        self.assertIn('"error_code":"INVALID_REQUEST"', payload)


if __name__ == "__main__":
    unittest.main()

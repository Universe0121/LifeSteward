"""Tests for the chat schema and service layer."""

from __future__ import annotations

import unittest
from dataclasses import dataclass

from pydantic import ValidationError

from schemas.chat_schema import ChatRequest, ChatResponse
from services.chat_service import (
    AgentProcessingError,
    build_agent_state,
    process_chat_message,
)


@dataclass
class StubMasterAgent:
    result_state: dict
    received_state: dict | None = None

    def process(self, state):
        self.received_state = state
        return self.result_state


class ChatServiceTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.chat_request = ChatRequest(
            user_id=10001,
            conversation_id="conv001",
            user_input="今天学习数学2小时",
        )

    def test_chat_request_accepts_required_fields(self) -> None:
        self.assertEqual(self.chat_request.user_id, 10001)
        self.assertEqual(self.chat_request.conversation_id, "conv001")
        self.assertEqual(self.chat_request.user_input, "今天学习数学2小时")

    def test_chat_request_rejects_unconfirmed_fields(self) -> None:
        with self.assertRaises(ValidationError):
            ChatRequest(
                user_id=10001,
                conversation_id="conv001",
                user_input="今天学习数学2小时",
                extra_field="not_allowed",
            )

    def test_chat_request_requires_all_fields(self) -> None:
        with self.assertRaises(ValidationError):
            ChatRequest(
                user_id=10001,
                conversation_id="conv001",
            )

    def test_build_agent_state_converts_user_id_to_string(self) -> None:
        agent_state = build_agent_state(self.chat_request)

        self.assertEqual(agent_state["user_id"], "10001")
        self.assertEqual(agent_state["conversation_id"], "conv001")
        self.assertEqual(agent_state["user_input"], "今天学习数学2小时")
        self.assertEqual(agent_state["extracted_events"], [])

    def test_process_chat_message_returns_chat_response(self) -> None:
        stub_master_agent = StubMasterAgent(
            {
                "assistant_response": "收到",
                "intent": "casual_chat",
                "extracted_events": [],
            }
        )

        chat_response = process_chat_message(
            self.chat_request,
            master_agent=stub_master_agent,
        )

        self.assertIsInstance(chat_response, ChatResponse)
        self.assertEqual(chat_response.assistant_response, "收到")
        self.assertEqual(chat_response.intent, "casual_chat")
        self.assertEqual(chat_response.extracted_events, [])
        self.assertEqual(stub_master_agent.received_state["user_id"], "10001")

    def test_process_chat_message_raises_agent_processing_error(self) -> None:
        class BrokenMasterAgent:
            def process(self, state):
                raise RuntimeError("boom")

        with self.assertRaises(AgentProcessingError):
            process_chat_message(self.chat_request, master_agent=BrokenMasterAgent())

    def test_chat_response_has_only_public_contract_fields(self) -> None:
        chat_response = ChatResponse(
            assistant_response="hello",
            intent="casual_chat",
            extracted_events=[],
        )

        response_data = (
            chat_response.model_dump()
            if hasattr(chat_response, "model_dump")
            else chat_response.dict()
        )
        self.assertEqual(
            set(response_data.keys()),
            {"assistant_response", "intent", "extracted_events"},
        )


if __name__ == "__main__":
    unittest.main()

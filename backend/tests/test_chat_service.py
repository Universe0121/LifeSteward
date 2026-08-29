"""Tests for the chat schema and service layer."""

from __future__ import annotations

import unittest
from dataclasses import dataclass

from pydantic import ValidationError

from agents.master_agent import MasterAgent
from agents.memory_agent import MemoryPersistenceError
from services.memory_service import MemoryService
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

    def test_build_agent_state_preserves_conversation_history(self) -> None:
        request = ChatRequest(
            user_id=10001,
            conversation_id="conv001",
            user_input="继续",
            conversation_history=[
                {"role": "user", "content": "我今天很累"},
                {"role": "assistant", "content": "我听到了"},
            ],
        )

        agent_state = build_agent_state(request)

        self.assertEqual(
            agent_state["conversation_history"],
            [
                {"role": "user", "content": "我今天很累"},
                {"role": "assistant", "content": "我听到了"},
            ],
        )

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

    def test_persistence_error_reaches_api_boundary_without_success_text(self) -> None:
        class RecordEventLLM:
            def generate(self, prompt, variables):
                return '{"intent":"record_event"}'

        class ExtractedEventAgent:
            def process(self, state):
                state["extracted_events"] = [{"event_content": "study"}]
                return state

        class FailingMemoryService(MemoryService):
            def save_memory(self, user_id, events):
                raise RuntimeError("database unavailable")

            def search_memory(self, user_id, memory_query, top_k=5):
                return []

            def update_user_profile(self, user_id, user_profile):
                return None

            def compress_memory(self, events):
                return []

        class SuccessReplyMustNotRun:
            called = False

            def process(self, state):
                self.called = True
                state["assistant_response"] = "recorded successfully"
                return state

        interaction_agent = SuccessReplyMustNotRun()
        master_agent = MasterAgent(
            memory_service=FailingMemoryService(),
            life_understanding_agent=ExtractedEventAgent(),
            interaction_agent=interaction_agent,
            llm_service=RecordEventLLM(),
        )

        with self.assertRaisesRegex(AgentProcessingError, "persist") as caught:
            process_chat_message(self.chat_request, master_agent=master_agent)

        self.assertEqual(str(caught.exception), "Unable to persist recorded events")
        self.assertNotIn("success", str(caught.exception).lower())
        self.assertIsInstance(caught.exception.__cause__, MemoryPersistenceError)
        self.assertIsInstance(caught.exception.__cause__.__cause__, RuntimeError)
        self.assertEqual(
            str(caught.exception.__cause__.__cause__),
            "database unavailable",
        )
        self.assertFalse(interaction_agent.called)

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
            {
                "assistant_response", "intent", "extracted_events",
                "retrieved_memories", "reflection_result", "generated_plan",
            },
        )


if __name__ == "__main__":
    unittest.main()

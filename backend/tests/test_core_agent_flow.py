"""Tests for the Day 1 core Agent workflow."""

import json
import unittest
from collections import deque
from collections.abc import Mapping
from typing import Any

from agents.master_agent import MasterAgent
from agents.state import AgentState
from core.llm_service import LLMService


class QueueLLMService(LLMService):
    def __init__(self, responses: list[str]) -> None:
        self._responses = deque(responses)
        self.calls: list[dict[str, Any]] = []

    def generate(self, prompt: str, variables: Mapping[str, Any]) -> str:
        self.calls.append({"prompt": prompt, "variables": dict(variables)})
        return self._responses.popleft()


def create_state(user_input: str, intent: str = "") -> AgentState:
    return {
        "user_id": "550e8400-e29b-41d4-a716-446655440000",
        "conversation_id": "conv_001",
        "user_input": user_input,
        "intent": intent,
        "extracted_events": [],
        "retrieved_memories": [],
        "user_profile": {},
        "current_goal": {},
        "generated_plan": [],
        "reflection_result": {},
        "assistant_response": "",
    }


class MasterAgentFlowTest(unittest.TestCase):
    def test_record_event_flow_extracts_event_and_returns_response(self) -> None:
        event_payload = {
            "extracted_events": [
                {
                    "event_type": "study",
                    "event_content": "学习数学2小时",
                    "event_time": None,
                    "emotion": "tired",
                    "impact": None,
                    "importance_score": 0.7,
                    "source": "text",
                    "source_text": "今天学习数学2小时，很累",
                }
            ]
        }
        llm_service = QueueLLMService(
            [
                json.dumps({"intent": "record_event"}),
                json.dumps(event_payload, ensure_ascii=False),
                "已经帮你记录：今天学习数学2小时，感觉很累。",
            ]
        )

        result = MasterAgent(llm_service=llm_service).process(
            create_state("今天学习数学2小时，很累")
        )

        self.assertEqual(result["intent"], "record_event")
        self.assertEqual(len(result["extracted_events"]), 1)
        self.assertEqual(result["extracted_events"][0]["event_type"], "study")
        self.assertEqual(result["extracted_events"][0]["source"], "text")
        self.assertEqual(
            result["assistant_response"],
            "已经帮你记录：今天学习数学2小时，感觉很累。",
        )
        self.assertEqual(len(llm_service.calls), 3)

    def test_existing_intent_skips_intent_classification(self) -> None:
        llm_service = QueueLLMService(
            [
                json.dumps(
                    {
                        "extracted_events": [
                            {
                                "event_type": "sleep",
                                "event_content": "昨晚睡了6小时",
                                "importance_score": 2,
                            }
                        ]
                    },
                    ensure_ascii=False,
                ),
                "已经记录昨晚睡了6小时。",
            ]
        )

        result = MasterAgent(llm_service=llm_service).process(
            create_state("昨晚睡了6小时", intent="record_event")
        )

        event = result["extracted_events"][0]
        self.assertEqual(event["importance_score"], 1.0)
        self.assertEqual(event["source_text"], "昨晚睡了6小时")
        self.assertEqual(len(llm_service.calls), 2)

    def test_unknown_intent_falls_back_to_casual_chat(self) -> None:
        llm_service = QueueLLMService(
            [
                json.dumps({"intent": "unsupported"}),
                "晚上好，我在这里。",
            ]
        )

        result = MasterAgent(llm_service=llm_service).process(
            create_state("晚上好")
        )

        self.assertEqual(result["intent"], "casual_chat")
        self.assertEqual(result["extracted_events"], [])
        self.assertEqual(result["assistant_response"], "晚上好，我在这里。")


if __name__ == "__main__":
    unittest.main()

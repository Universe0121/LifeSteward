"""Tests for the Day 1 core Agent workflow."""

from __future__ import annotations

import json
import unittest
from collections import deque
from collections.abc import Mapping
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from agents.master_agent import MasterAgent
from agents.state import AgentState
from core.llm_service import LLMService


class QueueLLMService(LLMService):
    def __init__(self, responses: list[str | Exception]) -> None:
        self._responses = deque(responses)
        self.calls: list[dict[str, Any]] = []

    def generate(self, prompt: str, variables: Mapping[str, Any]) -> str:
        self.calls.append({"prompt": prompt, "variables": dict(variables)})
        response = self._responses.popleft()
        if isinstance(response, Exception):
            raise response
        return response


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


def event_payload(**overrides: Any) -> dict[str, Any]:
    payload = {
        "event_type": "study",
        "event_content": "学习数学2小时",
        "event_time": None,
        "emotion": "tired",
        "impact": None,
        "importance_score": 0.7,
        "source": "text",
        "source_text": "今天学习数学2小时，很累",
    }
    payload.update(overrides)
    return {"extracted_events": [payload]}


class MasterAgentFlowTest(unittest.TestCase):
    def test_schedule_sentence_creates_meeting_and_reminder_events(self) -> None:
        source = "明天下午三点有组会，提醒我提前半小时准备汇报材料。"
        llm_service = QueueLLMService(
            [
                json.dumps({"intent": "casual_chat"}),
                json.dumps(event_payload(event_type="schedule", event_content="组会", event_time="明天下午三点"), ensure_ascii=False),
                "已经记下组会和提醒。",
            ]
        )

        result = MasterAgent(llm_service=llm_service).process(create_state(source))

        self.assertEqual(result["intent"], "record_event")
        self.assertEqual(len(result["extracted_events"]), 2)
        self.assertEqual({event["event_type"] for event in result["extracted_events"]}, {"schedule", "reminder"})
        times = {event["event_type"]: event["event_time"] for event in result["extracted_events"]}
        self.assertEqual(times["schedule"], datetime(2026, 8, 28, 15, 0, tzinfo=ZoneInfo("Asia/Shanghai")))
        self.assertEqual(times["reminder"], datetime(2026, 8, 28, 14, 30, tzinfo=ZoneInfo("Asia/Shanghai")))
    def test_record_event_flow_extracts_event_and_returns_response(self) -> None:
        llm_service = QueueLLMService(
            [
                json.dumps({"intent": "record_event"}),
                json.dumps(event_payload(), ensure_ascii=False),
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
        self.assertEqual(
            llm_service.calls[0]["variables"],
            {"user_input": "今天学习数学2小时，很累"},
        )
        self.assertEqual(
            llm_service.calls[1]["variables"],
            {"user_input": "今天学习数学2小时，很累"},
        )
        self.assertEqual(llm_service.calls[2]["variables"]["intent"], "record_event")

    def test_life_understanding_accepts_markdown_json_response(self) -> None:
        llm_service = QueueLLMService(
            [
                json.dumps({"intent": "record_event"}),
                "```json\n"
                + json.dumps(
                    event_payload(event_content="昨晚睡了6小时"),
                    ensure_ascii=False,
                )
                + "\n```",
                "已经记录睡眠信息。",
            ]
        )

        result = MasterAgent(llm_service=llm_service).process(
            create_state("昨晚睡了6小时")
        )

        self.assertEqual(result["extracted_events"][0]["event_content"], "昨晚睡了6小时")
        self.assertEqual(result["assistant_response"], "已经记录睡眠信息。")

    def test_existing_intent_skips_intent_classification(self) -> None:
        llm_service = QueueLLMService(
            [
                json.dumps(
                    event_payload(
                        event_type="sleep",
                        event_content="昨晚睡了6小时",
                        importance_score=2,
                        source_text="",
                    ),
                    ensure_ascii=False,
                ),
                "已经记录昨晚睡了6小时。",
            ]
        )

        result = MasterAgent(llm_service=llm_service).process(
            create_state("昨晚睡了6小时", intent="record_event")
        )

        event = result["extracted_events"][0]
        self.assertEqual(result["intent"], "record_event")
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

        result = MasterAgent(llm_service=llm_service).process(create_state("晚上好"))

        self.assertEqual(result["intent"], "casual_chat")
        self.assertEqual(result["extracted_events"], [])
        self.assertEqual(result["assistant_response"], "晚上好，我在这里。")
        self.assertEqual(len(llm_service.calls), 2)

    def test_interaction_error_uses_record_event_fallback(self) -> None:
        llm_service = QueueLLMService(
            [
                json.dumps({"intent": "record_event"}),
                json.dumps(event_payload(), ensure_ascii=False),
                RuntimeError("model unavailable"),
            ]
        )

        result = MasterAgent(llm_service=llm_service).process(
            create_state("今天学习数学2小时，很累")
        )

        self.assertEqual(result["intent"], "record_event")
        self.assertEqual(len(result["extracted_events"]), 1)
        self.assertIn("1", result["assistant_response"])

    def test_invalid_life_understanding_json_raises_value_error(self) -> None:
        llm_service = QueueLLMService(
            [
                json.dumps({"intent": "record_event"}),
                "not json",
            ]
        )

        with self.assertRaisesRegex(ValueError, "invalid JSON"):
            MasterAgent(llm_service=llm_service).process(
                create_state("今天学习数学2小时，很累")
            )

    def test_minimal_state_is_initialized_before_processing(self) -> None:
        llm_service = QueueLLMService(
            [
                json.dumps({"intent": "casual_chat"}),
                "收到。",
            ]
        )
        state: AgentState = {
            "user_id": "550e8400-e29b-41d4-a716-446655440000",
            "conversation_id": "conv_001",
            "user_input": "你好",
        }  # type: ignore[typeddict-item]

        result = MasterAgent(llm_service=llm_service).process(state)

        self.assertEqual(result["intent"], "casual_chat")
        self.assertEqual(result["extracted_events"], [])
        self.assertEqual(result["assistant_response"], "收到。")


if __name__ == "__main__":
    unittest.main()

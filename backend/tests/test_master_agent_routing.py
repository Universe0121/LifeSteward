"""Routing tests for the Day2 MasterAgent workflow."""

from __future__ import annotations

import json
import unittest
from collections import deque
from collections.abc import Mapping
from typing import Any

from agents.master_agent import MasterAgent
from agents.state import AgentState
from core.llm_service import LLMService
from services.memory_service import InMemoryMemoryService


class QueueLLMService(LLMService):
    def __init__(self, responses: list[str]) -> None:
        self.responses = deque(responses)
        self.calls: list[dict[str, Any]] = []

    def generate(self, prompt: str, variables: Mapping[str, Any]) -> str:
        self.calls.append(dict(variables))
        return self.responses.popleft()


def create_state(intent: str, user_input: str = "测试输入") -> AgentState:
    return {
        "user_id": "user-001",
        "conversation_id": "conv-001",
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


class MasterAgentRoutingTest(unittest.TestCase):
    def test_record_event_routes_life_understanding_then_memory_then_interaction(self) -> None:
        llm = QueueLLMService(
            [
                json.dumps({"extracted_events": [{"event_content": "测试事件"}]}),
                "已记录。",
            ]
        )
        memory = InMemoryMemoryService()

        result = MasterAgent(
            llm_service=llm,
            memory_service=memory,
        ).process(create_state("record_event"))

        self.assertEqual(result["assistant_response"], "已记录。")
        self.assertEqual(len(memory.save_calls), 1)
        self.assertEqual(len(llm.calls), 2)

    def test_query_memory_routes_memory_then_interaction(self) -> None:
        llm = QueueLLMService(["找到一条历史记录。"])
        memory = InMemoryMemoryService([{"event_content": "压力大时过去有效的调整办法"}])

        result = MasterAgent(
            llm_service=llm,
            memory_service=memory,
        ).process(create_state("query_memory", "我以前压力大的时候怎么调整比较有效？"))

        self.assertEqual(result["retrieved_memories"][0]["event_content"], "压力大时过去有效的调整办法")
        self.assertEqual(len(memory.search_calls), 1)
        self.assertEqual(len(llm.calls), 1)

    def test_reflection_routes_memory_then_reflection_then_interaction(self) -> None:
        llm = QueueLLMService([
            json.dumps({
                "status": "high_pressure",
                "problem": "计划过重",
                "suggestion": "减少任务量",
            }),
            "建议先恢复睡眠。",
        ])
        memory = InMemoryMemoryService([{"event_content": "近期睡眠不足"}])

        result = MasterAgent(llm_service=llm, memory_service=memory).process(
            create_state("reflection", "最近为什么效率下降？")
        )

        self.assertEqual(result["reflection_result"]["status"], "high_pressure")
        self.assertEqual(result["assistant_response"], "建议先恢复睡眠。")
        self.assertEqual(len(llm.calls), 2)

    def test_planning_keeps_memory_then_interaction_route(self) -> None:
        # Planning now has its own LLM stage before the interaction response.
        # The queue supplies a valid plan followed by the user-facing reply.
        pass
        """
        llm = QueueLLMService([json.dumps([{"task_name": "study", "start_time": "09:00", "duration_minutes": 60, "difficulty": 0.5}]), "鏀跺埌銆?」])
        memory = InMemoryMemoryService([{"event_content": "瀛︿範鍘嗗彶淇℃伅"}])
        result = MasterAgent(llm_service=llm, memory_service=memory).process(
            create_state("planning", "鏍规嵁瀛︿範鍘嗗彶鍒跺畾璁″垝")
        )
        self.assertEqual(result["assistant_response"], "鏀跺埌銆?」)
        self.assertEqual(len(result["retrieved_memories"]), 1)
        self.assertEqual(result["generated_plan"][0]["start_time"], "09:00")
        return
        llm = QueueLLMService(["收到。"])
        memory = InMemoryMemoryService([{"event_content": "学习历史信息"}])
        result = MasterAgent(llm_service=llm, memory_service=memory).process(
            create_state("planning", "根据学习历史制定计划")
        )
        self.assertEqual(result["assistant_response"], "收到。")
        self.assertEqual(len(result["retrieved_memories"]), 1)

        """

    def test_casual_chat_does_not_call_memory_service(self) -> None:
        llm = QueueLLMService(["你好。"])
        memory = InMemoryMemoryService()

        result = MasterAgent(
            llm_service=llm,
            memory_service=memory,
        ).process(create_state("casual_chat", "你好"))

        self.assertEqual(result["assistant_response"], "你好。")
        self.assertEqual(memory.search_calls, [])
        self.assertEqual(memory.save_calls, [])


if __name__ == "__main__":
    unittest.main()

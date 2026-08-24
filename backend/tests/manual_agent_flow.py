"""Manual acceptance script for the real Day2 Agent workflow.

Run from the backend directory:
    python tests/manual_agent_flow.py

Prerequisites:
    - backend/.env exists, or environment variables are already exported.
    - DASHSCOPE_API_KEY is set for the real Qwen provider.

This script intentionally calls the real model. It is not part of fast CI.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

backend_directory = Path(__file__).resolve().parents[1]
if str(backend_directory) not in sys.path:
    sys.path.insert(0, str(backend_directory))

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - depends on local developer setup.
    load_dotenv = None

from agents.master_agent import MasterAgent
from agents.state import AgentState
from core.llm_service import configure_llm_service_from_environment
from services.memory_service import InMemoryMemoryService


ACCEPTANCE_CASES = (
    ("record_event", "今天学习数学2小时，很累"),
    ("reflection", "最近为什么学习效率越来越低？"),
    ("query_memory", "我以前压力大的时候有什么有效的调整办法？"),
)


def create_acceptance_state(user_input: str) -> AgentState:
    return {
        "user_id": "550e8400-e29b-41d4-a716-446655440000",
        "conversation_id": "conv_real_001",
        "user_input": user_input,
        "intent": "",
        "extracted_events": [],
        "retrieved_memories": [],
        "user_profile": {},
        "current_goal": {},
        "generated_plan": [],
        "reflection_result": {},
        "assistant_response": "",
    }


def load_environment() -> None:
    if load_dotenv is not None:
        load_dotenv(backend_directory / ".env")


def summarize_result(result: AgentState) -> dict[str, Any]:
    return {
        "intent": result["intent"],
        "event_count": len(result["extracted_events"]),
        "memory_count": len(result["retrieved_memories"]),
        "extracted_events": result["extracted_events"],
        "retrieved_memories": result["retrieved_memories"],
        "assistant_response": result["assistant_response"],
    }


def assert_acceptance_result(expected_intent: str, result: AgentState) -> None:
    if result["intent"] != expected_intent:
        raise AssertionError(
            f"Expected intent {expected_intent}, got {result['intent']!r}"
        )

    if expected_intent == "record_event" and not result["extracted_events"]:
        raise AssertionError("Expected at least one extracted life event")

    for index, event in enumerate(result["extracted_events"], start=1):
        if not event.get("event_content"):
            raise AssertionError(f"Event {index} is missing event_content: {event!r}")
        if event.get("source") != "text":
            raise AssertionError(f"Event {index} source should be text: {event!r}")

    if not result["assistant_response"].strip():
        raise AssertionError("Expected a non-empty assistant_response")


def run_acceptance_case(
    master_agent: MasterAgent,
    user_input: str,
    intent: str,
) -> AgentState:
    return master_agent.process(create_acceptance_state(user_input))


def main() -> int:
    try:
        load_environment()
        llm_service = configure_llm_service_from_environment()
        memory_service = InMemoryMemoryService()
        master_agent = MasterAgent(
            llm_service=llm_service,
            memory_service=memory_service,
        )

        results = []
        for expected_intent, user_input in ACCEPTANCE_CASES:
            result = run_acceptance_case(master_agent, user_input, expected_intent)
            assert_acceptance_result(expected_intent, result)
            results.append(
                {
                    "user_input": user_input,
                    **summarize_result(result),
                }
            )
    except Exception as exc:
        print("[FAIL] real model Day2 Agent acceptance failed")
        print(f"{type(exc).__name__}: {exc}")
        return 1

    print("[PASS] real model Day2 Agent acceptance passed")
    print(json.dumps(results, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
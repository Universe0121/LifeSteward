"""Agent that turns retrieved life context into a structured reflection."""

from __future__ import annotations

import json

from agents.state import AgentState
from core.llm_service import LLMService, get_llm_service, load_prompt


class ReflectionAgent:
    _prompt_name = "reflection_prompt.md"
    _fallback = {
        "status": "insufficient_data",
        "problem": "可用于复盘的历史记录不足",
        "suggestion": "继续记录近期状态后再进行复盘",
    }

    def __init__(self, llm_service: LLMService | None = None) -> None:
        self._llm_service = llm_service

    def process(self, state: AgentState) -> AgentState:
        state["reflection_result"] = dict(self._fallback)
        if not state["retrieved_memories"]:
            return state
        try:
            raw_response = (self._llm_service or get_llm_service()).generate(
                load_prompt(self._prompt_name),
                {
                    "user_input": state["user_input"],
                    "retrieved_memories": state["retrieved_memories"],
                    "user_profile": state["user_profile"],
                    "extracted_events": state["extracted_events"],
                },
            )
            payload = json.loads(raw_response)
            if not isinstance(payload, dict) or not all(
                isinstance(payload.get(key), str) and payload[key].strip()
                for key in ("status", "problem", "suggestion")
            ):
                raise ValueError("Invalid reflection result")
            state["reflection_result"] = {
                key: payload[key].strip()
                for key in ("status", "problem", "suggestion")
            }
        except (RuntimeError, ValueError, json.JSONDecodeError):
            pass
        return state

"""Agent that extracts structured life events from natural language."""

import json
from collections.abc import Mapping
from typing import Any

from agents.state import AgentState
from core.llm_service import LLMService, get_llm_service, load_prompt


class LifeUnderstandingAgent:
    _prompt_name = "life_understanding_prompt.md"
    _event_defaults: dict[str, Any] = {
        "event_type": "other",
        "event_content": "",
        "event_time": None,
        "emotion": None,
        "impact": None,
        "importance_score": 0.5,
        "source": "text",
        "source_text": "",
    }

    def __init__(self, llm_service: LLMService | None = None) -> None:
        self._llm_service = llm_service

    def process(self, state: AgentState) -> AgentState:
        prompt = load_prompt(self._prompt_name)
        llm_service = self._llm_service or get_llm_service()
        raw_response = llm_service.generate(
            prompt,
            {
                "user_input": state["user_input"],
            },
        )
        state["extracted_events"] = self._parse_events(
            raw_response,
            state["user_input"],
        )
        return state

    def _parse_events(
        self,
        raw_response: str,
        source_text: str,
    ) -> list[dict[str, Any]]:
        try:
            payload = json.loads(self._strip_code_fence(raw_response))
        except (json.JSONDecodeError, TypeError) as exc:
            raise ValueError("Life Understanding Agent returned invalid JSON") from exc

        if isinstance(payload, Mapping):
            payload = payload.get("extracted_events", payload)
        if isinstance(payload, Mapping):
            payload = [payload]
        if not isinstance(payload, list):
            raise ValueError("extracted_events must be a list")

        events: list[dict[str, Any]] = []
        for item in payload:
            if not isinstance(item, Mapping):
                continue
            event = dict(self._event_defaults)
            event.update(item)
            event["source_text"] = event.get("source_text") or source_text
            event["importance_score"] = self._normalize_importance(
                event.get("importance_score")
            )
            if event["event_content"]:
                events.append(event)
        return events

    @staticmethod
    def _strip_code_fence(raw_response: str) -> str:
        content = raw_response.strip()
        if not content.startswith("```"):
            return content
        lines = content.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        return "\n".join(lines).strip()

    @staticmethod
    def _normalize_importance(value: Any) -> float:
        try:
            importance_score = float(value)
        except (TypeError, ValueError):
            return 0.5
        return min(1.0, max(0.0, importance_score))

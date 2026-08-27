"""Agent for loading and persisting stable user preferences."""

from __future__ import annotations

import re

from agents.intent import Intent
from agents.state import AgentState
from services.memory_service import MemoryService


class ProfileAgent:
    """Keep the current user profile available to downstream agents."""

    _language_patterns = (
        (re.compile(r"python", re.IGNORECASE), "Python"),
        (re.compile(r"typescript|ts\b", re.IGNORECASE), "TypeScript"),
        (re.compile(r"javascript|js\b", re.IGNORECASE), "JavaScript"),
        (re.compile(r"java\b", re.IGNORECASE), "Java"),
        (re.compile(r"golang|go\b", re.IGNORECASE), "Go"),
        (re.compile(r"rust\b", re.IGNORECASE), "Rust"),
        (re.compile(r"c\+\+", re.IGNORECASE), "C++"),
    )

    def __init__(self, memory_service: MemoryService) -> None:
        self.memory_service = memory_service

    def process(self, state: AgentState) -> AgentState:
        profile = self.memory_service.get_user_profile(state["user_id"])
        if state["intent"] == Intent.UPDATE_PROFILE.value:
            updates = self._extract_updates(state["user_input"])
            if updates:
                profile = {**profile, **updates}
                self.memory_service.update_user_profile(state["user_id"], profile)
        state["user_profile"] = profile
        return state

    @classmethod
    def _extract_updates(cls, user_input: str) -> dict[str, str]:
        text = str(user_input)
        if not any(term in text for term in ("喜欢", "偏好", "习惯", "优先")):
            return {}
        for pattern, language in cls._language_patterns:
            if pattern.search(text):
                return {"preferred_programming_language": language}
        return {}

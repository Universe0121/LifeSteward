"""Shared state passed between every LifeAgent Agent."""

from typing import Any, TypedDict


class AgentState(TypedDict):
    user_id: str
    conversation_id: str
    user_input: str
    intent: str
    extracted_events: list[dict[str, Any]]
    retrieved_memories: list[dict[str, Any]]
    user_profile: dict[str, Any]
    current_goal: dict[str, Any]
    generated_plan: list[dict[str, Any]]
    reflection_result: dict[str, Any]
    assistant_response: str

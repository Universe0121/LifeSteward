"""Shared state passed between LifeAgent agents."""

from typing import Any, Dict, List, TypedDict


class AgentState(TypedDict):
    """Unified state contract for all LifeAgent agents."""

    user_id: int
    conversation_id: str
    user_input: str
    intent: str
    extracted_events: List[Dict[str, Any]]
    retrieved_memories: List[Dict[str, Any]]
    user_profile: Dict[str, Any]
    current_goal: Dict[str, Any]
    generated_plan: List[Dict[str, Any]]
    reflection_result: Dict[str, Any]
    assistant_response: str


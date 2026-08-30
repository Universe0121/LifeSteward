"""Schemas for the chat API."""

from typing import Literal

from pydantic import BaseModel, Field


class ChatHistoryItem(BaseModel):
    """One previously exchanged message supplied by the client."""

    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)

    class Config:
        extra = "forbid"


class ChatRequest(BaseModel):
    """Request payload for POST /api/v1/chat."""

    user_id: int
    conversation_id: str
    user_input: str
    conversation_history: list[ChatHistoryItem] = Field(
        default_factory=list,
        max_length=20,
    )

    class Config:
        extra = "forbid"


class ChatResponse(BaseModel):
    """Response payload for POST /api/v1/chat."""

    assistant_response: str
    intent: str
    extracted_events: list = Field(default_factory=list)
    retrieved_memories: list = Field(default_factory=list)
    reflection_result: dict = Field(default_factory=dict)
    generated_plan: list = Field(default_factory=list)

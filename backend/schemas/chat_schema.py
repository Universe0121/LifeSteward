"""Schemas for the chat API."""

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """Request payload for POST /api/v1/chat."""

    user_id: int
    conversation_id: str
    user_input: str

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

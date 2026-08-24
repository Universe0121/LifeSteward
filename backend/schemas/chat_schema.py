"""Schemas for the chat API."""

from pydantic import BaseModel, ConfigDict, Field


class ChatRequest(BaseModel):
    """Request payload for POST /api/v1/chat."""

    user_id: int
    conversation_id: str
    user_input: str

    model_config = ConfigDict(extra="forbid")


class ChatResponse(BaseModel):
    """Response payload for POST /api/v1/chat."""

    assistant_response: str
    intent: str
    extracted_events: list = Field(default_factory=list)


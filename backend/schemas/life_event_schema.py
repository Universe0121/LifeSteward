"""Schemas for persisted life-event timeline queries."""

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class LifeEventItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    life_event_id: int
    user_id: str
    conversation_id: str = ""
    event_type: str
    event_content: str
    event_time: datetime | None = None
    emotion: str = ""
    importance_score: float = 0.0
    source: str = "text"
    source_text: str = ""
    created_at: datetime


class LifeEventsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[LifeEventItem] = Field(default_factory=list)
    count: int = Field(ge=0)

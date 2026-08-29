"""Schemas for speech-to-text requests and responses."""

from pydantic import BaseModel, ConfigDict, Field


class SpeechTranscriptionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1)
    language: str
    duration_ms: int = Field(ge=0)

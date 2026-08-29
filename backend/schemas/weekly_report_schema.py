"""Schemas for weekly report generation and retrieval."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class WeeklyReportGenerateRequest(BaseModel):
    """Request payload for POST /api/v1/weekly-reports/generate."""

    model_config = ConfigDict(extra="forbid")

    user_id: int | str
    week_start: date | None = None
    timezone: str = Field(default="Asia/Shanghai", min_length=1)


class WeeklyReportRecord(BaseModel):
    """Stored weekly report payload exposed through the API."""

    model_config = ConfigDict(extra="forbid")

    report_id: int
    user_id: str
    week_start: date
    week_end: date
    report_data: dict[str, Any] = Field(default_factory=dict)
    poster_url: str
    generated_at: datetime


class WeeklyReportListResponse(BaseModel):
    """Response payload for GET /api/v1/weekly-reports."""

    model_config = ConfigDict(extra="forbid")

    items: list[WeeklyReportRecord] = Field(default_factory=list)
    count: int = Field(ge=0)

"""Schemas for unified API error responses."""

from pydantic import BaseModel, ConfigDict


class ErrorResponse(BaseModel):
    """Standardized error envelope for backend APIs."""

    model_config = ConfigDict(extra="forbid")

    success: bool = False
    error_code: str
    message: str

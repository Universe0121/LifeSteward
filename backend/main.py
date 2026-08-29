"""FastAPI application entry point for the LifeAgent backend."""

from contextlib import asynccontextmanager
from collections.abc import Mapping
from typing import Any
from fastapi import FastAPI, File, Form, Query, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response

from schemas.chat_schema import ChatRequest, ChatResponse
from schemas.error_schema import ErrorResponse
from schemas.life_event_schema import LifeEventItem, LifeEventsResponse
from schemas.weekly_report_schema import (
    WeeklyReportGenerateRequest,
    WeeklyReportListResponse,
    WeeklyReportRecord,
)
from services.chat_service import AgentProcessingError, process_chat_message
from services.life_event_query_service import LifeEventQueryService
from services.mock_demo_service import get_demo_agent
from services.speech_service import SpeechServiceError
from schemas.speech_schema import SpeechTranscriptionResponse
from core.composition_root import CompositionRoot, build_composition_root


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Assemble production dependencies once when the application starts."""
    if not hasattr(application.state, "composition_root"):
        application.state.composition_root = build_composition_root()
    yield


app = FastAPI(
    title="LifeAgent API",
    version="0.1.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/demo", include_in_schema=False)
def demo_page() -> FileResponse:
    return FileResponse("static/demo.html", media_type="text/html")


@app.get("/simulation-demo", include_in_schema=False)
def simulation_demo_page() -> FileResponse:
    """Serve the real PostgreSQL/pgvector verification page."""
    return FileResponse("static/simulation-demo.html", media_type="text/html")


@app.post("/api/v1/chat", response_model=ChatResponse)
def chat(chat_request: ChatRequest) -> ChatResponse:
    """Process one user chat message through the service layer."""

    root: CompositionRoot | None = getattr(app.state, "composition_root", None)
    return process_chat_message(
        chat_request,
        master_agent=root.master_agent if root else None,
    )


@app.post("/api/v1/mock-chat", response_model=ChatResponse, include_in_schema=False)
def mock_chat(chat_request: ChatRequest) -> ChatResponse:
    """Run the same service/agent chain with a deterministic local model."""
    return process_chat_message(chat_request, master_agent=get_demo_agent())


@app.get("/api/v1/life-events", response_model=LifeEventsResponse)
def life_events(
    user_id: str = Query(..., min_length=1),
    days: int = Query(7, ge=1, le=30),
) -> LifeEventsResponse:
    """Return recent persisted life events through the shared SQL tool."""

    root: CompositionRoot | None = getattr(app.state, "composition_root", None)
    if root is None:
        raise RuntimeError("Production composition root is not initialized")
    items = LifeEventQueryService(root.sql_tool).get_recent_events(user_id, days)
    return LifeEventsResponse(
        items=[LifeEventItem.model_validate(item) for item in items],
        count=len(items),
    )


@app.post("/api/v1/speech-to-text", response_model=SpeechTranscriptionResponse)
async def speech_to_text(
    audio: UploadFile = File(...),
    user_id: int = Form(...),  # noqa: ARG001 - retained for the frozen client contract.
    language: str = Form("zh-CN"),
) -> SpeechTranscriptionResponse:
    """Validate an uploaded recording and delegate transcription to the service layer."""

    root: CompositionRoot | None = getattr(app.state, "composition_root", None)
    if root is None:
        raise RuntimeError("Production composition root is not initialized")
    payload = await audio.read()
    try:
        result = root.speech_service.transcribe(
            payload,
            audio.filename or "recording.m4a",
            audio.content_type or "application/octet-stream",
            language,
        )
    except SpeechServiceError as exc:
        error_status = (
            status.HTTP_400_BAD_REQUEST
            if exc.error_code in {"AUDIO_EMPTY", "AUDIO_TOO_LARGE", "INVALID_AUDIO"}
            else status.HTTP_503_SERVICE_UNAVAILABLE
        )
        return _error_response(error_status, exc.error_code, exc.message)
    return SpeechTranscriptionResponse(
        text=result.text,
        language=result.language,
        duration_ms=result.duration_ms,
    )


@app.post("/api/v1/weekly-reports/generate", response_model=WeeklyReportRecord)
def generate_weekly_report(
    request_payload: WeeklyReportGenerateRequest,
) -> WeeklyReportRecord:
    root: CompositionRoot | None = getattr(app.state, "composition_root", None)
    if root is None:
        raise RuntimeError("Production composition root is not initialized")

    try:
        report = root.weekly_report_service.generate_weekly_report(
            user_id=request_payload.user_id,
            week_start=request_payload.week_start,
            timezone_name=request_payload.timezone,
        )
    except ValueError as exc:
        return _error_response(
            status.HTTP_400_BAD_REQUEST,
            "INVALID_REQUEST",
            str(exc),
        )

    return _weekly_report_record(report)


@app.get("/api/v1/weekly-reports", response_model=WeeklyReportListResponse)
def weekly_reports(
    user_id: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=100),
) -> WeeklyReportListResponse:
    root: CompositionRoot | None = getattr(app.state, "composition_root", None)
    if root is None:
        raise RuntimeError("Production composition root is not initialized")
    items = root.weekly_report_service.list_weekly_reports(user_id, limit=limit)
    return WeeklyReportListResponse(
        items=[_weekly_report_record(item) for item in items],
        count=len(items),
    )


@app.get("/api/v1/weekly-reports/{report_id}/poster")
def weekly_report_poster(report_id: int) -> Response:
    root: CompositionRoot | None = getattr(app.state, "composition_root", None)
    if root is None:
        raise RuntimeError("Production composition root is not initialized")
    poster_svg = root.weekly_report_service.get_weekly_report_poster(report_id)
    if poster_svg is None:
        return _error_response(
            status.HTTP_404_NOT_FOUND,
            "WEEKLY_REPORT_NOT_FOUND",
            "周报不存在",
        )
    return Response(content=poster_svg, media_type="image/svg+xml")


def _error_response(
    status_code: int,
    error_code: str,
    message: str,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=ErrorResponse(
            success=False,
            error_code=error_code,
            message=message,
        ).model_dump(),
    )


def _weekly_report_record(report: Mapping[str, Any]) -> WeeklyReportRecord:
    public_fields = set(WeeklyReportRecord.model_fields)
    return WeeklyReportRecord.model_validate(
        {key: value for key, value in dict(report).items() if key in public_fields}
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,  # noqa: ARG001
    exc: RequestValidationError,
) -> JSONResponse:
    return _error_response(
        status.HTTP_400_BAD_REQUEST,
        "INVALID_REQUEST",
        "请求参数无效",
    )


@app.exception_handler(AgentProcessingError)
async def agent_processing_exception_handler(
    request: Request,  # noqa: ARG001
    exc: AgentProcessingError,
) -> JSONResponse:
    return _error_response(
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        "AGENT_PROCESSING_ERROR",
        str(exc),
    )


@app.exception_handler(Exception)
async def unexpected_exception_handler(
    request: Request,  # noqa: ARG001
    exc: Exception,
) -> JSONResponse:
    return _error_response(
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        "INTERNAL_SERVER_ERROR",
        "服务器内部错误",
    )

"""FastAPI application entry point for the LifeAgent backend."""

from contextlib import asynccontextmanager
from collections.abc import Mapping
import os
from pathlib import Path
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
from core.database import DatabaseClient
from core.redis_client import RedisClient
from core.settings import load_settings

try:  # pragma: no cover - optional dependency branch
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - handled by settings at runtime
    def load_dotenv(*args, **kwargs):  # type: ignore[no-redef]
        return False


load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env", override=False)


def _cors_origins() -> list[str]:
    configured = os.getenv("LIFESTEWARD_CORS_ORIGINS", "")
    origins = {
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    }
    origins.update(
        item.strip().rstrip("/")
        for item in configured.split(",")
        if item.strip()
    )
    return sorted(origins)


def _cors_origin_regex() -> str:
    return os.getenv(
        "LIFESTEWARD_CORS_ORIGIN_REGEX",
        r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    ).strip()


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Assemble production dependencies once when the application starts."""
    if not hasattr(application.state, "composition_root"):
        try:
            application.state.composition_root = build_composition_root()
            application.state.composition_root_error = False
        except Exception:
            # Keep /health/live available when a dependency or configuration is
            # temporarily unavailable. /health/ready exposes only safe status.
            application.state.composition_root = None
            application.state.composition_root_error = True
    yield


app = FastAPI(
    title="LifeAgent API",
    version="0.1.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_origin_regex=_cors_origin_regex() or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health/live", include_in_schema=False)
def health_live() -> dict[str, str]:
    """Return process liveness without touching external dependencies."""

    return {"status": "ok", "service": "lifeagent-backend"}


def _safe_configuration_status() -> dict[str, bool]:
    try:
        settings = load_settings()
        provider_key = (
            os.getenv("STEP_API_KEY", "")
            if settings.llm_provider == "stepfun"
            else os.getenv("DASHSCOPE_API_KEY", "")
        )
        llm_configured = bool(
            settings.llm_provider
            and settings.model_name
            and provider_key.strip()
        )
        speech_configured = bool(
            settings.speech_to_text_base_url
            and settings.speech_to_text_api_key
            and settings.speech_to_text_model
        )
        return {
            "llm_configured": llm_configured,
            "speech_to_text_configured": speech_configured,
        }
    except Exception:
        return {
            "llm_configured": False,
            "speech_to_text_configured": False,
        }


@app.get("/health/ready", include_in_schema=False)
def health_ready() -> JSONResponse:
    """Report dependency readiness with safe, non-secret component status."""

    try:
        database = DatabaseClient.from_environment()
        database_status = database.schema_health_check()
    except Exception:
        database_status = {
            "connected": False,
            "vector_extension_available": False,
            "migrations_applied": False,
            "missing_tables": [],
        }

    try:
        redis = RedisClient.from_environment()
        redis_status = redis.health_check()
        redis_status = {"connected": bool(redis_status.get("connected"))}
    except Exception:
        redis_status = {"connected": False}

    configuration_status = _safe_configuration_status()
    composition_available = getattr(app.state, "composition_root", None) is not None
    checks = {
        "database": {
            "connected": bool(database_status.get("connected")),
            "pgvector": bool(database_status.get("vector_extension_available")),
            "migrations": bool(database_status.get("migrations_applied")),
            "missing_tables": database_status.get("missing_tables", []),
        },
        "redis": redis_status,
        "configuration": configuration_status,
        "application": {"composition_root": composition_available},
    }
    ready = all(
        (
            checks["database"]["connected"],
            checks["database"]["pgvector"],
            checks["database"]["migrations"],
            checks["redis"]["connected"],
            checks["configuration"]["llm_configured"],
            checks["application"]["composition_root"],
        )
    )
    return JSONResponse(
        status_code=status.HTTP_200_OK if ready else status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "status": "ready" if ready else "not_ready",
            "service": "lifeagent-backend",
            "checks": checks,
        },
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

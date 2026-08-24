"""FastAPI application entry point for the LifeAgent backend."""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse

from schemas.chat_schema import ChatRequest, ChatResponse
from schemas.error_schema import ErrorResponse
from services.chat_service import AgentProcessingError, process_chat_message
from services.mock_demo_service import get_demo_agent
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


@app.get("/demo", include_in_schema=False)
def demo_page() -> FileResponse:
    return FileResponse("static/demo.html", media_type="text/html")


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

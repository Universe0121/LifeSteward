"""FastAPI application entry point for the LifeAgent backend."""

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from schemas.chat_schema import ChatRequest, ChatResponse
from schemas.error_schema import ErrorResponse
from services.chat_service import AgentProcessingError, process_chat_message


app = FastAPI(
    title="LifeAgent API",
    version="0.1.0",
)


@app.post("/api/v1/chat", response_model=ChatResponse)
def chat(chat_request: ChatRequest) -> ChatResponse:
    """Process one user chat message through the service layer."""

    return process_chat_message(chat_request)


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

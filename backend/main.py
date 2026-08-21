"""FastAPI application entry point for the LifeAgent backend."""

from fastapi import FastAPI

from schemas.chat_schema import ChatRequest, ChatResponse
from services.chat_service import process_chat_message


app = FastAPI(
    title="LifeAgent API",
    version="0.1.0",
)


@app.post("/api/v1/chat", response_model=ChatResponse)
def chat(chat_request: ChatRequest) -> ChatResponse:
    """Process one user chat message through the service layer."""

    return process_chat_message(chat_request)


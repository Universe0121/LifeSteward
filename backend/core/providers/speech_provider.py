"""Injectable speech provider boundary and HTTP adapter."""

from dataclasses import dataclass
import base64
import json
import os
import urllib.error
import urllib.request
import uuid
from typing import Protocol


class SpeechProviderError(RuntimeError):
    """Base error raised by speech providers."""


class SpeechProviderUnavailable(SpeechProviderError):
    """Provider is not configured or cannot be reached."""


@dataclass(frozen=True)
class Transcription:
    text: str
    language: str
    duration_ms: int = 0


class SpeechProvider(Protocol):
    def transcribe(self, audio: bytes, *, filename: str, content_type: str, language: str) -> Transcription:
        ...


class HttpSpeechProvider:
    """Minimal multipart adapter for OpenAI-compatible transcription APIs."""

    def __init__(self, base_url: str, api_key: str, model: str, timeout: float = 30.0) -> None:
        self.base_url, self.api_key, self.model, self.timeout = base_url.rstrip("/"), api_key, model, timeout

    def transcribe(self, audio: bytes, *, filename: str, content_type: str, language: str) -> Transcription:
        if "/audio/asr/sse" in self.base_url:
            return self._transcribe_stepfun_sse(audio, filename, content_type, language)
        boundary = f"----LifeAgent{uuid.uuid4().hex}"
        safe_filename = filename.replace("\r", "").replace("\n", "").replace('"', "") or "audio"
        fields = [("model", self.model), ("language", language)]
        chunks: list[bytes] = []
        for name, value in fields:
            chunks += [f"--{boundary}\r\n".encode(), f'Content-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()]
        chunks += [f"--{boundary}\r\n".encode(), f'Content-Disposition: form-data; name="file"; filename="{safe_filename}"\r\nContent-Type: {content_type or "application/octet-stream"}\r\n\r\n'.encode(), audio, f"\r\n--{boundary}--\r\n".encode()]
        request = urllib.request.Request(
            f"{self.base_url}/audio/transcriptions",
            data=b"".join(chunks),
            headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": f"multipart/form-data; boundary={boundary}"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, ValueError, OSError) as exc:
            raise SpeechProviderUnavailable("speech provider unavailable") from exc
        text = payload.get("text") if isinstance(payload, dict) else None
        if not isinstance(text, str) or not text.strip():
            raise SpeechProviderUnavailable("speech provider returned no transcript")
        return Transcription(text=text.strip(), language=language, duration_ms=int(payload.get("duration_ms", 0) or 0))

    def _transcribe_stepfun_sse(self, audio: bytes, filename: str, content_type: str, language: str) -> Transcription:
        extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else content_type.split("/", 1)[-1].split(";", 1)[0]
        payload = {
            "audio": {
                "data": base64.b64encode(audio).decode("ascii"),
                "input": {
                    "transcription": {"language": language.split("-", 1)[0], "model": self.model},
                    "format": {"type": extension},
                },
            }
        }
        request = urllib.request.Request(
            self.base_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "text/event-stream",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                body = response.read().decode("utf-8")
        except (urllib.error.URLError, TimeoutError, ValueError, OSError) as exc:
            raise SpeechProviderUnavailable("speech provider unavailable") from exc
        text_parts: list[str] = []
        duration_ms = 0
        for line in body.splitlines():
            if not line.startswith("data:"):
                continue
            try:
                event = json.loads(line[5:].strip())
            except json.JSONDecodeError:
                continue
            if event.get("type") == "error" or event.get("error"):
                raise SpeechProviderUnavailable("speech provider returned an error")
            if isinstance(event.get("text"), str):
                text_parts.append(event["text"])
            duration = event.get("duration_ms") or event.get("duration")
            if duration:
                duration_ms = int(float(duration) * (1000 if float(duration) < 1000 else 1))
        text = "".join(text_parts).strip()
        if not text:
            raise SpeechProviderUnavailable("speech provider returned no transcript")
        return Transcription(text=text, language=language, duration_ms=duration_ms)


class UnconfiguredSpeechProvider:
    def transcribe(self, audio: bytes, *, filename: str, content_type: str, language: str) -> Transcription:
        raise SpeechProviderUnavailable("speech provider is not configured")


def create_speech_provider_from_environment() -> SpeechProvider:
    base_url = os.getenv("SPEECH_TO_TEXT_BASE_URL", "").strip()
    api_key = os.getenv("SPEECH_TO_TEXT_API_KEY", "").strip()
    model = os.getenv("SPEECH_TO_TEXT_MODEL", "whisper-1").strip() or "whisper-1"
    if not base_url or not api_key:
        return UnconfiguredSpeechProvider()
    return HttpSpeechProvider(base_url, api_key, model, float(os.getenv("SPEECH_TO_TEXT_TIMEOUT", "30")))

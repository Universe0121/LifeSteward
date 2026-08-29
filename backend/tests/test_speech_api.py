"""HTTP contract tests for POST /api/v1/speech-to-text."""

import unittest
from types import SimpleNamespace

from fastapi.testclient import TestClient

from core.providers.speech_provider import Transcription, UnconfiguredSpeechProvider
from main import app
from services.speech_service import SpeechService


class FakeSpeechProvider:
    def transcribe(self, audio: bytes, **kwargs) -> Transcription:
        return Transcription("测试转写", kwargs["language"], 1200)


class SpeechAPITest(unittest.TestCase):
    def tearDown(self) -> None:
        if hasattr(app.state, "composition_root"):
            del app.state.composition_root

    def test_valid_multipart_request_returns_contract(self) -> None:
        app.state.composition_root = SimpleNamespace(speech_service=SpeechService(FakeSpeechProvider()))
        response = TestClient(app).post(
            "/api/v1/speech-to-text",
            data={"user_id": "10001", "language": "zh-CN"},
            files={"audio": ("voice.webm", b"audio", "audio/webm")},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"text": "测试转写", "language": "zh-CN", "duration_ms": 1200})

    def test_unconfigured_provider_returns_structured_503(self) -> None:
        app.state.composition_root = SimpleNamespace(speech_service=SpeechService(UnconfiguredSpeechProvider()))
        response = TestClient(app, raise_server_exceptions=False).post(
            "/api/v1/speech-to-text",
            data={"user_id": "10001"},
            files={"audio": ("voice.webm", b"audio", "audio/webm")},
        )
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["error_code"], "TRANSCRIPTION_UNAVAILABLE")


if __name__ == "__main__":
    unittest.main()

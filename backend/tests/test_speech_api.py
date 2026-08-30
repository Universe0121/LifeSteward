"""HTTP contract tests for the mobile speech upload endpoint."""

from __future__ import annotations

import unittest
from unittest.mock import Mock

from fastapi.testclient import TestClient

from core.composition_root import CompositionRoot
from main import app
from services.speech_service import SpeechResult, SpeechServiceError


class SpeechApiTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Mock(spec=CompositionRoot)
        self.root.speech_service = Mock()
        app.state.composition_root = self.root
        self.client = TestClient(app, raise_server_exceptions=False)

    def tearDown(self) -> None:
        if hasattr(app.state, "composition_root"):
            del app.state.composition_root

    def test_transcribes_multipart_audio(self) -> None:
        self.root.speech_service.transcribe.return_value = SpeechResult(
            text="今天完成学习",
            language="zh-CN",
            duration_ms=2400,
        )

        response = self.client.post(
            "/api/v1/speech-to-text",
            files={"audio": ("recording.m4a", b"audio-bytes", "audio/m4a")},
            data={"user_id": "10001", "language": "zh-CN"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "text": "今天完成学习",
            "language": "zh-CN",
            "duration_ms": 2400,
        })
        args = self.root.speech_service.transcribe.call_args.args
        self.assertEqual(args[0], b"audio-bytes")
        self.assertEqual(args[1], "recording.m4a")
        self.assertEqual(args[2], "audio/m4a")
        self.assertEqual(args[3], "zh-CN")

    def test_empty_audio_is_a_client_error(self) -> None:
        self.root.speech_service.transcribe.side_effect = SpeechServiceError(
            "AUDIO_EMPTY", "音频不能为空"
        )

        response = self.client.post(
            "/api/v1/speech-to-text",
            files={"audio": ("recording.m4a", b"", "audio/m4a")},
            data={"user_id": "10001", "language": "zh-CN"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error_code"], "AUDIO_EMPTY")
        self.assertEqual(response.json()["message"], "音频不能为空")

    def test_provider_failure_is_a_service_error(self) -> None:
        self.root.speech_service.transcribe.side_effect = SpeechServiceError(
            "TRANSCRIPTION_UNAVAILABLE", "语音服务暂时不可用"
        )

        response = self.client.post(
            "/api/v1/speech-to-text",
            files={"audio": ("recording.m4a", b"audio-bytes", "audio/m4a")},
            data={"user_id": "10001", "language": "zh-CN"},
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["error_code"], "TRANSCRIPTION_UNAVAILABLE")


if __name__ == "__main__":
    unittest.main()

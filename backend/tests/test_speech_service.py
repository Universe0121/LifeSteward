"""Speech service validation tests using a fake provider."""

import io
import unittest
import wave

from core.providers.speech_provider import SpeechProviderUnavailable, Transcription, UnconfiguredSpeechProvider
from services.speech_service import MAX_AUDIO_BYTES, SpeechService, SpeechServiceError


class FakeSpeechProvider:
    def __init__(self, result: Transcription | None = None, error: Exception | None = None) -> None:
        self.result = result or Transcription("今天晚上提醒我早点休息", "zh-CN", 4200)
        self.error = error

    def transcribe(self, audio: bytes, **kwargs) -> Transcription:
        if self.error:
            raise self.error
        return self.result


def wav_bytes(seconds: int) -> bytes:
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(1)
        wav.setframerate(8_000)
        wav.writeframes(b"\0" * 8_000 * seconds)
    return output.getvalue()


class SpeechServiceTest(unittest.TestCase):
    def test_valid_audio_returns_transcription(self) -> None:
        result = SpeechService(FakeSpeechProvider()).transcribe(b"audio", filename="voice.webm", content_type="audio/webm")
        self.assertEqual(result.text, "今天晚上提醒我早点休息")

    def test_audio_larger_than_ten_mb_is_rejected(self) -> None:
        with self.assertRaisesRegex(SpeechServiceError, "10 MB") as caught:
            SpeechService(FakeSpeechProvider()).transcribe(b"0" * (MAX_AUDIO_BYTES + 1), content_type="audio/webm")
        self.assertEqual(caught.exception.code, "AUDIO_TOO_LARGE")

    def test_wav_longer_than_sixty_seconds_is_rejected(self) -> None:
        with self.assertRaisesRegex(SpeechServiceError, "60 秒") as caught:
            SpeechService(FakeSpeechProvider()).transcribe(wav_bytes(61), filename="voice.wav", content_type="audio/wav")
        self.assertEqual(caught.exception.code, "INVALID_AUDIO")

    def test_provider_timeout_is_hidden_as_unavailable(self) -> None:
        service = SpeechService(FakeSpeechProvider(error=SpeechProviderUnavailable("secret raw timeout")))
        with self.assertRaises(SpeechServiceError) as caught:
            service.transcribe(b"audio", content_type="audio/webm")
        self.assertEqual(caught.exception.code, "TRANSCRIPTION_UNAVAILABLE")
        self.assertNotIn("secret", str(caught.exception))

    def test_unconfigured_provider_is_unavailable(self) -> None:
        with self.assertRaises(SpeechServiceError) as caught:
            SpeechService(UnconfiguredSpeechProvider()).transcribe(b"audio", content_type="audio/webm")
        self.assertEqual(caught.exception.status_code, 503)

    def test_non_audio_upload_is_rejected(self) -> None:
        with self.assertRaises(SpeechServiceError) as caught:
            SpeechService(FakeSpeechProvider()).transcribe(b"text", filename="note.txt", content_type="text/plain")
        self.assertEqual(caught.exception.code, "INVALID_AUDIO")


if __name__ == "__main__":
    unittest.main()

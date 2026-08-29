import base64
import json
from io import BytesIO
import unittest
import wave
from unittest.mock import patch

from core.providers.stepfun_speech_provider import SpeechProviderError, StepFunSpeechProvider
from services.speech_service import SpeechService, SpeechServiceError


class FakeProvider:
    def __init__(self, result=None, error=None):
        self.result = result or {"text": "今天完成学习", "language": "zh-CN", "duration_ms": 2400}
        self.error = error

    def transcribe(self, audio, filename, content_type, language):
        if self.error:
            raise self.error
        return self.result


class SpeechServiceTest(unittest.TestCase):
    def test_rejects_empty_audio_with_distinct_error_code(self):
        with self.assertRaises(SpeechServiceError) as context:
            SpeechService(FakeProvider()).transcribe(b"", "recording.m4a", "audio/m4a", "zh-CN")
        self.assertEqual(context.exception.error_code, "AUDIO_EMPTY")

    def test_transcribes_valid_audio(self):
        result = SpeechService(FakeProvider()).transcribe(b"audio", "recording.m4a", "audio/m4a", "zh-CN")
        self.assertEqual(result.text, "今天完成学习")
        self.assertEqual(result.duration_ms, 2400)

    def test_fills_wav_duration_when_provider_does_not_return_one(self):
        audio_buffer = BytesIO()
        with wave.open(audio_buffer, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(8000)
            wav_file.writeframes(b"\x00\x00" * 8000)
        result = SpeechService(FakeProvider(result={"text": "ok", "duration_ms": 0})).transcribe(
            audio_buffer.getvalue(), "recording.wav", "audio/wav", "zh-CN"
        )
        self.assertEqual(result.duration_ms, 1000)

    def test_rejects_audio_larger_than_ten_megabytes(self):
        with self.assertRaisesRegex(SpeechServiceError, "10 MB"):
            SpeechService(FakeProvider()).transcribe(b"x" * (10 * 1024 * 1024 + 1), "recording.m4a", "audio/m4a", "zh-CN")

    def test_rejects_unsupported_audio_format(self):
        with self.assertRaises(SpeechServiceError) as context:
            SpeechService(FakeProvider()).transcribe(b"audio", "recording.aac", "audio/aac", "zh-CN")
        self.assertEqual(context.exception.error_code, "INVALID_AUDIO")

    def test_provider_failure_is_safe_and_structured(self):
        with self.assertRaises(SpeechServiceError) as context:
            SpeechService(FakeProvider(error=SpeechProviderError("network"))).transcribe(b"audio", "recording.m4a", "audio/m4a", "zh-CN")
        self.assertEqual(context.exception.error_code, "TRANSCRIPTION_UNAVAILABLE")
        self.assertEqual(context.exception.message, "语音服务暂时不可用")

    def test_missing_provider_is_unavailable(self):
        with self.assertRaises(SpeechServiceError) as context:
            SpeechService(None).transcribe(b"audio", "recording.m4a", "audio/m4a", "zh-CN")
        self.assertEqual(context.exception.error_code, "TRANSCRIPTION_UNAVAILABLE")


class StepFunProviderTest(unittest.TestCase):
    def test_parses_json_and_sse_payloads(self):
        self.assertEqual(StepFunSpeechProvider._find_text({"output": {"text": "识别结果"}}), "识别结果")
        parsed = StepFunSpeechProvider._parse_response('data: {"text":"第一段"}\ndata: {"text":"第二段"}\ndata: [DONE]')
        self.assertEqual(StepFunSpeechProvider._find_text(parsed), "第一段第二段")

    @patch("core.providers.stepfun_speech_provider.urlopen")
    def test_builds_stepfun_json_request_and_uses_done_text(self, urlopen):
        response = urlopen.return_value.__enter__.return_value
        response.read.return_value = (
            b'data: {"type":"transcript.text.delta","delta":"o","end_time":100}\n\n'
            b'data: {"type":"transcript.text.done","text":"ok"}\n\n'
            b'data: [DONE]\n\n'
        )
        provider = StepFunSpeechProvider("https://example.test/asr", "secret-value", "stepaudio-2.5-asr")
        result = provider.transcribe(b"abc", "recording.m4a", "audio/m4a", "zh-CN")
        request = urlopen.call_args.args[0]
        body = json.loads(request.data.decode("utf-8"))
        self.assertEqual(result["text"], "ok")
        self.assertEqual(body["audio"]["data"], base64.b64encode(b"abc").decode("ascii"))
        self.assertEqual(body["audio"]["input"]["format"]["type"], "m4a")
        self.assertEqual(body["audio"]["input"]["transcription"]["language"], "zh")
        self.assertEqual(body["audio"]["input"]["transcription"]["model"], "stepaudio-2.5-asr")
        self.assertNotIn("secret-value", request.data.decode("utf-8"))
        self.assertEqual(request.headers["Content-type"], "application/json")
        self.assertEqual(request.headers["Authorization"], "Bearer secret-value")

    @patch("core.providers.stepfun_speech_provider.urlopen")
    def test_provider_error_frame_is_safe(self, urlopen):
        response = urlopen.return_value.__enter__.return_value
        response.read.return_value = b'data: {"type":"error","message":"private detail"}\n\n'
        provider = StepFunSpeechProvider("https://example.test/asr", "secret-value", "stepaudio-2.5-asr")
        with self.assertRaises(SpeechProviderError):
            provider.transcribe(b"abc", "recording.m4a", "audio/m4a", "zh-CN")


if __name__ == "__main__":
    unittest.main()

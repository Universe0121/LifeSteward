import unittest
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
    def test_transcribes_valid_audio(self):
        result = SpeechService(FakeProvider()).transcribe(b"audio", "recording.m4a", "audio/m4a", "zh-CN")
        self.assertEqual(result.text, "今天完成学习")
        self.assertEqual(result.duration_ms, 2400)

    def test_rejects_audio_larger_than_ten_megabytes(self):
        with self.assertRaisesRegex(SpeechServiceError, "10 MB"):
            SpeechService(FakeProvider()).transcribe(b"x" * (10 * 1024 * 1024 + 1), "recording.m4a", "audio/m4a", "zh-CN")

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
    def test_builds_multipart_request_without_exposing_key(self, urlopen):
        response = urlopen.return_value.__enter__.return_value
        response.read.return_value = b'{"text":"ok","duration_ms":100}'
        provider = StepFunSpeechProvider("https://example.test/asr", "secret-value", "stepaudio-2.5-asr")
        result = provider.transcribe(b"abc", "recording.m4a", "audio/m4a", "zh-CN")
        request = urlopen.call_args.args[0]
        self.assertEqual(result["text"], "ok")
        self.assertNotIn(b"secret-value", request.data)
        self.assertIn(b"stepaudio-2.5-asr", request.data)
        self.assertEqual(request.headers["Authorization"], "Bearer secret-value")


if __name__ == "__main__":
    unittest.main()

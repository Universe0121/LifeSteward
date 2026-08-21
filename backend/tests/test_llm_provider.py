"""Tests for Qwen provider configuration and request conversion."""

import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from core.llm_service import create_llm_service_from_environment
from core.providers.qwen_provider import QwenProvider


class FakeChatCompletions:
    def __init__(self) -> None:
        self.arguments = None

    def create(self, **arguments):
        self.arguments = arguments
        message = SimpleNamespace(content=" OK ")
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


class FakeQwenClient:
    def __init__(self, response=None) -> None:
        self.completions = FakeChatCompletions()
        if response is not None:
            self.completions.create = lambda **arguments: response
        self.chat = SimpleNamespace(completions=self.completions)


class QwenProviderTest(unittest.TestCase):
    def test_qwen_provider_builds_chat_completion_request(self) -> None:
        client = FakeQwenClient()
        provider = QwenProvider(
            api_key="test-key",
            model_name="qwen-plus",
            client=client,
        )

        response = provider.generate(
            "system prompt",
            {"user_input": "今天学习数学2小时"},
        )

        self.assertEqual(response, "OK")
        self.assertEqual(client.completions.arguments["model"], "qwen-plus")
        self.assertEqual(
            client.completions.arguments["messages"][0]["content"],
            "system prompt",
        )
        self.assertIn(
            "今天学习数学2小时",
            client.completions.arguments["messages"][1]["content"],
        )

    def test_qwen_provider_accepts_plain_string_response(self) -> None:
        provider = QwenProvider(
            api_key="test-key",
            client=FakeQwenClient(" OK "),
        )

        response = provider.generate("system prompt", {"user_input": "test"})

        self.assertEqual(response, "OK")

    def test_qwen_provider_rejects_html_response(self) -> None:
        provider = QwenProvider(
            api_key="test-key",
            client=FakeQwenClient("<!doctype html><html></html>"),
        )

        with self.assertRaisesRegex(RuntimeError, "API path"):
            provider.generate("system prompt", {"user_input": "test"})

    def test_qwen_provider_accepts_dictionary_response(self) -> None:
        provider = QwenProvider(
            api_key="test-key",
            client=FakeQwenClient(
                {"choices": [{"message": {"content": " OK "}}]}
            ),
        )

        response = provider.generate("system prompt", {"user_input": "test"})

        self.assertEqual(response, "OK")

    @patch.dict(
        os.environ,
        {
            "LLM_PROVIDER": "qwen",
            "DASHSCOPE_API_KEY": "test-key",
            "MODEL_NAME": "qwen-plus",
        },
        clear=True,
    )
    @patch("core.providers.qwen_provider.QwenProvider")
    def test_factory_creates_qwen_provider(self, provider_class) -> None:
        create_llm_service_from_environment()

        provider_class.assert_called_once_with(
            api_key="test-key",
            model_name="qwen-plus",
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            temperature=0.7,
        )

    @patch.dict(
        os.environ,
        {"LLM_PROVIDER": "openai"},
        clear=True,
    )
    def test_factory_rejects_other_providers(self) -> None:
        with self.assertRaisesRegex(ValueError, "Only the qwen"):
            create_llm_service_from_environment()


if __name__ == "__main__":
    unittest.main()

import os
import unittest
from pathlib import Path
from unittest.mock import patch

from core import settings


class SettingsTest(unittest.TestCase):
    def test_load_settings_reads_backend_env_file(self) -> None:
        expected_path = (
            Path(settings.__file__).resolve().parents[1] / ".env"
        )

        with patch("core.settings.load_dotenv") as load_dotenv:
            with patch.dict(os.environ, {}, clear=True):
                settings.load_settings()

        load_dotenv.assert_called_once_with(
            dotenv_path=expected_path,
            override=False,
        )

    def test_env_example_documents_required_settings(self) -> None:
        env_example = Path(__file__).resolve().parents[1] / ".env.example"

        self.assertTrue(env_example.exists())

        content = env_example.read_text(encoding="utf-8")
        required_keys = (
            "LLM_PROVIDER",
            "MODEL_NAME",
            "EMBEDDING_MODEL_NAME",
            "DASHSCOPE_API_KEY",
            "POSTGRES_DSN",
            "REDIS_URL",
            "SPEECH_TO_TEXT_BASE_URL",
            "SPEECH_TO_TEXT_API_KEY",
            "SPEECH_TO_TEXT_MODEL",
        )
        for key in required_keys:
            self.assertIn(f"{key}=", content)


if __name__ == "__main__":
    unittest.main()

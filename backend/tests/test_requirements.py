import unittest
from pathlib import Path


class RequirementsTest(unittest.TestCase):
    def setUp(self) -> None:
        path = Path(__file__).resolve().parents[1] / "requirements.txt"
        self.requirements = path.read_text(encoding="utf-8")

    def test_includes_uvicorn_runtime_server(self) -> None:
        self.assertIn("uvicorn>=0.30.0", self.requirements)

    def test_openai_major_version_is_bounded(self) -> None:
        self.assertIn("openai>=1.66.0,<2", self.requirements)


if __name__ == "__main__":
    unittest.main()
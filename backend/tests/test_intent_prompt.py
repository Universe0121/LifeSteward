"""Regression checks for the intent classification contract."""

import unittest

from core.llm_service import load_prompt


class IntentPromptTest(unittest.TestCase):
    def test_prompt_distinguishes_fact_query_from_reflection(self) -> None:
        prompt = load_prompt("intent_classification_prompt.md")

        self.assertIn("我最近的学习情况怎么样？", prompt)
        self.assertIn("query_memory", prompt)
        self.assertIn("最近为什么学习效率下降？", prompt)
        self.assertIn("reflection", prompt)


if __name__ == "__main__":
    unittest.main()
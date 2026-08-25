import unittest

from core.llm_service import load_prompt


class LifeUnderstandingPromptTest(unittest.TestCase):
    def test_prompt_forbids_inventing_event_details(self) -> None:
        prompt = load_prompt("life_understanding_prompt.md")

        self.assertIn("不添加用户未表达的事实", prompt)
        self.assertIn("不确定的信息使用 null", prompt)
        self.assertIn("禁止编造", prompt)


if __name__ == "__main__":
    unittest.main()
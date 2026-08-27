import unittest

from core.llm_service import load_prompt


class InteractionPromptTest(unittest.TestCase):
    def test_prompt_forbids_inventing_memory_or_saved_events(self) -> None:
        prompt = load_prompt("interaction_prompt.md")

        self.assertIn("不要编造历史记录", prompt)
        self.assertIn("retrieved_memories 为空时", prompt)
        self.assertIn("不得声称保存了 extracted_events 中不存在的内容", prompt)


if __name__ == "__main__":
    unittest.main()
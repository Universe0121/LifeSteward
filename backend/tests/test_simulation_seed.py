from __future__ import annotations
import sys, unittest
from unittest.mock import patch
from scripts import seed_simulation_data as seed

class SimulationSeedTest(unittest.TestCase):
    def test_build_messages_produces_fifty_explicit_record_requests(self):
        messages = seed.build_messages(50)
        self.assertEqual(len(messages), 50)
        self.assertEqual(len(set(messages)), 50)
        self.assertTrue(all(x.startswith("请记录这条生活事件") for x in messages))

    def test_main_posts_every_item_to_chat_and_only_reads_database_for_verification(self):
        posted = []
        def fake_post(api_base, user_id, conversation_id, message):
            posted.append((api_base, user_id, conversation_id, message))
            return {"intent": "record_event", "extracted_events": [{"event_content": message}]}
        with patch.object(seed, "post_chat", side_effect=fake_post), patch.object(seed, "verify_persistence", return_value={"event_count": 3}) as verify, patch.object(seed, "load_dotenv"), patch.object(sys, "argv", ["seed_simulation_data.py", "--count", "3", "--conversation-id", "agent-seed"]):
            seed.main()
        self.assertEqual(len(posted), 3)
        self.assertTrue(all(call[2] == "agent-seed" for call in posted))
        verify.assert_called_once_with("10001", "agent-seed")

    def test_main_clears_only_the_tagged_batch_before_posting(self):
        database = object()
        sql_tool = type("SQLTool", (), {"delete_simulation_batch": lambda self, user_id, conversation_id: calls.append((user_id, conversation_id))})()
        calls = []
        with patch.object(seed.DatabaseClient, "from_environment", return_value=database), patch.object(seed, "SQLTool", return_value=sql_tool), patch.object(seed, "post_chat", return_value={"intent": "record_event", "extracted_events": [{"event_content": "event"}]}), patch.object(seed, "verify_persistence", return_value={"event_count": 1}), patch.object(seed, "load_dotenv"), patch.object(sys, "argv", ["seed_simulation_data.py", "--count", "1", "--conversation-id", "simulation_demo"]):
            seed.main()
        self.assertEqual(calls, [("10001", "simulation_demo")])

    def test_main_stops_if_agent_does_not_route_to_record_event(self):
        with patch.object(seed, "post_chat", return_value={"intent": "casual_chat", "extracted_events": []}), patch.object(seed, "load_dotenv"), patch.object(sys, "argv", ["seed_simulation_data.py", "--count", "1"]):
            with self.assertRaisesRegex(RuntimeError, "routed"):
                seed.main()

if __name__ == "__main__":
    unittest.main()

from __future__ import annotations

import unittest
from unittest.mock import Mock, patch

from scripts import cleanup_demo_data


class CleanupDemoDataTest(unittest.TestCase):
    def test_cleanup_requires_explicit_conversation_ids_and_deletes_each_batch(self):
        sql_tool = Mock()
        with patch.object(cleanup_demo_data, "SQLTool", return_value=sql_tool), patch.object(
            cleanup_demo_data.DatabaseClient, "from_environment", return_value=object()
        ):
            cleanup_demo_data.clean_demo_data("10001", ["e2e-production-smoke", "simulation_demo"])

        self.assertEqual(
            sql_tool.delete_simulation_batch.call_args_list,
            [
                unittest.mock.call("10001", "e2e-production-smoke"),
                unittest.mock.call("10001", "simulation_demo"),
            ],
        )

    def test_cleanup_rejects_empty_conversation_ids(self):
        with self.assertRaises(ValueError):
            cleanup_demo_data.clean_demo_data("10001", [])


if __name__ == "__main__":
    unittest.main()

import unittest
from unittest.mock import patch

from core.database import DatabaseClient
from core.llm_service import CallableLLMService
from core.composition_root import build_composition_root


class ProductionWiringTest(unittest.TestCase):
    def test_composition_root_uses_real_memory_service(self) -> None:
        llm = CallableLLMService(
            lambda prompt, variables: "",
            lambda text: [0.1, 0.2],
        )
        database = DatabaseClient("postgresql://unused")

        with patch(
            "core.composition_root.configure_llm_service_from_environment",
            return_value=llm,
        ), patch(
            "core.composition_root.DatabaseClient.from_environment",
            return_value=database,
        ):
            root = build_composition_root()

        self.assertIs(root.sql_tool._database_client, database)
        self.assertIs(root.vector_search_tool._database_client, database)
        self.assertIs(
            root.master_agent._memory_agent.memory_service,
            root.memory_service,
        )


if __name__ == "__main__":
    unittest.main()
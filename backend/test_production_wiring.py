import unittest
from unittest.mock import patch

from core.composition_root import build_composition_root


class ProductionWiringTest(unittest.TestCase):
    def test_composition_root_assembles_production_graph(self):
        with patch("core.composition_root.configure_llm_service_from_environment") as llm_factory, \
             patch("core.composition_root.DatabaseClient.from_environment") as db_factory:
            from core.llm_service import CallableLLMService
            from core.database import DatabaseClient
            llm = CallableLLMService(lambda *_: "", lambda *_: [0.1, 0.2])
            llm_factory.return_value = llm
            db = DatabaseClient("postgresql://unused")
            db_factory.return_value = db
            root = build_composition_root()
        self.assertIs(root.llm_service, llm)
        self.assertIs(root.database_client, db)
        self.assertIs(root.sql_tool._database_client, db)
        self.assertIs(root.vector_search_tool._database_client, db)
        self.assertIs(root.master_agent._memory_agent.memory_service, root.memory_service)


if __name__ == "__main__": unittest.main()

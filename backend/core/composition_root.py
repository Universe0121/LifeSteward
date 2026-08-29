"""Production dependency composition for the FastAPI application."""

from dataclasses import dataclass

from agents.master_agent import MasterAgent
from agents.weekly_report_agent import WeeklyReportAgent
from core.database import DatabaseClient
from core.llm_service import LLMService, configure_llm_service_from_environment
from services.weekly_report_service import WeeklyReportService
from services.memory_service import ToolMemoryService
from tools.sql_tool import SQLTool
from tools.vector_search_tool import VectorSearchTool


@dataclass(frozen=True)
class CompositionRoot:
    """Fully assembled production object graph."""

    llm_service: LLMService
    database_client: DatabaseClient
    sql_tool: SQLTool
    vector_search_tool: VectorSearchTool
    memory_service: ToolMemoryService
    master_agent: MasterAgent
    weekly_report_agent: WeeklyReportAgent
    weekly_report_service: WeeklyReportService


def build_composition_root() -> CompositionRoot:
    """Construct the production graph from environment configuration."""

    llm_service = configure_llm_service_from_environment()
    database_client = DatabaseClient.from_environment()
    sql_tool = SQLTool(database_client)
    vector_search_tool = VectorSearchTool(database_client)
    memory_service = ToolMemoryService(sql_tool, vector_search_tool, llm_service)
    master_agent = MasterAgent(memory_service=memory_service, llm_service=llm_service)
    weekly_report_agent = WeeklyReportAgent(llm_service=llm_service)
    weekly_report_service = WeeklyReportService(
        sql_tool,
        weekly_report_agent=weekly_report_agent,
    )
    return CompositionRoot(
        llm_service,
        database_client,
        sql_tool,
        vector_search_tool,
        memory_service,
        master_agent,
        weekly_report_agent,
        weekly_report_service,
    )

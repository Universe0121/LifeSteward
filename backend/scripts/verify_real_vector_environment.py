"""Verify the real PostgreSQL, DashScope embedding, and pgvector path."""

from __future__ import annotations

import hashlib
import json
import os
import sys
import uuid
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv

from core.database import DatabaseClient
from core.llm_service import create_llm_service_from_environment
from tools.vector_search_tool import VectorSearchTool


def main() -> None:
    load_dotenv(BACKEND_DIR / ".env", override=False)

    required = (
        "POSTGRES_DSN",
        "DASHSCOPE_API_KEY",
        "DASHSCOPE_BASE_URL",
        "EMBEDDING_MODEL_NAME",
    )
    missing = [name for name in required if not os.getenv(name, "").strip()]
    if missing:
        raise RuntimeError(f"missing required configuration: {', '.join(missing)}")

    database = DatabaseClient.from_environment()
    database.execute_script(
        (BACKEND_DIR / "migrations" / "001_initial_memory_schema.sql").read_text(
            encoding="utf-8"
        )
    )

    schema = database.fetch_one(
        """
        SELECT
            current_database() AS database_name,
            current_user AS database_user,
            current_setting('server_version') AS server_version,
            (SELECT extversion FROM pg_extension WHERE extname = 'vector') AS vector_version,
            to_regclass('public.memories') IS NOT NULL AS memories_table_exists,
            (
                SELECT udt_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'memories'
                  AND column_name = 'embedding'
            ) AS embedding_column_type
        """
    )

    llm = create_llm_service_from_environment()
    generated = llm.generate(
        "只返回字符串 OK，不要添加其他内容。",
        {"purpose": "real environment acceptance"},
    )
    if not generated.strip():
        raise RuntimeError("configured generation model returned an empty response")
    memory_text = "验收样本：最近连续三天睡眠不足，导致白天学习效率下降。"
    query_text = "为什么我最近学习效率变低？"
    memory_embedding = llm.embed_text(memory_text)
    query_embedding = llm.embed_text(query_text)
    if not memory_embedding or len(memory_embedding) != len(query_embedding):
        raise RuntimeError("real embedding response was empty or dimensions differed")

    user_id = f"real-vector-acceptance-{uuid.uuid4()}"
    VectorSearchTool(database).save_memory(
        {
            "user_id": user_id,
            "memory_type": "acceptance",
            "memory_content": memory_text,
            "embedding": memory_embedding,
            "metadata": {
                "source": "real_environment_acceptance",
                "provider": "dashscope",
                "model": os.environ["EMBEDDING_MODEL_NAME"],
                "deterministic_fallback": False,
            },
        }
    )
    stored = database.fetch_one(
        """
        SELECT id, vector_dims(embedding) AS embedding_dimension, metadata
        FROM memories
        WHERE user_id = %s
        ORDER BY id DESC
        LIMIT 1
        """,
        (user_id,),
    )
    results = VectorSearchTool(database).search_memories(
        user_id, query_embedding, top_k=3
    )
    if not results:
        raise RuntimeError("pgvector returned no result for the inserted embedding")

    evidence = {
        "configuration": {
            "postgres_dsn_configured": True,
            "dashscope_api_key_configured": True,
            "dashscope_base_url": os.environ["DASHSCOPE_BASE_URL"],
            "embedding_model": os.environ["EMBEDDING_MODEL_NAME"],
            "deterministic_fallback_used": False,
        },
        "generation_model": {
            "provider": os.getenv("LLM_PROVIDER", "qwen"),
            "model": os.getenv("MODEL_NAME", "qwen-plus"),
            "response_length": len(generated),
            "sha256_prefix": hashlib.sha256(
                generated.encode("utf-8")
            ).hexdigest()[:16],
        },
        "database": schema,
        "embedding": {
            "dimension": len(memory_embedding),
            "sha256_prefix": hashlib.sha256(
                json.dumps(memory_embedding).encode("utf-8")
            ).hexdigest()[:16],
            "stored_row": stored,
        },
        "pgvector_search": results,
    }
    print(json.dumps(evidence, ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    main()

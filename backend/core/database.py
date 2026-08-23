"""PostgreSQL connection helpers for Day3 persistence work."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from core.settings import load_settings

try:  # pragma: no cover - optional dependency branch
    import psycopg
    from psycopg.rows import dict_row
except ImportError:  # pragma: no cover - handled at runtime
    psycopg = None
    dict_row = None


@dataclass
class DatabaseHealth:
    connected: bool
    vector_extension_available: bool
    error: str | None = None

    def as_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "connected": self.connected,
            "vector_extension_available": self.vector_extension_available,
        }
        if self.error:
            payload["error"] = self.error
        return payload


class DatabaseClient:
    """Thin PostgreSQL client with pgvector health verification."""

    def __init__(self, postgres_dsn: str) -> None:
        if not postgres_dsn:
            raise ValueError("POSTGRES_DSN is required")
        self._postgres_dsn = postgres_dsn

    @classmethod
    def from_environment(cls) -> "DatabaseClient":
        settings = load_settings()
        return cls(settings.postgres_dsn)

    def connect(self):  # pragma: no cover - exercised in integration tests
        if psycopg is None:
            raise RuntimeError("psycopg is required for PostgreSQL access")
        return psycopg.connect(self._postgres_dsn, connect_timeout=5)

    def fetch_all(
        self,
        query: str,
        params: tuple[Any, ...] | list[Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Run a read query and return all rows as dictionaries."""

        if psycopg is None:
            raise RuntimeError("psycopg is required for PostgreSQL access")

        with self.connect() as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(query, tuple(params or ()))
                return [dict(row) for row in cursor.fetchall()]

    def fetch_one(
        self,
        query: str,
        params: tuple[Any, ...] | list[Any] | None = None,
    ) -> dict[str, Any] | None:
        """Run a query and return the first row as a dictionary."""

        if psycopg is None:
            raise RuntimeError("psycopg is required for PostgreSQL access")

        with self.connect() as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(query, tuple(params or ()))
                row = cursor.fetchone()
                return dict(row) if row else None

    def execute(
        self,
        query: str,
        params: tuple[Any, ...] | list[Any] | None = None,
    ) -> None:
        """Run a statement that does not need a returned payload."""

        if psycopg is None:
            raise RuntimeError("psycopg is required for PostgreSQL access")

        with self.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, tuple(params or ()))

    def execute_script(self, script: str) -> None:
        """Execute a simple semicolon-delimited migration script."""

        if psycopg is None:
            raise RuntimeError("psycopg is required for PostgreSQL access")

        statements = [statement.strip() for statement in script.split(";")]
        with self.connect() as connection:
            with connection.cursor() as cursor:
                for statement in statements:
                    if statement:
                        cursor.execute(statement)

    def health_check(self) -> dict[str, Any]:
        if psycopg is None:
            return DatabaseHealth(
                connected=False,
                vector_extension_available=False,
                error="psycopg is not installed",
            ).as_dict()

        try:
            with self.connect() as connection:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT 1")
                    cursor.fetchone()
                    cursor.execute(
                        "SELECT EXISTS ("
                        "SELECT 1 FROM pg_extension WHERE extname = 'vector'"
                        ")"
                    )
                    row = cursor.fetchone()
                    vector_extension_available = bool(row[0]) if row else False
            return DatabaseHealth(
                connected=True,
                vector_extension_available=vector_extension_available,
            ).as_dict()
        except Exception as exc:  # pragma: no cover - integration failure path
            return DatabaseHealth(
                connected=False,
                vector_extension_available=False,
                error=str(exc),
            ).as_dict()

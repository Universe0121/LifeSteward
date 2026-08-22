"""Infrastructure smoke tests for database and Redis helpers."""

from __future__ import annotations

import os
import unittest

from core.database import DatabaseClient
from core.redis_client import RedisClient


class InfrastructureSmokeTestCase(unittest.TestCase):
    def test_database_health_check_returns_dict(self) -> None:
        if not os.getenv("POSTGRES_DSN"):
            self.skipTest("POSTGRES_DSN is not configured")

        health = DatabaseClient.from_environment().health_check()
        self.assertIn("connected", health)
        self.assertIn("vector_extension_available", health)

    def test_redis_health_check_returns_dict(self) -> None:
        if not os.getenv("REDIS_URL"):
            self.skipTest("REDIS_URL is not configured")

        health = RedisClient.from_environment().health_check()
        self.assertIn("connected", health)


if __name__ == "__main__":
    unittest.main()

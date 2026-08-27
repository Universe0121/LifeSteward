# Frontend Backend Integration Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

Goal: Add a safe backend health endpoint and precise local联调 instructions while preserving the existing chat/timeline contracts.

Architecture: Keep the existing FastAPI composition root and service boundaries. The health endpoint reads the assembled database client when available and derives LLM configuration from environment settings without invoking agents, writing data, or exposing secrets. Frontend behavior remains unchanged except for documented API-base configuration.

Tech Stack: FastAPI, Pydantic, Python unittest/TestClient, React + TypeScript + Vite, Markdown.

Spec: docs/superpowers/specs/2026-08-27-frontend-backend-integration-design.md

## Global Constraints

- Do not commit backend/.env, API keys, database credentials, or Redis credentials.
- Keep VITE_API_BASE defaulting to /api and the Vite proxy target at http://localhost:8000.
- Health checks must not invoke the Agent chain, write data, or return secrets/stack traces.
- Preserve /api/v1/chat and /api/v1/life-events request and response fields.
- Use test-first implementation: each production behavior gets a failing test before code.

### Task 1: Add health endpoint contract tests

Files:
- Create: backend/tests/test_health_api.py
- Modify: none

Interfaces:
- Consumes: main.app and core.composition_root.CompositionRoot.
- Produces: expectations for GET /api/health in ready, degraded, and uninitialized states.

- [ ] Step 1: Write the failing tests

    from unittest.mock import Mock, patch
    from fastapi.testclient import TestClient
    from core.composition_root import CompositionRoot
    from main import app

    def test_health_reports_ready_dependencies():
        root = Mock(spec=CompositionRoot)
        root.database_client.health_check.return_value = {
            "connected": True,
            "vector_extension_available": True,
        }
        app.state.composition_root = root
        with patch.dict("os.environ", {"LLM_PROVIDER": "qwen", "DASHSCOPE_API_KEY": "test-key"}, clear=False):
            response = TestClient(app, raise_server_exceptions=False).get("/api/health")
        assert response.status_code == 200
        assert response.json() == {
            "status": "ok",
            "database": {"connected": True, "vector_extension_available": True},
            "llm": {"configured": True, "provider": "qwen"},
        }

    def test_health_reports_degraded_database_without_secret_details():
        root = Mock(spec=CompositionRoot)
        root.database_client.health_check.return_value = {
            "connected": False,
            "vector_extension_available": False,
            "error": "database unavailable",
        }
        app.state.composition_root = root
        with patch.dict("os.environ", {"LLM_PROVIDER": "qwen", "DASHSCOPE_API_KEY": ""}, clear=False):
            response = TestClient(app, raise_server_exceptions=False).get("/api/health")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "degraded"
        assert payload["database"]["error"] == "database unavailable"
        assert payload["llm"] == {"configured": False, "provider": "qwen"}
        assert "test-key" not in response.text

    def test_health_reports_uninitialized_composition_root():
        app.state.composition_root = None
        with patch.dict("os.environ", {"LLM_PROVIDER": "stepfun", "STEP_API_KEY": ""}, clear=False):
            response = TestClient(app, raise_server_exceptions=False).get("/api/health")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "degraded"
        assert payload["database"]["connected"] is False
        assert payload["llm"] == {"configured": False, "provider": "stepfun"}

    def teardown_module():
        if hasattr(app.state, "composition_root"):
            del app.state.composition_root

- [ ] Step 2: Run the focused tests and verify they fail for the missing route

Run from backend:
    python -m unittest tests.test_health_api -v
Expected: failures because /api/health is not registered yet.

### Task 2: Implement the minimal health endpoint

Files:
- Modify: backend/main.py near the existing API routes
- Test: backend/tests/test_health_api.py

Interfaces:
- Consumes: app.state.composition_root and os.environ.
- Produces: GET /api/health returning {status, database, llm} with HTTP 200.

- [ ] Step 1: Add the smallest implementation

Add an os import and this route before the business endpoints:

    @app.get("/api/health")
    def health() -> dict:
        root: CompositionRoot | None = getattr(app.state, "composition_root", None)
        if root is None:
            database = {
                "connected": False,
                "vector_extension_available": False,
                "error": "composition root is not initialized",
            }
        else:
            database = root.database_client.health_check()
        provider = os.getenv("LLM_PROVIDER", "qwen").strip().lower() or "qwen"
        key_name = "STEP_API_KEY" if provider == "stepfun" else "DASHSCOPE_API_KEY"
        llm = {"configured": bool(os.getenv(key_name, "").strip()), "provider": provider}
        ready = bool(database.get("connected")) and bool(database.get("vector_extension_available")) and llm["configured"]
        return {"status": "ok" if ready else "degraded", "database": database, "llm": llm}

Do not return key values or exception tracebacks. Unknown providers remain degraded unless their selected key is configured.

- [ ] Step 2: Run the focused tests and verify they pass

    python -m unittest tests.test_health_api -v
Expected: all three health tests pass.

### Task 3: Document repeatable local联调 startup and dependency gaps

Files:
- Modify: docs/handoff.md
- Modify: backend/.env.example only if provider variables required by the health check are missing

Interfaces:
- Consumes: current Vite proxy, backend settings, and health route.
- Produces: copy-paste startup commands and a clear checklist for PostgreSQL/pgvector, Redis, and LLM configuration.

- [ ] Step 1: Update the handoff instructions

Document these commands:

    # terminal 1
    cd backend
    python -m uvicorn main:app --reload --port 8000

    # terminal 2
    cd frontend
    pnpm install
    pnpm dev

    # probe
    curl http://127.0.0.1:8000/api/health

State that real production chat/timeline validation requires POSTGRES_DSN pointing to PostgreSQL with vector installed, REDIS_URL when Redis-backed checks are used, and either DASHSCOPE_API_KEY or STEP_API_KEY according to LLM_PROVIDER. Missing external services are degraded/skipped, not successful production E2E.

- [ ] Step 2: Verify documentation and environment safety

    rg -n "DASHSCOPE_API_KEY|STEP_API_KEY|POSTGRES_DSN|REDIS_URL|/api/health|uvicorn|pnpm" docs/handoff.md backend/.env.example
    git diff --check
Expected: required names and commands are present, no whitespace errors, and no backend/.env is staged.

### Task 4: Run the full verification matrix

Files:
- Modify: none

Interfaces:
- Consumes: Tasks 1-3.
- Produces: evidence for backend unit tests, frontend contract/build, and optional real-dependency checks.

- [ ] Step 1: Run backend unit tests

From backend:
    python -m unittest discover -s tests -p "test_*.py" -v
Record skips caused by missing POSTGRES_DSN, REDIS_URL, or provider keys separately from failures.

- [ ] Step 2: Run frontend contract and build checks

From frontend using the bundled Node executable if npm/pnpm is not on PATH:
    <bundled-node> tests/contract.test.mjs
    <bundled-node> node_modules/typescript/bin/tsc
    <bundled-node> node_modules/vite/bin/vite.js build
Expected: contract test prints frontend contract passed, TypeScript exits 0, and Vite exits 0.

- [ ] Step 3: Run optional production smoke only when dependencies are configured

    LIFE_STEWARD_E2E=1 python -m unittest tests.test_e2e_production_smoke -v
If required services or keys are absent, report the exact missing variables/services instead of forcing this command.

- [ ] Step 4: Inspect final repository state

    git status --short --branch
    git diff --check
    rg -n "^(<<<<<<<|=======|>>>>>>>)" . --glob '!**/node_modules/**' --glob '!**/dist/**'
Expected: no conflict markers, no staged secrets, and only intentional tracked changes plus the user's pre-existing untracked documents.


# Day5 Database Demo Setup

This document is the reproducible database checklist for the LifeSteward web demo. Keep real secrets only in `backend/.env`; do not commit that file.

## 1. Local Environment

From the repository root:

```powershell
cd D:\Codex\黑客松
python -m pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
```

Edit `backend\.env` locally:

```dotenv
POSTGRES_DSN=postgresql://USER:PASSWORD@HOST:5432/lifesteward
DASHSCOPE_API_KEY=your_local_key
EMBEDDING_MODEL_NAME=text-embedding-v3
```

`POSTGRES_DSN` must point to PostgreSQL with pgvector available. `DASHSCOPE_API_KEY` is required for the real embedding evidence; fixed test vectors are not valid Day5 demo proof.

## 2. Migration

From the backend directory:

```powershell
cd D:\Codex\黑客松\backend
python -c "from pathlib import Path; from core.database import DatabaseClient; client = DatabaseClient.from_environment(); client.execute_script(Path('migrations/001_initial_memory_schema.sql').read_text(encoding='utf-8')); print(client.health_check())"
```

Expected health check:

```text
connected=True
vector_extension_available=True
```

The migration creates these tables:

- `life_events`
- `memories`
- `user_profile`
- `goals`
- `plans`
- `feedbacks`
- `reflections`

## 3. Test Commands

Database gate:

```powershell
cd D:\Codex\黑客松\backend
python -m unittest tests.test_database_integration -v
```

Day5 target: all five database integration tests run and pass. They must not skip because of missing `POSTGRES_DSN`; the vector test must use `DASHSCOPE_API_KEY` to create real embeddings.

Full backend gate:

```powershell
cd D:\Codex\黑客松\backend
python -m unittest discover -s tests -p "test_*.py" -v
```

Only explicitly environment-dependent Redis checks may skip if `REDIS_URL` is not configured.

## 4. Web Demo Data

Use the formal chat endpoint, not direct SQL inserts, to create demo data for `user_id=10001`:

```powershell
cd D:\Codex\黑客松\backend
python -m uvicorn main:app --reload
```

Then post these three messages to `POST /api/v1/chat` with `user_id=10001` and a stable demo `conversation_id`:

- 最近三天每天只睡5小时。
- 最近学习效率很差。
- 压力比较大。

After writing, verify through Tool or API flow that:

- `life_events` contains the three records for `user_id=10001`.
- `memories.embedding` is not null for the same user.
- Searching `最近为什么学习效率下降？` returns a row containing `memory_id`, `memory_content`, and `similarity_score`.

## 5. Safe Cleanup

Only delete demo data for `user_id=10001`. Never truncate tables or clear the whole database.

```sql
DELETE FROM memories
WHERE user_id = '10001';

DELETE FROM life_events
WHERE user_id = '10001';

DELETE FROM user_profile
WHERE user_id = '10001';

DELETE FROM plans
WHERE user_id = '10001';

DELETE FROM goals
WHERE user_id = '10001';

DELETE FROM feedbacks
WHERE user_id = '10001';

DELETE FROM reflections
WHERE user_id = '10001';
```

## 6. Handoff to Member 3

Share only sanitized values:

- DSN status: configured / unavailable, never the password.
- Migration status: executed successfully or exact failure class.
- Embedding model and dimension, not the embedding vector.
- Tool sample fields: `life_event_id`, `event_type`, `event_content`, `event_time`, `emotion`, `importance_score`, `memory_id`, `memory_content`, `similarity_score`.

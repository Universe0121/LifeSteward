# Database Schema

Day3 freezes the persistence layer around PostgreSQL + pgvector.

## Active tables

### `life_events`
- `id`: bigserial primary key
- `user_id`: text, required
- `conversation_id`: text
- `event_type`: text, required
- `event_content`: text, required
- `event_time`: timestamptz
- `emotion`: text
- `importance_score`: double precision
- `source`: text
- `source_text`: text
- `created_at`: timestamptz, default `now()`

### `memories`
- `id`: bigserial primary key
- `user_id`: text, required
- `memory_type`: text, required
- `memory_content`: text, required
- `embedding`: `vector`
- `source_event_id`: bigint, optional
- `metadata`: jsonb
- `created_at`: timestamptz, default `now()`

## Supporting tables

- `user_profile`
- `goals`
- `plans`
- `feedbacks`
- `reflections`

These are frozen in the initial migration so later agents can extend them without changing the schema contract.

## Migration rule

- Any future field change must add a new migration.
- No manual database edits without updating this document.

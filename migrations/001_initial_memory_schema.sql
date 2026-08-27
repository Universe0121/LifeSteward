CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS life_events (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL DEFAULT '',
    event_type TEXT NOT NULL,
    event_content TEXT NOT NULL,
    event_time TIMESTAMPTZ NULL,
    emotion TEXT NOT NULL DEFAULT '',
    importance_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'text',
    source_text TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS life_events_user_created_at_idx
    ON life_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS life_events_user_event_time_idx
    ON life_events (user_id, event_time DESC);

CREATE TABLE IF NOT EXISTS memories (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    memory_type TEXT NOT NULL DEFAULT 'habit',
    memory_content TEXT NOT NULL,
    embedding vector,
    source_event_id BIGINT NULL REFERENCES life_events(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS memories_user_created_at_idx
    ON memories (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_profile (
    user_id TEXT PRIMARY KEY,
    profile_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goals (
    goal_id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    goal_title TEXT NOT NULL,
    goal_description TEXT NOT NULL DEFAULT '',
    deadline DATE NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS goals_user_id_idx
    ON goals (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS plans (
    plan_id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    goal_id BIGINT NULL REFERENCES goals(goal_id) ON DELETE SET NULL,
    plan_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS plans_user_id_idx
    ON plans (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS feedbacks (
    feedback_id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    feedback_type TEXT NOT NULL DEFAULT 'general',
    feedback_content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feedbacks_user_id_idx
    ON feedbacks (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reflections (
    reflection_id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    analysis_period INTEGER NOT NULL DEFAULT 7,
    reflection_result JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reflections_user_id_idx
    ON reflections (user_id, created_at DESC);

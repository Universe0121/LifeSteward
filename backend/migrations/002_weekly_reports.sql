CREATE TABLE IF NOT EXISTS weekly_reports (
    report_id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    report_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    poster_svg TEXT NOT NULL DEFAULT '',
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT weekly_reports_user_id_week_start_key UNIQUE (user_id, week_start)
);

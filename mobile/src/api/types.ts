export type ChatRequest = {
  user_id: number;
  conversation_id: string;
  user_input: string;
  conversation_history?: ChatHistoryItem[];
};

export type ChatHistoryItem = {
  role: 'user' | 'assistant';
  content: string;
};

export type ChatResponse = {
  assistant_response: string;
  intent: string;
  extracted_events: Array<Record<string, unknown>>;
  retrieved_memories?: Array<Record<string, unknown>>;
  reflection_result?: Record<string, unknown>;
  generated_plan?: Array<Record<string, unknown>>;
};

export type LifeEvent = {
  life_event_id: number;
  user_id: string;
  conversation_id: string;
  event_type: string;
  event_content: string;
  event_time: string | null;
  emotion: string;
  importance_score: number;
  source: string;
  source_text: string;
  created_at: string;
};

export type LifeEventsResponse = {
  items: LifeEvent[];
  count: number;
};

export type SpeechTranscriptionResponse = {
  text: string;
  language: string;
  duration_ms: number;
};

export type WeeklyReportData = {
  overview?: {
    title?: string;
    theme?: string;
    summary?: string;
    week_start?: string;
    week_end?: string;
  };
  activity_analysis?: {
    total_events?: number;
    category_distribution?: Array<{
      category?: string;
      category_label?: string;
      count?: number;
      share?: number;
    }>;
  };
  section_reviews?: Array<{
    title?: string;
    summary?: string;
    points?: string[];
  }>;
  highlights?: Array<{
    title?: string;
    summary?: string;
    evidence?: string[];
  }>;
  completion?: {
    completed?: string[];
    unfinished?: string[];
    completion_rate?: number;
  };
  next_week_suggestions?: string[];
  summary?: string;
  stats?: Record<string, unknown>;
  suggestions?: string[];
};

export type WeeklyReportRecord = {
  report_id: number;
  user_id: string;
  week_start: string;
  week_end: string;
  report_data: WeeklyReportData;
  poster_url: string;
  generated_at: string;
};

export type WeeklyReportListResponse = {
  items: WeeklyReportRecord[];
  count: number;
};

export type WeeklyReportGenerateRequest = {
  user_id: number | string;
  week_start?: string;
  timezone?: string;
};

export type HealthReadyResponse = {
  status: 'ready' | 'not_ready' | string;
  service: string;
  checks: {
    database?: {
      connected?: boolean;
      pgvector?: boolean;
      migrations?: boolean;
      missing_tables?: string[];
    };
    redis?: { connected?: boolean };
    configuration?: {
      llm_configured?: boolean;
      speech_to_text_configured?: boolean;
    };
    application?: { composition_root?: boolean };
  };
};

export type HealthLiveResponse = {
  status: 'ok' | string;
  service: string;
};

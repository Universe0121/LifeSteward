export type ChatRequest = {
  user_id: number;
  conversation_id: string;
  user_input: string;
};

export type ChatResponse = {
  assistant_response: string;
  intent: string;
  extracted_events: Array<Record<string, unknown>>;
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

export type WeeklyReportRecord = {
  report_id: number;
  user_id: string;
  week_start: string;
  week_end: string;
  report_data: Record<string, unknown>;
  poster_url: string;
  generated_at: string;
};

export type WeeklyReportsResponse = {
  items: WeeklyReportRecord[];
  count: number;
};

const api_base = import.meta.env.VITE_API_BASE || "/api";

async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeout_ms = 8000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout_ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

export async function postChat(chat_request: ChatRequest): Promise<ChatResponse> {
  const response = await fetch(`${api_base}/v1/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(chat_request),
  });

  if (!response.ok) {
    throw new Error(`chat request failed: ${response.status}`);
  }

  return response.json() as Promise<ChatResponse>;
}

export async function getLifeEvents(
  user_id: number | string,
  days = 7,
): Promise<LifeEventsResponse> {
  const search = new URLSearchParams({ user_id: String(user_id), days: String(days) });
  const response = await fetch(`${api_base}/v1/life-events?${search}`);

  if (!response.ok) {
    throw new Error(`life-events request failed: ${response.status}`);
  }

  return response.json() as Promise<LifeEventsResponse>;
}

export async function getWeeklyReports(
  user_id: number | string,
  limit = 10,
): Promise<WeeklyReportsResponse> {
  const search = new URLSearchParams({ user_id: String(user_id), limit: String(limit) });
  const response = await fetchWithTimeout(`${api_base}/v1/weekly-reports?${search}`);

  if (!response.ok) {
    throw new Error(`weekly reports request failed: ${response.status}`);
  }

  return response.json() as Promise<WeeklyReportsResponse>;
}

export async function generateWeeklyReport(
  user_id: number | string,
  week_start?: string,
): Promise<WeeklyReportRecord> {
  const response = await fetchWithTimeout(`${api_base}/v1/weekly-reports/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id,
      ...(week_start ? { week_start } : {}),
      timezone: "Asia/Shanghai",
    }),
  });

  if (!response.ok) {
    throw new Error(`weekly report generation failed: ${response.status}`);
  }

  return response.json() as Promise<WeeklyReportRecord>;
}

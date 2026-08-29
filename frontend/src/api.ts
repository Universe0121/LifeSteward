export type ChatHistoryItem = { role: "user" | "assistant"; content: string };

export type ChatRequest = {
  user_id: number;
  conversation_id: string;
  user_input: string;
  conversation_history?: ChatHistoryItem[];
};

export type ChatResponse = {
  assistant_response: string;
  intent: string;
  extracted_events: Array<Record<string, unknown>>;
  retrieved_memories?: Array<Record<string, unknown>>;
  reflection_result?: Record<string, unknown>;
  generated_plan?: Array<Record<string, unknown>>;
};

export type SpeechTranscriptionResponse = {
  text: string;
  language: string;
  duration_ms: number;
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

export type LifeEventsResponse = { items: LifeEvent[]; count: number };

export type WeeklyReportRecord = {
  report_id: number;
  user_id: string;
  week_start: string;
  week_end: string;
  report_data: Record<string, unknown>;
  poster_url: string;
  generated_at: string;
};

export type WeeklyReportsResponse = { items: WeeklyReportRecord[]; count: number };

export class ApiClientError extends Error {
  status: number;
  error_code?: string;

  constructor(message: string, status: number, error_code?: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.error_code = error_code;
  }
}

const api_base = String(import.meta.env.VITE_API_BASE || "/api").replace(/\/+$/, "");
const unsafe_error_patterns = [/traceback/i, /stack\s*trace/i, /psycopg|postgres|redis|sqlalchemy/i, /password|secret|api[_ -]?key|bearer/i, /[A-Za-z]:\\|\/(?:home|usr|var|opt|app)\//i, /<!doctype|<html/i];

export function resolve_api_url(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/api/")) {
    if (/^https?:\/\//i.test(api_base)) {
      return `${new URL(api_base).origin}${path}`;
    }
    return path;
  }
  return `${api_base}/${path.replace(/^\/+/, "")}`;
}

function safe_message(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const message = value.trim();
  return message && message.length <= 240 && !unsafe_error_patterns.some((pattern) => pattern.test(message)) ? message : fallback;
}

async function read_payload(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    if (!text.trim()) return null;
    try { return JSON.parse(text) as unknown; } catch { return text; }
  } catch {
    return null;
  }
}

async function fetch_with_timeout(input: string, init: RequestInit = {}, timeout_ms = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout_ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

async function request_json<T>(path: string, init: RequestInit = {}, timeout_ms = 8000): Promise<T> {
  let response: Response;
  try {
    response = await fetch_with_timeout(resolve_api_url(path), init, timeout_ms);
  } catch {
    throw new ApiClientError("网络连接失败，请检查后端服务和网络。", 0, "NETWORK_ERROR");
  }
  const payload = await read_payload(response);
  if (!response.ok) {
    const candidate = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    const fallback = `请求失败（${response.status}）`;
    const message = safe_message(candidate.message ?? candidate.detail, fallback);
    const error_code = typeof candidate.error_code === "string" ? candidate.error_code : undefined;
    throw new ApiClientError(message, response.status, error_code);
  }
  return payload as T;
}

export async function postChat(chat_request: ChatRequest): Promise<ChatResponse> {
  return request_json<ChatResponse>("/v1/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(chat_request),
  });
}

export async function getLifeEvents(user_id: number | string, days = 7): Promise<LifeEventsResponse> {
  const search = new URLSearchParams({ user_id: String(user_id), days: String(Math.max(1, Math.min(30, Math.trunc(days)))) });
  return request_json<LifeEventsResponse>(`/v1/life-events?${search}`);
}

export async function getWeeklyReports(user_id: number | string, limit = 10): Promise<WeeklyReportsResponse> {
  const search = new URLSearchParams({ user_id: String(user_id), limit: String(Math.max(1, Math.min(100, Math.trunc(limit)))) });
  return request_json<WeeklyReportsResponse>(`/v1/weekly-reports?${search}`);
}

export async function generateWeeklyReport(user_id: number | string, week_start?: string): Promise<WeeklyReportRecord> {
  return request_json<WeeklyReportRecord>("/v1/weekly-reports/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id, ...(week_start ? { week_start } : {}), timezone: "Asia/Shanghai" }),
  });
}

export async function transcribeAudio(
  audio: Blob,
  user_id: number | string,
  filename = "recording.webm",
  language = "zh-CN",
): Promise<SpeechTranscriptionResponse> {
  const form_data = new FormData();
  form_data.append("audio", audio, filename);
  form_data.append("user_id", String(user_id));
  form_data.append("language", language);
  return request_json<SpeechTranscriptionResponse>("/v1/speech-to-text", {
    method: "POST",
    body: form_data,
  }, 65_000);
}

export function getWeeklyPosterUrl(report: WeeklyReportRecord): string {
  return resolve_api_url(report.poster_url || `/v1/weekly-reports/${report.report_id}/poster`);
}

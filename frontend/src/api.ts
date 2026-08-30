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

export type HealthReadyResponse = {
  status: "ready" | "not_ready" | string;
  service: string;
  checks?: Record<string, unknown>;
};

export type HealthLiveResponse = {
  status: "ok" | string;
  service: string;
};

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

function normalize_api_base(value: unknown): string {
  const configured = typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
  if (!configured || configured === "/") return "/api";
  if (/^https?:\/\//i.test(configured)) {
    try {
      const parsed = new URL(configured);
      const path = parsed.pathname.replace(/\/+$/, "");
      if (!/\/api$/i.test(path)) parsed.pathname = `${path}/api`.replace(/^\/\/+/, "/");
      return parsed.toString().replace(/\/+$/, "");
    } catch {
      return "/api";
    }
  }
  return /\/api$/i.test(configured) ? configured : `${configured}/api`;
}

const api_base = normalize_api_base(import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE);
const unsafe_error_patterns = [/traceback/i, /stack\s*trace/i, /psycopg|postgres|redis|sqlalchemy/i, /password|secret|api[_ -]?key|bearer/i, /[A-Za-z]:\\|\/(?:home|usr|var|opt|app)\//i, /<!doctype|<html/i];
const retry_delays_ms = [250, 750];

export function resolve_api_url(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/health/")) {
    if (/^https?:\/\//i.test(api_base)) return `${new URL(api_base).origin}${path}`;
    return path;
  }
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
  let timed_out = false;
  const timer = globalThis.setTimeout(() => { timed_out = true; controller.abort(); }, timeout_ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timed_out) throw new ApiClientError("请求超时，请检查后端服务和网络。", 0, "REQUEST_TIMEOUT");
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

function should_retry_status(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function sleep(delay_ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, delay_ms));
}

function safe_error_code(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Z0-9_]{1,64}$/.test(value) ? value : undefined;
}

function response_error(payload: unknown, status: number): ApiClientError {
  const candidate = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const nested = candidate.detail && typeof candidate.detail === "object" ? candidate.detail as Record<string, unknown> : {};
  const fallback = `请求失败（${status}）`;
  const message = safe_message(candidate.message ?? candidate.detail ?? nested.message, fallback);
  return new ApiClientError(message, status, safe_error_code(candidate.error_code ?? nested.error_code));
}

export async function request_json<T>(path: string, init: RequestInit = {}, timeout_ms = 8000, retryable = false): Promise<T> {
  const request_url = resolve_api_url(path);
  const attempts = retryable ? retry_delays_ms.length + 1 : 1;
  let last_error: ApiClientError | null = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch_with_timeout(request_url, init, timeout_ms);
      const payload = await read_payload(response);
      if (!response.ok) {
        const error = response_error(payload, response.status);
        if (retryable && attempt < attempts - 1 && should_retry_status(error.status)) {
          last_error = error;
          await sleep(retry_delays_ms[attempt]);
          continue;
        }
        throw error;
      }
      return payload as T;
    } catch (error) {
      const normalized = error instanceof ApiClientError
        ? error
        : new ApiClientError("网络连接失败，请检查后端服务和网络。", 0, "NETWORK_ERROR");
      if (retryable && attempt < attempts - 1 && (normalized.status === 0 || should_retry_status(normalized.status))) {
        last_error = normalized;
        await sleep(retry_delays_ms[attempt]);
        continue;
      }
      throw normalized;
    }
  }
  throw last_error ?? new ApiClientError("请求失败，请稍后重试。", 0, "NETWORK_ERROR");
}

export function user_facing_api_error(error: unknown, fallback: string): string {
  if (!(error instanceof ApiClientError)) return fallback;
  if (error.error_code === "REQUEST_TIMEOUT") return "请求超时，AI 可能正在处理中，请稍后重试。";
  if (error.status === 502 || error.status === 504) return "公网隧道暂时不可用，请稍后重试。";
  if (error.status === 503) return "后端暂未就绪或公网隧道已断开，请稍后重试。";
  if (error.status === 0) return "网络连接失败，请检查后端服务和公网地址。";
  return error.message || fallback;
}

export async function postChat(chat_request: ChatRequest): Promise<ChatResponse> {
  return request_json<ChatResponse>("/v1/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(chat_request),
  }, 90_000);
}

export async function getLifeEvents(user_id: number | string, days = 7): Promise<LifeEventsResponse> {
  const search = new URLSearchParams({ user_id: String(user_id), days: String(Math.max(1, Math.min(30, Math.trunc(days)))) });
  return request_json<LifeEventsResponse>(`/v1/life-events?${search}`, {}, 8000, true);
}

export async function getWeeklyReports(user_id: number | string, limit = 10): Promise<WeeklyReportsResponse> {
  const search = new URLSearchParams({ user_id: String(user_id), limit: String(Math.max(1, Math.min(100, Math.trunc(limit)))) });
  return request_json<WeeklyReportsResponse>(`/v1/weekly-reports?${search}`, {}, 8000, true);
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

export async function getHealthReady(): Promise<HealthReadyResponse> {
  return request_json<HealthReadyResponse>("/health/ready", {}, 8000, true);
}

export async function getHealthLive(): Promise<HealthLiveResponse> {
  return request_json<HealthLiveResponse>("/health/live", {}, 5000, true);
}

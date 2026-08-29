import type {
  ChatRequest,
  ChatResponse,
  LifeEventsResponse,
  SpeechTranscriptionResponse,
  WeeklyReportGenerateRequest,
  WeeklyReportListResponse,
  WeeklyReportRecord,
} from './types';

const default_request_timeout_ms = 30_000;
const speech_request_timeout_ms = 65_000;

export class ApiClientError extends Error {
  readonly status: number;
  readonly error_code?: string;

  constructor(message: string, status: number, error_code?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.error_code = error_code;
  }
}

type FetchLike = typeof fetch;

export type ApiClient = {
  postChat(request: ChatRequest): Promise<ChatResponse>;
  getLifeEvents(user_id: number | string, days?: number): Promise<LifeEventsResponse>;
  transcribeAudio(uri: string, user_id: number, language?: string): Promise<SpeechTranscriptionResponse>;
  listWeeklyReports(user_id: number | string, limit?: number): Promise<WeeklyReportListResponse>;
  generateWeeklyReport(request: WeeklyReportGenerateRequest): Promise<WeeklyReportRecord>;
  getWeeklyPosterUri(report_id: number, poster_url?: string): string;
  getWeeklyPosterSvg(report_id: number, poster_url?: string): Promise<string>;
};

type Options = {
  api_base_url?: string;
  fetch_impl?: FetchLike;
  request_timeout_ms?: number;
  speech_timeout_ms?: number;
};

function clean_base_url(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  return trimmed.replace(/\/api(?:\/v\d+)?$/i, '');
}

function is_absolute_url(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function resolve_api_url(value: string, api_base_url: string): string {
  if (is_absolute_url(value)) return value;
  const base_url = clean_base_url(api_base_url);
  if (!base_url) {
    throw new ApiClientError('尚未配置后端地址，请设置 EXPO_PUBLIC_API_BASE_URL。', 0, 'API_NOT_CONFIGURED');
  }
  return `${base_url}/${value.replace(/^\/+/, '')}`;
}

function safe_timeout(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value as number) > 0 ? Math.floor(value as number) : fallback;
}

const unsafe_error_patterns = [
  /traceback/i,
  /stack\s*trace/i,
  /\b(?:exception|psycopg|sqlalchemy|postgres(?:ql)?|redis|uvicorn|fastapi)\b/i,
  /(?:password|passwd|secret|api[_ -]?key|authorization|bearer)/i,
  /(?:[a-z]:\\|\/(?:home|usr|var|opt|app)\/)/i,
  /<!doctype|<html/i,
];

export function sanitize_api_message(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const message = value.trim();
  if (!message || message.length > 240 || unsafe_error_patterns.some((pattern) => pattern.test(message))) return fallback;
  return message;
}

function safe_error_code(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^[A-Z0-9_]{1,64}$/.test(value)) return undefined;
  return value;
}

function payload_message(payload: unknown, fallback: string): { message: string; error_code?: string } {
  if (payload && typeof payload === 'object') {
    const data = payload as Record<string, unknown>;
    if (typeof data.message === 'string' && data.message.trim()) {
      return {
        message: sanitize_api_message(data.message, fallback),
        error_code: safe_error_code(data.error_code),
      };
    }
    if (typeof data.detail === 'string' && data.detail.trim()) {
      return { message: sanitize_api_message(data.detail, fallback) };
    }
    if (data.detail && typeof data.detail === 'object') {
      const detail = data.detail as Record<string, unknown>;
      if (typeof detail.message === 'string' && detail.message.trim()) {
        return { message: sanitize_api_message(detail.message, fallback) };
      }
    }
  }
  return { message: fallback };
}

async function read_response_payload(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    if (!text.trim()) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  } catch {
    return null;
  }
}

export function infer_audio_asset(uri: string): { extension: string; content_type: string } {
  let path = uri.split(/[?#]/, 1)[0].toLowerCase();
  try {
    path = decodeURIComponent(path);
  } catch {
    // Keep the raw URI and use the safe default when a file URI is malformed.
  }
  const match = path.match(/\.([a-z0-9]+)$/);
  const extension = match?.[1] ?? 'm4a';
  const content_types: Record<string, string> = {
    oga: 'audio/ogg',
    ogg: 'audio/ogg',
    m4a: 'audio/m4a',
    mp4: 'audio/mp4',
    mp3: 'audio/mpeg',
    pcm: 'audio/pcm',
    wav: 'audio/wav',
  };
  if (!content_types[extension]) return { extension: 'm4a', content_type: 'audio/m4a' };
  return { extension, content_type: content_types[extension] };
}

export function createApiClient(options: Options = {}): ApiClient {
  const api_base_url = clean_base_url(
    options.api_base_url ?? (typeof process === 'undefined' ? '' : process.env.EXPO_PUBLIC_API_BASE_URL ?? ''),
  );
  const fetch_impl = options.fetch_impl ?? fetch;
  const request_timeout_ms = safe_timeout(options.request_timeout_ms, default_request_timeout_ms);
  const speech_timeout_ms = safe_timeout(options.speech_timeout_ms, speech_request_timeout_ms);

  function url(path: string): string {
    return resolve_api_url(path, api_base_url);
  }

  async function request_json<T>(path: string, init: RequestInit = {}, timeout_ms = request_timeout_ms): Promise<T> {
    const request_url = url(path);
    const controller = typeof AbortController === 'undefined' ? null : new AbortController();
    let timed_out = false;
    const timeout_id = controller
      ? setTimeout(() => {
          timed_out = true;
          controller.abort();
        }, timeout_ms)
      : undefined;

    let response: Response;
    try {
      response = await fetch_impl(request_url, { ...init, ...(controller ? { signal: controller.signal } : {}) });
      if (timed_out) throw new ApiClientError('请求超时，请稍后重试。', 0, 'REQUEST_TIMEOUT');
    } catch (error) {
      if (error instanceof ApiClientError) throw error;
      if (timed_out) throw new ApiClientError('请求超时，请稍后重试。', 0, 'REQUEST_TIMEOUT');
      throw new ApiClientError('网络连接失败，请检查后端地址和网络。', 0, 'NETWORK_ERROR');
    } finally {
      if (timeout_id !== undefined) clearTimeout(timeout_id);
    }

    const payload = await read_response_payload(response);
    if (!response.ok) {
      const error = payload_message(payload, `请求失败（${response.status}）`);
      throw new ApiClientError(error.message, response.status, error.error_code);
    }
    return payload as T;
  }

  async function request_text(path: string, timeout_ms = request_timeout_ms): Promise<string> {
    const request_url = resolve_api_url(path, api_base_url);
    const controller = typeof AbortController === 'undefined' ? null : new AbortController();
    let timed_out = false;
    const timeout_id = controller
      ? setTimeout(() => {
          timed_out = true;
          controller.abort();
        }, timeout_ms)
      : undefined;
    let response: Response;
    try {
      response = await fetch_impl(request_url, {
        ...(controller ? { signal: controller.signal } : {}),
        headers: { Accept: 'image/svg+xml' },
      });
      if (timed_out) throw new ApiClientError('海报请求超时，请稍后重试。', 0, 'REQUEST_TIMEOUT');
    } catch (error) {
      if (error instanceof ApiClientError) throw error;
      if (timed_out) throw new ApiClientError('海报请求超时，请稍后重试。', 0, 'REQUEST_TIMEOUT');
      throw new ApiClientError('海报暂时无法加载，请稍后重试。', 0, 'NETWORK_ERROR');
    } finally {
      if (timeout_id !== undefined) clearTimeout(timeout_id);
    }

    const payload = await read_response_payload(response);
    if (!response.ok) {
      const error = payload_message(payload, `海报请求失败（${response.status}）`);
      throw new ApiClientError(error.message, response.status, error.error_code);
    }
    if (typeof payload !== 'string' || !/<svg[\s>]/i.test(payload)) {
      throw new ApiClientError('海报格式暂不支持，请稍后重试。', response.status, 'INVALID_POSTER');
    }
    return payload;
  }

  return {
    postChat: (request) => request_json<ChatResponse>('/api/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    }),
    getLifeEvents: (user_id, days = 7) => request_json<LifeEventsResponse>(
      `/api/v1/life-events?user_id=${encodeURIComponent(String(user_id))}&days=${Math.max(1, Math.min(30, Math.trunc(days)))}`,
    ),
    transcribeAudio: (uri, user_id, language = 'zh-CN') => {
      const asset = infer_audio_asset(uri);
      const form = new FormData();
      form.append('audio', {
        uri,
        name: `lifeagent-recording.${asset.extension}`,
        type: asset.content_type,
      } as unknown as Blob);
      form.append('user_id', String(user_id));
      form.append('language', language);
      return request_json<SpeechTranscriptionResponse>('/api/v1/speech-to-text', {
        method: 'POST',
        body: form,
      }, speech_timeout_ms);
    },
    listWeeklyReports: (user_id, limit = 10) => request_json<WeeklyReportListResponse>(
      `/api/v1/weekly-reports?user_id=${encodeURIComponent(String(user_id))}&limit=${Math.max(1, Math.min(100, Math.trunc(limit)))}`,
    ),
    generateWeeklyReport: (request) => request_json<WeeklyReportRecord>('/api/v1/weekly-reports/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    }),
    getWeeklyPosterUri: (report_id, poster_url) => poster_url
      ? resolve_api_url(poster_url, api_base_url)
      : url(`/api/v1/weekly-reports/${report_id}/poster`),
    getWeeklyPosterSvg: (report_id, poster_url) => request_text(
      poster_url ? resolve_api_url(poster_url, api_base_url) : `/api/v1/weekly-reports/${report_id}/poster`,
    ),
  };
}

export function is_mock_api_mode(): boolean {
  const mode = typeof process === 'undefined' ? '' : process.env.EXPO_PUBLIC_API_MODE ?? '';
  const base_url = typeof process === 'undefined' ? '' : process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
  return mode.trim().toLowerCase() === 'mock' || !base_url.trim();
}

export const real_api_client = createApiClient();

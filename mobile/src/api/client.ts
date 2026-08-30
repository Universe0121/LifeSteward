import type {
  ChatRequest,
  ChatResponse,
  HealthLiveResponse,
  HealthReadyResponse,
  LifeEventsResponse,
  SpeechTranscriptionResponse,
  WeeklyReportGenerateRequest,
  WeeklyReportListResponse,
  WeeklyReportRecord,
} from './types';
import { useEffect, useState } from 'react';

const default_request_timeout_ms = 30_000;
const speech_request_timeout_ms = 65_000;
const default_get_retry_count = 2;
const retry_delays_ms = [250, 750];
const default_demo_api_base_url = 'https://jill-lance-iso-its.trycloudflare.com';

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
  getHealthLive(): Promise<HealthLiveResponse>;
  getHealthReady(): Promise<HealthReadyResponse>;
};

type Options = {
  api_base_url?: string;
  fetch_impl?: FetchLike;
  request_timeout_ms?: number;
  speech_timeout_ms?: number;
  get_retry_count?: number;
};

function environment_value(name: string): string {
  if (typeof process === 'undefined') return '';
  // Expo inlines EXPO_PUBLIC_* variables only when the property access is
  // statically visible to the bundler. Keep this small switch instead of
  // dynamic process.env[name] access so release APKs receive the build URL.
  if (name === 'EXPO_PUBLIC_API_BASE_URL') return String(process.env.EXPO_PUBLIC_API_BASE_URL ?? '');
  if (name === 'EXPO_PUBLIC_API_MODE') return String(process.env.EXPO_PUBLIC_API_MODE ?? '');
  return '';
}

/** Normalize operator-entered URLs while keeping API paths stable. */
export function normalize_api_base_url(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) return '';
  try {
    const parsed = new URL(trimmed);
    if (!parsed.hostname) return '';
  } catch {
    return '';
  }
  return trimmed.replace(/\/api(?:\/v\d+)?$/i, '');
}

function clean_base_url(value: string): string {
  return normalize_api_base_url(value);
}

function is_absolute_url(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

let runtime_base_override: string | null | undefined;
let api_config_revision = 0;
const api_config_listeners = new Set<() => void>();

export function get_runtime_api_base_url(): string {
  if (runtime_base_override !== undefined) return runtime_base_override ?? '';
  return clean_base_url(environment_value('EXPO_PUBLIC_API_BASE_URL')) || default_demo_api_base_url;
}

export function set_runtime_api_base_url(value: string): boolean {
  const normalized = normalize_api_base_url(value);
  if (!normalized) return false;
  runtime_base_override = normalized;
  api_config_revision += 1;
  api_config_listeners.forEach((listener) => listener());
  return true;
}

export function clear_runtime_api_base_url(): void {
  runtime_base_override = undefined;
  api_config_revision += 1;
  api_config_listeners.forEach((listener) => listener());
}

export function subscribe_api_config(listener: () => void): () => void {
  api_config_listeners.add(listener);
  return () => api_config_listeners.delete(listener);
}

export function get_api_config_revision(): number {
  return api_config_revision;
}

export function use_api_config_revision(): number {
  const [revision, setRevision] = useState(api_config_revision);
  useEffect(() => subscribe_api_config(() => setRevision(api_config_revision)), []);
  return revision;
}

export function resolve_api_url(value: string, api_base_url: string): string {
  if (is_absolute_url(value)) return value;
  const base_url = clean_base_url(api_base_url);
  if (!base_url) {
    throw new ApiClientError('尚未配置后端地址（EXPO_PUBLIC_API_BASE_URL），请在定制页设置并测试连接。', 0, 'API_NOT_CONFIGURED');
  }
  if (value.startsWith('/api/')) return `${base_url}${value}`;
  return `${base_url}/${value.replace(/^\/+/, '')}`;
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
    const candidate = typeof data.message === 'string' ? data.message : data.detail;
    if (typeof candidate === 'string' && candidate.trim()) {
      return { message: sanitize_api_message(candidate, fallback), error_code: safe_error_code(data.error_code) };
    }
    if (data.detail && typeof data.detail === 'object') {
      const detail = data.detail as Record<string, unknown>;
      if (typeof detail.message === 'string' && detail.message.trim()) {
        return { message: sanitize_api_message(detail.message, fallback), error_code: safe_error_code(detail.error_code) };
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

function safe_timeout(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value as number) > 0 ? Math.floor(value as number) : fallback;
}

function safe_retry_count(value: number | undefined): number {
  return Number.isFinite(value) && (value as number) >= 0
    ? Math.min(3, Math.floor(value as number))
    : default_get_retry_count;
}

function should_retry_status(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function sleep(delay_ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delay_ms));
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
    webm: 'audio/webm',
  };
  if (!content_types[extension]) return { extension: 'm4a', content_type: 'audio/m4a' };
  return { extension, content_type: content_types[extension] };
}

export function user_facing_api_error(error: unknown, fallback: string): string {
  if (!(error instanceof ApiClientError)) return fallback;
  if (error.error_code === 'API_NOT_CONFIGURED') return '尚未配置后端地址（EXPO_PUBLIC_API_BASE_URL），请到定制页测试连接。';
  if (error.error_code === 'REQUEST_TIMEOUT') return '请求超时，AI 可能正在处理中，请稍后重试。';
  if (error.status === 0) return '网络连接失败，请检查后端服务和公网地址。';
  if (error.status === 502 || error.status === 504) return '公网隧道暂时不可用，请稍后重试。';
  if (error.status === 503) return '后端暂未就绪或公网隧道已断开，请稍后重试。';
  return error.message || fallback;
}

export function createApiClient(options: Options = {}): ApiClient {
  const api_base_url = clean_base_url(options.api_base_url ?? get_runtime_api_base_url());
  const fetch_impl = options.fetch_impl ?? fetch;
  const request_timeout_ms = safe_timeout(options.request_timeout_ms, default_request_timeout_ms);
  const speech_timeout_ms = safe_timeout(options.speech_timeout_ms, speech_request_timeout_ms);
  const get_retry_count = safe_retry_count(options.get_retry_count);

  function url(path: string): string {
    return resolve_api_url(path, api_base_url);
  }

  async function perform_request(
    request_url: string,
    init: RequestInit,
    timeout_ms: number,
  ): Promise<Response> {
    const controller = typeof AbortController === 'undefined' ? null : new AbortController();
    let timed_out = false;
    const timeout_id = controller
      ? setTimeout(() => {
          timed_out = true;
          controller.abort();
        }, timeout_ms)
      : undefined;
    try {
      const response = await fetch_impl(request_url, {
        ...init,
        ...(controller ? { signal: controller.signal } : {}),
      });
      if (timed_out) throw new ApiClientError('请求超时，请稍后重试。', 0, 'REQUEST_TIMEOUT');
      return response;
    } catch (error) {
      if (error instanceof ApiClientError) throw error;
      if (timed_out) throw new ApiClientError('请求超时，请稍后重试。', 0, 'REQUEST_TIMEOUT');
      throw new ApiClientError('网络连接失败，请检查后端地址和网络。', 0, 'NETWORK_ERROR');
    } finally {
      if (timeout_id !== undefined) clearTimeout(timeout_id);
    }
  }

  async function request_json<T>(
    path: string,
    init: RequestInit = {},
    timeout_ms = request_timeout_ms,
    retryable = false,
  ): Promise<T> {
    const request_url = url(path);
    const attempts = retryable ? get_retry_count + 1 : 1;
    let last_error: ApiClientError | null = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await perform_request(request_url, init, timeout_ms);
        const payload = await read_response_payload(response);
        if (!response.ok) {
          const parsed = payload_message(payload, `请求失败（${response.status}）`);
          const error = new ApiClientError(parsed.message, response.status, parsed.error_code);
          if (retryable && attempt < attempts - 1 && should_retry_status(response.status)) {
            last_error = error;
            await sleep(retry_delays_ms[Math.min(attempt, retry_delays_ms.length - 1)]);
            continue;
          }
          throw error;
        }
        return payload as T;
      } catch (error) {
        const normalized = error instanceof ApiClientError
          ? error
          : new ApiClientError('网络连接失败，请检查后端地址和网络。', 0, 'NETWORK_ERROR');
        if (retryable && attempt < attempts - 1 && (normalized.status === 0 || should_retry_status(normalized.status))) {
          last_error = normalized;
          await sleep(retry_delays_ms[Math.min(attempt, retry_delays_ms.length - 1)]);
          continue;
        }
        throw normalized;
      }
    }
    throw last_error ?? new ApiClientError('请求失败，请稍后重试。', 0, 'NETWORK_ERROR');
  }

  async function request_text(path: string, timeout_ms = request_timeout_ms): Promise<string> {
    const request_url = url(path);
    const attempts = get_retry_count + 1;
    let last_error: ApiClientError | null = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await perform_request(request_url, { headers: { Accept: 'image/svg+xml' } }, timeout_ms);
        const payload = await read_response_payload(response);
        if (!response.ok) {
          const parsed = payload_message(payload, `海报请求失败（${response.status}）`);
          const error = new ApiClientError(parsed.message, response.status, parsed.error_code);
          if (attempt < attempts - 1 && should_retry_status(response.status)) {
            last_error = error;
            await sleep(retry_delays_ms[Math.min(attempt, retry_delays_ms.length - 1)]);
            continue;
          }
          throw error;
        }
        if (typeof payload !== 'string' || !/<svg[\s>]/i.test(payload)) {
          throw new ApiClientError('海报格式暂不支持，请稍后重试。', response.status, 'INVALID_POSTER');
        }
        return payload;
      } catch (error) {
        const normalized = error instanceof ApiClientError
          ? error
          : new ApiClientError('海报暂时无法加载，请稍后重试。', 0, 'NETWORK_ERROR');
        if (attempt < attempts - 1 && (normalized.status === 0 || should_retry_status(normalized.status))) {
          last_error = normalized;
          await sleep(retry_delays_ms[Math.min(attempt, retry_delays_ms.length - 1)]);
          continue;
        }
        throw normalized;
      }
    }
    throw last_error ?? new ApiClientError('海报暂时无法加载，请稍后重试。', 0, 'NETWORK_ERROR');
  }

  return {
    postChat: (request) => request_json<ChatResponse>('/api/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    }, 90_000),
    getLifeEvents: (user_id, days = 7) => request_json<LifeEventsResponse>(
      `/api/v1/life-events?user_id=${encodeURIComponent(String(user_id))}&days=${Math.max(1, Math.min(30, Math.trunc(days)))}`,
      {},
      request_timeout_ms,
      true,
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
      {},
      request_timeout_ms,
      true,
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
    getHealthLive: () => request_json<HealthLiveResponse>('/health/live', {}, 5000, true),
    getHealthReady: () => request_json<HealthReadyResponse>('/health/ready', {}, request_timeout_ms, true),
  };
}

export function is_mock_api_mode(): boolean {
  if (runtime_base_override) return false;
  return environment_value('EXPO_PUBLIC_API_MODE').trim().toLowerCase() === 'mock';
}

export async function test_api_connection(api_base_url: string): Promise<HealthReadyResponse> {
  const client = createApiClient({ api_base_url, get_retry_count: 1 });
  return client.getHealthReady();
}

export const real_api_client = createApiClient();

import type { ChatRequest, ChatResponse, LifeEventsResponse, SpeechTranscriptionResponse, WeeklyReportGenerateRequest, WeeklyReportListResponse, WeeklyReportRecord } from './types';

export class ApiClientError extends Error {
  readonly status: number;
  readonly error_code?: string;
  constructor(message: string, status: number, error_code?: string) { super(message); this.name = 'ApiClientError'; this.status = status; this.error_code = error_code; }
}
type FetchLike = typeof fetch;
export type ApiClient = { postChat(request: ChatRequest): Promise<ChatResponse>; getLifeEvents(user_id: number | string, days?: number): Promise<LifeEventsResponse>; transcribeAudio(uri: string, user_id: number, language?: string): Promise<SpeechTranscriptionResponse>; listWeeklyReports(user_id: number | string, limit?: number): Promise<WeeklyReportListResponse>; generateWeeklyReport(request: WeeklyReportGenerateRequest): Promise<WeeklyReportRecord>; getWeeklyPosterUri(report_id: number): string };
type Options = { api_base_url?: string; fetch_impl?: FetchLike };
function clean_base_url(value: string) { return value.trim().replace(/\/+$/, '').replace(/\/api$/, ''); }
function payload_message(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object') { const data = payload as Record<string, unknown>; if (typeof data.message === 'string') return { message: data.message, error_code: typeof data.error_code === 'string' ? data.error_code : undefined }; if (typeof data.detail === 'string') return { message: data.detail }; if (data.detail && typeof data.detail === 'object' && typeof (data.detail as Record<string, unknown>).message === 'string') return { message: String((data.detail as Record<string, unknown>).message) }; }
  return { message: fallback };
}
export function createApiClient(options: Options = {}): ApiClient {
  const base_url = clean_base_url(options.api_base_url ?? process.env.EXPO_PUBLIC_API_BASE_URL ?? '');
  const fetch_impl = options.fetch_impl ?? fetch;
  function url(path: string) { if (!base_url) throw new ApiClientError('尚未配置后端地址，请设置 EXPO_PUBLIC_API_BASE_URL。', 0); return `${base_url}${path}`; }
  async function request_json<T>(path: string, init?: RequestInit): Promise<T> {
    const request_url = url(path);
    let response: Response;
    try { response = await fetch_impl(request_url, init); } catch { throw new ApiClientError('网络连接失败，请检查后端地址和网络。', 0); }
    let payload: unknown = null; try { payload = await response.json(); } catch { /* Use a safe message for non-JSON responses. */ }
    if (!response.ok) { const error = payload_message(payload, `请求失败（${response.status}）`); throw new ApiClientError(error.message, response.status, error.error_code); }
    return payload as T;
  }
  return {
    postChat: (request) => request_json<ChatResponse>('/api/v1/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) }),
    getLifeEvents: (user_id, days = 7) => request_json<LifeEventsResponse>(`/api/v1/life-events?user_id=${encodeURIComponent(String(user_id))}&days=${days}`),
    transcribeAudio: (uri, user_id, language = 'zh-CN') => { const extension = uri.split('?')[0].toLowerCase().endsWith('.webm') ? 'webm' : 'm4a'; const form = new FormData(); form.append('audio', { uri, name: `lifeagent-recording.${extension}`, type: extension === 'webm' ? 'audio/webm' : 'audio/m4a' } as unknown as Blob); form.append('user_id', String(user_id)); form.append('language', language); return request_json<SpeechTranscriptionResponse>('/api/v1/speech-to-text', { method: 'POST', body: form }); },
    listWeeklyReports: (user_id, limit = 10) => request_json<WeeklyReportListResponse>(`/api/v1/weekly-reports?user_id=${encodeURIComponent(String(user_id))}&limit=${limit}`),
    generateWeeklyReport: (request) => request_json<WeeklyReportRecord>('/api/v1/weekly-reports/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) }),
    getWeeklyPosterUri: (report_id) => url(`/api/v1/weekly-reports/${report_id}/poster`),
  };
}
export const real_api_client = createApiClient();

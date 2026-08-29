import type { ApiClient } from './client';
import type { ChatResponse, LifeEventsResponse, SpeechTranscriptionResponse, WeeklyReportListResponse } from './types';

const mock_events: LifeEventsResponse = { count: 3, items: [
  { life_event_id: 1, user_id: '10001', conversation_id: 'mock', event_type: 'study', event_content: '完成了数学复习', event_time: new Date().toISOString(), emotion: 'focused', importance_score: 0.8, source: 'mock', source_text: '完成了数学复习', created_at: new Date().toISOString() },
  { life_event_id: 2, user_id: '10001', conversation_id: 'mock', event_type: 'sleep', event_content: '昨晚睡了 7 小时', event_time: new Date(Date.now() - 86400000).toISOString(), emotion: 'calm', importance_score: 0.6, source: 'mock', source_text: '昨晚睡了 7 小时', created_at: new Date().toISOString() },
  { life_event_id: 3, user_id: '10001', conversation_id: 'mock', event_type: 'exercise', event_content: '散步 30 分钟', event_time: new Date(Date.now() - 172800000).toISOString(), emotion: 'relaxed', importance_score: 0.6, source: 'mock', source_text: '散步 30 分钟', created_at: new Date().toISOString() },
] };

const mock_reports: WeeklyReportListResponse = { count: 1, items: [{ report_id: 1, user_id: '10001', week_start: '2026-08-17', week_end: '2026-08-23', report_data: { overview: { title: '8 月 17 日至 23 日周报', theme: '学习 / 生活', summary: '这一周，你在记录中慢慢找回自己的节奏。' }, activity_analysis: { total_events: 12, category_distribution: [{ category_label: '学习', count: 6 }] }, highlights: [{ title: '保持专注', summary: '完成了几次稳定的学习记录。', evidence: ['完成了数学复习'] }], next_week_suggestions: ['继续保留学习和休息的完整记录。'] }, poster_url: '/api/v1/weekly-reports/1/poster', generated_at: new Date().toISOString() }] };

export const mock_api_client: ApiClient = {
  async postChat(): Promise<ChatResponse> { return { assistant_response: '已记录。你的节奏正在变得更清晰。', intent: 'record_event', extracted_events: [] }; },
  async getLifeEvents(): Promise<LifeEventsResponse> { return mock_events; },
  async transcribeAudio(): Promise<SpeechTranscriptionResponse> { return { text: '今天完成了一次专注学习', language: 'zh-CN', duration_ms: 2400 }; },
  async listWeeklyReports(): Promise<WeeklyReportListResponse> { return mock_reports; },
  getWeeklyPosterUri(report_id: number): string { return `https://dummyimage.com/1080x1080/edf4ef/173126.png&text=LifeAgent+Report+${report_id}`; },
};

import type { ApiClient } from './client';
import type {
  ChatRequest,
  ChatResponse,
  HealthLiveResponse,
  LifeEvent,
  LifeEventsResponse,
  SpeechTranscriptionResponse,
  WeeklyReportListResponse,
  WeeklyReportRecord,
  HealthReadyResponse,
} from './types';
import timeline_events from '../mocks/timeline_events.json';
import { is_plan_request, is_task_only_request, normalize_plan_items } from '../domain/planning';

type MockTimelineEvent = {
  event_type: string;
  event_content: string;
  event_time: string;
  emotion: string;
  importance_score: number;
};

function local_date_for_source(source_date: string, latest_source_date: string): Date {
  const source = new Date(`${source_date}T12:00:00`);
  const latest = new Date(`${latest_source_date}T12:00:00`);
  const day_offset = Math.round((latest.getTime() - source.getTime()) / 86_400_000);
  const target = new Date();
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() - day_offset);
  return target;
}

function build_mock_events(): LifeEvent[] {
  const source_dates = Object.keys(timeline_events).sort();
  const latest_source_date = source_dates[source_dates.length - 1] ?? '';
  let life_event_id = 1;
  return source_dates.flatMap((source_date) => {
    const target_date = local_date_for_source(source_date, latest_source_date);
    const entries = (timeline_events as Record<string, MockTimelineEvent[]>)[source_date] ?? [];
    return entries.map((entry) => {
      const time = entry.event_time.match(/^(\d{2}):(\d{2})$/);
      const event_date = new Date(target_date);
      event_date.setHours(time ? Number(time[1]) : 12, time ? Number(time[2]) : 0, 0, 0);
      const timestamp = event_date.toISOString();
      const event: LifeEvent = {
        life_event_id,
        user_id: '10001',
        conversation_id: 'mock',
        event_type: entry.event_type,
        event_content: entry.event_content,
        event_time: timestamp,
        emotion: entry.emotion,
        importance_score: entry.importance_score,
        source: 'mock',
        source_text: entry.event_content,
        created_at: timestamp,
      };
      life_event_id += 1;
      return event;
    });
  });
}

let mock_event_items = build_mock_events();

const mock_report: WeeklyReportRecord = {
  report_id: 1,
  user_id: '10001',
  week_start: '2026-08-17',
  week_end: '2026-08-23',
  report_data: {
    overview: {
      title: '8 月 17 日至 23 日周报',
      theme: '学习 / 生活',
      summary: '这一周，你在记录中慢慢找回自己的节奏。',
    },
    activity_analysis: {
      total_events: 12,
      category_distribution: [{ category: 'study', category_label: '学习', count: 6, share: 50 }],
    },
    highlights: [{ title: '保持专注', summary: '完成了几次稳定的学习记录。', evidence: ['完成了数学复习'] }],
    next_week_suggestions: ['继续保留学习和休息的完整记录。'],
  },
  poster_url: '/api/v1/weekly-reports/1/poster',
  generated_at: new Date().toISOString(),
};

function classify_event(text: string): string {
  if (/睡|作息|休息/.test(text)) return 'sleep';
  if (/跑|运动|散步|锻炼/.test(text)) return 'exercise';
  return 'study';
}

function build_mock_poster_svg(report_id: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080"><rect width="1080" height="1080" fill="#F6F8FC"/><rect x="48" y="48" width="984" height="984" rx="28" fill="#FFFFFF" stroke="#D0D5DD"/><text x="88" y="142" font-family="Arial,sans-serif" font-size="42" font-weight="700" fill="#101828">LifeAgent</text><text x="88" y="192" font-family="Arial,sans-serif" font-size="24" fill="#667085">WEEKLY REPORT</text><rect x="88" y="258" width="904" height="420" rx="24" fill="#E8EDFB"/><text x="540" y="430" text-anchor="middle" font-family="Arial,sans-serif" font-size="54" font-weight="700" fill="#252525">本周生活回顾</text><text x="540" y="486" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="#667085">记录让节奏变得清晰</text><circle cx="280" cy="800" r="74" fill="#252525"/><text x="280" y="815" text-anchor="middle" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="#FFFFFF">12</text><text x="280" y="930" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="#667085">本周记录</text><text x="820" y="815" text-anchor="middle" font-family="Arial,sans-serif" font-size="30" font-weight="700" fill="#252525">#${report_id}</text><text x="820" y="930" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="#667085">生活周报</text></svg>`;
}

export { build_mock_poster_svg };

export const mock_api_client: ApiClient = {
  async postChat(request: ChatRequest): Promise<ChatResponse> {
    const timestamp = new Date().toISOString();
    const event_content = request.user_input.trim();
    if (is_task_only_request(event_content)) {
      return {
        assistant_response: '已添加到任务清单，不设置具体时间。',
        intent: 'planning',
        extracted_events: [],
        generated_plan: [],
      };
    }
    if (is_plan_request(event_content)) {
      return {
        assistant_response: '计划已经整理好，具体时间会显示在今日计划里。',
        intent: 'planning',
        extracted_events: [],
        generated_plan: normalize_plan_items([
          { task_name: '专注完成今天最重要的一件事', start_time: '09:00', duration_minutes: 60, difficulty: 0.5 },
          { task_name: '安排一次休息和复盘', start_time: '18:30', duration_minutes: 30, difficulty: 0.3 },
        ]),
      };
    }
    const next_id = Math.max(0, ...mock_event_items.map((item) => item.life_event_id)) + 1;
    mock_event_items = [
      ...mock_event_items,
      {
        life_event_id: next_id,
        user_id: String(request.user_id),
        conversation_id: request.conversation_id,
        event_type: classify_event(event_content),
        event_content,
        event_time: timestamp,
        emotion: '',
        importance_score: 0.6,
        source: 'mock',
        source_text: event_content,
        created_at: timestamp,
      },
    ];
    return {
      assistant_response: '已记录。你的节奏正在变得更清晰。',
      intent: 'record_event',
      extracted_events: [{ event_content }],
    };
  },
  async getLifeEvents(user_id: number | string): Promise<LifeEventsResponse> {
    const items = mock_event_items.filter((item) => item.user_id === String(user_id));
    return { count: items.length, items };
  },
  async transcribeAudio(): Promise<SpeechTranscriptionResponse> {
    return { text: '今天完成了一次专注学习', language: 'zh-CN', duration_ms: 2400 };
  },
  async listWeeklyReports(): Promise<WeeklyReportListResponse> {
    return { count: 1, items: [mock_report] };
  },
  async generateWeeklyReport(): Promise<WeeklyReportRecord> {
    return { ...mock_report, generated_at: new Date().toISOString() };
  },
  getWeeklyPosterUri(report_id: number): string {
    return `mock://weekly-report/${report_id}`;
  },
  async getWeeklyPosterSvg(report_id: number): Promise<string> {
    return build_mock_poster_svg(report_id);
  },
  async getHealthReady(): Promise<HealthReadyResponse> {
    return {
      status: 'ready',
      service: 'lifeagent-backend',
      checks: {
        database: { connected: true, pgvector: true, migrations: true, missing_tables: [] },
        redis: { connected: true },
        configuration: { llm_configured: true, speech_to_text_configured: true },
        application: { composition_root: true },
      },
    };
  },
  async getHealthLive(): Promise<HealthLiveResponse> {
    return {
      status: 'ok',
      service: 'lifeagent-backend',
    };
  },
};

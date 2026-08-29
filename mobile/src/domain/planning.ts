import { add_days, local_date_key, parse_clock_minutes } from '../utils/date';

export type PlanItem = {
  task_name: string;
  start_time: string;
  duration_minutes: number;
  difficulty: number;
};

const plan_words = /(计划|安排|日程|时间表|学习规划|几点开始|时间安排)/;
const task_words = /(添加|新增|加上|安排一个|设一个|设置一个).{0,8}(任务|待办|提醒)|待办|提醒我/;

export function is_plan_request(value: string): boolean {
  return plan_words.test(value) && !is_task_only_request(value);
}

export function is_task_only_request(value: string): boolean {
  const text = value.trim();
  return task_words.test(text) && !plan_words.test(text);
}

export function has_explicit_clock(value: string): boolean {
  return /(上午|下午|早上|晚上|凌晨)?\s*\d{1,2}(?::|点)\s*\d{0,2}/.test(value);
}

export function requested_date_key(value: string, base_date: Date = new Date()): string {
  const today = local_date_key(base_date);
  if (/(后天)/.test(value)) return add_days(today, 2);
  if (/(明天|次日)/.test(value)) return add_days(today, 1);
  return today;
}

export function extract_task_name(value: string): string {
  let text = value.trim();
  text = text.replace(/^\s*(请|麻烦|帮我|请你)?\s*/, '');
  text = text.replace(/^(今天|明天|后天|次日)\s*(要|需要|记得|完成)?\s*/, '');
  text = text.replace(/^(添加|新增|加上|设置|安排)\s*(一项|一个|一条)?\s*(任务|待办|提醒)?\s*[:：,，]?\s*/i, '');
  text = text.replace(/^(任务|待办)\s*[:：]?\s*/, '');
  text = text.replace(/(，|,)?\s*(不用|无需|不需要)?\s*具体时间.*$/, '');
  return text.trim() || value.trim();
}

export function normalize_plan_items(value: unknown): PlanItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Record<string, unknown>;
    const task_name = typeof candidate.task_name === 'string' ? candidate.task_name.trim() : '';
    const start_time = typeof candidate.start_time === 'string' ? candidate.start_time.trim() : '';
    const duration_minutes = typeof candidate.duration_minutes === 'number'
      ? Math.trunc(candidate.duration_minutes)
      : Number(candidate.duration_minutes);
    const difficulty = typeof candidate.difficulty === 'number' ? candidate.difficulty : Number(candidate.difficulty);
    if (!task_name || parse_clock_minutes(start_time) === null || !Number.isFinite(duration_minutes) || duration_minutes <= 0) return [];
    return [{
      task_name,
      start_time,
      duration_minutes,
      difficulty: Number.isFinite(difficulty) ? Math.max(0, Math.min(1, difficulty)) : 0.5,
    }];
  });
}

export function plan_identity(item: Pick<PlanItem, 'task_name' | 'start_time' | 'duration_minutes'>, plan_date: string): string {
  return `${plan_date}|${item.start_time}|${item.duration_minutes}|${item.task_name.trim().toLowerCase()}`;
}

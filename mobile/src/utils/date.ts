export function local_date_key(value: Date = new Date()): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function date_from_key(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function add_days(value: string, amount: number): string {
  const date = date_from_key(value) ?? new Date();
  date.setDate(date.getDate() + amount);
  return local_date_key(date);
}

export function format_date_label(value: string, include_year = false): string {
  const date = date_from_key(value);
  if (!date) return '日期未选择';
  const label = `${date.getMonth() + 1}月${date.getDate()}日`;
  return include_year ? `${date.getFullYear()}年${label}` : label;
}

export function weekday_label(value: string): string {
  const date = date_from_key(value);
  if (!date) return '';
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
}

export function month_label(value: Date): string {
  return `${value.getFullYear()}年${value.getMonth() + 1}月`;
}

export function parse_clock_minutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function format_clock_minutes(value: number): string {
  const normalized = Math.max(0, Math.min(23 * 60 + 59, Math.round(value)));
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

export function plan_end_time(start_time: string, duration_minutes: number): string {
  const start = parse_clock_minutes(start_time);
  if (start === null) return start_time;
  return format_clock_minutes(start + Math.max(1, duration_minutes));
}

export function format_message_day(value: string): string {
  const date = date_from_key(value);
  if (!date) return value;
  const today = local_date_key();
  if (value === today) return '今天';
  if (value === add_days(today, -1)) return '昨天';
  return format_date_label(value, true);
}

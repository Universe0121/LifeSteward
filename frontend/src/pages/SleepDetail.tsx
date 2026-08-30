import { useMemo } from "react";
import { Link } from "react-router-dom";
import { local_date_key } from "../workspace";

type SleepRow = { date: string; hours: number; bed: string; wake: string };

function add_days(value: string, amount: number): string {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return local_date_key(date);
}

function date_label(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export default function SleepDetail() {
  const today = local_date_key();
  const rows = useMemo<SleepRow[]>(() => [
    { date: today, hours: 6.5, bed: "00:30", wake: "07:00" },
    { date: add_days(today, -1), hours: 7.2, bed: "23:50", wake: "07:02" },
    { date: add_days(today, -2), hours: 6.8, bed: "00:10", wake: "06:58" },
    { date: add_days(today, -3), hours: 7.6, bed: "23:25", wake: "07:01" },
    { date: add_days(today, -4), hours: 6.1, bed: "01:05", wake: "07:10" },
  ], [today]);
  const average = rows.reduce((sum, row) => sum + row.hours, 0) / rows.length;

  return <section className="content-page sleep-page">
    <header className="page-heading"><div><span className="eyebrow">模拟数据 · 后续可连接手环</span><h1>睡眠时间</h1></div><Link className="plain-icon-button" to="/" aria-label="返回首页">←</Link></header>
    <div className="sleep-hero"><span className="eyebrow light">SLEEP RHYTHM</span><h2>{average.toFixed(1)}<small> 小时</small></h2><p>近 5 天平均睡眠时长</p></div>
    <div className="section-title"><h2>每天的睡眠记录</h2><span className="eyebrow">模拟数据</span></div>
    <div className="sleep-chart">{rows.map((row, index) => <div className="sleep-chart-row" key={row.date}><span>{index === 0 ? "今天" : date_label(row.date)}</span><div className="sleep-track"><i style={{ width: `${Math.min(100, row.hours / 9 * 100)}%` }} /></div><strong>{row.hours.toFixed(1)}h</strong></div>)}</div>
    <div className="section-title"><h2>睡眠时段</h2></div>
    <div className="sleep-details">{rows.slice(0, 3).map((row) => <div className="sleep-detail-row" key={row.date}><div><strong>{date_label(row.date)}</strong><span>入睡 {row.bed} · 起床 {row.wake}</span></div><b>{row.hours.toFixed(1)}h</b></div>)}</div>
    <div className="sleep-analysis"><span className="eyebrow light">ANALYSIS</span><h2>分析与建议</h2><p>近几天平均睡眠低于 7 小时，入睡时间略有波动。今晚可以提前 20 分钟放下屏幕，为自己留出稳定的睡前缓冲。</p><ul><li>尽量在 23:30 前开始准备入睡</li><li>明天安排短任务，给精力留出余量</li></ul></div>
  </section>;
}

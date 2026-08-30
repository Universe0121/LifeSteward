import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useWorkspace } from '../state/WorkspaceContext';
import { add_days, format_date_label, local_date_key } from '../utils/date';

type SleepRow = { date: string; hours: number; bed: string; wake: string };

export default function SleepDetailScreen() {
  const { colors } = useWorkspace();
  const today = local_date_key();
  const rows = useMemo<SleepRow[]>(() => [
    { date: today, hours: 6.5, bed: '00:30', wake: '07:00' },
    { date: add_days(today, -1), hours: 7.2, bed: '23:50', wake: '07:02' },
    { date: add_days(today, -2), hours: 6.8, bed: '00:10', wake: '06:58' },
    { date: add_days(today, -3), hours: 7.6, bed: '23:25', wake: '07:01' },
    { date: add_days(today, -4), hours: 6.1, bed: '01:05', wake: '07:10' },
  ], [today]);
  const average = rows.reduce((sum, row) => sum + row.hours, 0) / rows.length;

  return <ScrollView style={{ backgroundColor: colors.canvas }} contentContainerStyle={styles.content}><View style={[styles.hero, { backgroundColor: colors.blue }]}><View style={styles.hero_top}><View><Text style={[styles.eyebrow, { color: colors.muted }]}>模拟数据 · 后续可连接手环</Text><Text style={[styles.title, { color: colors.ink }]}>睡眠时间</Text></View><MaterialCommunityIcons color={colors.ink} name="moon-waning-crescent" size={34} /></View><Text style={[styles.average, { color: colors.ink }]}>{average.toFixed(1)}<Text style={styles.average_unit}> 小时</Text></Text><Text style={[styles.copy, { color: colors.muted }]}>近 5 天平均睡眠时长</Text></View><Text style={[styles.section_title, { color: colors.ink }]}>每天的睡眠记录</Text><View style={[styles.chart, { backgroundColor: colors.paper, borderColor: colors.line }]}>{rows.map((row, index) => <View key={row.date} style={styles.chart_row}><Text style={[styles.date, { color: colors.muted }]}>{index === 0 ? '今天' : format_date_label(row.date)}</Text><View style={styles.bar_track}><View style={[styles.bar, { width: `${Math.min(100, row.hours / 9 * 100)}%`, backgroundColor: row.hours >= 7 ? colors.green : colors.blue_strong }]} /></View><Text style={[styles.hours, { color: colors.ink }]}>{row.hours.toFixed(1)}h</Text></View>)}</View><Text style={[styles.section_title, { color: colors.ink }]}>睡眠时段</Text><View style={[styles.detail_card, { backgroundColor: colors.paper, borderColor: colors.line }]}>{rows.slice(0, 3).map((row) => <View key={row.date} style={styles.detail_row}><View style={[styles.detail_icon, { backgroundColor: colors.blue }]}><MaterialCommunityIcons color={colors.ink} name="bed-outline" size={18} /></View><View style={styles.detail_copy}><Text style={[styles.detail_date, { color: colors.ink }]}>{format_date_label(row.date, true)}</Text><Text style={[styles.muted, { color: colors.muted }]}>入睡 {row.bed} · 起床 {row.wake}</Text></View><Text style={[styles.detail_hours, { color: colors.ink }]}>{row.hours.toFixed(1)}h</Text></View>)}</View><View style={[styles.analysis, { backgroundColor: colors.ink }]}><MaterialCommunityIcons color={colors.blue_strong} name="chart-line" size={24} /><Text style={[styles.analysis_title, { color: colors.paper }]}>分析与建议</Text><Text style={[styles.analysis_copy, { color: colors.muted }]}>近几天平均睡眠低于 7 小时，入睡时间也略有波动。今晚可以提前 20 分钟放下屏幕，为自己留出稳定的睡前缓冲。</Text><View style={styles.suggestion}><MaterialCommunityIcons color={colors.blue_strong} name="check-circle-outline" size={18} /><Text style={[styles.suggestion_text, { color: colors.paper }]}>尽量在 23:30 前开始准备入睡</Text></View><View style={styles.suggestion}><MaterialCommunityIcons color={colors.blue_strong} name="check-circle-outline" size={18} /><Text style={[styles.suggestion_text, { color: colors.paper }]}>明天安排短任务，给精力留出余量</Text></View></View></ScrollView>;
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 40 },
  hero: { padding: 23, borderRadius: 25, marginBottom: 25 },
  hero_top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eyebrow: { fontSize: 11, letterSpacing: 0.6, marginBottom: 6 },
  title: { fontSize: 26, fontWeight: '700' },
  average: { fontSize: 43, fontWeight: '800', marginTop: 24 },
  average_unit: { fontSize: 16, fontWeight: '600' },
  copy: { fontSize: 12, marginTop: 2 },
  section_title: { fontSize: 20, fontWeight: '700', marginBottom: 13, marginTop: 2 },
  chart: { padding: 16, borderWidth: 1, borderRadius: 18, marginBottom: 24, gap: 15 },
  chart_row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  date: { width: 44, fontSize: 11 },
  bar_track: { flex: 1, height: 14, borderRadius: 7, backgroundColor: '#EEF0F2', overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 7 },
  hours: { width: 36, textAlign: 'right', fontSize: 11, fontWeight: '700' },
  detail_card: { paddingHorizontal: 15, borderWidth: 1, borderRadius: 18, marginBottom: 24 },
  detail_row: { minHeight: 67, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#E9E9E6' },
  detail_icon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  detail_copy: { flex: 1, minWidth: 0, gap: 4 },
  detail_date: { fontSize: 13, fontWeight: '700' },
  muted: { fontSize: 11, lineHeight: 17 },
  detail_hours: { fontSize: 14, fontWeight: '800' },
  analysis: { padding: 20, borderRadius: 20 },
  analysis_title: { fontSize: 17, fontWeight: '700', marginTop: 10, marginBottom: 8 },
  analysis_copy: { fontSize: 13, lineHeight: 21 },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  suggestion_text: { flex: 1, minWidth: 0, fontSize: 12 },
});

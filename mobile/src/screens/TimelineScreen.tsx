import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api_client, type LifeEvent } from '../api';
import { colors, spacing } from '../theme';

const user_id = 10001;
const filters = [['all', '全部'], ['study', '学习'], ['exercise', '运动'], ['sleep', '作息']] as const;
type Filter = typeof filters[number][number];
const event_labels: Record<string, string> = { study: '学习', exercise: '运动', sleep: '作息', work: '工作' };

function event_date(event: LifeEvent): string { return new Date(event.event_time ?? event.created_at).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' }); }

export default function TimelineScreen() {
  const [days, setDays] = useState(7);
  const [event_filter, setEventFilter] = useState<Filter>('all');
  const [life_events, setLifeEvents] = useState<LifeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error_message, setErrorMessage] = useState('');
  const load_events = useCallback(async () => { setLoading(true); setErrorMessage(''); try { const response = await api_client.getLifeEvents(user_id, days); setLifeEvents(response.items); } catch { setErrorMessage('时间轴加载失败，请检查网络后重试。'); } finally { setLoading(false); } }, [days]);
  useEffect(() => { void load_events(); }, [load_events]);
  const filtered_events = useMemo(() => event_filter === 'all' ? life_events : life_events.filter((event) => event.event_type === event_filter), [event_filter, life_events]);

  return <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={load_events} tintColor={colors.primary} />}><View style={styles.heading}><View><Text style={styles.eyebrow}>回到生活现场</Text><Text style={styles.title}>个人时间轴</Text></View><MaterialCommunityIcons color={colors.primary} name="timeline-outline" size={30} /></View><View style={styles.segment}><Text style={styles.segment_label}>时间范围</Text>{([7, 30] as const).map((value) => <Pressable key={value} onPress={() => setDays(value)} style={[styles.segment_button, days === value && styles.segment_active]}><Text style={[styles.segment_text, days === value && styles.segment_active_text]}>{value} 天</Text></Pressable>)}</View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filter_row}>{filters.map(([value, label]) => <Pressable key={value} onPress={() => setEventFilter(value)} style={[styles.filter_button, event_filter === value && styles.filter_active]}><Text style={[styles.filter_text, event_filter === value && styles.filter_active_text]}>{label}</Text></Pressable>)}</ScrollView><Text style={styles.count}>{filtered_events.length} 条记录</Text>{loading && <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={styles.muted}>正在加载生活记录...</Text></View>}{!loading && error_message !== '' && <View style={styles.state}><MaterialCommunityIcons color={colors.danger} name="wifi-off" size={28} /><Text style={styles.error}>{error_message}</Text><Pressable onPress={load_events}><Text style={styles.link}>重新加载</Text></Pressable></View>}{!loading && !error_message && filtered_events.length === 0 && <View style={styles.state}><MaterialCommunityIcons color={colors.muted} name="notebook-outline" size={30} /><Text style={styles.empty_title}>这段时间还没有记录</Text><Text style={styles.muted}>去聊天页记录一个正在发生的片段。</Text></View>}{!loading && !error_message && filtered_events.map((event) => <View key={event.life_event_id} style={styles.event_card}><View style={styles.event_marker}><MaterialCommunityIcons color={colors.primary} name="leaf" size={15} /></View><View style={styles.event_copy}><View style={styles.event_meta}><Text style={styles.event_type}>{event_labels[event.event_type] ?? event.event_type}</Text><Text style={styles.muted}>{event_date(event)}</Text></View><Text style={styles.event_content}>{event.event_content}</Text><Text style={styles.muted}>{event.emotion || '未记录情绪'} · 重要程度 {(event.importance_score * 100).toFixed(0)}%</Text></View></View>)}</ScrollView>;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.lg, paddingBottom: 36, backgroundColor: colors.canvas },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  eyebrow: { color: colors.muted, fontSize: 11, letterSpacing: 0.7, marginBottom: 4 },
  title: { color: colors.ink, fontSize: 26, fontWeight: '700' },
  segment: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  segment_label: { color: colors.muted, fontSize: 13, marginRight: 'auto' },
  segment_button: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.paper },
  segment_active: { backgroundColor: colors.primary },
  segment_text: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  segment_active_text: { color: colors.paper },
  filter_row: { gap: spacing.sm, paddingBottom: spacing.md },
  filter_button: { paddingHorizontal: spacing.md, paddingVertical: 9, borderRadius: 18, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  filter_active: { backgroundColor: colors.ink, borderColor: colors.ink },
  filter_text: { color: colors.muted, fontSize: 13 },
  filter_active_text: { color: colors.paper },
  count: { color: colors.muted, fontSize: 12, marginBottom: spacing.sm },
  state: { minHeight: 170, backgroundColor: colors.paper, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  error: { color: colors.danger, textAlign: 'center', fontSize: 13 },
  link: { color: colors.primary, fontWeight: '700' },
  empty_title: { color: colors.ink, fontWeight: '700', fontSize: 16 },
  event_card: { flexDirection: 'row', backgroundColor: colors.paper, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.md },
  event_marker: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.soft, justifyContent: 'center', alignItems: 'center' },
  event_copy: { flex: 1, gap: 6 },
  event_meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  event_type: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  event_content: { color: colors.ink, fontSize: 15, lineHeight: 22, fontWeight: '600' },
});

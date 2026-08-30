import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api_client, is_mock_api_mode, use_api_config_revision, type LifeEvent } from '../api';
import { useAuth } from '../state/AuthContext';
import { useWorkspace } from '../state/WorkspaceContext';
import { add_days, date_from_key, format_date_label, local_date_key, month_label } from '../utils/date';

const query_days = 30;
const filters = [['all', '全部'], ['study', '学习'], ['exercise', '运动'], ['sleep', '作息']] as const;
type Filter = typeof filters[number][number];
const event_labels: Record<string, string> = { study: '学习', exercise: '运动', sleep: '作息', work: '工作', meal: '饮食', mood: '情绪' };

function parse_event_date(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalized = value.trim().replace(/^([0-9]{4}-[0-9]{2}-[0-9]{2})\s+([0-9]{2}:[0-9]{2})(?::([0-9]{2}))?$/, (_match, date, time, seconds) => `${date}T${time}:${seconds ?? '00'}`);
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function date_key(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function build_date_options(): string[] {
  const today = local_date_key();
  return Array.from({ length: 31 }, (_, index) => add_days(today, -(30 - index)));
}

function event_date(event: LifeEvent): string {
  const date = parse_event_date(event.event_time ?? event.created_at);
  return date ? date_key(date) : '';
}

function event_time(event: LifeEvent): string {
  const date = parse_event_date(event.event_time ?? event.created_at);
  return date ? date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '时间未记录';
}

function emotion_label(value: string | null | undefined): string {
  const normalized = value?.trim().toLocaleLowerCase();
  return !normalized || normalized === 'none' || normalized === 'null' ? '未记录情绪' : value!.trim();
}

function merge_date_options(current_dates: string[], events: LifeEvent[]): string[] {
  const all_dates = new Set([...current_dates, ...events.map(event_date).filter(Boolean)]);
  return [...all_dates].sort().slice(-31);
}

function build_month_grid(month_date: Date): string[] {
  const first_day = new Date(month_date.getFullYear(), month_date.getMonth(), 1);
  const grid_start = new Date(first_day);
  grid_start.setDate(first_day.getDate() - first_day.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(grid_start);
    date.setDate(grid_start.getDate() + index);
    return date_key(date);
  });
}

export default function TimelineScreen() {
  const navigation = useNavigation<any>();
  const { user_id } = useAuth();
  const { colors } = useWorkspace();
  const api_config_revision = use_api_config_revision();
  const today = local_date_key();
  const [dates, setDates] = useState(build_date_options);
  const [selected_date, setSelectedDate] = useState(today);
  const [filter, setFilter] = useState<Filter>('all');
  const [events, setEvents] = useState<LifeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [calendar_visible, setCalendarVisible] = useState(false);
  const [calendar_month, setCalendarMonth] = useState(() => new Date());

  const load_events = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api_client.getLifeEvents(user_id, query_days);
      setEvents(response.items);
      setDates((current_dates) => merge_date_options(current_dates, response.items));
      if (is_mock_api_mode() && response.items.length > 0) {
        const latest_date = response.items.map(event_date).filter(Boolean).sort().at(-1);
        if (latest_date) setSelectedDate((current_date) => response.items.some((item) => event_date(item) === current_date) ? current_date : latest_date);
      }
    } catch {
      setError('时间轴加载失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  }, [api_config_revision, user_id]);

  useEffect(() => {
    void load_events();
  }, [load_events]);

  const visible = useMemo(
    () => events.filter((event) => event_date(event) === selected_date && (filter === 'all' || event.event_type === filter)),
    [events, filter, selected_date],
  );
  const selected_label = selected_date ? format_date_label(selected_date, true) : '日期未选择';
  const month_dates = useMemo(() => build_month_grid(calendar_month), [calendar_month]);
  const event_date_set = useMemo(() => new Set(events.map(event_date)), [events]);

  function choose_date(value: string) {
    setSelectedDate(value);
    setDates((current) => current.includes(value) ? current : [...current, value].sort().slice(-31));
    setExpanded(null);
    setCalendarVisible(false);
  }

  function move_month(offset: number) {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function open_calendar() {
    const selected = date_from_key(selected_date);
    setCalendarMonth(selected ?? new Date());
    setCalendarVisible(true);
  }

  return <ScrollView style={{ backgroundColor: colors.canvas }} contentContainerStyle={[styles.content, { backgroundColor: colors.canvas }]} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load_events()} tintColor={colors.ink} />}>
      <View style={styles.heading}>
      <View><Text style={[styles.eyebrow, { color: colors.muted }]}>{selected_label}</Text><Text style={[styles.title, { color: colors.ink }]}>日历</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="打开大日历选择日期" onPress={open_calendar} hitSlop={8} style={styles.calendar_button}><MaterialCommunityIcons color={colors.ink} name="calendar-month-outline" size={26} /></Pressable>
    </View>
    <ScrollView horizontal nestedScrollEnabled directionalLockEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.date_strip}>
      {dates.map((date) => <Pressable accessibilityRole="button" accessibilityState={{ selected: date === selected_date }} accessibilityLabel={`选择${format_date_label(date, true)}`} key={date} onPress={() => choose_date(date)} style={[styles.date_button, date === selected_date && { backgroundColor: colors.ink }]}><Text style={[styles.date_week, { color: date === selected_date ? colors.muted : colors.muted }]}>{date === today ? '今天' : date.slice(5, 7) + '/'}</Text><Text style={[styles.date_text, { color: date === selected_date ? colors.paper : colors.ink }]}>{date.slice(-2)}</Text></Pressable>)}
    </ScrollView>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filter_row}>
      {filters.map(([value, label]) => <Pressable accessibilityRole="button" accessibilityState={{ selected: filter === value }} key={value} onPress={() => { setFilter(value); setExpanded(null); }} style={[styles.filter_button, { backgroundColor: colors.paper, borderColor: colors.line }, filter === value && { backgroundColor: colors.ink, borderColor: colors.ink }]}><Text style={[styles.filter_text, { color: filter === value ? colors.paper : colors.muted }]}>{label}</Text></Pressable>)}
    </ScrollView>
    <View style={styles.section_heading}><Text style={[styles.section_title, { color: colors.ink }]}>生活记录</Text><Text style={[styles.eyebrow, { color: colors.muted }]}>{visible.length} 条记录</Text></View>
    {loading && <View style={[styles.empty, { backgroundColor: colors.paper }]}><ActivityIndicator color={colors.ink} /><Text style={[styles.muted, { color: colors.muted }]}>正在加载生活记录...</Text></View>}
    {!loading && error !== '' && <View style={[styles.empty, { backgroundColor: colors.paper }]}><Text style={[styles.muted, { color: colors.muted }]}>{error}</Text><Pressable accessibilityRole="button" accessibilityLabel="重新加载生活记录" onPress={() => void load_events()}><Text style={[styles.link, { color: colors.ink }]}>重新加载</Text></Pressable></View>}
    {!loading && error === '' && visible.length === 0 && <View style={[styles.empty, { backgroundColor: colors.paper }]}><MaterialCommunityIcons color={colors.muted} name="notebook-outline" size={30} /><Text style={[styles.empty_title, { color: colors.ink }]}>这一天还没有记录</Text><Text style={[styles.muted, { color: colors.muted }]}>去聊天页记录一个正在发生的片段。</Text><Pressable accessibilityRole="button" accessibilityLabel="去聊天记录生活" onPress={() => navigation.navigate('聊天')}><Text style={[styles.link, { color: colors.ink }]}>去记录</Text></Pressable></View>}
    {!loading && error === '' && visible.map((event, index) => {
      const is_expanded = expanded === event.life_event_id;
      const featured = index === 0;
      return <Pressable accessibilityRole="button" accessibilityLabel={`${event.event_content}，${is_expanded ? '收起详情' : '查看原话'}`} key={event.life_event_id} onPress={() => setExpanded(is_expanded ? null : event.life_event_id)} style={[styles.event, { backgroundColor: featured ? colors.ink : colors.paper }]}>
        <View style={[styles.node, { backgroundColor: featured ? colors.paper : colors.ink }]}><MaterialCommunityIcons color={featured ? colors.ink : colors.paper} name="leaf" size={13} /></View>
        <View style={styles.event_copy}><View style={styles.meta}><Text style={[styles.event_type, { color: featured ? colors.blue_strong : colors.ink }]}>{event_labels[event.event_type] ?? event.event_type}</Text><Text style={[styles.muted, { color: colors.muted }]}>{event_time(event)}</Text></View><Text style={[styles.event_content, { color: featured ? colors.paper : colors.ink }]}>{event.event_content}</Text><Text style={[styles.muted, { color: colors.muted }]}>AI 摘要 · {emotion_label(event.emotion)}</Text>{is_expanded && <View style={[styles.detail, { borderTopColor: featured ? '#555555' : colors.line }]}><Text style={[styles.detail_label, { color: featured ? colors.blue_strong : colors.ink }]}>你当时告诉 AI 的原话</Text><Text style={[styles.detail_text, { color: featured ? colors.paper : colors.ink }]}>{event.source_text || event.event_content}</Text><Text style={[styles.muted, { color: colors.muted }]}>重要程度 {Math.round((Number(event.importance_score) || 0) * 100)}% · 来源 {event.source || 'life_events'}</Text></View>}</View>
        <Text style={[styles.importance, { color: colors.muted }]}>{is_expanded ? '收起' : (Number(event.importance_score) || 0).toFixed(1)}</Text>
      </Pressable>;
    })}
    <Modal visible={calendar_visible} transparent animationType="fade" onRequestClose={() => setCalendarVisible(false)}>
      <View style={styles.modal_backdrop}><View style={[styles.calendar_modal, { backgroundColor: colors.paper }]}>
        <View style={styles.modal_heading}><Text style={[styles.modal_title, { color: colors.ink }]}>选择日期</Text><Pressable accessibilityRole="button" accessibilityLabel="关闭大日历" onPress={() => setCalendarVisible(false)} hitSlop={8}><MaterialCommunityIcons color={colors.muted} name="close" size={24} /></Pressable></View>
        <View style={styles.month_heading}><Pressable accessibilityRole="button" accessibilityLabel="上一个月" onPress={() => move_month(-1)} hitSlop={8}><MaterialCommunityIcons color={colors.ink} name="chevron-left" size={24} /></Pressable><Text style={[styles.month_title, { color: colors.ink }]}>{month_label(calendar_month)}</Text><Pressable accessibilityRole="button" accessibilityLabel="下一个月" onPress={() => move_month(1)} hitSlop={8}><MaterialCommunityIcons color={colors.ink} name="chevron-right" size={24} /></Pressable></View>
        <View style={styles.week_row}>{['日', '一', '二', '三', '四', '五', '六'].map((label) => <Text key={label} style={[styles.week_label, { color: colors.muted }]}>{label}</Text>)}</View>
        <View style={styles.month_grid}>{month_dates.map((date) => { const date_object = new Date(`${date}T12:00:00`); const in_month = date_object.getMonth() === calendar_month.getMonth(); const selected = date === selected_date; return <Pressable accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`选择${format_date_label(date, true)}`} key={date} onPress={() => choose_date(date)} style={[styles.grid_day, selected && { backgroundColor: colors.ink }]}><Text style={[styles.grid_day_text, { color: selected ? colors.paper : in_month ? colors.ink : colors.line }]}>{date.slice(-2)}</Text>{event_date_set.has(date) && <View style={[styles.event_dot, { backgroundColor: selected ? colors.paper : colors.blue_strong }]} />}</Pressable>; })}</View>
        <Pressable accessibilityRole="button" accessibilityLabel="选择今天" onPress={() => choose_date(today)} style={[styles.today_button, { backgroundColor: colors.blue }]}><Text style={[styles.today_text, { color: colors.ink }]}>回到今天</Text></Pressable>
      </View></View>
    </Modal>
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: 34 },
  heading: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontSize: 11, letterSpacing: 0.6, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '700' },
  calendar_button: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  date_strip: { gap: 9, paddingHorizontal: 24, paddingVertical: 10, paddingBottom: 22 },
  date_button: { width: 54, height: 66, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 5 },
  date_week: { fontSize: 10 },
  date_text: { fontSize: 19, fontWeight: '800' },
  filter_row: { gap: 8, paddingHorizontal: 24, paddingBottom: 20 },
  filter_button: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderRadius: 20 },
  filter_text: { fontSize: 13 },
  section_heading: { paddingHorizontal: 24, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 },
  section_title: { fontSize: 21, fontWeight: '700' },
  empty: { marginHorizontal: 24, minHeight: 170, padding: 24, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 8 },
  muted: { fontSize: 12, lineHeight: 19 },
  link: { fontSize: 13, fontWeight: '700' },
  empty_title: { fontSize: 16, fontWeight: '700' },
  event: { minHeight: 86, marginHorizontal: 24, marginBottom: 12, padding: 16, paddingLeft: 18, borderRadius: 23, flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  node: { width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  event_copy: { flex: 1, minWidth: 0, gap: 5 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  event_type: { fontSize: 11, fontWeight: '700' },
  event_content: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  detail: { borderTopWidth: 1, marginTop: 5, paddingTop: 9, gap: 4 },
  detail_label: { fontSize: 11, fontWeight: '700' },
  detail_text: { fontSize: 13, lineHeight: 21 },
  importance: { fontSize: 12 },
  modal_backdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.42)' },
  calendar_modal: { padding: 20, borderRadius: 24 },
  modal_heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modal_title: { fontSize: 20, fontWeight: '700' },
  month_heading: { marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month_title: { fontSize: 16, fontWeight: '700' },
  week_row: { flexDirection: 'row', marginTop: 16, marginBottom: 5 },
  week_label: { width: '14.2857%', textAlign: 'center', fontSize: 11 },
  month_grid: { flexDirection: 'row', flexWrap: 'wrap' },
  grid_day: { width: '14.2857%', height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  grid_day_text: { fontSize: 13 },
  event_dot: { width: 4, height: 4, marginTop: 3, borderRadius: 2 },
  today_button: { minHeight: 44, marginTop: 15, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  today_text: { fontSize: 13, fontWeight: '700' },
});

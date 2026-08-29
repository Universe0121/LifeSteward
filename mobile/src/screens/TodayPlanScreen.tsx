import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useWorkspace } from '../state/WorkspaceContext';
import { format_date_label, local_date_key, plan_end_time } from '../utils/date';

export default function TodayPlanScreen() {
  const navigation = useNavigation<any>();
  const { data, colors, notification_state, toggle_plan } = useWorkspace();
  const today = local_date_key();
  const plans = useMemo(() => data.plans.filter((plan) => plan.plan_date === today).sort((a, b) => a.start_time.localeCompare(b.start_time)), [data.plans, today]);
  function open_chat() {
    // TodayPlan is a root-stack screen, so the chat tab must be addressed through the nested tab navigator.
    navigation.navigate('主导航', { screen: '聊天' });
  }

  function open_task_list() {
    navigation.navigate('任务管理', { task_date: today });
  }

  return <ScrollView style={{ backgroundColor: colors.canvas }} contentContainerStyle={styles.content}><View style={[styles.hero, { backgroundColor: colors.ink }]}><Text style={[styles.eyebrow, { color: colors.muted }]}>今天 · {format_date_label(today, true)}</Text><Text style={[styles.title, { color: colors.paper }]}>按时间照顾自己的节奏</Text><Text style={[styles.copy, { color: colors.muted }]}>计划精确到分钟，到点后 LifeAgent 会提醒你。</Text></View><View style={styles.notice}>{notification_state === 'loading' ? <ActivityIndicator color={colors.ink} size="small" /> : <MaterialCommunityIcons color={notification_state === 'ready' ? colors.green : colors.muted} name={notification_state === 'ready' ? 'bell-check-outline' : 'bell-off-outline'} size={19} />}<Text style={[styles.notice_text, { color: colors.muted }]}>{notification_state === 'ready' ? '计划提醒已设置' : notification_state === 'denied' ? '未开启系统通知，计划仍会保留' : '正在设置计划提醒...'}</Text></View>{plans.length === 0 ? <View style={[styles.empty, { backgroundColor: colors.paper }]}><MaterialCommunityIcons color={colors.muted} name="calendar-blank-outline" size={34} /><Text style={[styles.empty_title, { color: colors.ink }]}>今天还没有精确计划</Text><Text style={[styles.empty_copy, { color: colors.muted }]}>去聊天告诉 LifeAgent 你想在几点做什么。</Text><Pressable accessibilityRole="button" accessibilityLabel="去聊天安排计划" onPress={open_chat}><Text style={[styles.link, { color: colors.ink }]}>去聊天安排</Text></Pressable></View> : <View style={styles.timeline}>{plans.map((plan, index) => <View key={plan.plan_id} style={styles.plan_row}><View style={styles.time_column}><Text style={[styles.time, { color: colors.ink }]}>{plan.start_time}</Text><Text style={[styles.duration, { color: colors.muted }]}>{plan.duration_minutes} 分钟</Text></View><View style={styles.rail}><View style={[styles.node, { backgroundColor: plan.completed ? colors.green : colors.ink, borderColor: colors.canvas }]} /><View style={[styles.line, { backgroundColor: colors.line }, index === plans.length - 1 && styles.hidden]} /></View><Pressable accessibilityRole="button" accessibilityLabel={`${plan.completed ? '标记' : '查看'}${plan.task_name}计划`} onPress={() => toggle_plan(plan.plan_id)} style={[styles.plan_card, { backgroundColor: colors.paper, borderColor: colors.line }, plan.completed && { opacity: 0.62 }]}><View style={styles.plan_heading}><Text style={[styles.plan_name, { color: colors.ink }, plan.completed && styles.strike]}>{plan.task_name}</Text></View><Text style={[styles.plan_end, { color: colors.muted }]}>至 {plan_end_time(plan.start_time, plan.duration_minutes)} · {plan.completed ? '已完成' : '待完成'}</Text></Pressable></View>)}</View>}<Pressable accessibilityRole="button" accessibilityLabel="打开任务清单管理普通任务" onPress={open_task_list} style={[styles.task_list_cta, { backgroundColor: colors.paper, borderColor: colors.line }]}><MaterialCommunityIcons color={colors.ink} name="format-list-checks" size={19} /><Text style={[styles.task_list_cta_text, { color: colors.ink }]}>打开任务清单，添加或修改任务</Text><MaterialCommunityIcons color={colors.ink} name="arrow-right" size={18} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="去聊天添加精确计划" onPress={open_chat} style={[styles.cta, { backgroundColor: colors.blue }]}><MaterialCommunityIcons color={colors.ink} name="message-text-outline" size={20} /><Text style={[styles.cta_text, { color: colors.ink }]}>去聊天添加或调整计划</Text><MaterialCommunityIcons color={colors.ink} name="arrow-right" size={19} /></Pressable></ScrollView>;
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 40 },
  hero: { padding: 24, borderRadius: 25, marginBottom: 15 },
  eyebrow: { fontSize: 11, letterSpacing: 0.7, marginBottom: 10 },
  title: { fontSize: 25, lineHeight: 33, fontWeight: '700', marginBottom: 8 },
  copy: { fontSize: 13, lineHeight: 21 },
  notice: { minHeight: 45, paddingHorizontal: 14, marginBottom: 20, borderRadius: 14, backgroundColor: '#E8EDFB', flexDirection: 'row', alignItems: 'center', gap: 8 },
  notice_text: { fontSize: 12 },
  empty: { minHeight: 210, padding: 24, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 8 },
  empty_title: { fontSize: 16, fontWeight: '700' },
  empty_copy: { fontSize: 12, textAlign: 'center', lineHeight: 19 },
  link: { fontSize: 13, fontWeight: '700', marginTop: 5 },
  timeline: { paddingTop: 3 },
  plan_row: { minHeight: 96, flexDirection: 'row' },
  time_column: { width: 58, paddingTop: 13 },
  time: { fontSize: 16, fontWeight: '800' },
  duration: { fontSize: 10, marginTop: 4 },
  rail: { width: 24, alignItems: 'center', position: 'relative' },
  node: { zIndex: 2, width: 13, height: 13, marginTop: 16, borderWidth: 3, borderRadius: 7 },
  line: { position: 'absolute', top: 28, bottom: 0, width: 1 },
  hidden: { display: 'none' },
  plan_card: { flex: 1, minWidth: 0, minHeight: 78, marginBottom: 12, padding: 14, borderWidth: 1, borderRadius: 17 },
  plan_heading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  plan_name: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  plan_end: { fontSize: 11, marginTop: 8 },
  strike: { textDecorationLine: 'line-through' },
  task_list_cta: { minHeight: 50, marginTop: 6, paddingHorizontal: 15, borderWidth: 1, borderRadius: 16, alignItems: 'center', flexDirection: 'row', gap: 8 },
  task_list_cta_text: { flex: 1, fontSize: 13, fontWeight: '700' },
  cta: { minHeight: 52, marginTop: 18, paddingHorizontal: 15, borderRadius: 16, alignItems: 'center', flexDirection: 'row', gap: 8 },
  cta_text: { flex: 1, fontSize: 13, fontWeight: '700' },
});

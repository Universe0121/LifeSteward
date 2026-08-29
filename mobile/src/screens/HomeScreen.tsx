import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api_client, type WeeklyReportRecord } from '../api';
import WeeklyPosterCard from '../components/WeeklyPosterCard';
import { useAuth } from '../state/AuthContext';
import { useWorkspace } from '../state/WorkspaceContext';
import { format_date_label, local_date_key, weekday_label } from '../utils/date';

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { user_id, display_name } = useAuth();
  const { data, colors, toggle_task: toggle_workspace_task, remove_task } = useWorkspace();
  const today = local_date_key();
  const [reports, setReports] = useState<WeeklyReportRecord[]>([]);
  const [report_loading, setReportLoading] = useState(true);
  const [report_error, setReportError] = useState('');
  const [generating_report, setGeneratingReport] = useState(false);
  const [search, setSearch] = useState('');

  const load_reports = useCallback(async (limit = 3) => {
    setReportLoading(true);
    setReportError('');
    try {
      const result = await api_client.listWeeklyReports(user_id, limit);
      setReports(result.items);
    } catch {
      setReportError('周报暂时无法加载，请稍后重试。');
    } finally {
      setReportLoading(false);
    }
  }, [user_id]);

  useEffect(() => {
    void load_reports();
  }, [load_reports]);

  const today_tasks = useMemo(() => data.tasks.filter((task) => task.task_date === today), [data.tasks, today]);
  const visible_tasks = useMemo(
    () => today_tasks.filter((task) => task.task_name.toLowerCase().includes(search.trim().toLowerCase())),
    [today_tasks, search],
  );
  const completed = today_tasks.filter((task) => task.completed).length;
  const today_plans = data.plans.filter((plan) => plan.plan_date === today);
  const project_copy = data.project_description === '创建仪表盘菜单，梳理用户流程'
    ? '为用户量身定制每日计划'
    : data.project_description;

  function toggle_task(task_id: string) {
    toggle_workspace_task(task_id);
  }

  function open_stack(screen: string, params?: object) {
    navigation.getParent()?.navigate(screen, params);
  }

  function open_task_menu(task_id: string) {
    const task = today_tasks.find((item) => item.task_id === task_id);
    if (!task) return;
    Alert.alert(task.task_name, '选择要进行的操作', [
      { text: '编辑', onPress: () => open_stack('任务管理', { edit_task_id: task.task_id }) },
      { text: '删除', style: 'destructive', onPress: () => remove_task(task.task_id) },
      { text: '取消', style: 'cancel' },
    ]);
  }

  function open_report(report: WeeklyReportRecord) {
    navigation.getParent()?.navigate('周报详情', { report });
  }

  async function generate_report() {
    if (generating_report) return;
    setGeneratingReport(true);
    setReportError('');
    try {
      const report = await api_client.generateWeeklyReport({ user_id, timezone: 'Asia/Shanghai' });
      setReports((current) => [report, ...current.filter((item) => item.report_id !== report.report_id)].slice(0, 3));
    } catch {
      setReportError('周报生成失败，请稍后重试。');
    } finally {
      setGeneratingReport(false);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.canvas }}
      contentContainerStyle={[styles.content, { backgroundColor: colors.canvas }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={report_loading} onRefresh={() => void load_reports()} tintColor={colors.ink} />}
    >
      <View style={[styles.hero, { backgroundColor: colors.ink }]}>
        <Text style={[styles.eyebrow_light, { color: colors.muted }]}>{weekday_label(today)} · {format_date_label(today)}</Text>
        <Text style={[styles.greeting, { color: colors.paper }]}>嗨，{display_name || '朋友'}!</Text>
        <Text style={[styles.hero_copy, { color: colors.muted }]}>开启你今天的学习之旅</Text>
        <View style={[styles.search, { backgroundColor: colors.paper }]}>
          <MaterialCommunityIcons color={colors.muted} name="magnify" size={21} />
          <TextInput
            accessibilityLabel="搜索任务或项目"
            value={search}
            onChangeText={setSearch}
            placeholder="搜索任务或项目"
            placeholderTextColor={colors.muted}
            style={[styles.search_input, { color: colors.ink }]}
          />
        </View>
      </View>

      <View style={styles.section_heading}>
        <Text style={[styles.section_title, { color: colors.ink }]}>项目</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="编辑全部项目" onPress={() => navigation.navigate('定制')}>
          <Text style={[styles.edit_link, { color: colors.muted }]}>编辑全部</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.project_scroller}>
        <Pressable accessibilityRole="button" accessibilityLabel="打开今日计划" onPress={() => open_stack('今日计划')} style={[styles.project_card, { backgroundColor: colors.ink }]}>
          <View style={[styles.card_icon, { backgroundColor: colors.paper }]}><MaterialCommunityIcons color={colors.ink} name="account-heart-outline" size={19} /></View>
          <Text style={[styles.project_title, { color: colors.paper }]}>{data.project_name === '事件提醒' ? '今日计划' : data.project_name}</Text>
          <Text style={[styles.project_copy, { color: colors.muted }]}>{project_copy}</Text>
          <Text style={[styles.project_status, { color: colors.paper }]}>● 进行中 · {today_plans.length || today_tasks.length} 个任务</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="打开睡眠时间详情" onPress={() => open_stack('睡眠详情')} style={[styles.project_card, { backgroundColor: colors.blue }]}>
          <View style={[styles.card_icon, { backgroundColor: colors.paper }]}><MaterialCommunityIcons color={colors.ink} name="moon-waning-crescent" size={19} /></View>
          <Text style={[styles.project_title, { color: colors.ink }]}>睡眠时间</Text>
          <Text style={[styles.project_copy, { color: colors.muted }]}>记录总结这一周的作息</Text>
          <Text style={[styles.project_status, { color: colors.ink }]}>● 模拟数据 · 近 5 天</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.section_heading}>
        <Text style={[styles.section_title, { color: colors.ink }]}>任务</Text>
        <View style={styles.task_heading_actions}><Text style={[styles.eyebrow, { color: colors.muted }]}>{completed}/{today_tasks.length} 已完成</Text><Pressable accessibilityRole="button" accessibilityLabel="管理今日任务" onPress={() => open_stack('任务管理', { task_date: today })} hitSlop={8}><MaterialCommunityIcons color={colors.ink} name="plus-circle-outline" size={22} /></Pressable></View>
      </View>
      <View style={styles.task_list}>
        {visible_tasks.length === 0
          ? <View style={[styles.empty_task, { backgroundColor: colors.paper }]}><Text style={[styles.muted, { color: colors.muted }]}>没有匹配的任务。</Text></View>
          : visible_tasks.map((task) => (
            <View key={task.task_id} style={[styles.task_row, { backgroundColor: colors.paper }]}>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: task.completed }} accessibilityLabel={`标记${task.task_name}`} onPress={() => toggle_task(task.task_id)} style={[styles.checkbox, { borderColor: colors.line }, task.completed && { backgroundColor: colors.ink, borderColor: colors.ink }]}>{task.completed && <MaterialCommunityIcons color={colors.paper} name="check" size={18} />}</Pressable>
              <Text style={[styles.task_text, { color: task.completed ? colors.muted : colors.ink }, task.completed && styles.completed_text]}>{task.task_name}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`编辑或删除${task.task_name}`} onPress={() => open_task_menu(task.task_id)} hitSlop={8} style={styles.task_menu}><MaterialCommunityIcons color={colors.ink} name="dots-horizontal" size={21} /></Pressable>
            </View>
          ))}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="添加或管理今日任务" onPress={() => open_stack('任务管理', { task_date: today })} style={[styles.task_manage_cta, { backgroundColor: colors.paper, borderColor: colors.line }]}>
        <MaterialCommunityIcons color={colors.ink} name="playlist-edit" size={19} /><Text style={[styles.task_manage_text, { color: colors.ink }]}>添加或管理今日任务</Text><MaterialCommunityIcons color={colors.ink} name="arrow-right" size={18} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="和 LifeAgent 聊聊今天" onPress={() => navigation.navigate('聊天')} style={[styles.chat_cta, { backgroundColor: colors.ink }]}>
        <Text style={[styles.chat_cta_text, { color: colors.paper }]}>和 LifeAgent 聊聊今天</Text>
        <MaterialCommunityIcons color={colors.paper} name="arrow-right" size={21} />
      </Pressable>

      <View style={styles.report_heading}>
        <Text style={[styles.section_title, { color: colors.ink }]}>最近周报</Text>
        <View style={styles.report_actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="刷新周报" onPress={() => void load_reports(10)} hitSlop={8}>
            <MaterialCommunityIcons color={colors.muted} name="refresh" size={19} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="生成本周周报" onPress={() => void generate_report()} disabled={generating_report} style={styles.generate_action}>
            {generating_report ? <ActivityIndicator color={colors.ink} size="small" /> : <MaterialCommunityIcons color={colors.ink} name="file-chart-outline" size={17} />}
            <Text style={[styles.edit_link, { color: colors.ink }]}>生成</Text>
          </Pressable>
        </View>
      </View>
      {report_loading && <View style={[styles.state, { backgroundColor: colors.paper }]}><ActivityIndicator color={colors.ink} /><Text style={[styles.muted, { color: colors.muted }]}>正在加载周报...</Text></View>}
      {!report_loading && report_error !== '' && <View style={[styles.state, { backgroundColor: colors.paper }]}><Text style={[styles.muted, { color: colors.muted }]}>{report_error}</Text><Pressable accessibilityRole="button" onPress={() => void load_reports()}><Text style={[styles.retry, { color: colors.ink }]}>重试</Text></Pressable></View>}
      {!report_loading && report_error === '' && reports.length === 0 && <View style={[styles.state, { backgroundColor: colors.paper }]}><Text style={[styles.muted, { color: colors.muted }]}>暂无周报，先去记录今天的生活。</Text><Pressable accessibilityRole="button" onPress={() => navigation.navigate('聊天')}><Text style={[styles.retry, { color: colors.ink }]}>去记录</Text></Pressable></View>}
      {!report_loading && report_error === '' && reports.map((report) => <WeeklyPosterCard key={report.report_id} report={report} on_press={() => open_report(report)} />)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: 30 },
  hero: { padding: 24, paddingTop: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  eyebrow_light: { fontSize: 11, letterSpacing: 1, marginBottom: 11 },
  greeting: { fontSize: 28, lineHeight: 34, fontWeight: '700', marginBottom: 4 },
  hero_copy: { fontSize: 14, marginBottom: 23 },
  search: { height: 50, paddingLeft: 14, paddingRight: 7, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 8 },
  search_input: { flex: 1, minWidth: 0, fontSize: 13 },
  section_heading: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 13, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  section_title: { fontSize: 21, fontWeight: '700' },
  edit_link: { fontSize: 12 },
  eyebrow: { fontSize: 12 },
  project_scroller: { paddingHorizontal: 24, paddingBottom: 7, gap: 14 },
  project_card: { width: 222, minHeight: 222, padding: 20, borderRadius: 27, position: 'relative' },
  card_icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  project_title: { marginTop: 48, marginBottom: 8, fontSize: 22, fontWeight: '700' },
  project_copy: { minHeight: 39, fontSize: 12, lineHeight: 19 },
  project_status: { marginTop: 20, fontSize: 11, fontWeight: '700' },
  task_list: { gap: 10, paddingHorizontal: 24 },
  task_row: { minHeight: 58, padding: 14, borderRadius: 17, flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: { width: 28, height: 28, borderWidth: 2, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  task_text: { flex: 1, minWidth: 0, fontSize: 14 },
  task_menu: { width: 28, height: 30, alignItems: 'center', justifyContent: 'center' },
  task_heading_actions: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  completed_text: { textDecorationLine: 'line-through' },
  empty_task: { minHeight: 58, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  chat_cta: { marginHorizontal: 24, marginTop: 20, minHeight: 54, paddingHorizontal: 18, borderRadius: 17, alignItems: 'center', justifyContent: 'space-between', flexDirection: 'row' },
  chat_cta_text: { fontSize: 13, fontWeight: '700' },
  task_manage_cta: { minHeight: 50, marginHorizontal: 24, marginTop: 13, paddingHorizontal: 15, borderWidth: 1, borderRadius: 16, alignItems: 'center', flexDirection: 'row', gap: 8 },
  task_manage_text: { flex: 1, fontSize: 13, fontWeight: '700' },
  report_heading: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  report_actions: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  generate_action: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  state: { marginHorizontal: 24, padding: 22, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 8 },
  muted: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
  retry: { fontSize: 13, fontWeight: '700' },
});

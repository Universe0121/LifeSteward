import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { normalize_plan_draft, type DailyPlan, type PlanDraft, useWorkspace } from '../state/WorkspaceContext';
import { add_days, format_date_label, local_date_key, parse_clock_minutes, plan_end_time, weekday_label } from '../utils/date';

type Props = NativeStackScreenProps<RootStackParamList, '今日计划'>;

const date_window = 61;
const date_offset = 30;
const difficulty_options = [
  { value: 0.3, label: '轻松' },
  { value: 0.5, label: '适中' },
  { value: 0.7, label: '有挑战' },
  { value: 1, label: '高强度' },
] as const;

function initial_draft(): PlanDraft {
  return { task_name: '', start_time: '09:00', duration_minutes: 30, difficulty: 0.5 };
}

function build_date_options(today: string, extra_date?: string): string[] {
  const values = Array.from({ length: date_window }, (_, index) => add_days(today, index - date_offset));
  if (extra_date && /^\d{4}-\d{2}-\d{2}$/.test(extra_date)) values.push(extra_date);
  return [...new Set(values)].sort();
}

function date_short_label(value: string, today: string): string {
  if (value === today) return '今天';
  return weekday_label(value);
}

export default function TodayPlanScreen({ route, navigation }: Props) {
  const { data, colors, notification_state, add_plan, edit_plan, toggle_plan, remove_plan } = useWorkspace();
  const today = local_date_key();
  const date_options = useMemo(() => build_date_options(today, route.params?.plan_date), [route.params?.plan_date, today]);
  const initial_date = route.params?.plan_date && date_options.includes(route.params.plan_date) ? route.params.plan_date : today;
  const [selected_date, setSelectedDate] = useState(initial_date);
  const [editor_visible, setEditorVisible] = useState(false);
  const [editing_id, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PlanDraft>(initial_draft);
  const [draft_date, setDraftDate] = useState(initial_date);
  const [duration_text, setDurationText] = useState('30');
  const [form_error, setFormError] = useState('');

  useEffect(() => {
    const requested_date = route.params?.plan_date;
    if (requested_date && date_options.includes(requested_date)) {
      setSelectedDate(requested_date);
      if (!editor_visible) setDraftDate(requested_date);
    }
  }, [date_options, editor_visible, route.params?.plan_date]);

  const plans = useMemo(
    () => data.plans
      .filter((plan) => plan.plan_date === selected_date)
      .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [data.plans, selected_date],
  );

  function reset_editor(date = selected_date) {
    setEditingId(null);
    setDraft(initial_draft());
    setDurationText('30');
    setDraftDate(date);
    setFormError('');
  }

  function close_editor() {
    setEditorVisible(false);
    reset_editor(selected_date);
  }

  function open_new(date = selected_date) {
    reset_editor(date);
    setEditorVisible(true);
  }

  function open_edit(plan: DailyPlan) {
    setSelectedDate(plan.plan_date);
    setEditingId(plan.plan_id);
    setDraft({
      task_name: plan.task_name,
      start_time: plan.start_time,
      duration_minutes: plan.duration_minutes,
      difficulty: plan.difficulty,
    });
    setDurationText(String(plan.duration_minutes));
    setDraftDate(plan.plan_date);
    setFormError('');
    setEditorVisible(true);
  }

  function save_plan() {
    const candidate = normalize_plan_draft({
      ...draft,
      task_name: draft.task_name.trim(),
      duration_minutes: Number(duration_text),
    });
    if (!candidate) {
      setFormError('请填写名称、有效的 HH:mm 时间，以及 1-1440 分钟的时长。');
      return;
    }
    if (parse_clock_minutes(candidate.start_time) === null) {
      setFormError('开始时间必须使用 HH:mm 格式，例如 09:30。');
      return;
    }
    const saved = editing_id
      ? edit_plan(editing_id, candidate, draft_date)
      : add_plan(candidate, draft_date);
    if (!saved) {
      setFormError('相同日期、时间和名称的计划已经存在，或计划内容无效。');
      return;
    }
    setSelectedDate(draft_date);
    setEditorVisible(false);
    reset_editor(draft_date);
  }

  function confirm_remove(plan: DailyPlan) {
    Alert.alert('删除计划', `确定删除“${plan.task_name}”吗？`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => remove_plan(plan.plan_id) },
    ]);
  }

  function open_chat() {
    navigation.navigate('主导航', { screen: '聊天' });
  }

  function open_task_list() {
    navigation.navigate('任务管理', { task_date: selected_date });
  }

  return (
    <KeyboardAvoidingView
      style={[styles.page, { backgroundColor: colors.canvas }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ backgroundColor: colors.canvas }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        <View style={[styles.hero, { backgroundColor: colors.ink }]}>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>计划日期 · {format_date_label(selected_date, true)}</Text>
          <Text style={[styles.title, { color: colors.paper }]}>按时间照顾自己的节奏</Text>
          <Text style={[styles.copy, { color: colors.muted }]}>计划精确到分钟，到点后 LifeAgent 会提醒你。</Text>
        </View>

        <View style={[styles.notice, { backgroundColor: colors.blue }]}>
          {notification_state === 'loading'
            ? <ActivityIndicator color={colors.ink} size="small" />
            : <MaterialCommunityIcons
                color={notification_state === 'ready' ? colors.green : colors.muted}
                name={notification_state === 'ready' ? 'bell-check-outline' : 'bell-off-outline'}
                size={19}
              />}
          <Text style={[styles.notice_text, { color: colors.ink }]}>
            {notification_state === 'ready'
              ? '计划提醒已设置'
              : notification_state === 'denied'
                ? '未开启系统通知，计划仍会保留'
                : '正在设置计划提醒...'}
          </Text>
        </View>

        <ScrollView
          horizontal
          nestedScrollEnabled
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.date_row}
        >
          {date_options.map((date) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: date === selected_date }}
              accessibilityLabel={`选择${format_date_label(date, true)}计划`}
              key={date}
              onPress={() => { setSelectedDate(date); setFormError(''); }}
              style={[styles.date_button, { backgroundColor: colors.paper, borderColor: colors.line }, date === selected_date && { backgroundColor: colors.ink, borderColor: colors.ink }]}
            >
              <Text style={[styles.date_week, { color: date === selected_date ? colors.muted : colors.muted }]}>{date_short_label(date, today)}</Text>
              <Text style={[styles.date_number, { color: date === selected_date ? colors.paper : colors.ink }]}>{date.slice(-2)}</Text>
              <Text style={[styles.date_month, { color: date === selected_date ? colors.muted : colors.muted }]}>{date.slice(5, 7)}月</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.section_heading}>
          <View>
            <Text style={[styles.section_title, { color: colors.ink }]}>今日计划</Text>
            <Text style={[styles.section_date, { color: colors.muted }]}>{format_date_label(selected_date, true)} · {plans.length} 项</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="新增计划" onPress={() => open_new()} style={[styles.add_icon, { backgroundColor: colors.ink }]}>
            <MaterialCommunityIcons color={colors.paper} name="plus" size={21} />
          </Pressable>
        </View>

        {plans.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.paper }]}>
            <MaterialCommunityIcons color={colors.muted} name="calendar-blank-outline" size={34} />
            <Text style={[styles.empty_title, { color: colors.ink }]}>这一天还没有精确计划</Text>
            <Text style={[styles.empty_copy, { color: colors.muted }]}>新增一条带具体时间的安排，或去聊天告诉 LifeAgent。</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="新增精确计划" onPress={() => open_new()} style={[styles.empty_button, { backgroundColor: colors.ink }]}>
              <MaterialCommunityIcons color={colors.paper} name="plus" size={17} />
              <Text style={[styles.empty_button_text, { color: colors.paper }]}>新增计划</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.timeline}>
            {plans.map((plan, index) => (
              <View key={plan.plan_id} style={styles.plan_row}>
                <View style={styles.time_column}>
                  <Text style={[styles.time, { color: colors.ink }]}>{plan.start_time}</Text>
                  <Text style={[styles.duration, { color: colors.muted }]}>{plan.duration_minutes} 分钟</Text>
                </View>
                <View style={styles.rail}>
                  <View style={[styles.node, { backgroundColor: plan.completed ? colors.green : colors.ink, borderColor: colors.canvas }]} />
                  <View style={[styles.line, { backgroundColor: colors.line }, index === plans.length - 1 && styles.hidden]} />
                </View>
                <View style={[styles.plan_card, { backgroundColor: colors.paper, borderColor: colors.line }, plan.completed && styles.completed_card]}>
                  <View style={styles.plan_copy}>
                    <Text style={[styles.plan_name, { color: colors.ink }, plan.completed && styles.strike]}>{plan.task_name}</Text>
                    <Text style={[styles.plan_end, { color: colors.muted }]}>至 {plan_end_time(plan.start_time, plan.duration_minutes)} · {plan.completed ? '已完成' : '待完成'}</Text>
                  </View>
                  <View style={styles.plan_actions}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`${plan.completed ? '撤销完成' : '完成'}${plan.task_name}`} onPress={() => toggle_plan(plan.plan_id)} hitSlop={7} style={styles.icon_button}>
                      <MaterialCommunityIcons color={plan.completed ? colors.green : colors.ink} name={plan.completed ? 'check-circle-outline' : 'circle-outline'} size={21} />
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`编辑${plan.task_name}`} onPress={() => open_edit(plan)} hitSlop={7} style={styles.icon_button}>
                      <MaterialCommunityIcons color={colors.ink} name="pencil-outline" size={19} />
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`删除${plan.task_name}`} onPress={() => confirm_remove(plan)} hitSlop={7} style={styles.icon_button}>
                      <MaterialCommunityIcons color={colors.muted} name="trash-can-outline" size={19} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        <Pressable accessibilityRole="button" accessibilityLabel="打开任务清单管理普通任务" onPress={open_task_list} style={[styles.task_cta, { backgroundColor: colors.paper, borderColor: colors.line }]}>
          <MaterialCommunityIcons color={colors.ink} name="format-list-checks" size={19} />
          <Text style={[styles.task_cta_text, { color: colors.ink }]}>打开任务清单，添加或修改普通任务</Text>
          <MaterialCommunityIcons color={colors.ink} name="arrow-right" size={18} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="去聊天添加或调整计划" onPress={open_chat} style={[styles.chat_cta, { backgroundColor: colors.blue }]}>
          <MaterialCommunityIcons color={colors.ink} name="message-text-outline" size={20} />
          <Text style={[styles.chat_cta_text, { color: colors.ink }]}>去聊天添加或调整计划</Text>
          <MaterialCommunityIcons color={colors.ink} name="arrow-right" size={19} />
        </Pressable>
      </ScrollView>

      <Modal visible={editor_visible} transparent animationType="slide" onRequestClose={close_editor}>
        <View style={styles.modal_backdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modal_keyboard}>
            <View style={[styles.modal, { backgroundColor: colors.paper }]}>
              <View style={styles.modal_heading}>
                <View>
                  <Text style={[styles.modal_title, { color: colors.ink }]}>{editing_id ? '编辑计划' : '新增计划'}</Text>
                  <Text style={[styles.modal_subtitle, { color: colors.muted }]}>计划需要具体日期、时间和时长</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="关闭计划编辑窗口" onPress={close_editor} hitSlop={8}>
                  <MaterialCommunityIcons color={colors.muted} name="close" size={24} />
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.modal_scroll}>
                <Text style={[styles.modal_label, { color: colors.muted }]}>计划内容</Text>
                <TextInput
                  autoFocus
                  accessibilityLabel="计划内容"
                  value={draft.task_name}
                  onChangeText={(value) => setDraft((current) => ({ ...current, task_name: value }))}
                  placeholder="例如：专注学习数学"
                  placeholderTextColor={colors.muted}
                  style={[styles.modal_input, { color: colors.ink, backgroundColor: colors.canvas, borderColor: colors.line }]}
                />
                <Text style={[styles.modal_label, { color: colors.muted }]}>安排日期</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modal_dates}>
                  {date_options.map((date) => (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: date === draft_date }}
                      accessibilityLabel={`安排在${format_date_label(date, true)}`}
                      key={date}
                      onPress={() => setDraftDate(date)}
                      style={[styles.modal_date, { borderColor: colors.line }, date === draft_date && { backgroundColor: colors.ink, borderColor: colors.ink }]}
                    >
                      <Text style={{ color: date === draft_date ? colors.paper : colors.ink, fontSize: 12 }}>{date_short_label(date, today)} {date.slice(-2)}日</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={styles.form_row}>
                  <View style={styles.form_field_time}>
                    <Text style={[styles.modal_label, { color: colors.muted }]}>开始时间</Text>
                    <TextInput
                      accessibilityLabel="开始时间"
                      value={draft.start_time}
                      onChangeText={(value) => setDraft((current) => ({ ...current, start_time: value }))}
                      keyboardType="numbers-and-punctuation"
                      placeholder="09:30"
                      placeholderTextColor={colors.muted}
                      maxLength={5}
                      style={[styles.modal_input, { color: colors.ink, backgroundColor: colors.canvas, borderColor: colors.line }]}
                    />
                  </View>
                  <View style={styles.form_field_duration}>
                    <Text style={[styles.modal_label, { color: colors.muted }]}>时长（分钟）</Text>
                    <TextInput
                      accessibilityLabel="计划时长（分钟）"
                      value={duration_text}
                      onChangeText={setDurationText}
                      keyboardType="number-pad"
                      placeholder="30"
                      placeholderTextColor={colors.muted}
                      style={[styles.modal_input, { color: colors.ink, backgroundColor: colors.canvas, borderColor: colors.line }]}
                    />
                  </View>
                </View>
                <Text style={[styles.modal_label, { color: colors.muted }]}>难度</Text>
                <View style={styles.difficulty_row}>
                  {difficulty_options.map((option) => (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: draft.difficulty === option.value }}
                      accessibilityLabel={`难度${option.label}`}
                      key={option.label}
                      onPress={() => setDraft((current) => ({ ...current, difficulty: option.value }))}
                      style={[styles.difficulty_button, { borderColor: colors.line }, draft.difficulty === option.value && { backgroundColor: colors.ink, borderColor: colors.ink }]}
                    >
                      <Text style={{ color: draft.difficulty === option.value ? colors.paper : colors.ink, fontSize: 12 }}>{option.label}</Text>
                    </Pressable>
                  ))}
                </View>
                {form_error !== '' && <Text accessibilityRole="alert" style={[styles.form_error, { color: colors.danger }]}>{form_error}</Text>}
                <Pressable accessibilityRole="button" accessibilityLabel={editing_id ? '保存计划修改' : '保存新计划'} disabled={!draft.task_name.trim()} onPress={save_plan} style={[styles.save_button, { backgroundColor: colors.ink }, !draft.task_name.trim() && styles.disabled]}>
                  <Text style={[styles.save_text, { color: colors.paper }]}>{editing_id ? '保存修改' : '添加到今日计划'}</Text>
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: 24, paddingBottom: 42 },
  hero: { padding: 24, borderRadius: 25, marginBottom: 14 },
  eyebrow: { fontSize: 11, letterSpacing: 0.7, marginBottom: 10 },
  title: { fontSize: 25, lineHeight: 33, fontWeight: '700', marginBottom: 8 },
  copy: { fontSize: 13, lineHeight: 21 },
  notice: { minHeight: 45, paddingHorizontal: 14, marginBottom: 10, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  notice_text: { flex: 1, fontSize: 12 },
  date_row: { gap: 9, paddingVertical: 14, paddingBottom: 22 },
  date_button: { width: 61, height: 78, borderWidth: 1, borderRadius: 19, alignItems: 'center', justifyContent: 'center', gap: 3 },
  date_week: { fontSize: 10 },
  date_number: { fontSize: 20, fontWeight: '800' },
  date_month: { fontSize: 9 },
  section_heading: { marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  section_title: { fontSize: 21, fontWeight: '700' },
  section_date: { marginTop: 3, fontSize: 11 },
  add_icon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  empty: { minHeight: 220, padding: 24, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 8 },
  empty_title: { fontSize: 16, fontWeight: '700' },
  empty_copy: { fontSize: 12, textAlign: 'center', lineHeight: 19 },
  empty_button: { minHeight: 42, marginTop: 6, paddingHorizontal: 15, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  empty_button_text: { fontSize: 13, fontWeight: '700' },
  timeline: { paddingTop: 3 },
  plan_row: { minHeight: 104, flexDirection: 'row' },
  time_column: { width: 59, paddingTop: 13 },
  time: { fontSize: 16, fontWeight: '800' },
  duration: { fontSize: 10, marginTop: 4 },
  rail: { width: 24, alignItems: 'center', position: 'relative' },
  node: { zIndex: 2, width: 13, height: 13, marginTop: 16, borderWidth: 3, borderRadius: 7 },
  line: { position: 'absolute', top: 28, bottom: 0, width: 1 },
  hidden: { display: 'none' },
  plan_card: { flex: 1, minWidth: 0, minHeight: 82, marginBottom: 12, padding: 13, borderWidth: 1, borderRadius: 17, flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  completed_card: { opacity: 0.62 },
  plan_copy: { flex: 1, minWidth: 0 },
  plan_name: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  plan_end: { fontSize: 11, marginTop: 8 },
  plan_actions: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  icon_button: { width: 27, height: 32, alignItems: 'center', justifyContent: 'center' },
  strike: { textDecorationLine: 'line-through' },
  task_cta: { minHeight: 50, marginTop: 5, paddingHorizontal: 15, borderWidth: 1, borderRadius: 16, alignItems: 'center', flexDirection: 'row', gap: 8 },
  task_cta_text: { flex: 1, fontSize: 13, fontWeight: '700' },
  chat_cta: { minHeight: 52, marginTop: 14, paddingHorizontal: 15, borderRadius: 16, alignItems: 'center', flexDirection: 'row', gap: 8 },
  chat_cta_text: { flex: 1, fontSize: 13, fontWeight: '700' },
  modal_backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.42)' },
  modal_keyboard: { width: '100%' },
  modal: { maxHeight: '92%', padding: 24, paddingBottom: 28, borderTopLeftRadius: 25, borderTopRightRadius: 25 },
  modal_heading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  modal_title: { fontSize: 20, fontWeight: '700' },
  modal_subtitle: { marginTop: 4, fontSize: 11 },
  modal_scroll: { paddingBottom: 5 },
  modal_label: { marginTop: 17, fontSize: 12 },
  modal_input: { width: '100%', minHeight: 45, marginTop: 7, paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderRadius: 13, fontSize: 14 },
  modal_dates: { gap: 8, paddingTop: 8, paddingBottom: 2 },
  modal_date: { minHeight: 38, paddingHorizontal: 13, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  form_row: { flexDirection: 'row', gap: 10 },
  form_field_time: { flex: 1 },
  form_field_duration: { width: 125 },
  difficulty_row: { flexDirection: 'row', gap: 7, marginTop: 8 },
  difficulty_button: { flex: 1, minHeight: 38, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  form_error: { marginTop: 12, fontSize: 12, lineHeight: 18 },
  save_button: { minHeight: 49, marginTop: 18, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  save_text: { fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});

import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import {
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
import { add_days, format_date_label, local_date_key, weekday_label } from '../utils/date';
import { useWorkspace } from '../state/WorkspaceContext';

type Props = NativeStackScreenProps<RootStackParamList, '任务管理'>;

const date_window = 61;
const date_offset = 30;

function build_date_options(today: string, extra_date?: string): string[] {
  const values = Array.from({ length: date_window }, (_, index) => add_days(today, index - date_offset));
  if (extra_date && /^\d{4}-\d{2}-\d{2}$/.test(extra_date)) values.push(extra_date);
  return [...new Set(values)].sort();
}

function short_date_label(value: string, today: string): string {
  return value === today ? '今天' : weekday_label(value);
}

export default function TaskManagementScreen({ route, navigation }: Props) {
  const { data, colors, toggle_task, add_task, edit_task, remove_task } = useWorkspace();
  const today = local_date_key();
  const date_options = useMemo(() => build_date_options(today, route.params?.task_date), [route.params?.task_date, today]);
  const initial_date = route.params?.task_date && date_options.includes(route.params.task_date) ? route.params.task_date : today;
  const [selected_date, setSelectedDate] = useState(initial_date);
  const [editor_visible, setEditorVisible] = useState(false);
  const [editing_task_id, setEditingTaskId] = useState<string | null>(null);
  const [draft_name, setDraftName] = useState('');
  const [draft_date, setDraftDate] = useState(initial_date);
  const [form_error, setFormError] = useState('');

  const visible_tasks = data.tasks.filter((task) => task.task_date === selected_date);

  useEffect(() => {
    const task_date = route.params?.task_date;
    if (task_date && date_options.includes(task_date)) {
      setSelectedDate(task_date);
      if (!editor_visible) setDraftDate(task_date);
    }
  }, [date_options, editor_visible, route.params?.task_date]);

  useEffect(() => {
    const task_id = route.params?.edit_task_id;
    if (!task_id) return;
    // Consume a one-shot deep link before opening the editor so a navigation
    // state update cannot reopen the same task modal.
    navigation.setParams({ edit_task_id: undefined });
    const task = data.tasks.find((item) => item.task_id === task_id);
    if (!task) return;
    setSelectedDate(task.task_date);
    setEditingTaskId(task.task_id);
    setDraftName(task.task_name);
    setDraftDate(task.task_date);
    setFormError('');
    setEditorVisible(true);
  }, [data.tasks, navigation, route.params?.edit_task_id]);

  function close_editor() {
    setEditorVisible(false);
    setEditingTaskId(null);
    setDraftName('');
    setDraftDate(selected_date);
    setFormError('');
  }

  function open_new() {
    setEditingTaskId(null);
    setDraftName('');
    setDraftDate(selected_date);
    setFormError('');
    setEditorVisible(true);
  }

  function open_edit(task_id: string) {
    const task = data.tasks.find((item) => item.task_id === task_id);
    if (!task) return;
    setEditingTaskId(task.task_id);
    setDraftName(task.task_name);
    setDraftDate(task.task_date);
    setFormError('');
    setEditorVisible(true);
  }

  function confirm_remove(task_id: string) {
    const task = data.tasks.find((item) => item.task_id === task_id);
    if (!task) return;
    Alert.alert('删除任务', `确定删除“${task.task_name}”吗？`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => remove_task(task_id) },
    ]);
  }

  function save_task() {
    const name = draft_name.trim();
    if (!name) {
      setFormError('请输入任务内容。');
      return;
    }
    const saved = editing_task_id ? edit_task(editing_task_id, name, draft_date) : add_task(name, draft_date);
    if (!saved) {
      setFormError('任务内容无效，或相同日期下已经有同名任务。');
      return;
    }
    setSelectedDate(draft_date);
    close_editor();
  }

  return (
    <KeyboardAvoidingView style={[styles.page, { backgroundColor: colors.canvas }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
        <View style={[styles.intro, { backgroundColor: colors.blue }]}>
          <View style={styles.intro_copy}>
            <Text style={[styles.eyebrow, { color: colors.muted }]}>只安排哪一天做什么</Text>
            <Text style={[styles.title, { color: colors.ink }]}>任务清单</Text>
            <Text style={[styles.description, { color: colors.muted }]}>任务不设置具体时间；需要精确到分钟的内容请放进今日计划。</Text>
          </View>
          <MaterialCommunityIcons color={colors.ink} name="format-list-checks" size={30} />
        </View>

        <ScrollView horizontal nestedScrollEnabled directionalLockEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.date_row}>
          {date_options.map((date) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: date === selected_date }}
              accessibilityLabel={`选择${format_date_label(date, true)}任务`}
              key={date}
              onPress={() => { setSelectedDate(date); setEditingTaskId(null); setFormError(''); }}
              style={[styles.date_button, { backgroundColor: colors.paper, borderColor: colors.line }, date === selected_date && { backgroundColor: colors.ink, borderColor: colors.ink }]}
            >
              <Text style={[styles.date_week, { color: colors.muted }]}>{short_date_label(date, today)}</Text>
              <Text style={[styles.date_number, { color: date === selected_date ? colors.paper : colors.ink }]}>{date.slice(-2)}</Text>
              <Text style={[styles.date_month, { color: colors.muted }]}>{date.slice(5, 7)}月</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.heading}>
          <Text style={[styles.section_title, { color: colors.ink }]}>{format_date_label(selected_date, true)}</Text>
          <Text style={[styles.count, { color: colors.muted }]}>{visible_tasks.length} 项</Text>
        </View>

        {visible_tasks.length === 0
          ? <View style={[styles.empty, { backgroundColor: colors.paper }]}><MaterialCommunityIcons color={colors.muted} name="playlist-plus" size={30} /><Text style={[styles.empty_title, { color: colors.ink }]}>这一天还没有任务</Text><Text style={[styles.empty_copy, { color: colors.muted }]}>添加一个不带具体时间的待办事项。</Text></View>
          : visible_tasks.map((task) => <View key={task.task_id} style={[styles.task_row, { backgroundColor: colors.paper, borderColor: colors.line }]}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: task.completed }} accessibilityLabel={`标记${task.task_name}`} onPress={() => toggle_task(task.task_id)} style={[styles.checkbox, { borderColor: colors.line }, task.completed && { backgroundColor: colors.ink, borderColor: colors.ink }]}>{task.completed && <MaterialCommunityIcons color={colors.paper} name="check" size={17} />}</Pressable><Text style={[styles.task_name, { color: task.completed ? colors.muted : colors.ink }, task.completed && styles.strike]}>{task.task_name}</Text><Pressable accessibilityRole="button" accessibilityLabel={`编辑${task.task_name}`} onPress={() => open_edit(task.task_id)} hitSlop={8} style={styles.icon_button}><MaterialCommunityIcons color={colors.ink} name="pencil-outline" size={19} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`删除${task.task_name}`} onPress={() => confirm_remove(task.task_id)} hitSlop={8} style={styles.icon_button}><MaterialCommunityIcons color={colors.muted} name="trash-can-outline" size={19} /></Pressable></View>)}

        <Pressable accessibilityRole="button" accessibilityLabel="添加任务" onPress={open_new} style={[styles.add_button, { backgroundColor: colors.ink }]}><MaterialCommunityIcons color={colors.paper} name="plus" size={20} /><Text style={[styles.add_text, { color: colors.paper }]}>添加任务</Text></Pressable>
      </ScrollView>

      <Modal visible={editor_visible} transparent animationType="slide" onRequestClose={close_editor}>
        <View style={styles.modal_backdrop}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modal_keyboard}><View style={[styles.modal, { backgroundColor: colors.paper }]}>
          <View style={styles.modal_heading}><View><Text style={[styles.modal_title, { color: colors.ink }]}>{editing_task_id ? '编辑任务' : '新增任务'}</Text><Text style={[styles.modal_subtitle, { color: colors.muted }]}>普通任务只记录名称和日期</Text></View><Pressable accessibilityRole="button" accessibilityLabel="关闭任务编辑窗口" onPress={close_editor} hitSlop={8}><MaterialCommunityIcons color={colors.muted} name="close" size={23} /></Pressable></View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.modal_scroll}>
            <Text style={[styles.modal_label, { color: colors.muted }]}>任务内容</Text>
            <TextInput autoFocus accessibilityLabel="任务内容" value={draft_name} onChangeText={setDraftName} onSubmitEditing={save_task} placeholder="例如：整理客户反馈" placeholderTextColor={colors.muted} style={[styles.modal_input, { color: colors.ink, backgroundColor: colors.canvas, borderColor: colors.line }]} returnKeyType="done" />
            <Text style={[styles.modal_label, { color: colors.muted }]}>安排日期</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modal_dates}>{date_options.map((date) => <Pressable accessibilityRole="button" accessibilityState={{ selected: date === draft_date }} accessibilityLabel={`安排在${format_date_label(date, true)}`} key={date} onPress={() => setDraftDate(date)} style={[styles.modal_date, { borderColor: colors.line }, date === draft_date && { backgroundColor: colors.ink, borderColor: colors.ink }]}><Text style={{ color: date === draft_date ? colors.paper : colors.ink, fontSize: 12 }}>{short_date_label(date, today)} {date.slice(-2)}日</Text></Pressable>)}</ScrollView>
            {form_error !== '' && <Text accessibilityRole="alert" style={[styles.form_error, { color: colors.danger }]}>{form_error}</Text>}
            <Pressable accessibilityRole="button" accessibilityLabel="保存任务" disabled={!draft_name.trim()} onPress={save_task} style={[styles.save_button, { backgroundColor: colors.ink }, !draft_name.trim() && styles.disabled]}><Text style={[styles.save_text, { color: colors.paper }]}>{editing_task_id ? '保存修改' : '添加任务'}</Text></Pressable>
          </ScrollView>
        </View></KeyboardAvoidingView></View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: 24, paddingBottom: 40 },
  intro: { padding: 20, borderRadius: 23, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  intro_copy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 11, letterSpacing: 0.6, marginBottom: 5 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 7 },
  description: { fontSize: 13, lineHeight: 20 },
  date_row: { gap: 9, paddingVertical: 22 },
  date_button: { width: 61, height: 78, borderWidth: 1, borderRadius: 19, alignItems: 'center', justifyContent: 'center', gap: 3 },
  date_week: { fontSize: 10 },
  date_number: { fontSize: 20, fontWeight: '800' },
  date_month: { fontSize: 9 },
  heading: { marginBottom: 13, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  section_title: { fontSize: 20, fontWeight: '700' },
  count: { fontSize: 12 },
  empty: { minHeight: 190, borderRadius: 20, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  empty_title: { fontSize: 16, fontWeight: '700' },
  empty_copy: { fontSize: 12, textAlign: 'center' },
  task_row: { minHeight: 62, padding: 14, borderWidth: 1, borderRadius: 17, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  checkbox: { width: 27, height: 27, borderWidth: 2, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  task_name: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 20 },
  strike: { textDecorationLine: 'line-through' },
  icon_button: { width: 28, height: 34, alignItems: 'center', justifyContent: 'center' },
  add_button: { minHeight: 52, marginTop: 10, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  add_text: { fontSize: 14, fontWeight: '700' },
  modal_backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  modal_keyboard: { width: '100%' },
  modal: { maxHeight: '82%', padding: 24, paddingBottom: 32, borderTopLeftRadius: 25, borderTopRightRadius: 25 },
  modal_heading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  modal_title: { fontSize: 20, fontWeight: '700' },
  modal_subtitle: { marginTop: 4, fontSize: 11 },
  modal_scroll: { paddingBottom: 3 },
  modal_label: { marginTop: 16, marginBottom: 7, fontSize: 12 },
  modal_input: { minHeight: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontSize: 15 },
  modal_dates: { gap: 8, paddingBottom: 6 },
  modal_date: { paddingHorizontal: 13, minHeight: 38, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  form_error: { marginTop: 10, fontSize: 12, lineHeight: 18 },
  save_button: { minHeight: 51, borderRadius: 14, marginTop: 20, alignItems: 'center', justifyContent: 'center' },
  save_text: { fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});

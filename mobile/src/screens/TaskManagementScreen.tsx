import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { add_days, format_date_label, local_date_key, weekday_label } from '../utils/date';
import { useWorkspace } from '../state/WorkspaceContext';

type Props = NativeStackScreenProps<RootStackParamList, '任务管理'>;

export default function TaskManagementScreen({ route }: Props) {
  const { data, colors, toggle_task, add_task, edit_task, remove_task } = useWorkspace();
  const today = local_date_key();
  const date_options = useMemo(() => Array.from({ length: 7 }, (_, index) => add_days(today, index)), [today]);
  const [selected_date, setSelectedDate] = useState(route.params?.task_date ?? today);
  const [editor_visible, setEditorVisible] = useState(false);
  const [editing_task_id, setEditingTaskId] = useState<string | null>(null);
  const [draft_name, setDraftName] = useState('');
  const [draft_date, setDraftDate] = useState(today);

  const visible_tasks = data.tasks.filter((task) => task.task_date === selected_date);

  useEffect(() => {
    const task_id = route.params?.edit_task_id;
    if (!task_id) return;
    const task = data.tasks.find((item) => item.task_id === task_id);
    if (task) {
      setSelectedDate(task.task_date);
      setEditingTaskId(task.task_id);
      setDraftName(task.task_name);
      setDraftDate(task.task_date);
      setEditorVisible(true);
    }
  }, [data.tasks, route.params?.edit_task_id]);

  function open_new() {
    setEditingTaskId(null);
    setDraftName('');
    setDraftDate(selected_date);
    setEditorVisible(true);
  }

  function open_edit(task_id: string) {
    const task = data.tasks.find((item) => item.task_id === task_id);
    if (!task) return;
    setEditingTaskId(task.task_id);
    setDraftName(task.task_name);
    setDraftDate(task.task_date);
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
    if (!name) return;
    if (editing_task_id) edit_task(editing_task_id, name, draft_date);
    else add_task(name, draft_date);
    setSelectedDate(draft_date);
    setEditorVisible(false);
  }

  return (
    <KeyboardAvoidingView style={[styles.page, { backgroundColor: colors.canvas }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <View style={styles.intro_copy}><Text style={[styles.eyebrow, { color: colors.muted }]}>只安排哪一天做什么</Text><Text style={[styles.title, { color: colors.ink }]}>任务清单</Text><Text style={[styles.description, { color: colors.muted }]}>任务不设置具体时间；需要精确到分钟的内容请放进今日计划。</Text></View>
          <MaterialCommunityIcons color={colors.ink} name="format-list-checks" size={30} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.date_row}>
          {date_options.map((date) => <Pressable accessibilityRole="button" accessibilityState={{ selected: date === selected_date }} accessibilityLabel={`选择${format_date_label(date, true)}`} key={date} onPress={() => setSelectedDate(date)} style={[styles.date_button, { backgroundColor: colors.paper, borderColor: colors.line }, date === selected_date && { backgroundColor: colors.ink, borderColor: colors.ink }]}><Text style={[styles.date_week, { color: date === selected_date ? colors.muted : colors.muted }]}>{date === today ? '今天' : weekday_label(date)}</Text><Text style={[styles.date_number, { color: date === selected_date ? colors.paper : colors.ink }]}>{date.slice(-2)}</Text></Pressable>)}
        </ScrollView>
        <View style={styles.heading}><Text style={[styles.section_title, { color: colors.ink }]}>{format_date_label(selected_date, true)}</Text><Text style={[styles.count, { color: colors.muted }]}>{visible_tasks.length} 项</Text></View>
        {visible_tasks.length === 0 ? <View style={[styles.empty, { backgroundColor: colors.paper }]}><MaterialCommunityIcons color={colors.muted} name="playlist-plus" size={30} /><Text style={[styles.empty_title, { color: colors.ink }]}>这一天还没有任务</Text><Text style={[styles.empty_copy, { color: colors.muted }]}>添加一个不带具体时间的待办事项。</Text></View> : visible_tasks.map((task) => <View key={task.task_id} style={[styles.task_row, { backgroundColor: colors.paper, borderColor: colors.line }]}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: task.completed }} accessibilityLabel={`标记${task.task_name}`} onPress={() => toggle_task(task.task_id)} style={[styles.checkbox, { borderColor: colors.line }, task.completed && { backgroundColor: colors.ink, borderColor: colors.ink }]}>{task.completed && <MaterialCommunityIcons color={colors.paper} name="check" size={17} />}</Pressable><Text style={[styles.task_name, { color: task.completed ? colors.muted : colors.ink }, task.completed && styles.strike]}>{task.task_name}</Text><Pressable accessibilityRole="button" accessibilityLabel={`编辑${task.task_name}`} onPress={() => open_edit(task.task_id)} hitSlop={8} style={styles.icon_button}><MaterialCommunityIcons color={colors.ink} name="pencil-outline" size={19} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`删除${task.task_name}`} onPress={() => confirm_remove(task.task_id)} hitSlop={8} style={styles.icon_button}><MaterialCommunityIcons color={colors.muted} name="trash-can-outline" size={19} /></Pressable></View>)}
        <Pressable accessibilityRole="button" accessibilityLabel="添加任务" onPress={open_new} style={[styles.add_button, { backgroundColor: colors.ink }]}><MaterialCommunityIcons color={colors.paper} name="plus" size={20} /><Text style={[styles.add_text, { color: colors.paper }]}>添加任务</Text></Pressable>
      </ScrollView>
      <Modal visible={editor_visible} transparent animationType="slide" onRequestClose={() => setEditorVisible(false)}>
        <View style={styles.modal_backdrop}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modal_keyboard}><View style={[styles.modal, { backgroundColor: colors.paper }]}><View style={styles.modal_heading}><Text style={[styles.modal_title, { color: colors.ink }]}>{editing_task_id ? '编辑任务' : '新增任务'}</Text><Pressable accessibilityRole="button" accessibilityLabel="关闭编辑窗口" onPress={() => setEditorVisible(false)} hitSlop={8}><MaterialCommunityIcons color={colors.muted} name="close" size={23} /></Pressable></View><Text style={[styles.modal_label, { color: colors.muted }]}>任务内容</Text><TextInput autoFocus accessibilityLabel="任务内容" value={draft_name} onChangeText={setDraftName} onSubmitEditing={save_task} placeholder="例如：整理客户反馈" placeholderTextColor={colors.muted} style={[styles.modal_input, { color: colors.ink, backgroundColor: colors.canvas, borderColor: colors.line }]} returnKeyType="done" /><Text style={[styles.modal_label, { color: colors.muted }]}>安排日期</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modal_dates}>{date_options.slice(0, 3).map((date) => <Pressable accessibilityRole="button" accessibilityState={{ selected: date === draft_date }} accessibilityLabel={`安排在${format_date_label(date, true)}`} key={date} onPress={() => setDraftDate(date)} style={[styles.modal_date, { borderColor: colors.line }, date === draft_date && { backgroundColor: colors.ink, borderColor: colors.ink }]}><Text style={{ color: date === draft_date ? colors.paper : colors.ink, fontSize: 12 }}>{date === today ? '今天' : weekday_label(date)} {date.slice(-2)}日</Text></Pressable>)}</ScrollView><Pressable accessibilityRole="button" accessibilityLabel="保存任务" disabled={!draft_name.trim()} onPress={save_task} style={[styles.save_button, { backgroundColor: colors.ink }, !draft_name.trim() && styles.disabled]}><Text style={[styles.save_text, { color: colors.paper }]}>保存</Text></Pressable></View></KeyboardAvoidingView></View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: 24, paddingBottom: 40 },
  intro: { padding: 20, borderRadius: 23, backgroundColor: '#E8EDFB', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  intro_copy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 11, letterSpacing: 0.6, marginBottom: 5 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 7 },
  description: { fontSize: 13, lineHeight: 20 },
  date_row: { gap: 9, paddingVertical: 22 },
  date_button: { width: 58, height: 70, borderWidth: 1, borderRadius: 19, alignItems: 'center', justifyContent: 'center', gap: 5 },
  date_week: { fontSize: 10 },
  date_number: { fontSize: 20, fontWeight: '800' },
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
  modal: { padding: 24, paddingBottom: 32, borderTopLeftRadius: 25, borderTopRightRadius: 25 },
  modal_heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  modal_title: { fontSize: 20, fontWeight: '700' },
  modal_label: { fontSize: 12, marginBottom: 7, marginTop: 10 },
  modal_input: { minHeight: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontSize: 15 },
  modal_dates: { gap: 8, paddingBottom: 6 },
  modal_date: { paddingHorizontal: 13, minHeight: 38, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  save_button: { minHeight: 51, borderRadius: 14, marginTop: 20, alignItems: 'center', justifyContent: 'center' },
  save_text: { fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});

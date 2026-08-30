import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { get_runtime_api_base_url, is_mock_api_mode, normalize_api_base_url, test_api_connection, user_facing_api_error } from '../api';
import { clear_persisted_runtime_api_base_url, persist_runtime_api_base_url } from '../api/runtime';
import { useWorkspace } from '../state/WorkspaceContext';

type ConnectionState = 'idle' | 'checking' | 'ready' | 'error';

export default function CustomizeScreen() {
  const { data, colors, update, add_task: add_workspace_task, remove_task, toggle_theme } = useWorkspace();
  const [new_task, setNewTask] = useState('');
  const [saved, setSaved] = useState(false);
  const [api_url, setApiUrl] = useState(() => get_runtime_api_base_url());
  const [connection_state, setConnectionState] = useState<ConnectionState>('idle');
  const [connection_message, setConnectionMessage] = useState('');
  const saved_timer_ref = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (saved_timer_ref.current) clearTimeout(saved_timer_ref.current);
  }, []);

  function add_task() {
    const task_name = new_task.trim();
    if (!task_name) return;
    add_workspace_task(task_name);
    setNewTask('');
  }

  function save_settings() {
    setSaved(true);
    if (saved_timer_ref.current) clearTimeout(saved_timer_ref.current);
    saved_timer_ref.current = setTimeout(() => setSaved(false), 1600);
  }

  async function test_connection() {
    const normalized = normalize_api_base_url(api_url);
    if (!normalized) {
      if (is_mock_api_mode() && !api_url.trim()) {
        setConnectionState('ready');
        setConnectionMessage('本地演示模式已启用，页面使用明确的 mock 数据。');
        return;
      }
      setConnectionState('error');
      setConnectionMessage('请输入完整的 HTTP 或 HTTPS 后端地址。');
      return;
    }
    setConnectionState('checking');
    setConnectionMessage('正在检查后端、数据库和 Redis 状态...');
    try {
      const health = await test_api_connection(normalized);
      if (health.status !== 'ready') throw new Error('后端尚未就绪');
      await persist_runtime_api_base_url(normalized);
      setApiUrl(normalized);
      setConnectionState('ready');
      setConnectionMessage('连接成功，已保存当前后端地址。');
    } catch (error) {
      setConnectionState('error');
      setConnectionMessage(user_facing_api_error(error, '连接失败，请检查后端和公网隧道。'));
    }
  }

  async function restore_build_address() {
    try {
      await clear_persisted_runtime_api_base_url();
      const build_address = get_runtime_api_base_url();
      setApiUrl(build_address);
      setConnectionState('idle');
      setConnectionMessage(build_address ? '已恢复构建时地址，请先测试连接。' : '已清除运行时地址，请输入后端地址。');
    } catch {
      setConnectionState('error');
      setConnectionMessage('无法清除运行时地址，请稍后重试。');
    }
  }

  const current_address = api_url.trim() || '未配置';

  return (
    <ScrollView style={{ backgroundColor: colors.canvas }} contentContainerStyle={[styles.content, { backgroundColor: colors.canvas }]} keyboardShouldPersistTaps="handled">
      <View style={styles.heading}><View><Text style={[styles.eyebrow, { color: colors.muted }]}>工作区设置</Text><Text style={[styles.title, { color: colors.ink }]}>自主 DIY</Text></View></View>
      <Text style={[styles.description, { color: colors.muted }]}>调整你的项目内容与视觉风格，保存后首页会即时应用。</Text>

      <View style={[styles.card, { backgroundColor: colors.paper, borderColor: colors.line }]}>
        <View style={[styles.card_icon, { backgroundColor: colors.blue }]}><MaterialCommunityIcons color={colors.ink} name="view-dashboard-outline" size={20} /></View>
        <Text style={[styles.card_title, { color: colors.ink }]}>项目内容</Text>
        <Text style={[styles.card_copy, { color: colors.muted }]}>编辑卡片上展示的文字</Text>
        <Text style={[styles.label, { color: colors.muted }]}>项目名称</Text>
        <TextInput accessibilityLabel="项目名称" value={data.project_name} onChangeText={(value) => update({ ...data, project_name: value })} style={[styles.input, { color: colors.ink, borderColor: colors.line, backgroundColor: colors.canvas }]} />
        <Text style={[styles.label, { color: colors.muted }]}>一句话描述</Text>
        <TextInput accessibilityLabel="项目描述" multiline value={data.project_description} onChangeText={(value) => update({ ...data, project_description: value })} style={[styles.input, styles.textarea, { color: colors.ink, borderColor: colors.line, backgroundColor: colors.canvas }]} />
      </View>

      <View style={[styles.card, { backgroundColor: colors.paper, borderColor: colors.line }]}>
        <View style={[styles.card_icon, { backgroundColor: colors.blue }]}><MaterialCommunityIcons color={colors.ink} name="format-list-checks" size={20} /></View>
        <Text style={[styles.card_title, { color: colors.ink }]}>新增任务</Text>
        <Text style={[styles.card_copy, { color: colors.muted }]}>快速添加一条不带具体时间的待办事项</Text>
        <View style={styles.add_row}><TextInput accessibilityLabel="新任务" value={new_task} onChangeText={setNewTask} onSubmitEditing={add_task} placeholder="例如：整理客户反馈" placeholderTextColor={colors.muted} style={[styles.input, styles.add_input, { color: colors.ink, borderColor: colors.line, backgroundColor: colors.canvas }]} /><Pressable accessibilityRole="button" accessibilityLabel="添加任务" onPress={add_task} disabled={!new_task.trim()} style={[styles.add_button, { backgroundColor: colors.ink }, !new_task.trim() && styles.disabled]}><MaterialCommunityIcons color={colors.paper} name="plus" size={18} /><Text style={{ color: colors.paper, fontWeight: '700' }}>添加</Text></Pressable></View>
        <View style={styles.editable_list}>{data.tasks.map((task) => <View key={task.task_id} style={styles.editable}><Pressable accessibilityRole="button" accessibilityLabel={`切换${task.task_name}完成状态`} onPress={() => update((current) => ({ ...current, tasks: current.tasks.map((item) => item.task_id === task.task_id ? { ...item, completed: !item.completed } : item) }))} style={[styles.small_button, { backgroundColor: colors.blue }]}><MaterialCommunityIcons color={colors.ink} name={task.completed ? 'check' : 'circle-outline'} size={16} /></Pressable><Text style={[styles.editable_text, { color: task.completed ? colors.muted : colors.ink }, task.completed && styles.strike]}>{task.task_name}</Text><Pressable accessibilityRole="button" accessibilityLabel={`删除${task.task_name}`} onPress={() => remove_task(task.task_id)} hitSlop={8}><MaterialCommunityIcons color={colors.muted} name="close" size={19} /></Pressable></View>)}</View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.paper, borderColor: colors.line }]}>
        <View style={[styles.card_icon, { backgroundColor: colors.blue }]}><MaterialCommunityIcons color={colors.ink} name="theme-light-dark" size={20} /></View>
        <Text style={[styles.card_title, { color: colors.ink }]}>视觉偏好</Text>
        <Text style={[styles.card_copy, { color: colors.muted }]}>选择最适合你的主题</Text>
        <View style={styles.theme_options}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: data.theme === 'light' }} onPress={() => data.theme !== 'light' && toggle_theme()} style={[styles.theme_option, { borderColor: data.theme === 'light' ? colors.ink : colors.line }]}><View style={[styles.preview, { backgroundColor: '#F8F8F6' }]} /><Text style={{ color: colors.ink }}>浅色</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: data.theme === 'dark' }} onPress={() => data.theme !== 'dark' && toggle_theme()} style={[styles.theme_option, { borderColor: data.theme === 'dark' ? colors.ink : colors.line }]}><View style={[styles.preview, { backgroundColor: '#252525' }]} /><Text style={{ color: colors.ink }}>深色</Text></Pressable>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.paper, borderColor: colors.line }]}>
        <View style={[styles.card_icon, { backgroundColor: colors.blue }]}><MaterialCommunityIcons color={colors.ink} name="cloud-sync-outline" size={20} /></View>
        <Text style={[styles.card_title, { color: colors.ink }]}>后端连接</Text>
        <Text style={[styles.card_copy, { color: colors.muted }]}>公网隧道变化时只需更新地址，不必重新安装 APK。</Text>
        <Text style={[styles.label, { color: colors.muted }]}>API 地址</Text>
        <TextInput accessibilityLabel="后端 API 地址" autoCapitalize="none" autoCorrect={false} keyboardType="url" value={api_url} onChangeText={(value) => { setApiUrl(value); setConnectionState('idle'); setConnectionMessage(''); }} placeholder="https://你的后端地址" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.ink, borderColor: colors.line, backgroundColor: colors.canvas }]} />
        <Text style={[styles.address_hint, { color: colors.muted }]}>当前：{current_address}</Text>
        {is_mock_api_mode() && <Text style={[styles.mode_hint, { color: colors.muted }]}>当前构建为本地 mock 模式；填写地址并测试后会切换为真实请求。</Text>}
        {connection_message !== '' && <Text accessibilityRole="alert" style={[styles.connection_message, { color: connection_state === 'error' ? colors.danger : colors.muted }]}>{connection_message}</Text>}
        <View style={styles.connection_actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="测试后端连接" disabled={connection_state === 'checking'} onPress={() => void test_connection()} style={[styles.connection_button, { backgroundColor: colors.ink }, connection_state === 'checking' && styles.disabled]}>{connection_state === 'checking' ? <ActivityIndicator color={colors.paper} size="small" /> : <MaterialCommunityIcons color={colors.paper} name="connection" size={17} />}<Text style={[styles.connection_button_text, { color: colors.paper }]}>测试连接</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="恢复构建时后端地址" onPress={() => void restore_build_address()} style={[styles.restore_button, { borderColor: colors.line }]}><MaterialCommunityIcons color={colors.ink} name="restore" size={17} /><Text style={[styles.restore_button_text, { color: colors.ink }]}>恢复构建地址</Text></Pressable>
        </View>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="保存设置" onPress={save_settings} style={[styles.save, { backgroundColor: colors.ink }]}><Text style={{ color: colors.paper, fontWeight: '700' }}>{saved ? '已保存' : '保存设置'}</Text></Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: 32 },
  heading: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontSize: 11, letterSpacing: 0.6, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '700' },
  description: { marginHorizontal: 24, marginBottom: 20, fontSize: 13, lineHeight: 21 },
  card: { marginHorizontal: 24, marginBottom: 14, padding: 19, borderWidth: 1, borderRadius: 23 },
  card_icon: { width: 38, height: 38, marginBottom: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  card_title: { fontSize: 16, fontWeight: '700' },
  card_copy: { marginTop: 4, marginBottom: 15, fontSize: 12, lineHeight: 18 },
  label: { marginTop: 12, fontSize: 12 },
  input: { width: '100%', minHeight: 45, marginTop: 7, paddingHorizontal: 13, paddingVertical: 11, borderWidth: 1, borderRadius: 13, fontSize: 13 },
  textarea: { minHeight: 75, textAlignVertical: 'top' },
  add_row: { flexDirection: 'row', gap: 8 },
  add_input: { flex: 1, minWidth: 0, marginTop: 0 },
  add_button: { minWidth: 72, paddingHorizontal: 12, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 3 },
  disabled: { opacity: 0.45 },
  editable_list: { gap: 7, marginTop: 14 },
  editable: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 9 },
  small_button: { width: 25, height: 25, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  editable_text: { flex: 1, minWidth: 0, fontSize: 13 },
  strike: { textDecorationLine: 'line-through' },
  theme_options: { flexDirection: 'row', gap: 10 },
  theme_option: { flex: 1, padding: 10, borderWidth: 1, borderRadius: 14, alignItems: 'center', gap: 6 },
  preview: { width: '100%', height: 30, borderRadius: 8 },
  address_hint: { marginTop: 8, fontSize: 11, lineHeight: 17 },
  mode_hint: { marginTop: 5, fontSize: 11, lineHeight: 17 },
  connection_message: { marginTop: 10, fontSize: 12, lineHeight: 18 },
  connection_actions: { marginTop: 14, flexDirection: 'row', gap: 8 },
  connection_button: { flex: 1, minHeight: 45, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  connection_button_text: { fontSize: 12, fontWeight: '700' },
  restore_button: { flex: 1, minHeight: 45, borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 },
  restore_button_text: { fontSize: 12, fontWeight: '700' },
  save: { minHeight: 50, marginHorizontal: 24, marginTop: 6, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});

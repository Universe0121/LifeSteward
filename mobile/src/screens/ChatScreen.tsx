import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api_client, type ChatHistoryItem } from '../api';
import VoiceInputButton from '../components/VoiceInputButton';
import { extract_task_name, is_plan_request, is_task_only_request, normalize_plan_items, requested_date_key } from '../domain/planning';
import { useConversationId } from '../hooks/useConversationId';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { useAuth } from '../state/AuthContext';
import { useWorkspace } from '../state/WorkspaceContext';
import { local_date_key } from '../utils/date';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  kind?: 'welcome' | 'error';
  failed_input?: string;
};

const message_storage_prefix = 'lifeagent_chat_messages_v2_';
const max_saved_messages = 200;

function message_storage_key(user_id: number): string {
  return `${message_storage_prefix}${user_id}`;
}

function welcome_message(display_name: string): Message {
  return {
    id: `welcome-${local_date_key()}`,
    role: 'assistant',
    kind: 'welcome',
    content: `你好，${display_name || '朋友'}！\n把正在发生的生活告诉我，我们一起理清下一步。`,
  };
}

function normalize_messages(value: unknown): Message[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Partial<Message>;
    if ((candidate.role !== 'user' && candidate.role !== 'assistant') || typeof candidate.content !== 'string') return [];
    const content = candidate.content.trim();
    if (!content) return [];
    return [{
      id: typeof candidate.id === 'string' && candidate.id ? candidate.id : `message-${Date.now()}-${Math.random()}`,
      role: candidate.role,
      content,
      kind: candidate.kind === 'welcome' || candidate.kind === 'error' ? candidate.kind : undefined,
      failed_input: typeof candidate.failed_input === 'string' ? candidate.failed_input : undefined,
    }];
  }).slice(-max_saved_messages);
}

function history_from_messages(messages: Message[]): ChatHistoryItem[] {
  return messages
    .filter((message) => !message.kind)
    .slice(-20)
    .map(({ role, content }) => ({ role, content }));
}

export default function ChatScreen() {
  const { colors, add_task, add_plans } = useWorkspace();
  const { user_id, display_name } = useAuth();
  const conversation_id = useConversationId();
  const list_ref = useRef<FlatList<Message>>(null);
  const messages_ref = useRef<Message[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messages_ready, setMessagesReady] = useState(false);
  const [user_input, setUserInput] = useState('');
  const [sending, setSending] = useState(false);
  const [failed_input, setFailedInput] = useState<string | null>(null);

  const commit_messages = useCallback((next_messages: Message[]) => {
    const bounded_messages = next_messages.slice(-max_saved_messages);
    messages_ref.current = bounded_messages;
    setMessages(bounded_messages);
  }, []);

  useEffect(() => {
    let active = true;
    setMessagesReady(false);
    AsyncStorage.getItem(message_storage_key(user_id))
      .then((saved) => {
        if (!active) return;
        let loaded_messages: Message[] = [];
        if (saved) {
          try {
            loaded_messages = normalize_messages(JSON.parse(saved));
          } catch {
            loaded_messages = [];
          }
        }
        const today_welcome_id = `welcome-${local_date_key()}`;
        if (!loaded_messages.some((message) => message.id === today_welcome_id)) {
          loaded_messages = [...loaded_messages, welcome_message(display_name)];
        }
        commit_messages(loaded_messages);
        const last_error = [...loaded_messages].reverse().find((message) => message.kind === 'error');
        setFailedInput(last_error?.failed_input ?? null);
      })
      .catch(() => {
        if (active) commit_messages([welcome_message(display_name)]);
      })
      .finally(() => {
        if (active) setMessagesReady(true);
      });
    return () => {
      active = false;
    };
  }, [commit_messages, display_name, user_id]);

  useEffect(() => {
    if (!messages_ready) return;
    void AsyncStorage.setItem(message_storage_key(user_id), JSON.stringify(messages_ref.current)).catch(() => undefined);
  }, [messages, messages_ready, user_id]);

  const scroll_to_end = useCallback(() => {
    requestAnimationFrame(() => list_ref.current?.scrollToEnd({ animated: true }));
  }, []);

  useEffect(() => {
    if (messages_ready) scroll_to_end();
  }, [messages.length, messages_ready, scroll_to_end]);

  const on_transcribed = useCallback((text: string) => setUserInput(text), []);
  const voice = useVoiceInput(user_id, on_transcribed);

  function persist_next_message(message: Message) {
    commit_messages([...messages_ref.current, message]);
  }

  function apply_chat_result(input: string, generated_plan: Array<Record<string, unknown>> | undefined) {
    const plan_date = requested_date_key(input);
    if (is_task_only_request(input)) {
      add_task(extract_task_name(input), plan_date);
      return;
    }
    if (is_plan_request(input)) {
      const plans = normalize_plan_items(generated_plan);
      if (plans.length > 0) add_plans(plans, plan_date);
    }
  }

  async function send_message(value: string, retry = false) {
    const content = value.trim();
    if (!content || !conversation_id || sending || !messages_ready) return;

    const current_messages = messages_ref.current;
    const retry_error_index = retry
      ? [...current_messages].map((message, index) => ({ message, index })).reverse().find(({ message }) => message.kind === 'error' && message.failed_input === content)?.index
      : undefined;
    const history_source = retry_error_index === undefined
      ? current_messages
      : current_messages.slice(0, retry_error_index);
    const conversation_history = history_from_messages(history_source);

    if (!retry) persist_next_message({ id: `${Date.now()}-user`, role: 'user', content });
    else if (retry_error_index !== undefined) commit_messages(current_messages.slice(0, retry_error_index));
    setUserInput('');
    setFailedInput(null);
    setSending(true);
    try {
      const response = await api_client.postChat({
        user_id,
        conversation_id,
        user_input: content,
        conversation_history,
      });
      apply_chat_result(content, response.generated_plan);
      persist_next_message({ id: `${Date.now()}-assistant`, role: 'assistant', content: response.assistant_response });
    } catch {
      setFailedInput(content);
      persist_next_message({
        id: `${Date.now()}-error`,
        role: 'assistant',
        kind: 'error',
        failed_input: content,
        content: '请求暂时失败，可以重试，或继续用文字记录。',
      });
    } finally {
      setSending(false);
    }
  }

  function render_message({ item }: { item: Message }) {
    if (item.kind === 'welcome') {
      const [welcome_title, ...welcome_copy] = item.content.split('\n');
      return <View style={[styles.welcome, { backgroundColor: colors.ink }]}>
        <Text style={[styles.eyebrow, { color: colors.muted }]}>今天，照顾好自己的节奏</Text>
        <Text style={[styles.welcome_title, { color: colors.paper }]}>{welcome_title}</Text>
        <Text style={[styles.welcome_copy, { color: colors.muted }]}>{welcome_copy.join('\n')}</Text>
      </View>;
    }
    const is_user = item.role === 'user';
    return <View style={[styles.message, is_user && styles.user_message]}>
      <View style={[styles.avatar, { backgroundColor: is_user ? colors.ink : colors.blue }]}>
        <Text style={{ color: is_user ? colors.paper : colors.blue_strong, fontSize: 12, fontWeight: '700' }}>{is_user ? '你' : '✦'}</Text>
      </View>
      <View style={[styles.bubble, { backgroundColor: is_user ? colors.ink : colors.paper }, is_user && styles.user_bubble, item.kind === 'error' && { borderWidth: 1, borderColor: colors.danger }]}>
        <Text style={{ color: is_user ? colors.paper : colors.ink, fontSize: 15, lineHeight: 23 }}>{item.content}</Text>
      </View>
    </View>;
  }

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0} style={[styles.page, { backgroundColor: colors.canvas }]}>
    <View style={[styles.topbar, { backgroundColor: colors.paper, borderBottomColor: colors.line }]}>
      <View style={styles.brand}><View style={[styles.brand_mark, { backgroundColor: colors.ink }]}><Text style={{ color: colors.paper, fontWeight: '800' }}>L</Text></View><View><Text style={[styles.eyebrow, { color: colors.muted }]}>LifeAgent</Text><Text style={[styles.title, { color: colors.ink }]}>AI 生活助手</Text></View></View>
      <View style={styles.online}><View style={[styles.dot, { backgroundColor: colors.green }]} /><Text style={[styles.eyebrow, { color: colors.muted }]}>在线</Text></View>
    </View>
    {!messages_ready ? <View style={styles.preparing}><ActivityIndicator color={colors.ink} /><Text style={[styles.preparing_text, { color: colors.muted }]}>正在加载聊天记录...</Text></View> : <FlatList
      ref={list_ref}
      style={styles.messages_list}
      contentContainerStyle={styles.messages}
      data={messages}
      keyExtractor={(item) => item.id}
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      keyboardShouldPersistTaps="handled"
      onContentSizeChange={scroll_to_end}
      renderItem={render_message}
      ListFooterComponent={failed_input ? <Pressable accessibilityRole="button" accessibilityLabel="重试上一条消息" onPress={() => void send_message(failed_input, true)} style={styles.retry}><MaterialCommunityIcons color={colors.ink} name="refresh" size={17} /><Text style={[styles.retry_text, { color: colors.ink }]}>重试上一条</Text></Pressable> : sending ? <View style={styles.typing}><ActivityIndicator color={colors.ink} size="small" /><Text style={[styles.typing_text, { color: colors.muted }]}>正在整理你的记录...</Text></View> : null}
    />}
    <View style={[styles.composer_wrap, { backgroundColor: colors.paper, borderTopColor: colors.line }]}>
      <View style={styles.composer}><TextInput accessibilityLabel="用户输入" editable={!sending} multiline value={user_input} onChangeText={setUserInput} placeholder="说点什么..." placeholderTextColor={colors.muted} style={[styles.input, { color: colors.ink, backgroundColor: colors.canvas }]} /><VoiceInputButton duration_ms={voice.duration_ms} error_message={voice.error_message} on_retry={voice.retry} on_start={() => void voice.start_recording()} on_stop={() => void voice.stop_recording()} state={voice.state} /><Pressable accessibilityRole="button" accessibilityLabel="发送" disabled={!user_input.trim() || sending || conversation_id === null || !messages_ready} onPress={() => void send_message(user_input)} style={[styles.send, { backgroundColor: colors.ink }, (!user_input.trim() || sending || conversation_id === null || !messages_ready) && styles.disabled]}>{sending ? <ActivityIndicator color={colors.paper} size="small" /> : <MaterialCommunityIcons color={colors.paper} name="arrow-up" size={22} />}</Pressable></View>
      <Text style={[styles.footer, { color: colors.muted }]}>语音会先转成文字，你确认后才会发送</Text>
    </View>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  topbar: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 16, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brand_mark: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 11, letterSpacing: 0.8, marginBottom: 3 },
  title: { fontSize: 20, fontWeight: '700' },
  online: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  messages_list: { flex: 1 },
  messages: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 14, gap: 18 },
  welcome: { padding: 24, borderRadius: 28, marginBottom: 2 },
  welcome_title: { marginVertical: 10, fontSize: 28, lineHeight: 36, fontWeight: '700' },
  welcome_copy: { fontSize: 13, lineHeight: 21 },
  preparing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  preparing_text: { fontSize: 13 },
  message: { maxWidth: '92%', flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  user_message: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  avatar: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '88%', padding: 14, borderRadius: 5, borderTopRightRadius: 18, borderBottomRightRadius: 18, borderBottomLeftRadius: 18 },
  user_bubble: { borderTopLeftRadius: 18, borderTopRightRadius: 5 },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  retry_text: { fontWeight: '700' },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  typing_text: { fontSize: 12 },
  composer_wrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, borderTopWidth: 1 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, minWidth: 0, minHeight: 42, maxHeight: 105, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 22, fontSize: 15 },
  send: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },
  footer: { textAlign: 'center', fontSize: 10, marginTop: 7 },
});

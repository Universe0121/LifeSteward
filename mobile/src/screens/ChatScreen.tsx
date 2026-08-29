import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api_client } from '../api';
import VoiceInputButton from '../components/VoiceInputButton';
import { useConversationId } from '../hooks/useConversationId';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { colors, spacing } from '../theme';

type Message = { id: string; role: 'user' | 'assistant'; content: string };
const user_id = 10001;

export default function ChatScreen() {
  const conversation_id = useConversationId();
  const [user_input, setUserInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([{ id: 'welcome', role: 'assistant', content: '早上好！把正在发生的生活告诉我，我们一起理清下一步。' }]);
  const [sending, setSending] = useState(false);
  const [failed_input, setFailedInput] = useState<string | null>(null);
  const on_transcribed = useCallback((text: string) => setUserInput(text), []);
  const voice = useVoiceInput(user_id, on_transcribed);

  async function send_message(message_content: string) {
    const content = message_content.trim();
    if (!content || !conversation_id || sending) return;
    setMessages((current) => [...current, { id: `${Date.now()}-user`, role: 'user', content }]);
    setUserInput(''); setFailedInput(null); setSending(true);
    try {
      const response = await api_client.postChat({ user_id, conversation_id, user_input: content });
      setMessages((current) => [...current, { id: `${Date.now()}-assistant`, role: 'assistant', content: response.assistant_response }]);
    } catch {
      setFailedInput(content);
      setMessages((current) => [...current, { id: `${Date.now()}-error`, role: 'assistant', content: '暂时没有收到后端回应。可以重试，或继续用文字记录。' }]);
    } finally { setSending(false); }
  }

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.page}>
    <View style={styles.header}><View><Text style={styles.eyebrow}>LIFEAGENT</Text><Text style={styles.title}>AI 生活助手</Text></View><View style={styles.status}><View style={styles.dot} /><Text style={styles.status_text}>在线</Text></View></View>
    <FlatList contentContainerStyle={styles.messages} data={messages} keyExtractor={(item) => item.id} renderItem={({ item }) => <View style={[styles.message_row, item.role === 'user' && styles.user_row]}><View style={[styles.avatar, item.role === 'user' && styles.user_avatar]}><Text style={styles.avatar_text}>{item.role === 'assistant' ? '✦' : '你'}</Text></View><View style={[styles.bubble, item.role === 'user' && styles.user_bubble]}><Text style={styles.bubble_text}>{item.content}</Text></View></View>} ListFooterComponent={failed_input ? <Pressable accessibilityRole="button" onPress={() => void send_message(failed_input)} style={styles.retry}><MaterialCommunityIcons color={colors.primary} name="refresh" size={17} /><Text style={styles.retry_text}>重试上一条</Text></Pressable> : null} />
    <View style={styles.composer_wrap}>
      <View style={styles.composer}><TextInput accessibilityLabel="生活记录输入框" editable={!sending} multiline maxLength={2000} onChangeText={setUserInput} placeholder="说点什么..." placeholderTextColor={colors.muted} style={styles.input} value={user_input} /><VoiceInputButton duration_ms={voice.duration_ms} error_message={voice.error_message} onRetry={voice.retry} onStart={() => void voice.start_recording()} onStop={() => void voice.stop_recording()} state={voice.state} /><Pressable accessibilityRole="button" accessibilityLabel="发送消息" disabled={sending || !user_input.trim()} onPress={() => void send_message(user_input)} style={[styles.send, (!user_input.trim() || sending) && styles.send_disabled]}>{sending ? <ActivityIndicator color={colors.paper} size="small" /> : <MaterialCommunityIcons color={colors.paper} name="arrow-up" size={22} />}</Pressable></View>
      <Text style={styles.footer_note}>语音会先转成文字，你确认后才会发送</Text>
    </View>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.canvas },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md, backgroundColor: colors.paper, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  eyebrow: { color: colors.muted, fontSize: 11, letterSpacing: 1, marginBottom: 4 },
  title: { color: colors.ink, fontSize: 23, fontWeight: '700' },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  status_text: { color: colors.muted, fontSize: 12 },
  messages: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  message_row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, maxWidth: '88%' },
  user_row: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  user_avatar: { backgroundColor: colors.primary },
  avatar_text: { color: colors.paper, fontSize: 12, fontWeight: '700' },
  bubble: { backgroundColor: colors.paper, padding: spacing.md, borderRadius: 8, flexShrink: 1, borderWidth: 1, borderColor: colors.border },
  user_bubble: { backgroundColor: '#DCEFE2', borderColor: '#C8E3D0' },
  bubble_text: { color: colors.ink, fontSize: 15, lineHeight: 23 },
  retry: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  retry_text: { color: colors.primary, fontWeight: '700' },
  composer_wrap: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.border },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: { flex: 1, minHeight: 44, maxHeight: 110, paddingHorizontal: spacing.md, paddingVertical: 11, backgroundColor: colors.canvas, borderRadius: 14, color: colors.ink, fontSize: 15 },
  send: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  send_disabled: { backgroundColor: '#AFC8B7' },
  footer_note: { color: colors.muted, textAlign: 'center', fontSize: 11, marginTop: spacing.sm },
});

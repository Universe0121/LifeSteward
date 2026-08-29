import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { VoiceInputState } from '../hooks/useVoiceInput';
import { light_colors } from '../theme';
type Props = { state: VoiceInputState; duration_ms: number; error_message: string; on_start: () => void; on_stop: () => void; on_retry: () => void };
function duration(value: number) { const seconds = Math.floor(value / 1000); return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
export default function VoiceInputButton({ state, duration_ms, error_message, on_start, on_stop, on_retry }: Props) {
  if (state === 'error') return <View style={styles.error_row} accessibilityLiveRegion="polite"><Text style={styles.error}>{error_message}</Text><Pressable onPress={on_retry} accessibilityRole="button" accessibilityLabel="重置语音输入"><Text style={styles.retry}>重试</Text></Pressable></View>;
  const recording = state === 'recording'; const transcribing = state === 'transcribing';
  return <Pressable accessibilityRole="button" accessibilityLabel={recording ? '停止录音' : transcribing ? '语音转写中' : '开始录音'} disabled={transcribing} onPress={recording ? on_stop : on_start} style={[styles.button, recording && styles.recording]}><MaterialCommunityIcons color={recording ? light_colors.danger : light_colors.ink} name={recording ? 'stop' : 'microphone-outline'} size={20} />{recording && <Text style={styles.duration}>{duration(duration_ms)}</Text>}{transcribing && <Text style={styles.transcribing}>转写中</Text>}</Pressable>;
}
const styles = StyleSheet.create({ button: { minWidth: 42, height: 42, paddingHorizontal: 9, borderRadius: 21, backgroundColor: light_colors.blue, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 }, recording: { backgroundColor: '#FDE8E8' }, duration: { color: light_colors.danger, fontWeight: '600' }, transcribing: { color: light_colors.muted, fontSize: 11 }, error_row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }, error: { flex: 1, color: light_colors.danger, fontSize: 11, lineHeight: 16 }, retry: { color: light_colors.ink, fontWeight: '700' } });

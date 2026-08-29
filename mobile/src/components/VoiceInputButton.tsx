import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import type { VoiceInputState } from '../hooks/useVoiceInput';

type VoiceInputButtonProps = {
  state: VoiceInputState;
  duration_ms: number;
  error_message: string;
  onStart: () => void;
  onStop: () => void;
  onRetry: () => void;
};

function format_duration(duration_ms: number): string {
  const seconds = Math.floor(duration_ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function VoiceInputButton({ state, duration_ms, error_message, onStart, onStop, onRetry }: VoiceInputButtonProps) {
  if (state === 'error') {
    return <View style={styles.error_row} accessibilityLiveRegion="polite"><Text style={styles.error_text}>{error_message}</Text><Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel="重置语音输入"><Text style={styles.retry_text}>重试</Text></Pressable></View>;
  }
  const recording = state === 'recording';
  const transcribing = state === 'transcribing';
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={recording ? '停止录音' : transcribing ? '语音转写中' : '开始录音'}
    disabled={transcribing}
    onPress={recording ? onStop : onStart}
    style={({ pressed }) => [styles.button, recording && styles.recording, pressed && styles.pressed]}
  >
    <MaterialCommunityIcons color={recording ? colors.danger : colors.primary} name={recording ? 'stop' : 'microphone-outline'} size={20} />
    {recording && <Text style={styles.duration}>{format_duration(duration_ms)}</Text>}
    {transcribing && <Text style={styles.transcribing}>转写中</Text>}
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { minWidth: 44, height: 44, paddingHorizontal: spacing.sm, borderRadius: 14, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.xs },
  recording: { backgroundColor: '#FDE8E8' },
  pressed: { opacity: 0.7 },
  duration: { color: colors.danger, fontWeight: '600' },
  transcribing: { color: colors.muted, fontSize: 12 },
  error_row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  error_text: { flex: 1, color: colors.danger, fontSize: 12, lineHeight: 18 },
  retry_text: { color: colors.primary, fontWeight: '600' },
});

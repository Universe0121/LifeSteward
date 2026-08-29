import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { VoiceInputState } from '../hooks/useVoiceInput';
import { useWorkspace } from '../state/WorkspaceContext';

type Props = {
  state: VoiceInputState;
  duration_ms: number;
  error_message: string;
  on_start: () => void;
  on_stop: () => void;
  on_retry: () => void;
};

function duration(value: number): string {
  const seconds = Math.floor(value / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function VoiceInputButton({ state, duration_ms, error_message, on_start, on_stop, on_retry }: Props) {
  const { colors } = useWorkspace();
  if (state === 'error') {
    return (
      <View style={styles.error_row} accessibilityLiveRegion="polite">
        <Text style={[styles.error, { color: colors.danger }]} numberOfLines={2}>{error_message}</Text>
        <Pressable onPress={on_retry} accessibilityRole="button" accessibilityLabel="重置语音输入" hitSlop={8}>
          <Text style={[styles.retry, { color: colors.ink }]}>重试</Text>
        </Pressable>
      </View>
    );
  }

  const recording = state === 'recording';
  const transcribing = state === 'transcribing';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={recording ? '停止录音' : transcribing ? '语音转写中' : '开始录音'}
      accessibilityState={{ disabled: transcribing, busy: transcribing }}
      disabled={transcribing}
      onPress={recording ? on_stop : on_start}
      style={[
        styles.button,
        { backgroundColor: colors.blue },
        recording && { backgroundColor: colors.danger + '22' },
      ]}
    >
      {transcribing ? <ActivityIndicator color={colors.ink} size="small" /> : <MaterialCommunityIcons color={recording ? colors.danger : colors.ink} name={recording ? 'stop' : 'microphone-outline'} size={20} />}
      {recording && <Text style={[styles.duration, { color: colors.danger }]}>{duration(duration_ms)}</Text>}
      {transcribing && <Text style={[styles.transcribing, { color: colors.muted }]}>转写中</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 42,
    height: 42,
    paddingHorizontal: 9,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  duration: {
    fontWeight: '600',
  },
  transcribing: {
    fontSize: 11,
  },
  error_row: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  error: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    lineHeight: 16,
  },
  retry: {
    fontWeight: '700',
  },
});

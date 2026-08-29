import { Audio } from 'expo-av';
import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { api_client } from '../api';
export type VoiceInputState = 'idle' | 'recording' | 'transcribing' | 'error';
export function useVoiceInput(user_id: number, on_transcribed: (text: string) => void) {
  const recording_ref = useRef<Audio.Recording | null>(null);
  const [state, setState] = useState<VoiceInputState>('idle');
  const [error_message, setErrorMessage] = useState('');
  const [duration_ms, setDurationMs] = useState(0);
  const start_recording = useCallback(async () => {
    if (Platform.OS === 'web') { setState('error'); setErrorMessage('当前浏览器不支持移动端录音，请直接输入文字。'); return; }
    try { setErrorMessage(''); const permission = await Audio.requestPermissionsAsync(); if (!permission.granted) { setState('error'); setErrorMessage('麦克风权限未开启，请在系统设置中允许后重试。'); return; } await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true }); const result = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY, (status) => setDurationMs(status.durationMillis ?? 0)); recording_ref.current = result.recording; setDurationMs(0); setState('recording'); } catch { setState('error'); setErrorMessage('录音启动失败，请保留文字输入或稍后重试。'); }
  }, []);
  const stop_recording = useCallback(async () => { const recording = recording_ref.current; if (!recording) return; recording_ref.current = null; setState('transcribing'); try { await recording.stopAndUnloadAsync(); const uri = recording.getURI(); if (!uri) throw new Error('missing recording'); const response = await api_client.transcribeAudio(uri, user_id, 'zh-CN'); on_transcribed(response.text); setState('idle'); } catch { setState('error'); setErrorMessage('语音转写暂时不可用，请直接输入文字或稍后重试。'); } }, [on_transcribed, user_id]);
  const retry = useCallback(() => { setState('idle'); setErrorMessage(''); }, []);
  return { state, error_message, duration_ms, start_recording, stop_recording, retry };
}

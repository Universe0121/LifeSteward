import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { api_client } from '../api';

export type VoiceInputState = 'idle' | 'recording' | 'transcribing' | 'error';

const max_recording_duration_ms = 60_000;

function recording_options() {
  const preset = Audio.RecordingOptionsPresets.HIGH_QUALITY;
  return {
    ...preset,
    // Keep the container accepted by the StepFun ASR contract on both mobile platforms.
    android: { ...preset.android, extension: '.m4a', numberOfChannels: 1 },
    ios: { ...preset.ios, extension: '.m4a', numberOfChannels: 1 },
  };
}

export function useVoiceInput(user_id: number, on_transcribed: (text: string) => void) {
  const recording_ref = useRef<Audio.Recording | null>(null);
  const stop_timer_ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted_ref = useRef(true);
  const [state, setState] = useState<VoiceInputState>('idle');
  const [error_message, setErrorMessage] = useState('');
  const [duration_ms, setDurationMs] = useState(0);

  const update_state = useCallback((next_state: VoiceInputState, message = '') => {
    if (!mounted_ref.current) return;
    setState(next_state);
    setErrorMessage(message);
  }, []);

  const clear_stop_timer = useCallback(() => {
    if (stop_timer_ref.current !== null) {
      clearTimeout(stop_timer_ref.current);
      stop_timer_ref.current = null;
    }
  }, []);

  const restore_audio_mode = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
    } catch {
      // Audio mode restoration is best effort after native cleanup.
    }
  }, []);

  const release_recording = useCallback(async (recording: Audio.Recording | null) => {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
    } catch {
      // The native recorder may already have released its resource.
    }
  }, []);

  const delete_recording_file = useCallback(async (uri: string | null) => {
    if (!uri) return;
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch {
      // A temporary recording is best-effort cleanup and never blocks text input.
    }
  }, []);

  const stop_recording = useCallback(async () => {
    clear_stop_timer();
    const recording = recording_ref.current;
    if (!recording) return;
    recording_ref.current = null;
    update_state('transcribing', '');
    let uri: string | null = null;
    try {
      await recording.stopAndUnloadAsync();
      uri = recording.getURI();
      if (!uri) throw new Error('recording uri is missing');
      const response = await api_client.transcribeAudio(uri, user_id, 'zh-CN');
      const text = response.text.trim();
      if (!text) {
        update_state('error', '没有识别到有效语音，请重试或直接输入文字。');
      } else {
        on_transcribed(text);
        update_state('idle', '');
      }
    } catch {
      update_state('error', '语音转写暂时不可用，请直接输入文字或稍后重试。');
    } finally {
      await delete_recording_file(uri);
      await restore_audio_mode();
      if (mounted_ref.current) setDurationMs(0);
    }
  }, [clear_stop_timer, delete_recording_file, on_transcribed, restore_audio_mode, update_state, user_id]);

  const start_recording = useCallback(async () => {
    if (Platform.OS === 'web') {
      update_state('error', '当前浏览器不支持移动端录音，请直接输入文字。');
      return;
    }
    if (recording_ref.current) return;

    clear_stop_timer();
    update_state('idle', '');
    setDurationMs(0);
    let created_recording: Audio.Recording | null = null;
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        update_state('error', '麦克风权限未开启，请在系统设置中允许后重试。');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const result = await Audio.Recording.createAsync(
        recording_options(),
        (status) => {
          if (mounted_ref.current) setDurationMs(status.durationMillis ?? 0);
        },
        250,
      );
      created_recording = result.recording;
      recording_ref.current = created_recording;
      update_state('recording', '');
      stop_timer_ref.current = setTimeout(() => {
        void stop_recording();
      }, max_recording_duration_ms);
    } catch {
      recording_ref.current = null;
      clear_stop_timer();
      await release_recording(created_recording);
      await restore_audio_mode();
      update_state('error', '录音启动失败，请保留文字输入或稍后重试。');
    }
  }, [clear_stop_timer, release_recording, restore_audio_mode, stop_recording, update_state]);

  const retry = useCallback(() => {
    clear_stop_timer();
    setDurationMs(0);
    update_state('idle', '');
  }, [clear_stop_timer, update_state]);

  useEffect(() => {
    return () => {
      mounted_ref.current = false;
      clear_stop_timer();
      const recording = recording_ref.current;
      recording_ref.current = null;
      void release_recording(recording).finally(() => restore_audio_mode());
    };
  }, [clear_stop_timer, release_recording, restore_audio_mode]);

  return { state, error_message, duration_ms, start_recording, stop_recording, retry };
}

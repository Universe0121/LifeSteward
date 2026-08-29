import { useCallback, useEffect, useRef, useState } from "react";
import { transcribeAudio } from "../api";

export type VoiceInputState = "idle" | "recording" | "transcribing" | "error";

const max_recording_duration_ms = 60_000;
const preferred_mime_types = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

export function recording_format(media_recorder: typeof MediaRecorder | undefined): {
  mime_type: string;
  extension: string;
} {
  if (media_recorder) {
    const supported = preferred_mime_types.find((mime_type) => media_recorder.isTypeSupported(mime_type));
    if (supported) {
      return {
        mime_type: supported,
        extension: supported.includes("mp4") ? "m4a" : supported.includes("ogg") ? "ogg" : "webm",
      };
    }
  }
  return { mime_type: "", extension: "webm" };
}

function format_from_mime(mime_type: string): { mime_type: string; extension: string } {
  const normalized = mime_type.split(";", 1)[0].toLowerCase();
  if (normalized.includes("mp4")) return { mime_type: normalized, extension: "m4a" };
  if (normalized.includes("ogg")) return { mime_type: normalized, extension: "ogg" };
  return { mime_type: normalized || "audio/webm", extension: "webm" };
}

export function useVoiceInput(user_id: number, on_transcribed: (text: string) => void) {
  const recorder_ref = useRef<MediaRecorder | null>(null);
  const stream_ref = useRef<MediaStream | null>(null);
  const chunks_ref = useRef<Blob[]>([]);
  const settled_recorder_ref = useRef<MediaRecorder | null>(null);
  const callback_ref = useRef(on_transcribed);
  const interval_ref = useRef<number | null>(null);
  const stop_timer_ref = useRef<number | null>(null);
  const started_at_ref = useRef(0);
  const mounted_ref = useRef(true);
  const [state, setState] = useState<VoiceInputState>("idle");
  const [error_message, setErrorMessage] = useState("");
  const [duration_ms, setDurationMs] = useState(0);

  useEffect(() => {
    callback_ref.current = on_transcribed;
  }, [on_transcribed]);

  const clear_timers = useCallback(() => {
    if (interval_ref.current !== null) {
      window.clearInterval(interval_ref.current);
      interval_ref.current = null;
    }
    if (stop_timer_ref.current !== null) {
      window.clearTimeout(stop_timer_ref.current);
      stop_timer_ref.current = null;
    }
  }, []);

  const release_stream = useCallback(() => {
    stream_ref.current?.getTracks().forEach((track) => track.stop());
    stream_ref.current = null;
  }, []);

  const update_state = useCallback((next_state: VoiceInputState, message = "") => {
    if (!mounted_ref.current) return;
    setState(next_state);
    setErrorMessage(message);
  }, []);

  const transcribe_recording = useCallback(async (recorder: MediaRecorder) => {
    if (settled_recorder_ref.current === recorder) return;
    settled_recorder_ref.current = recorder;
    clear_timers();
    recorder_ref.current = null;
    const chunks = chunks_ref.current;
    chunks_ref.current = [];
    const format = format_from_mime(recorder.mimeType);
    release_stream();
    update_state("transcribing");
    try {
      const audio = new Blob(chunks, { type: format.mime_type });
      if (!audio.size) throw new Error("empty recording");
      const response = await transcribeAudio(audio, user_id, `lifeagent-recording.${format.extension}`);
      const text = response.text.trim();
      if (!text) throw new Error("empty transcription");
      callback_ref.current(text);
      update_state("idle");
    } catch {
      update_state("error", "语音转写暂时不可用，请直接输入文字或稍后重试。");
    } finally {
      release_stream();
      if (mounted_ref.current) setDurationMs(0);
    }
  }, [clear_timers, release_stream, update_state, user_id]);

  const stop_recording = useCallback(() => {
    const recorder = recorder_ref.current;
    if (!recorder) return;
    clear_timers();
    update_state("transcribing");
    try {
      if (recorder.state === "inactive") void transcribe_recording(recorder);
      else recorder.stop();
    } catch {
      void transcribe_recording(recorder);
    }
  }, [clear_timers, transcribe_recording, update_state]);

  const start_recording = useCallback(async () => {
    if (recorder_ref.current) return;
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === "undefined") {
      update_state("error", "当前浏览器不支持录音，请直接输入文字。");
      return;
    }
    clear_timers();
    setDurationMs(0);
    update_state("idle");
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream_ref.current = stream;
      const format = recording_format(window.MediaRecorder);
      const recorder = format.mime_type ? new window.MediaRecorder(stream, { mimeType: format.mime_type }) : new window.MediaRecorder(stream);
      settled_recorder_ref.current = null;
      chunks_ref.current = [];
      recorder_ref.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks_ref.current.push(event.data);
      };
      recorder.onstop = () => { void transcribe_recording(recorder); };
      recorder.onerror = () => {
        if (settled_recorder_ref.current === recorder) return;
        settled_recorder_ref.current = recorder;
        recorder_ref.current = null;
        clear_timers();
        release_stream();
        update_state("error", "录音失败，请保留文字输入或稍后重试。");
      };
      recorder.start(250);
      started_at_ref.current = Date.now();
      update_state("recording");
      interval_ref.current = window.setInterval(() => {
        if (mounted_ref.current) setDurationMs(Date.now() - started_at_ref.current);
      }, 250);
      stop_timer_ref.current = window.setTimeout(stop_recording, max_recording_duration_ms);
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      stream_ref.current = null;
      recorder_ref.current = null;
      clear_timers();
      update_state("error", "无法访问麦克风，请检查权限后重试；文字输入仍可用。");
    }
  }, [clear_timers, release_stream, stop_recording, transcribe_recording, update_state]);

  const retry = useCallback(() => {
    clear_timers();
    release_stream();
    setDurationMs(0);
    update_state("idle");
  }, [clear_timers, release_stream, update_state]);

  useEffect(() => () => {
    mounted_ref.current = false;
    clear_timers();
    release_stream();
    const recorder = recorder_ref.current;
    recorder_ref.current = null;
    if (recorder && recorder.state !== "inactive") {
      try { recorder.stop(); } catch { /* native/browser cleanup is best effort */ }
    }
  }, [clear_timers, release_stream]);

  return { state, error_message, duration_ms, start_recording, stop_recording, retry };
}

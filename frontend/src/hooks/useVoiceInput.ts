import { useCallback, useEffect, useRef, useState } from "react";
import { postSpeechToText } from "../api";

export type VoiceInputState = "idle" | "recording" | "transcribing" | "error";

type Options = { user_id: number; language?: string; onText: (text: string) => void };

export function useVoiceInput({ user_id, language = "zh-CN", onText }: Options) {
  const [state, setState] = useState<VoiceInputState>("idle");
  const [duration_ms, setDurationMs] = useState(0);
  const [error, setError] = useState("");
  const recorder_ref = useRef<MediaRecorder | null>(null);
  const chunks_ref = useRef<Blob[]>([]);
  const started_at_ref = useRef(0);
  const timer_ref = useRef<number | null>(null);

  const stop = useCallback(() => {
    recorder_ref.current?.stop();
    if (timer_ref.current !== null) window.clearInterval(timer_ref.current);
    timer_ref.current = null;
  }, []);

  const start = useCallback(async () => {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setState("error"); setError("当前浏览器不支持录音，请直接输入文字。"); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime_type = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg", "audio/wav"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mime_type ? { mimeType: mime_type } : undefined);
      chunks_ref.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks_ref.current.push(event.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setState("transcribing");
        try {
          const response = await postSpeechToText(new Blob(chunks_ref.current, { type: recorder.mimeType || mime_type || "audio/webm" }), user_id, language);
          onText(response.text);
          setDurationMs(response.duration_ms || Date.now() - started_at_ref.current);
          setState("idle");
        } catch (caught) {
          setState("error"); setError(caught instanceof Error ? caught.message : "语音转写失败，请重试或直接输入文字。");
        }
      };
      recorder_ref.current = recorder;
      started_at_ref.current = Date.now(); setDurationMs(0); setState("recording"); recorder.start();
      timer_ref.current = window.setInterval(() => {
        const elapsed = Date.now() - started_at_ref.current;
        setDurationMs(elapsed);
        if (elapsed >= 60_000 && recorder.state === "recording") stop();
      }, 250);
    } catch {
      setState("error"); setError("未获得麦克风权限，请允许录音或直接输入文字。");
    }
  }, [language, onText, stop, user_id]);

  useEffect(() => () => { if (recorder_ref.current?.state === "recording") recorder_ref.current.stop(); if (timer_ref.current !== null) window.clearInterval(timer_ref.current); }, []);
  return { state, duration_ms, error, start, stop };
}

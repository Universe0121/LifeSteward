import type { VoiceInputState } from "../hooks/useVoiceInput";

type Props = { state: VoiceInputState; duration_ms: number; error: string; onStart: () => void; onStop: () => void };

function formatDuration(duration_ms: number) {
  const total_seconds = Math.floor(duration_ms / 1000);
  return `${String(Math.floor(total_seconds / 60)).padStart(2, "0")}:${String(total_seconds % 60).padStart(2, "0")}`;
}

export default function VoiceInputButton({ state, duration_ms, error, onStart, onStop }: Props) {
  if (state === "transcribing") return <span className="voice-status" role="status">转写中…</span>;
  if (state === "recording") return <button className="voice-button recording" type="button" onClick={onStop} aria-label="停止录音">■ {formatDuration(duration_ms)}</button>;
  return <button className={`voice-button${state === "error" ? " has-error" : ""}`} type="button" onClick={onStart} aria-label="开始录音" title={error || "开始录音"}>🎙</button>;
}

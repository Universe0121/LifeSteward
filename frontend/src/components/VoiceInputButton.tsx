import { VoiceInputState } from "../hooks/useVoiceInput";

type Props = {
  state: VoiceInputState;
  duration_ms: number;
  error_message: string;
  on_start: () => void;
  on_stop: () => void;
  on_retry: () => void;
};

function format_duration(value: number): string {
  const seconds = Math.floor(value / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function VoiceInputButton({ state, duration_ms, error_message, on_start, on_stop, on_retry }: Props) {
  if (state === "error") {
    return <div className="voice-input-error" role="alert"><span>{error_message}</span><button type="button" onClick={on_retry}>重试</button></div>;
  }
  const recording = state === "recording";
  const transcribing = state === "transcribing";
  return <button
    className={`voice-input-button${recording ? " recording" : ""}`}
    type="button"
    aria-label={recording ? "停止录音" : transcribing ? "语音转写中" : "开始录音"}
    aria-busy={transcribing}
    disabled={transcribing}
    onClick={recording ? on_stop : on_start}
  >
    <span aria-hidden="true">{transcribing ? "…" : recording ? "■" : "♩"}</span>
    {recording && <small>{format_duration(duration_ms)}</small>}
    {transcribing && <small>转写中</small>}
  </button>;
}

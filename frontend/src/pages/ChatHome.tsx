import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { postChat, type ChatHistoryItem, type ChatResponse } from "../api";
import { useAuth } from "../auth";
import VoiceInputButton from "../components/VoiceInputButton";
import { classify_chat_action, extract_task_name, normalize_plan_items, requested_date_key } from "../planning";
import { useVoiceInput } from "../hooks/useVoiceInput";
import { useWorkspace } from "../workspace";

type Message = { id: string; role: "user" | "assistant"; content: string; kind?: "welcome" | "error"; failed_input?: string };
const message_storage_prefix = "lifeagent_web_chat_v2_";

function local_date_key(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function conversation_storage_key(user_id: number): string { return `lifeagent_web_conversation_${user_id}`; }
function message_storage_key(user_id: number): string { return `${message_storage_prefix}${user_id}`; }
function message_id(prefix: string): string { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function welcome_message(display_name: string): Message { return { id: `welcome-${local_date_key()}`, role: "assistant", kind: "welcome", content: `你好，${display_name || "朋友"}！\n把正在发生的生活告诉我，我们一起理清下一步。` }; }

function normalize_messages(value: unknown): Message[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<Message>;
    if ((candidate.role !== "user" && candidate.role !== "assistant") || typeof candidate.content !== "string" || !candidate.content.trim()) return [];
    return [{ id: typeof candidate.id === "string" ? candidate.id : message_id("message"), role: candidate.role, content: candidate.content.trim(), kind: candidate.kind === "welcome" || candidate.kind === "error" ? candidate.kind : undefined, failed_input: typeof candidate.failed_input === "string" ? candidate.failed_input : undefined }];
  }).slice(-200);
}

function history_from_messages(messages: Message[]): ChatHistoryItem[] {
  return messages.filter((message) => !message.kind).slice(-20).map(({ role, content }) => ({ role, content }));
}

export default function ChatHome() {
  const { user_id, display_name } = useAuth();
  const { add_task, add_plans } = useWorkspace();
  const list_ref = useRef<HTMLDivElement>(null);
  const messages_ref = useRef<Message[]>([]);
  const [conversation_id, setConversationId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [user_input, setUserInput] = useState("");
  const [messages_ready, setMessagesReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [failed_input, setFailedInput] = useState("");
  const handle_transcribed = useCallback((text: string) => setUserInput(text), []);
  const voice_input = useVoiceInput(user_id, handle_transcribed);

  const commit_messages = useCallback((next_messages: Message[]) => {
    const bounded = next_messages.slice(-200);
    messages_ref.current = bounded;
    setMessages(bounded);
  }, []);

  useEffect(() => {
    let active = true;
    let saved_messages: Message[] = [];
    try {
      const saved_id = localStorage.getItem(conversation_storage_key(user_id));
      const next_id = saved_id?.trim() || `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(conversation_storage_key(user_id), next_id);
      setConversationId(next_id);
      const saved = localStorage.getItem(message_storage_key(user_id));
      if (saved) saved_messages = normalize_messages(JSON.parse(saved));
    } catch {
      saved_messages = [];
    }
    const today_welcome_id = `welcome-${local_date_key()}`;
    if (!saved_messages.some((message) => message.id === today_welcome_id)) saved_messages.push(welcome_message(display_name));
    if (active) {
      commit_messages(saved_messages);
      setFailedInput([...saved_messages].reverse().find((message) => message.kind === "error")?.failed_input ?? "");
      setMessagesReady(true);
    }
    return () => { active = false; };
  }, [commit_messages, display_name, user_id]);

  useEffect(() => {
    if (!messages_ready) return;
    try { localStorage.setItem(message_storage_key(user_id), JSON.stringify(messages_ref.current)); } catch { /* best effort */ }
  }, [messages, messages_ready, user_id]);

  useEffect(() => {
    if (list_ref.current) list_ref.current.scrollTop = list_ref.current.scrollHeight;
  }, [messages, sending]);

  function apply_chat_result(input: string, response: ChatResponse) {
    const action = classify_chat_action(input, response);
    if (action === "task") add_task(extract_task_name(input), requested_date_key(input));
    if (action === "plan") {
      const plans = normalize_plan_items(response.generated_plan);
      if (plans.length) add_plans(plans, requested_date_key(input));
    }
  }

  async function send_message(value: string, retry = false) {
    const content = value.trim();
    if (!content || !conversation_id || sending || !messages_ready) return;
    const current = messages_ref.current;
    const error_index = retry ? [...current].map((message, index) => ({ message, index })).reverse().find(({ message }) => message.kind === "error" && message.failed_input === content)?.index : undefined;
    let history_source = error_index === undefined ? current : current.slice(0, error_index);
    const last = history_source[history_source.length - 1];
    if (retry && last?.role === "user" && last.content === content) history_source = history_source.slice(0, -1);
    const conversation_history = history_from_messages(history_source);
    if (retry && error_index !== undefined) commit_messages([...history_source, { id: message_id("user"), role: "user", content }]);
    else commit_messages([...current, { id: message_id("user"), role: "user", content }]);
    setUserInput("");
    setFailedInput("");
    setSending(true);
    try {
      const response = await postChat({ user_id, conversation_id, user_input: content, conversation_history });
      apply_chat_result(content, response);
      commit_messages([...messages_ref.current, { id: message_id("assistant"), role: "assistant", content: response.assistant_response || "已收到你的记录。" }]);
    } catch {
      setFailedInput(content);
      commit_messages([...messages_ref.current, { id: message_id("error"), role: "assistant", kind: "error", failed_input: content, content: "请求暂时失败，可以重试，或继续用文字记录。" }]);
    } finally {
      setSending(false);
    }
  }

  function handle_submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send_message(user_input);
  }

  return <section className="chat-page">
    <header className="topbar"><div className="brand-mark">L</div><div><span className="eyebrow">LifeAgent</span><h1>AI 生活助手</h1></div><span className="online-dot" aria-label="在线" /></header>
    {!messages_ready ? <div className="empty-state">正在加载聊天记录...</div> : <div className="message-list" aria-live="polite" ref={list_ref}>{messages.map((message) => message.kind === "welcome" ? <article className="chat-intro" key={message.id}><p className="eyebrow">今天，照顾好自己的节奏</p><h2>{message.content.split("\n")[0]}</h2><p>{message.content.split("\n").slice(1).join("\n")}</p></article> : <article className={`message ${message.role}`} key={message.id}><span className="message-avatar">{message.role === "assistant" ? "✦" : "你"}</span><div className={`message-bubble${message.kind === "error" ? " message-error" : ""}`}>{message.content}{message.kind === "error" && <button className="retry-button" onClick={() => void send_message(message.failed_input || failed_input, true)}>重试</button>}</div></article>)}{sending && <div className="typing-indicator">LifeAgent 正在整理你的记录...</div>}</div>}
    <form className="composer" onSubmit={handle_submit}><input aria-label="用户输入" disabled={sending || voice_input.state === "transcribing"} value={user_input} onChange={(event) => setUserInput(event.target.value)} placeholder="说点什么..." /><VoiceInputButton state={voice_input.state} duration_ms={voice_input.duration_ms} error_message={voice_input.error_message} on_start={() => void voice_input.start_recording()} on_stop={() => void voice_input.stop_recording()} on_retry={voice_input.retry} /><button aria-label="发送" disabled={sending || voice_input.state === "transcribing" || !user_input.trim()} type="submit">↑</button></form>
    {voice_input.state !== "error" && <p className="voice-note">语音会先转成文字，你确认后才会发送</p>}
  </section>;
}

import { FormEvent, useState } from "react";
import { postChat } from "../api";

type Message = { role: "user" | "assistant"; content: string; time: string };
type RequestStatus = "idle" | "loading" | "success" | "error";
type SessionStorage = Pick<Storage, "getItem" | "setItem">;
type RequestDetails = {
  status: RequestStatus;
  intent: string;
  extracted_events: Array<Record<string, unknown>>;
  error: string;
  retry_content: string;
};

const initial_messages: Message[] = [{ role: "assistant", content: "早上好！很高兴在你的生活里见到你。今天想从哪个想法开始？", time: "09:00" }];
const quick_prompts = ["帮我安排今天", "总结最近状态", "我有点焦虑"];
const conversation_storage_key = "lifeagent_conversation_id";

export function getConversationId(storage: SessionStorage, create_id: () => string): string {
  try {
    const saved_id = storage.getItem(conversation_storage_key);
    if (saved_id) return saved_id;
  } catch {
    // Restricted storage must not prevent the chat page from rendering.
  }
  let seed: string;
  try {
    seed = create_id();
  } catch {
    seed = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  const conversation_id = `conv_${seed}`;
  try {
    storage.setItem(conversation_storage_key, conversation_id);
  } catch {
    // Restricted storage must not prevent the chat page from rendering.
  }
  return conversation_id;
}

export function emptyRequestDetails(status: RequestStatus): RequestDetails {
  return { status, intent: "-", extracted_events: [], error: "", retry_content: "" };
}

function newConversationSeed(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function currentTime() {
  return new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

export default function ChatHome() {
  const [user_input, setUserInput] = useState("");
  const [messages, setMessages] = useState<Message[]>(initial_messages);
  const [task_status, setTaskStatus] = useState("等待你的输入");
  const [is_loading, setIsLoading] = useState(false);
  const [conversation_id] = useState(() => getConversationId(sessionStorage, newConversationSeed));
  const [request_details, setRequestDetails] = useState<RequestDetails>(() => emptyRequestDetails("idle"));

  async function sendMessage(raw_content: string, append_user = true) {
    const content = raw_content.trim();
    if (!content || is_loading) return;
    if (append_user) {
      setMessages((current) => [...current, { role: "user", content, time: currentTime() }]);
    }
    setUserInput("");
    setTaskStatus("Master Agent 正在处理");
    setIsLoading(true);
    setRequestDetails(emptyRequestDetails("loading"));
    try {
      const chat_response = await postChat({ user_id: 10001, conversation_id, user_input: content });
      setMessages((current) => [...current, { role: "assistant", content: chat_response.assistant_response, time: currentTime() }]);
      setRequestDetails({ status: "success", intent: chat_response.intent, extracted_events: chat_response.extracted_events, error: "", retry_content: "" });
      setTaskStatus("已完成");
    } catch (error) {
      setRequestDetails({
        ...emptyRequestDetails("error"),
        error: error instanceof Error ? error.message : "聊天请求失败，请稍后重试。",
        retry_content: content,
      });
      setTaskStatus("请求失败，可继续操作");
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(user_input);
  }

  function clearConversation() {
    setMessages(initial_messages);
    setTaskStatus("等待你的输入");
    setRequestDetails(emptyRequestDetails("idle"));
  }

  return (
    <section className="chat-page">
      <header className="topbar"><div className="brand-mark">L</div><div><span className="eyebrow">LifeAgent</span><h1>AI 生活助手</h1></div><span className="online-dot" aria-label="在线" /></header>
      <div className="chat-intro"><p className="eyebrow">今天，照顾好自己的节奏</p><h2>你好，Marimar</h2><p>把正在发生的生活告诉我，我们一起理清下一步。</p></div>
      <div className="quick-prompt-heading"><span className="eyebrow">快捷提问</span><button className="text-button" onClick={clearConversation}>清空对话</button></div>
      <div className="quick-prompts">{quick_prompts.map((prompt) => <button key={prompt} onClick={() => void sendMessage(prompt)} disabled={is_loading}>{prompt}<span>↗</span></button>)}</div>
      <div className="message-list" aria-live="polite">{messages.map((message, index) => <article className={`message ${message.role}`} key={`${message.role}-${index}`}><span className="message-avatar">{message.role === "assistant" ? "✦" : "你"}</span><div><div className="message-bubble">{message.content}</div><small>{message.time}</small></div></article>)}{is_loading && <article className="message assistant"><span className="message-avatar">✦</span><div className="message-bubble typing-indicator"><i /> <i /> <i /></div></article>}</div>
      {request_details.error && <div className="request-error" role="alert"><strong>请求失败</strong><span>{request_details.error}</span><button type="button" onClick={() => void sendMessage(request_details.retry_content, false)} disabled={is_loading}>重试</button></div>}
      <div className="focus-card"><div><span className="eyebrow">当前任务状态</span><strong>{task_status}</strong></div><span className={`focus-value${is_loading ? " pulsing" : ""}`}>●</span></div>
      <div className="request-panel">
        <span className="eyebrow">本轮真实请求</span>
        <dl><div><dt>请求状态</dt><dd>{request_details.status}</dd></div><div><dt>会话 ID</dt><dd>{conversation_id}</dd></div><div><dt>意图</dt><dd>{request_details.intent}</dd></div><div><dt>提取事件</dt><dd>{request_details.extracted_events.length}</dd></div></dl>
        {request_details.extracted_events.length > 0 && <pre>{JSON.stringify(request_details.extracted_events, null, 2)}</pre>}
       </div>
       <form className="composer" onSubmit={handleSubmit}><input aria-label="用户输入" value={user_input} onChange={(event) => setUserInput(event.target.value)} placeholder="说点什么..." /><button aria-label="发送" type="submit" disabled={is_loading || !user_input.trim()}>↑</button></form>
    </section>
  );
}

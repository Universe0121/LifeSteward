import { FormEvent, useState } from "react";
import { postChat } from "../api";

type Message = { role: "user" | "assistant"; content: string; time: string };
const initial_messages: Message[] = [{ role: "assistant", content: "早上好！很高兴在你的生活里见到你。今天想从哪个想法开始？", time: "09:00" }];
const quick_prompts = ["帮我安排今天", "总结最近状态", "我有点焦虑"];

function currentTime() {
  return new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

export default function ChatHome() {
  const [user_input, setUserInput] = useState("");
  const [messages, setMessages] = useState<Message[]>(initial_messages);
  const [task_status, setTaskStatus] = useState("等待你的输入");
  const [is_loading, setIsLoading] = useState(false);

  async function sendMessage(raw_content: string) {
    const content = raw_content.trim();
    if (!content || is_loading) return;
    setMessages((current) => [...current, { role: "user", content, time: currentTime() }]);
    setUserInput("");
    setTaskStatus("Master Agent 正在处理");
    setIsLoading(true);
    try {
      const chat_response = await postChat({ user_id: 10001, conversation_id: "conv_001", user_input: content });
      setMessages((current) => [...current, { role: "assistant", content: chat_response.assistant_response, time: currentTime() }]);
      setTaskStatus("已完成");
    } catch {
      setMessages((current) => [...current, { role: "assistant", content: `我先帮你记下了：${content}`, time: currentTime() }]);
      setTaskStatus("演示模式：已使用 mock 回复");
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(user_input);
  }

  return (
    <section className="chat-page">
      <header className="topbar"><div className="brand-mark">L</div><div><span className="eyebrow">LifeAgent</span><h1>AI 生活助手</h1></div><span className="online-dot" aria-label="在线" /></header>
      <div className="chat-intro"><p className="eyebrow">今天，照顾好自己的节奏</p><h2>你好，Marimar</h2><p>把正在发生的生活告诉我，我们一起理清下一步。</p></div>
      <div className="quick-prompt-heading"><span className="eyebrow">快捷提问</span><button className="text-button" onClick={() => setMessages(initial_messages)}>清空对话</button></div>
      <div className="quick-prompts">{quick_prompts.map((prompt) => <button key={prompt} onClick={() => void sendMessage(prompt)} disabled={is_loading}>{prompt}<span>↗</span></button>)}</div>
      <div className="message-list" aria-live="polite">{messages.map((message, index) => <article className={`message ${message.role}`} key={`${message.role}-${index}`}><span className="message-avatar">{message.role === "assistant" ? "✦" : "你"}</span><div><div className="message-bubble">{message.content}</div><small>{message.time}</small></div></article>)}{is_loading && <article className="message assistant"><span className="message-avatar">✦</span><div className="message-bubble typing-indicator"><i /> <i /> <i /></div></article>}</div>
      <div className="focus-card"><div><span className="eyebrow">当前任务状态</span><strong>{task_status}</strong></div><span className={`focus-value${is_loading ? " pulsing" : ""}`}>●</span></div>
      <form className="composer" onSubmit={handleSubmit}><input aria-label="用户输入" value={user_input} onChange={(event) => setUserInput(event.target.value)} placeholder="说点什么..." /><button aria-label="发送" type="submit" disabled={is_loading || !user_input.trim()}>↑</button></form>
    </section>
  );
}

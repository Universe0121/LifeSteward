import { FormEvent, useState } from "react";
import { postChat } from "../api";

type Message = { role: "user" | "assistant"; content: string };

const initial_messages: Message[] = [
  { role: "assistant", content: "早上好！很高兴在你的生活里见到你。今天想从哪个想法开始？" },
];

export default function ChatHome() {
  const [user_input, setUserInput] = useState("");
  const [messages, setMessages] = useState<Message[]>(initial_messages);
  const [task_status, setTaskStatus] = useState("等待你的输入");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = user_input.trim();
    if (!content) return;
    setMessages((current) => [...current, { role: "user", content }]);
    setUserInput("");
    setTaskStatus("Master Agent 正在处理");
    try {
      const chat_response = await postChat({ user_id: 10001, conversation_id: "conv_001", user_input: content });
      setMessages((current) => [...current, { role: "assistant", content: chat_response.assistant_response }]);
      setTaskStatus("已完成");
    } catch (error) {
      const message = error instanceof Error ? error.message : "chat request failed";
      setMessages((current) => [...current, { role: "assistant", content: `请求失败：${message}。请稍后重试。` }]);
      setTaskStatus("请求失败：未写入时间轴");
    }
  }

  return (
    <section className="chat-page">
      <header className="topbar">
        <div className="brand-mark">L</div>
        <div><span className="eyebrow">LifeAgent</span><h1>AI 生活助手</h1></div>
        <span className="online-dot" aria-label="在线" />
      </header>
      <div className="chat-intro">
        <p className="eyebrow">今天，照顾好自己的节奏</p>
        <h2>你好，Marimar</h2>
        <p>把正在发生的生活告诉我，我们一起理清下一步。</p>
      </div>
      <div className="message-list" aria-live="polite">
        {messages.map((message, index) => (
          <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
            <span className="message-avatar">{message.role === "assistant" ? "✦" : "你"}</span>
            <div className="message-bubble">{message.content}</div>
          </article>
        ))}
      </div>
      <div className="focus-card">
        <div><span className="eyebrow">当前任务状态</span><strong>{task_status}</strong></div>
        <span className="focus-value">●</span>
      </div>
      <form className="composer" onSubmit={handleSubmit}>
        <input aria-label="用户输入" value={user_input} onChange={(event) => setUserInput(event.target.value)} placeholder="说点什么..." />
        <button aria-label="发送" type="submit">↑</button>
      </form>
    </section>
  );
}

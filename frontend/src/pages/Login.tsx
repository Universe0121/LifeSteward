import { FormEvent, useState } from "react";
import { useAuth } from "../auth";

export default function Login() {
  const { login } = useAuth();
  const [display_name, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handle_submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    const message = await login(display_name, password);
    if (message) setError(message);
    setSubmitting(false);
  }

  return <main className="login-page">
    <section className="login-panel">
      <div className="login-hero"><div className="login-mark">L</div><span className="eyebrow light">LIFEAGENT</span><h1>把生活交给时间，也交给自己。</h1><p>记录正在发生的事，慢慢找到适合自己的节奏。</p></div>
      <form className="login-form" onSubmit={handle_submit}>
        <span className="eyebrow">本机演示登录</span><h2>欢迎回来</h2><p className="page-description login-description">用户名会显示在你的 LifeAgent 首页，密码只用于本次本机登录。</p>
        <label>用户名<input autoComplete="username" value={display_name} onChange={(event) => setDisplayName(event.target.value)} placeholder="输入你的名字" /></label>
        <label>密码<input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 4 个字符" /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="login-button" disabled={submitting} type="submit">{submitting ? "正在进入..." : "进入 LifeAgent"}<span>→</span></button>
      </form>
    </section>
  </main>;
}

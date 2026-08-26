import { NavLink, Route, Routes } from "react-router-dom";
import ChatHome from "./pages/ChatHome";
import Customize from "./pages/Customize";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import Timeline from "./pages/Timeline";
import { WorkspaceProvider, useWorkspace } from "./workspace";

const navigation = [
  { to: "/", label: "首页", icon: "⌂" },
  { to: "/timeline", label: "日历", icon: "▣" },
  { to: "/profile", label: "画像", icon: "♙" },
  { to: "/customize", label: "定制", icon: "⚙" },
];

function AppFrame() {
  const { data } = useWorkspace();
  return (
    <div className={`app-shell ${data.theme === "dark" ? "theme-dark" : ""}`}>
      <main className="page-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/chat" element={<ChatHome />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/customize" element={<Customize />} />
        </Routes>
      </main>
      <nav className="bottom-nav" aria-label="主导航">
        {navigation.slice(0, 2).map((item) => (
          <NavLink className={({ isActive }) => `nav-item${isActive ? " active" : ""}`} key={item.to} to={item.to}>
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
        <NavLink className={({ isActive }) => `voice-nav${isActive ? " active" : ""}`} to="/chat" aria-label="聊天快捷记录">
          <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="8" y="3" width="8" height="13" rx="4" /><path d="M5.5 11.5v.5a6.5 6.5 0 0 0 13 0v-.5M12 18.5V22M8.5 22h7" /></svg>
          <span className="voice-label">快捷记录</span>
        </NavLink>
        {navigation.slice(2).map((item) => (
          <NavLink className={({ isActive }) => `nav-item${isActive ? " active" : ""}`} key={item.to} to={item.to}>
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  return <WorkspaceProvider><AppFrame /></WorkspaceProvider>;
}

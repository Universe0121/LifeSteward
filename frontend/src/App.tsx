import { NavLink, Route, Routes } from "react-router-dom";
import ChatHome from "./pages/ChatHome";
import Customize from "./pages/Customize";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import Timeline from "./pages/Timeline";
import WeeklyReport from "./pages/WeeklyReport";

const navigation = [
  { to: "/", label: "首页", icon: "⌂" },
  { to: "/chat", label: "聊天", icon: "✦" },
  { to: "/timeline", label: "日历", icon: "▣" },
  { to: "/weekly", label: "周报", icon: "✦" },
  { to: "/profile", label: "画像", icon: "♙" },
  { to: "/customize", label: "定制", icon: "⚙" },
];

export default function App() {
  return (
    <div className="app-shell">
      <main className="page-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/chat" element={<ChatHome />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/weekly" element={<WeeklyReport />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/customize" element={<Customize />} />
        </Routes>
      </main>
      <nav className="bottom-nav" aria-label="主导航">
        {navigation.map((item) => (
          <NavLink
            className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            key={item.to}
            to={item.to}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

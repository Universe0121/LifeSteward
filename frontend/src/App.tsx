import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import ChatHome from "./pages/ChatHome";
import Customize from "./pages/Customize";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import SleepDetail from "./pages/SleepDetail";
import TaskManagement from "./pages/TaskManagement";
import Timeline from "./pages/Timeline";
import TodayPlan from "./pages/TodayPlan";
import WeeklyReport from "./pages/WeeklyReport";
import { WorkspaceProvider } from "./workspace";

const navigation = [
  { to: "/", label: "首页", icon: "⌂" },
  { to: "/chat", label: "聊天", icon: "✦" },
  { to: "/timeline", label: "日历", icon: "▣" },
  { to: "/weekly", label: "周报", icon: "✦" },
  { to: "/profile", label: "画像", icon: "♙" },
  { to: "/customize", label: "定制", icon: "⚙" },
];

function AuthenticatedApp() {
  const { ready, authenticated } = useAuth();
  if (!ready) return <div className="loading-screen">正在准备 LifeAgent...</div>;
  if (!authenticated) return <Login />;

  return <WorkspaceProvider>
    <div className="app-shell">
      <main className="page-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/chat" element={<ChatHome />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/weekly" element={<WeeklyReport />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/customize" element={<Customize />} />
          <Route path="/tasks" element={<TaskManagement />} />
          <Route path="/today-plan" element={<TodayPlan />} />
          <Route path="/sleep" element={<SleepDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <nav className="bottom-nav" aria-label="主导航">
        {navigation.map((item) => <NavLink className={({ isActive }) => `nav-item${isActive ? " active" : ""}`} key={item.to} to={item.to}>
          <span className="nav-icon">{item.icon}</span><span>{item.label}</span>
        </NavLink>)}
      </nav>
    </div>
  </WorkspaceProvider>;
}

export default function App() {
  return <AuthenticatedApp />;
}

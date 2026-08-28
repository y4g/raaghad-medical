import { NavLink, Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import Home from "./pages/Home";
import Patients from "./pages/Patients";
import PatientRecordPage from "./pages/PatientRecord";
import Operations from "./pages/Operations";
import CalendarPage from "./pages/Calendar";
import Administration from "./pages/Administration";
import NotificationCenter from "./components/NotificationCenter";
import GlobalSearch from "./components/GlobalSearch";
import "./styles.css";
import "./features.css";
import "./theme.css";
import "./hours.css";
import "./quick.css";
import "./responsive.css";
import AuthPage from "./pages/Auth";
import { useAuth } from "./auth/AuthContext";
import { operationsApi } from "./api/client";

export default function App() {
  const { user, loading, setupRequired, logout } = useAuth();
  useEffect(() => {
    if (!user) return;
    operationsApi
      .settings()
      .then(({ settings }) => {
        const a = settings.appearance_settings || {};
        document.documentElement.dataset.theme = a.theme || "light";
        document.documentElement.dataset.fontSize = a.fontSize || "medium";
        document.documentElement.dataset.motion = a.motionLevel || "full";
      })
      .catch(() => {});
  }, [user]);

  if (loading)
    return (
      <div className="app-loading" aria-live="polite">
        <span className="brand-mark">✚</span>
        <div className="skeleton-line wide" />
        <div className="skeleton-line" />
      </div>
    );
  if (!user || setupRequired) return <AuthPage />;

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink
          className="brand"
          to="/"
          aria-label="عيادة د. رغد حسين - الرئيسية"
        >
          <span className="brand-mark" aria-hidden="true">
            ✚
          </span>
          <span>
            <strong>عيادة د. رغد حسين</strong>
            <small>طب الأسرة</small>
          </span>
        </NavLink>
        <nav className="main-nav" aria-label="التنقل الرئيسي">
          <NavLink to="/" end>
            <span aria-hidden="true">⌂</span> الرئيسية
          </NavLink>
          <NavLink to="/patients">
            <span aria-hidden="true">♙</span> المرضى
          </NavLink>
          <NavLink to="/calendar">
            <span aria-hidden="true">▦</span> التقويم
          </NavLink>
          <NavLink to="/operations">
            <span aria-hidden="true">☷</span> الإدارة
          </NavLink>
          {user.permissions.includes("settings.manage") && (
            <NavLink to="/administration">
              <span aria-hidden="true">⚙</span> الإعدادات
            </NavLink>
          )}
        </nav>
        <div className="header-tools">
          <GlobalSearch />
          <NotificationCenter />
        </div>
        <div className="user-menu">
          <span className="user-avatar">
            {user.fullName.replace("د. ", "").charAt(0)}
          </span>
          <span>
            <strong>{user.fullName}</strong>
            <small>{user.roleName}</small>
          </span>
          <button
            onClick={() => void logout()}
            aria-label="تسجيل الخروج"
            title="تسجيل الخروج"
          >
            ↪
          </button>
        </div>
      </header>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/patients/:id" element={<PatientRecordPage />} />
          <Route path="/operations" element={<Operations />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/administration" element={<Administration />} />
          <Route
            path="*"
            element={
              <div className="empty-state">
                <h2>الصفحة غير موجودة</h2>
                <NavLink className="button primary" to="/">
                  العودة للرئيسية
                </NavLink>
              </div>
            }
          />
        </Routes>
      </main>
      <footer>عيادة د. رغد حسين · طب الأسرة</footer>
    </div>
  );
}

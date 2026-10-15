import { BarChart3, Briefcase, FileUp, LayoutDashboard, ListChecks, LogOut, Sparkles, User } from "lucide-react";
import { useEffect, useState } from "react";
import Greeting from "./Greeting";
import Avatar from "./Avatar";
import { api } from "../api";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import ThemeToggle from "./ThemeToggle";

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const staff = user?.role !== "candidate";
  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => {
    if (staff || !user) return;
    api("/api/candidates/profile").then((c) => setPhoto(c.photoUrl ?? null)).catch(() => {});
    const on = (e: Event) => setPhoto((e as CustomEvent).detail ?? null);
    window.addEventListener("hw-photo", on);
    return () => window.removeEventListener("hw-photo", on);
  }, [staff, user]);
  const link = (to: string, icon: JSX.Element, label: string) => (
    <NavLink to={to} className={({ isActive }) => (isActive ? "active" : "")}>{icon}{label}</NavLink>
  );
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><Sparkles size={18} /> HireWise AI</div>
        {staff ? <>
          {link("/dashboard", <LayoutDashboard size={16} />, "Dashboard")}
          {link("/jobs", <Briefcase size={16} />, "Jobs")}
          {link("/rankings", <BarChart3 size={16} />, "Rankings")}
          {link("/upload-resume", <FileUp size={16} />, "Upload resume")}
        </> : <>
          {link("/candidates/profile", <User size={16} />, "My profile")}
          {link("/upload-resume", <FileUp size={16} />, "Upload / update resume")}
          {link("/jobs", <Briefcase size={16} />, "Available jobs")}
          {link("/applications", <ListChecks size={16} />, "My applications")}
        </>}
        <div className="who">
          <div style={{ marginBottom: 10 }}><ThemeToggle /></div>
          {!staff && <div style={{ marginBottom: 8 }}><Avatar name={user?.name} url={photo} size={44} /></div>}<b>{user?.name}</b>{user?.email} · {user?.role}
          <div style={{ marginTop: 8 }}>
            <button className="sm" onClick={() => { logout(); nav("/login"); }}><LogOut size={13} /> Sign out</button>
          </div>
        </div>
      </aside>
      <main className="main">
        <div className="banner">
          <div><b>{staff ? "Find the right hire, faster." : "Your next role starts here."}</b><span>{staff ? "Resumes in, AI-ranked matches out." : "Upload your resume and see how you match every job."}</span></div>
          {staff ? <img src="/hero.png" alt="" /> : <div className="banner-photo"><Avatar name={user?.name} url={photo} size={110} /></div>}
        </div>
        {!staff && <div style={{ margin: "4px 0 16px" }}><Greeting name={user?.name} compact /></div>}
        <Outlet />
      </main>
    </div>
  );
}

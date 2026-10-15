import { useEffect, useState } from "react";
import Avatar from "../components/Avatar";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import { Empty, Err, ScoreBadge, Stat, StatusBadge } from "../components/ui";
import Greeting from "../components/Greeting";
import { useAuth } from "../auth";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [an, setAn] = useState<any>(null);
  const [top, setTop] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api("/api/dashboard/stats"), api("/api/dashboard/analytics"), api("/api/dashboard/categories")])
      .then(([s, a, c]) => { setStats(s); setAn(a); setCats(c); })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const q = new URLSearchParams({ limit: "25" });
    if (cat) q.set("category", cat);
    if (status) q.set("status", status);
    api(`/api/dashboard/candidates?${q}`).then(setTop).catch((e) => setError(e.message));
  }, [cat, status]);

  const total = cats.reduce((n, c) => n + c.candidates, 0);
  const STATUSES: [string, string][] = [["", "All"], ["SHORTLISTED", "Shortlisted"], ["PENDING", "Pending"], ["REJECTED", "Rejected"]];

  return (
    <>
      <div className="head"><div><Greeting name={user?.name} compact /><div className="muted">Dashboard · Hiring pipeline at a glance</div></div></div>
      <Err msg={error} />
      {stats && <div className="grid g5">
        <Stat label="Candidates" value={stats.totalCandidates} />
        <Stat label="Active jobs" value={stats.activeJobs} />
        <Stat label="Avg AI score" value={`${stats.averageAIScore}%`} />
        <Stat label="Shortlisted" value={stats.shortlisted} />
        <Stat label="New this week" value={stats.recentUploads} />
      </div>}
      {an && <div className="grid g2" style={{ marginTop: 16 }}>
        <div className="card"><h2>Pipeline</h2><div style={{ height: 240 }}><ResponsiveContainer>
          <BarChart data={an.pipeline}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="stage" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="candidates" fill="#7c6cff" radius={[6, 6, 0, 0]} /></BarChart>
        </ResponsiveContainer></div></div>
        <div className="card"><h2>Match score distribution</h2><div style={{ height: 240 }}><ResponsiveContainer>
          <BarChart data={an.distribution}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="range" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="candidates" fill="#34c9a0" radius={[6, 6, 0, 0]} /></BarChart>
        </ResponsiveContainer></div></div>
      </div>}
      <div className="card" style={{ marginTop: 16 }}>
        <h2>Browse by role</h2>
        <div className="muted" style={{ marginBottom: 10 }}>Candidates grouped by role category (best match per candidate). Click a role to filter the list below.</div>
        {cats.length === 0 ? <Empty>No candidates yet.</Empty> : <div className="rolegrid">
          <button className={`rolecard ${cat === "" ? "on" : ""}`} onClick={() => setCat("")}>
            <b>All roles</b><span>{total} candidates</span><span>{cats.reduce((n, c) => n + c.shortlisted, 0)} shortlisted</span>
          </button>
          {cats.map((c) => <button key={c.category} className={`rolecard ${cat === c.category ? "on" : ""}`} onClick={() => setCat(cat === c.category ? "" : c.category)}>
            <b>{c.category}</b><span>{c.candidates} candidates · {c.shortlisted} shortlisted</span><span>Avg {c.avgScore}% · Top {c.topScore}%</span>
          </button>)}
        </div>}
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="head" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>{status ? STATUSES.find((x) => x[0] === status)![1] : "Top"} matches{cat ? ` — ${cat}` : ""}</h2>
          <div className="seg">{STATUSES.map(([v, l]) => <button key={v} className={status === v ? "on" : ""} onClick={() => setStatus(v)}>{l}</button>)}</div>
        </div>
        {top.length === 0 ? <Empty>{cat || status ? "No candidates in this role/status yet." : "No matches yet — add a job and upload resumes."}</Empty> :
          <table><thead><tr><th>Candidate</th><th>Role</th><th>Category</th><th>Exp.</th><th>Score</th><th>Status</th></tr></thead><tbody>
            {top.map((c) => <tr key={c.matchId}>
              <td><span className="namecell"><Avatar name={c.name} url={c.photoUrl} /><Link to={`/candidates/${c.candidateId}`}>{c.name}</Link></span></td>
              <td>{c.currentTitle || "—"}<div className="muted">{c.currentCompany}</div></td>
              <td><span className="badge">{c.category}</span></td>
              <td>{c.yearsOfExperience} yrs</td><td><ScoreBadge score={c.overallScore} /></td><td><StatusBadge status={c.recruiterStatus} /></td>
            </tr>)}
          </tbody></table>}
      </div>
    </>
  );
}

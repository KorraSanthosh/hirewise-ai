import { useEffect, useState } from "react";
import Avatar from "../components/Avatar";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { Bar, Empty, Err, ScoreBadge } from "../components/ui";

const WEIGHTS: [string, string][] = [["semantic", "Semantic"], ["skills", "Skills"], ["experience", "Experience"], ["education", "Education"], ["career_progression", "Career"], ["availability", "Availability"]];
const DEFAULTS: Record<string, number> = { semantic: 0.2, skills: 0.25, experience: 0.2, education: 0.1, career_progression: 0.15, availability: 0.1 };

export default function Rankings() {
  const [params, setParams] = useSearchParams();
  const [jobs, setJobs] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [jobId, setJobId] = useState(params.get("jobId") || "");
  const [weights, setWeights] = useState<Record<string, number>>(DEFAULTS);
  const [showW, setShowW] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => { api("/api/jobs").then((js: any[]) => { setJobs(js); if (!jobId && js[0]) setJobId(js[0].id); }).catch((e) => setError(e.message)); }, []);
  useEffect(() => {
    if (!jobId) return;
    setParams({ jobId }, { replace: true });
    api(`/api/matches?jobId=${jobId}`).then(setMatches).catch((e) => setError(e.message));
  }, [jobId]);

  const sum = Object.values(weights).reduce((a, b) => a + b, 0);

  const rerank = async () => {
    setBusy("rank"); setError(""); setMsg("");
    try {
      const r = await api(`/api/jobs/${jobId}/rank`, { body: showW ? { weights } : {} });
      setMsg(r.message);
      setMatches(await api(`/api/matches?jobId=${jobId}`));
    } catch (e: any) { setError(e.message); } finally { setBusy(""); }
  };

  const patch = async (id: string, body: any) => {
    try {
      const u = await api(`/api/matches/${id}`, { method: "PATCH", body });
      setMatches((ms) => ms.map((m) => (m.id === id ? { ...m, ...u } : m)));
    } catch (e: any) { setError(e.message); }
  };

  const explain = async (id: string) => {
    setBusy(id); setError("");
    try {
      const r = await api(`/api/matches/${id}/explain`, { method: "POST" });
      setMatches((ms) => ms.map((m) => (m.id === id ? { ...m, ...r.data.explainability } : m)));
      setOpen(id);
    } catch (e: any) { setError(e.message); } finally { setBusy(""); }
  };

  return (
    <>
      <div className="head"><div><h1>Rankings</h1><div className="muted">Hybrid score: semantic + skills + experience + education + career + availability, with anomaly penalties</div></div>
        <div className="row">
          <select style={{ width: 280 }} value={jobId} onChange={(e) => setJobId(e.target.value)}>{jobs.map((j) => <option key={j.id} value={j.id}>{j.title}{j.company ? ` — ${j.company}` : ""}</option>)}</select>
          <button onClick={() => setShowW(!showW)}>Weights</button>
          <button className="primary" disabled={!jobId || busy === "rank" || (showW && Math.abs(sum - 1) > 0.01)} onClick={rerank}>{busy === "rank" ? "Ranking…" : "Re-rank candidates"}</button>
        </div></div>
      <Err msg={error} />{msg && <div className="ok">{msg}</div>}
      {showW && <div className="card" style={{ marginBottom: 16 }}>
        <div className="row spread"><h2>Custom weights</h2><span className={Math.abs(sum - 1) > 0.01 ? "badge bad" : "badge good"}>sum {sum.toFixed(2)} (must be 1.00)</span></div>
        <div className="grid g5">{WEIGHTS.map(([k, l]) => <div key={k}><label>{l}</label>
          <input type="number" step={0.05} min={0} max={1} value={weights[k]} onChange={(e) => setWeights({ ...weights, [k]: Number(e.target.value) })} /></div>)}</div>
      </div>}

      <div className="card">
        {matches.length === 0 ? <Empty>No matches for this job yet. Click “Re-rank candidates” to score the pool.</Empty> :
          <table><thead><tr><th>#</th><th>Candidate</th><th>Overall</th><th>Skills</th><th>Exp.</th><th>Semantic</th><th>Status</th><th></th></tr></thead><tbody>
            {matches.map((m, i) => <>
              <tr key={m.id}>
                <td>{i + 1}</td>
                <td><span className="namecell"><Avatar name={m.candidate.name} url={m.candidate.photoUrl} /><Link to={`/candidates/${m.candidate.candidateId}`}>{m.candidate.name}</Link></span>
                  <div className="muted">{m.candidate.currentTitle || m.candidate.headline} · {m.candidate.yearsOfExperience} yrs
                    {m.candidate.anomalyStatus && m.candidate.anomalyStatus !== "CLEAN" && <span className="badge warn" style={{ marginLeft: 6 }}>{m.candidate.anomalyStatus}</span>}</div></td>
                <td><ScoreBadge score={m.overallScore * 100} /></td>
                <td style={{ width: 90 }}><Bar value={m.skillMatchScore} /></td>
                <td style={{ width: 90 }}><Bar value={m.experienceScore} /></td>
                <td style={{ width: 90 }}><Bar value={m.semanticSimilarity} /></td>
                <td><select value={m.recruiterStatus} onChange={(e) => patch(m.id, { recruiterStatus: e.target.value })}>
                  <option value="PENDING">Pending</option><option value="SHORTLISTED">Shortlisted</option><option value="REJECTED">Rejected</option></select></td>
                <td className="row"><button className="sm" disabled={busy === m.id} onClick={() => (m.id === open ? setOpen(null) : m.hiringRecommendation && m.improvementSuggestions?.length > 2 ? setOpen(m.id) : explain(m.id))}>{busy === m.id ? "…" : "Explain"}</button></td>
              </tr>
              {open === m.id && <tr key={m.id + "x"}><td colSpan={8} style={{ background: "var(--panel2)" }}>
                <div className="grid g2">
                  <div><h3>Strengths</h3><ul className="tight">{m.strengths.map((s: string, k: number) => <li key={k}>{s}</li>)}</ul>
                    <h3 style={{ marginTop: 10 }}>Weaknesses</h3><ul className="tight">{m.weaknesses.map((s: string, k: number) => <li key={k}>{s}</li>)}</ul></div>
                  <div><h3>Recommendation</h3><p style={{ margin: 0 }}>{m.hiringRecommendation}</p>
                    {m.missingSkills?.length > 0 && <><h3 style={{ marginTop: 10 }}>Missing skills</h3><div className="chips">{m.missingSkills.map((s: string, k: number) => <span key={k} className="chip">{s}</span>)}</div></>}
                    <h3 style={{ marginTop: 10 }}>Notes</h3>
                    <textarea rows={2} defaultValue={m.recruiterNotes || ""} placeholder="Private recruiter notes" onBlur={(e) => e.target.value !== (m.recruiterNotes || "") && patch(m.id, { recruiterNotes: e.target.value })} /></div>
                </div></td></tr>}
            </>)}
          </tbody></table>}
      </div>
    </>
  );
}

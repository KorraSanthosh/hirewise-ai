import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { Chips, Err, ScoreBadge } from "../components/ui";

export default function Evaluate() {
  const { jobId } = useParams();
  const [job, setJob] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [res, setRes] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { api(`/api/jobs/${jobId}`).then(setJob).catch((e) => setError(e.message)); }, [jobId]);

  const run = async () => {
    if (!file) return;
    setBusy(true); setError(""); setRes(null);
    const form = new FormData(); form.append("file", file);
    try { setRes((await api(`/api/jobs/${jobId}/evaluate`, { form })).data); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const scores: [string, string][] = res ? [["Semantic", "semanticSimilarity"], ["Skills", "skillMatchScore"], ["Experience", "experienceScore"], ["Education", "educationScore"], ["Career", "careerProgressionScore"], ["Availability", "availabilityScore"]] : [];
  return (
    <>
      <div className="head"><div><h1>Evaluate a resume</h1><div className="muted">{job ? `Against: ${job.title}${job.company ? " — " + job.company : ""}` : "…"}</div></div></div>
      <Err msg={error} />
      <div className="card">
        <label style={{ marginTop: 0 }}>Resume (PDF)</label>
        <input type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <div style={{ marginTop: 14 }}><button className="primary" disabled={!file || busy} onClick={run}>{busy ? "Parsing and scoring…" : "Evaluate"}</button></div>
      </div>
      {res && <div className="card" style={{ marginTop: 16 }}>
        <div className="row spread"><div><h2 style={{ marginBottom: 2 }}><Link to={`/candidates/${res.candidate.candidateId}`}>{res.candidate.name}</Link></h2>
          <div className="muted">{res.candidate.currentTitle} · {res.candidate.yearsOfExperience} yrs</div></div>
          <div className="score"><ScoreBadge score={res.overallScore * 100} /></div></div>
        <table style={{ margin: "12px 0" }}><tbody>{scores.map(([l, k]) => <tr key={k}><td>{l}</td><td>{res[k].toFixed(1)}</td></tr>)}</tbody></table>
        <h3>Skills</h3><Chips items={res.candidate.skills.map((s: any) => s.name)} />
        {res.weaknesses?.length > 0 && <><h3 style={{ marginTop: 12 }}>Gaps</h3><ul className="tight">{res.weaknesses.map((w: string, i: number) => <li key={i}>{w}</li>)}</ul></>}
        <p className="muted">{res.hiringRecommendation}</p>
      </div>}
    </>
  );
}

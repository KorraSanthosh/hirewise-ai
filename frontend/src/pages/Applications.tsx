import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Bar, Empty, Err, ScoreBadge, StatusBadge } from "../components/ui";

export default function Applications() {
  const [ms, setMs] = useState<any[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api("/api/matches").then(setMs).catch((e) => setError(e.message)); }, []);
  return (
    <>
      <div className="head"><div><h1>My applications</h1><div className="muted">How your profile scores against each job, and where recruiters have you</div></div></div>
      <Err msg={error} />
      {ms && ms.length === 0 && <Empty>No applications yet. <Link to="/jobs">Browse jobs</Link> and apply — upload your resume first.</Empty>}
      <div className="grid">{ms?.map((m) => <div className="card" key={m.id}>
        <div className="row spread"><div><h2 style={{ marginBottom: 2 }}>{m.job.title}</h2><div className="muted">{m.job.company}</div></div>
          <div className="row"><ScoreBadge score={m.overallScore * 100} /><StatusBadge status={m.recruiterStatus} /></div></div>
        <div className="grid g5" style={{ margin: "12px 0" }}>{([["Skills", m.skillMatchScore], ["Experience", m.experienceScore], ["Semantic", m.semanticSimilarity], ["Availability", m.availabilityScore]] as [string, number][]).map(([l, v]) =>
          <div key={l}><div className="muted">{l}</div><Bar value={v} /></div>)}</div>
        {m.missingSkills?.length > 0 && <div><b>Skills to add:</b> <span className="muted">{m.missingSkills.slice(0, 6).join(", ")}</span></div>}
        {m.improvementSuggestions?.length > 0 && <ul className="tight" style={{ marginTop: 8 }}>{m.improvementSuggestions.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>}
      </div>)}</div>
    </>
  );
}

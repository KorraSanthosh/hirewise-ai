import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Chips, Empty, Err, ScoreBadge, StatusBadge } from "../components/ui";

const blank = { title: "", company: "", department: "", rawDescription: "", experienceYears: "", seniority: "", domain: "" };

export default function Jobs() {
  const { user } = useAuth();
  const staff = user?.role !== "candidate";
  const [jobs, setJobs] = useState<any[]>([]);
  const [mine, setMine] = useState<Record<string, any>>({});
  const [form, setForm] = useState<any>(null); // null = closed, {id?} = open
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");

  const load = async () => {
    try {
      setJobs(await api("/api/jobs"));
      if (!staff) {
        const ms = await api<any[]>("/api/matches");
        setMine(Object.fromEntries(ms.map((m) => [m.jobId, m])));
      }
    } catch (e: any) { setError(e.message); }
  };
  useEffect(() => { load(); }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault(); setBusy("save"); setError("");
    const body: any = { ...form };
    delete body.id;
    ["experienceYears"].forEach((k) => (body[k] === "" || body[k] === undefined ? delete body[k] : (body[k] = Number(body[k]))));
    Object.keys(body).forEach((k) => body[k] === "" && delete body[k]);
    try {
      if (form.id) await api(`/api/jobs/${form.id}`, { method: "PUT", body });
      else await api("/api/jobs", { body });
      setForm(null); await load();
    } catch (err: any) { setError(err.message); } finally { setBusy(""); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this job and all of its matches?")) return;
    try { await api(`/api/jobs/${id}`, { method: "DELETE" }); await load(); } catch (e: any) { setError(e.message); }
  };

  const apply = async (jobId: string) => {
    setBusy(jobId); setError(""); setNote("");
    try { await api("/api/matches", { body: { jobId } }); setNote("Applied — your match score is ready."); await load(); }
    catch (e: any) { setError(e.message); } finally { setBusy(""); }
  };

  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <div className="head"><div><h1>{staff ? "Jobs" : "Available jobs"}</h1><div className="muted">{staff ? "Job descriptions are parsed and embedded by Gemini" : "Apply to see how well your resume matches"}</div></div>
        {staff && !form && <button className="primary" onClick={() => setForm({ ...blank })}>New job</button>}</div>
      <Err msg={error} />{note && <div className="ok">{note}</div>}

      {form && <form className="card" onSubmit={save} style={{ marginBottom: 16 }}>
        <h2>{form.id ? "Edit job" : "New job"}</h2>
        <div className="grid g5">
          <div><label>Title</label><input value={form.title || ""} onChange={set("title")} placeholder="Auto-detected if empty" /></div>
          <div><label>Company</label><input value={form.company || ""} onChange={set("company")} /></div>
          <div><label>Department</label><input value={form.department || ""} onChange={set("department")} /></div>
          <div><label>Min. years</label><input type="number" min={0} value={form.experienceYears ?? ""} onChange={set("experienceYears")} /></div>
          <div><label>Seniority</label><input value={form.seniority || ""} onChange={set("seniority")} /></div>
        </div>
        <label>Job description</label>
        <textarea rows={10} value={form.rawDescription || ""} onChange={set("rawDescription")} required={!form.id} minLength={form.id ? undefined : 20} placeholder="Paste the full job description…" />
        <div className="row" style={{ marginTop: 14 }}>
          <button className="primary" disabled={busy === "save"}>{busy === "save" ? "Parsing with Gemini…" : "Save"}</button>
          <button type="button" onClick={() => setForm(null)}>Cancel</button>
        </div>
      </form>}

      {jobs.length === 0 ? <Empty>No jobs yet.</Empty> : <div className="grid">
        {jobs.map((j) => {
          const m = mine[j.id];
          return <div className="card" key={j.id}>
            <div className="row spread">
              <div><h2 style={{ marginBottom: 2 }}>{j.title}</h2><div className="muted">{[j.company, j.department, `${j.experienceYears}+ yrs`, j.seniority].filter(Boolean).join(" · ")}</div></div>
              <div className="row">
                {staff ? <>
                  <Link className="btn" to={`/rankings?jobId=${j.id}`}>Rank</Link>
                  <Link className="btn" to={`/jobs/${j.id}/evaluate`}>Evaluate resume</Link>
                  <button onClick={() => setForm({ ...j })}>Edit</button>
                  <button className="danger" onClick={() => remove(j.id)}>Delete</button>
                </> : m ? <><ScoreBadge score={m.overallScore * 100} /><StatusBadge status={m.recruiterStatus} /></>
                  : <button className="primary" disabled={busy === j.id} onClick={() => apply(j.id)}>{busy === j.id ? "Scoring…" : "Apply"}</button>}
              </div>
            </div>
            <div style={{ margin: "12px 0 6px" }}><b>Required:</b> <Chips items={j.requiredSkills || []} /></div>
            {j.preferredSkills?.length > 0 && <div><b>Preferred:</b> <Chips items={j.preferredSkills} /></div>}
          </div>;
        })}
      </div>}
    </>
  );
}

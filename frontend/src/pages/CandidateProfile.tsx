import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import Avatar, { resizeImage } from "../components/Avatar";
import { Chips, Empty, Err, ScoreBadge, StatusBadge } from "../components/ui";

const dash = "—";
const month = (d?: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "");

export default function CandidateProfile() {
  const { candidateId } = useParams();
  const { user } = useAuth();
  const own = user?.role === "candidate";
  const [c, setC] = useState<any>(null);
  const [error, setError] = useState("");
  const [photoMsg, setPhotoMsg] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pickPhoto = async (f?: File | null) => {
    if (!f) return;
    setPhotoMsg(""); setPhotoBusy(true);
    try {
      const blob = await resizeImage(f);
      const form = new FormData();
      form.append("file", blob, "photo.jpg");
      const r = await api(`/api/candidates/${c.id}/photo`, { form });
      const url = r.data?.photoUrl ?? r.photoUrl ?? null;
      setC((p: any) => ({ ...p, photoUrl: url }));
      window.dispatchEvent(new CustomEvent("hw-photo", { detail: url }));
    } catch (e: any) { setPhotoMsg(e.message); }
    setPhotoBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  };
  const removePhoto = async () => {
    setPhotoMsg(""); setPhotoBusy(true);
    try { await api(`/api/candidates/${c.id}/photo`, { method: "DELETE" }); setC((p: any) => ({ ...p, photoUrl: null })); window.dispatchEvent(new CustomEvent("hw-photo", { detail: null })); }
    catch (e: any) { setPhotoMsg(e.message); }
    setPhotoBusy(false);
  };
  useEffect(() => { api(`/api/candidates/${candidateId}`).then(setC).catch((e) => setError(e.message)); }, [candidateId]);
  if (error) return own ? <div className="card"><h2>No profile yet</h2><p className="muted">Upload your resume to create your profile.</p><Link className="btn primary" to="/upload-resume">Upload resume</Link></div> : <Err msg={error} />;
  if (!c) return <div className="muted">Loading…</div>;

  return (
    <>
      <div className="head"><div className="profile-photo"><Avatar name={c.name} url={c.photoUrl} size={88} /><div><h1>{c.name}</h1><div className="muted">{c.headline}</div>
        <div className="muted">{[c.currentTitle && `${c.currentTitle}${c.currentCompany ? " @ " + c.currentCompany : ""}`, c.location, `${c.yearsOfExperience} yrs`, c.candidateId].filter(Boolean).join(" · ")}</div>
        {own && <div className="actions" style={{ marginTop: 8 }}>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
          <button disabled={photoBusy} onClick={() => fileRef.current?.click()}>{photoBusy ? "Saving…" : c.photoUrl ? "Change photo" : "Add profile photo"}</button>
          {c.photoUrl && <button disabled={photoBusy} onClick={removePhoto}>Remove</button>}
          {photoMsg && <span className="badge warn">{photoMsg}</span>}
        </div>}</div></div>
        <div className="row">{c.anomalyStatus !== "CLEAN" && !own && <span className="badge warn">Anomaly: {c.anomalyStatus}</span>}{own && <Link className="btn primary" to="/upload-resume">Upload / update resume</Link>}</div></div>
      {own && c.skills.length === 0 && c.careerHistory.length === 0 && <div className="card" style={{ marginBottom: 16 }}><h2>Complete your profile</h2><p className="muted" style={{ margin: 0 }}>Your profile is empty. <Link to="/upload-resume">Upload your resume</Link> and we will fill in your skills, experience and education automatically.</p></div>}
      {!own && c.anomalyReasons?.length > 0 && <div className="card" style={{ marginBottom: 16, borderColor: "var(--warn)" }}><h3>Profile flags</h3><ul className="tight">{c.anomalyReasons.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul></div>}
      <div className="grid g2">
        <div className="card"><h2>Summary</h2><p style={{ margin: 0 }}>{c.summary || <span className="muted">No summary.</span>}</p>
          <h2 style={{ marginTop: 18 }}>Skills</h2>{c.skills.length ? <Chips items={c.skills.map((s: any) => `${s.name} · ${s.proficiency}`)} /> : <span className="muted">None parsed.</span>}</div>
        <div className="card"><h2>Personal &amp; job details</h2>
          <table><tbody>
            <tr><td>Email</td><td>{c.email || dash}</td></tr>
            <tr><td>Phone</td><td>{c.phone || dash}</td></tr>
            <tr><td>Location</td><td>{[c.location, c.country].filter(Boolean).join(", ") || dash}</td></tr>
            <tr><td>Current role</td><td>{c.currentTitle || dash}</td></tr>
            <tr><td>Company</td><td>{[c.currentCompany, c.currentCompanySize && `(${c.currentCompanySize} employees)`].filter(Boolean).join(" ") || dash}</td></tr>
            <tr><td>Industry</td><td>{c.currentIndustry || dash}</td></tr>
            <tr><td>Seniority / domain</td><td>{[c.seniority, c.domain].filter(Boolean).join(" · ") || dash}</td></tr>
            <tr><td>Experience</td><td>{c.yearsOfExperience} years</td></tr>
          </tbody></table></div>
      </div>
      <div className="grid g2" style={{ marginTop: 16 }}>
        <div className="card"><h2>Availability &amp; preferences</h2>
          <table><tbody>
            <tr><td>Open to work</td><td>{c.openToWork ? "Yes" : "No"}</td></tr>
            <tr><td>Notice period</td><td>{c.noticePeriodDays} days</td></tr>
            <tr><td>Expected salary</td><td>{c.expectedSalaryMax > 0 ? `${c.expectedSalaryMin}–${c.expectedSalaryMax} LPA` : dash}</td></tr>
            <tr><td>Work mode</td><td>{c.preferredWorkMode || dash}{c.willingToRelocate ? " · willing to relocate" : ""}</td></tr>
            <tr><td>Last active</td><td>{c.lastActiveDate ? new Date(c.lastActiveDate).toLocaleDateString() : dash}</td></tr>
          </tbody></table></div>
        <div className="card"><h2>Platform signals</h2>
          <table><tbody>
            <tr><td>Profile completeness</td><td>{Math.round(c.profileCompleteness)}%</td></tr>
            <tr><td>Recruiter response rate</td><td>{Math.round(c.recruiterResponse * 100)}%{c.avgResponseTime > 0 ? ` · avg ${Math.round(c.avgResponseTime)} h` : ""}</td></tr>
            <tr><td>Connections / endorsements</td><td>{c.connectionCount} / {c.endorsementsCount}</td></tr>
            <tr><td>GitHub activity</td><td>{c.githubActivityScore >= 0 ? `${Math.round(c.githubActivityScore)}/100` : "Not linked"}</td></tr>
            <tr><td>Verified</td><td>{[c.verifiedEmail && "email", c.verifiedPhone && "phone", c.linkedinConnected && "LinkedIn"].filter(Boolean).join(", ") || dash}</td></tr>
          </tbody></table></div>
      </div>
      <div className="grid g2" style={{ marginTop: 16 }}>
        <div className="card"><h2>Experience</h2>{c.careerHistory.length === 0 ? <Empty>No roles parsed.</Empty> :
          c.careerHistory.map((j: any) => <div key={j.id} style={{ marginBottom: 12 }}><b>{j.title}</b> · {j.company}
            <div className="muted">{month(j.startDate)} – {j.isCurrent ? "Present" : month(j.endDate)} · {j.durationMonths} mo</div>
            {j.description && <div>{j.description}</div>}</div>)}</div>
        <div className="card"><h2>Education</h2>{c.education.length === 0 ? <Empty>No education parsed.</Empty> :
          c.education.map((e: any) => <div key={e.id} style={{ marginBottom: 10 }}><b>{e.degree}</b>, {e.fieldOfStudy}<div className="muted">{e.institution} · {e.startYear ?? "?"}–{e.endYear ?? "?"} · {e.tier}</div></div>)}</div>
      </div>
      <div className="card" style={{ marginTop: 16 }}><h2>{own ? "How I match open jobs" : "Job matches"}</h2>
        {c.matches.length === 0 ? <Empty>No matches yet.</Empty> : <table><thead><tr><th>Job</th><th>Score</th><th>Status</th></tr></thead><tbody>
          {[...c.matches].sort((a: any, b: any) => b.overallScore - a.overallScore).map((m: any) => <tr key={m.id}><td>{m.job.title}<div className="muted">{m.job.company}</div></td>
            <td><ScoreBadge score={m.overallScore * 100} /></td><td><StatusBadge status={m.recruiterStatus} /></td></tr>)}</tbody></table>}
      </div>
    </>
  );
}

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Err } from "../components/ui";

export default function UploadResume() {
  const { user } = useAuth();
  const nav = useNavigate();
  const isCand = user?.role === "candidate";
  const [file, setFile] = useState<File | null>(null);
  const [res, setRes] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    if (!file) return;
    setBusy(true); setError(""); setRes(null);
    const form = new FormData(); form.append("file", file);
    try { const r = (await api("/api/candidates/upload", { form })).data; setRes(r); if (isCand) setTimeout(() => nav("/candidates/profile"), 1200); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <>
      <div className="head"><div><h1>{isCand ? "Upload / update my resume" : "Upload resume"}</h1>
        <div className="muted">{isCand ? "Upload your resume (PDF). We read it with AI, build your profile, and score you against every open job. Uploading again replaces your profile." : "Each upload adds a new candidate to the pool (uploading the same resume again reuses the existing one). PDF only — parsed with Gemini and scored against every job."}</div></div></div>
      <Err msg={error} />
      <div className="card">
        <input type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <div style={{ marginTop: 14 }}><button className="primary" disabled={!file || busy} onClick={run}>{busy ? "Parsing resume…" : "Upload & parse"}</button></div>
      </div>
      {res && <div className="ok">Profile ready: <b>{res.name}</b> ({res.candidateId}) — {res.headline || "no headline"}, {res.yearsOfExperience} yrs. <Link to={isCand ? "/candidates/profile" : `/candidates/${res.candidateId}`}>View profile</Link>{isCand && " — opening your profile…"}</div>}
    </>
  );
}

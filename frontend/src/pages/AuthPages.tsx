import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Briefcase, UserRound } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Err } from "../components/ui";
import ThemeToggle from "../components/ThemeToggle";
import Greeting from "../components/Greeting";

const KINDS = {
  recruiter: { label: "Recruiter", Icon: Briefcase, blurb: "Post jobs, rank candidates, get an explainable shortlist." },
  candidate: { label: "Candidate", Icon: UserRound, blurb: "Upload your resume and see how you match every job." },
} as const;
type Kind = keyof typeof KINDS;

export function Login() {
  const { login, logout } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [kind, setKind] = useState<Kind>(params.get("as") === "candidate" ? "candidate" : "recruiter");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const u = await login(email, password);
      const isCand = u.role === "candidate";
      if ((kind === "candidate") !== isCand) {  // signed in with the wrong tab selected
        logout();
        setError(`This is a ${isCand ? "candidate" : "recruiter"} account. Choose the "${isCand ? "Candidate" : "Recruiter"}" option above and sign in again.`);
        return;
      }
      nav(isCand ? "/candidates/profile" : "/dashboard");
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <div className="center split"><ThemeToggle floating /><div className="hero"><Greeting /><img className="hero-img" src="/hero.png" alt="Recruiter screening candidate profiles" /><h2>Hire smarter, or get found — AI matches candidates and jobs, role by role.</h2><p className="muted">Recruiters get an explainable, role-wise shortlist. Candidates upload a resume and see how they match.</p></div><form className="card auth" onSubmit={submit}>
      <h1>Sign in to HireWise AI</h1><p className="muted">Choose how you want to sign in.</p>
      <div className="kinds" role="tablist">
        {(Object.keys(KINDS) as Kind[]).map((k) => { const { label, Icon } = KINDS[k]; return (
          <button type="button" role="tab" aria-selected={kind === k} key={k} className={`kind ${kind === k ? "on" : ""}`} onClick={() => { setKind(k); setError(""); }}>
            <Icon size={20} /><b>{label}</b>
          </button>); })}
      </div>
      <p className="muted kind-blurb">{KINDS[kind].blurb}</p>
      <Err msg={error} />
      <label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
      <label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <button className="primary" style={{ width: "100%", marginTop: 18, justifyContent: "center" }} disabled={busy}>{busy ? "Signing in…" : `Sign in as ${KINDS[kind].label.toLowerCase()}`}</button>
      <p className="muted" style={{ textAlign: "center" }}>No account? <Link to={`/register?as=${kind}`}>Register as a {KINDS[kind].label.toLowerCase()}</Link></p>
    </form></div>
  );
}

export function Register() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [params] = useSearchParams();
  const [f, setF] = useState({ name: "", email: "", password: "", role: params.get("as") === "candidate" ? "candidate" : "recruiter" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await api("/api/auth/register", { body: f });
      const u = await login(f.email, f.password);
      nav(u.role === "candidate" ? "/candidates/profile" : "/dashboard");
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <div className="center split"><ThemeToggle floating /><div className="hero"><img className="hero-img" src="/hero.png" alt="Recruiter screening candidate profiles" /><h2>Hire smarter, or get found — AI matches candidates and jobs, role by role.</h2><p className="muted">Recruiters get an explainable, role-wise shortlist. Candidates upload a resume and see how they match.</p></div><form className="card auth" onSubmit={submit}>
      <h1>Create your account</h1>
      <Err msg={error} />
      <label>Full name</label><input value={f.name} onChange={set("name")} required />
      <label>Email</label><input type="email" value={f.email} onChange={set("email")} required />
      <label>Password (min 6 characters)</label><input type="password" minLength={6} value={f.password} onChange={set("password")} required />
      <label>I am a…</label>
      <select value={f.role} onChange={set("role")}><option value="recruiter">Recruiter</option><option value="candidate">Candidate (upload my resume)</option></select>
            <button className="primary" style={{ width: "100%", marginTop: 18, justifyContent: "center" }} disabled={busy}>{busy ? "Creating…" : "Register"}</button>
      <p className="muted" style={{ textAlign: "center" }}>Have an account? <Link to={`/login?as=${f.role}`}>Sign in</Link></p>
    </form></div>
  );
}

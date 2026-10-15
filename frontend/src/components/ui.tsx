import { ReactNode } from "react";

export const pct = (n: number) => `${Math.round(n)}%`;
export const Err = ({ msg }: { msg: string }) => (msg ? <div className="err">{msg}</div> : null);
export const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>;

export function Bar({ value }: { value: number }) {
  return <div className="bar" title={pct(value)}><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

export function ScoreBadge({ score }: { score: number }) {
  const cls = score >= 75 ? "good" : score >= 50 ? "warn" : "bad";
  return <span className={`badge ${cls}`}>{score.toFixed(1)}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const cls = status === "SHORTLISTED" ? "good" : status === "REJECTED" ? "bad" : "";
  return <span className={`badge ${cls}`}>{status.charAt(0) + status.slice(1).toLowerCase()}</span>;
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return <div className="card stat"><div className="l">{label}</div><div className="v">{value}</div></div>;
}

export function Chips({ items }: { items: string[] }) {
  return <div className="chips">{items.map((s, i) => <span key={i} className="chip">{s}</span>)}</div>;
}

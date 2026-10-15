import { Moon, Sun, Sunset } from "lucide-react";

function partOfDay(h: number) {
  if (h >= 5 && h < 12) return { text: "Good morning", Icon: Sun, cls: "morning" };
  if (h >= 12 && h < 17) return { text: "Good afternoon", Icon: Sun, cls: "afternoon" };
  if (h >= 17 && h < 21) return { text: "Good evening", Icon: Sunset, cls: "evening" };
  return { text: "Good night", Icon: Moon, cls: "night" };
}

/** Animated, time-aware greeting: letters rise in one by one, the icon spins/pulses, a shimmer sweeps across. */
export default function Greeting({ name, compact }: { name?: string; compact?: boolean }) {
  const { text: base, Icon, cls } = partOfDay(new Date().getHours());
  const first = (name || "").trim().split(" ")[0];
  const text = first ? `${base}, ${first}` : base;
  return (
    <div className={`greet ${cls}${compact ? " compact" : ""}`} aria-label={text}>
      <span className="greet-icon"><Icon size={compact ? 26 : 34} /></span>
      <span className="greet-text" aria-hidden="true">
        {text.split("").map((ch, i) => (
          <span key={i} style={{ animationDelay: `${0.15 + i * 0.05}s` }}>{ch === " " ? " " : ch}</span>
        ))}
      </span>
      <span className="greet-wave" aria-hidden="true">👋</span>
    </div>
  );
}

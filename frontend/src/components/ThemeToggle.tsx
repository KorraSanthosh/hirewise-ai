import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { applyMode, getMode, Mode } from "../theme";

const OPTS: [Mode, JSX.Element, string][] = [["system", <Monitor size={14} />, "System"], ["light", <Sun size={14} />, "Light"], ["dark", <Moon size={14} />, "Dark"]];

export default function ThemeToggle({ floating = false }: { floating?: boolean }) {
  const [mode, setMode] = useState<Mode>(getMode());
  return (
    <div className={`theme${floating ? " floating" : ""}`} role="group" aria-label="Theme">
      {OPTS.map(([m, icon, label]) => (
        <button key={m} type="button" className={mode === m ? "on" : ""} title={label} aria-label={label} onClick={() => { applyMode(m); setMode(m); }}>{icon}</button>
      ))}
    </div>
  );
}

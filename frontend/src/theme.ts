export type Mode = "system" | "light" | "dark";
const KEY = "hw_theme";
export const getMode = (): Mode => {
  try { const v = localStorage.getItem(KEY); if (v === "light" || v === "dark" || v === "system") return v; } catch {}
  return "system";
};
export const applyMode = (m: Mode) => {
  document.documentElement.dataset.mode = m;
  try { localStorage.setItem(KEY, m); } catch {}
};

const WHITE_POINT_KEY = "izer-white-point";
const DARKNESS_KEY = "izer-darkness-depth";

export function readWhitePoint(): number {
  try {
    const raw = localStorage.getItem(WHITE_POINT_KEY);
    if (!raw) return 0;
    const num = Number(raw);
    return isNaN(num) ? 0 : Math.max(0, Math.min(100, num));
  } catch {
    return 0;
  }
}

export function writeWhitePoint(val: number): void {
  try {
    localStorage.setItem(WHITE_POINT_KEY, String(val));
    applyDisplayAdjustments();
  } catch {}
}

export function readDarkness(): number {
  try {
    const raw = localStorage.getItem(DARKNESS_KEY);
    if (!raw) return 0;
    const num = Number(raw);
    return isNaN(num) ? 0 : Math.max(0, Math.min(100, num));
  } catch {
    return 0;
  }
}

export function writeDarkness(val: number): void {
  const next = Math.max(0, Math.min(100, Math.round(val)));
  try {
    localStorage.setItem(DARKNESS_KEY, String(next));
  } catch {
    /* storage blocked */
  }
  applyDisplayAdjustments(next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("izer-darkness", { detail: next }));
  }
}

export function applyDisplayAdjustments(darkness = readDarkness()): void {
  if (typeof document === "undefined") return;
  const wp = readWhitePoint();
  const dk = Math.max(0, Math.min(100, darkness));
  const root = document.documentElement;
  root.style.setProperty("--papein-white-point", `${wp}%`);
  root.style.setProperty("--papein-darkness", `${dk}%`);
  root.style.setProperty("--papein-darkness-level", String(dk));
}

// Automatically apply on load
if (typeof window !== "undefined") {
  applyDisplayAdjustments();
}

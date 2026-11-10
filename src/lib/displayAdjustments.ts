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
  try {
    localStorage.setItem(DARKNESS_KEY, String(val));
    applyDisplayAdjustments();
  } catch {}
}

export function applyDisplayAdjustments(): void {
  if (typeof document === "undefined") return;
  const wp = readWhitePoint();
  const dk = readDarkness();
  document.documentElement.style.setProperty("--papein-white-point", `${wp}%`);
  document.documentElement.style.setProperty("--papein-darkness", `${dk}%`);
}

// Automatically apply on load
if (typeof window !== "undefined") {
  applyDisplayAdjustments();
}

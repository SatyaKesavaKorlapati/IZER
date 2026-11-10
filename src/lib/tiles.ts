export const TILE_KEY = "eq-band-tile-width";
export const TILE_MIN = 168;
export const TILE_MAX = 280;
export const TILE_GAP = 8;
/**
 * Widest preference that still fits five tiles on a 1280px window.
 * Shell padding 10+10, band-scroll inset 1+1, four 8px gaps:
 * (1280 - 22 - 32) / 5 = 245.2, so 244 keeps a pixel of slack.
 */
export const TILE_FIT = 244;

let sessionWidth: number | null = null;

function clampTile(value: number): number {
  return Math.round(Math.min(TILE_MAX, Math.max(TILE_MIN, value)));
}

/** Session starts at the 1280px row max. A previously stored smaller width does not win. */
export function readTileWidth(): number {
  if (sessionWidth != null) return sessionWidth;
  let raw = Number.NaN;
  try {
    const stored = localStorage.getItem(TILE_KEY);
    if (stored != null && stored.trim() !== "") raw = Number(stored);
  } catch {
    raw = Number.NaN;
  }
  const next = !Number.isFinite(raw) || raw < TILE_FIT || raw > TILE_MAX ? TILE_FIT : clampTile(raw);
  sessionWidth = next;
  try {
    localStorage.setItem(TILE_KEY, String(next));
  } catch {
    /* ignore quota */
  }
  return next;
}

export function writeTileWidth(value: number): void {
  const next = clampTile(value);
  sessionWidth = next;
  try {
    localStorage.setItem(TILE_KEY, String(next));
  } catch {
    /* ignore quota */
  }
}

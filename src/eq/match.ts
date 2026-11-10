import type { EqModel, FilterType } from "./types";

export interface CurveBand {
  type: FilterType;
  freq: number;
  gain: number;
  q: number;
}

export interface PresetMatchHit {
  name: string;
  note: string;
}

export interface PresetMatch {
  exactNames: string[];
  closest: PresetMatchHit[];
}

const FREQ_TOL = 1;
const GAIN_TOL = 0.1;
const Q_TOL = 0.05;

/** Gain stored on a disabled band is not what a flush writes. Compare the curve the DAC would hold. */
export function presetCurve(eq: EqModel): CurveBand[] {
  return eq.bands.slice(0, 5).map((band) => ({
    type: band.type,
    freq: Math.round(band.freq),
    gain: band.enabled ? band.gain : 0,
    q: band.q,
  }));
}

function bandsExact(dac: CurveBand[], curve: CurveBand[]): boolean {
  if (dac.length !== 5 || curve.length !== 5) return false;
  return dac.every((band, index) => {
    const other = curve[index];
    return (
      band.type === other.type &&
      Math.abs(band.freq - other.freq) <= FREQ_TOL &&
      Math.abs(band.gain - other.gain) <= GAIN_TOL &&
      Math.abs(band.q - other.q) <= Q_TOL
    );
  });
}

function distanceTo(dac: CurveBand[], curve: CurveBand[], name: string): { score: number; note: string } {
  let score = 0;
  let worst = 0;
  let worstText = "";
  const rough = () => worstText.includes("type") || worstText.includes("missing");
  for (let index = 0; index < 5; index += 1) {
    const band = dac[index];
    const other = curve[index];
    if (!band || !other) {
      score += 80;
      if (80 > worst) {
        worst = 80;
        worstText = `band ${index + 1} missing`;
      }
      continue;
    }
    if (band.type !== other.type) {
      score += 40;
      if (40 > worst) {
        worst = 40;
        worstText = `band ${index + 1} type differs`;
      }
    }
    const freqDelta = Math.abs(band.freq - other.freq);
    const gainDelta = Math.abs(band.gain - other.gain);
    const qDelta = Math.abs(band.q - other.q);
    const freqScore = freqDelta / 25;
    const gainScore = gainDelta * 5;
    const qScore = qDelta * 10;
    score += freqScore + gainScore + qScore;
    if (freqDelta > FREQ_TOL && freqScore > worst) {
      worst = freqScore;
      worstText = `${Math.round(freqDelta)} Hz off`;
    }
    if (gainDelta > GAIN_TOL && gainScore > worst) {
      worst = gainScore;
      worstText = `${(Math.round(gainDelta * 10) / 10).toFixed(1)} dB off`;
    }
    if (qDelta > Q_TOL && qScore > worst) {
      worst = qScore;
      worstText = `Q ${(Math.round(qDelta * 100) / 100).toFixed(2)} off`;
    }
  }
  const lead = worst <= 20 && !rough() ? "close to" : "nearest";
  const note = worstText ? `${lead} ${name} · ${worstText}` : `${lead} ${name}`;
  return { score, note };
}

export function matchCurveToPresets(bands: readonly CurveBand[], presets: ReadonlyArray<{ name: string; eq: EqModel }>): PresetMatch {
  const exactNames: string[] = [];
  const ranked: Array<{ name: string; score: number; note: string }> = [];
  const seenExact = new Set<string>();
  for (const preset of presets) {
    const curve = presetCurve(preset.eq);
    if (bandsExact([...bands], curve)) {
      if (!seenExact.has(preset.name)) {
        seenExact.add(preset.name);
        exactNames.push(preset.name);
      }
      continue;
    }
    ranked.push({ name: preset.name, ...distanceTo([...bands], curve, preset.name) });
  }
  ranked.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  if (exactNames.length > 0) return { exactNames, closest: [] };
  const closest: PresetMatchHit[] = [];
  const seen = new Set<string>();
  for (const row of ranked) {
    if (seen.has(row.name)) continue;
    seen.add(row.name);
    closest.push({ name: row.name, note: row.note });
    if (closest.length === 3) break;
  }
  return { exactNames: [], closest };
}

const CLOSE_GAIN = 0.5;
const CLOSE_Q = 0.2;

/**
 * A preset is worth naming only when every type matches, frequencies stay
 * inside the exact tolerance, and any gain or Q miss is small.
 * A flat line whose frequencies are thousands of Hz away is not that preset.
 */
export function closePresetName(
  bands: readonly CurveBand[],
  presets: ReadonlyArray<{ name: string; eq: EqModel }>,
): string | null {
  let best: { name: string; score: number } | null = null;
  const seen = new Set<string>();
  for (const preset of presets) {
    if (seen.has(preset.name)) continue;
    const curve = presetCurve(preset.eq);
    if (bands.length !== 5 || curve.length !== 5) continue;
    let score = 0;
    let ok = true;
    for (let index = 0; index < 5; index += 1) {
      const band = bands[index];
      const other = curve[index];
      const freqDelta = Math.abs(band.freq - other.freq);
      const gainDelta = Math.abs(band.gain - other.gain);
      const qDelta = Math.abs(band.q - other.q);
      if (band.type !== other.type || freqDelta > FREQ_TOL || gainDelta > CLOSE_GAIN || qDelta > CLOSE_Q) {
        ok = false;
        break;
      }
      score += gainDelta * 5 + qDelta * 10;
    }
    if (!ok) continue;
    seen.add(preset.name);
    if (!best || score < best.score) best = { name: preset.name, score };
  }
  return best?.name ?? null;
}

export function dacEditorName(match: PresetMatch): string {
  return match.exactNames[0] ?? "On the DAC";
}

export function dacCurveSentence(
  bands: readonly CurveBand[],
  match: PresetMatch,
  presets: ReadonlyArray<{ name: string; eq: EqModel }>,
): string {
  if (match.exactNames.length === 1) return `This matches ${match.exactNames[0]}.`;
  if (match.exactNames.length > 1) {
    const shown = match.exactNames.slice(0, 3);
    const extra = match.exactNames.length - shown.length;
    const list = shown.join(", ");
    return extra > 0 ? `This matches ${list}, and ${extra} more.` : `This matches ${list}.`;
  }
  const close = closePresetName(bands, presets);
  const flat = bands.length > 0 && bands.every((band) => Math.abs(band.gain) <= 0.05);
  if (flat && close) return `This is a flat curve, close to ${close}.`;
  if (flat) return "This is a flat curve.";
  if (close) return `This is close to ${close}.`;
  return "This curve does not match a library preset.";
}

export function matchSummary(match: PresetMatch): string {
  if (match.exactNames.length === 1) return `Matches ${match.exactNames[0]}.`;
  if (match.exactNames.length > 1) {
    const shown = match.exactNames.slice(0, 3);
    const extra = match.exactNames.length - shown.length;
    const list = shown.join(", ");
    return extra > 0 ? `Matches ${list}, and ${extra} more.` : `Matches ${list}.`;
  }
  if (match.closest.length === 0) return "No preset to compare.";
  const [first, ...rest] = match.closest;
  const head = `${first.note.charAt(0).toUpperCase()}${first.note.slice(1)}.`;
  if (rest.length === 0) return head;
  return `${head} Also ${rest.map((hit) => hit.note).join(". ")}.`;
}

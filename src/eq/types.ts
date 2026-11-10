export type FilterType = "pk" | "ls" | "hs";

export interface Band {
  type: FilterType;
  freq: number;
  gain: number;
  q: number;
  enabled: boolean;
}

export interface EqModel {
  name: string;
  bands: Band[];
  preamp: number;
  autoPreamp: boolean;
}

export const SAMPLE_RATE = 48_000;
export const FREQ_MIN = 20;
export const FREQ_MAX = 20_000;
export const GAIN_MIN = -12;
export const GAIN_MAX = 12;
export const Q_MIN = 0.1;
export const Q_MAX = 10;
export const BAND_COUNT = 5;

export const BAND_COLORS = ["#1A8F9A", "#C47A2C", "#6B5CC7", "#2E8B62", "#C25478"] as const;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function roundTo(value: number, places: number): number {
  const m = 10 ** places;
  return Math.round(value * m) / m;
}

export function clampBand(band: Band): Band {
  return {
    type: band.type,
    freq: Math.round(clamp(band.freq, FREQ_MIN, FREQ_MAX)),
    gain: roundTo(clamp(band.gain, GAIN_MIN, GAIN_MAX), 1),
    q: roundTo(clamp(band.q, Q_MIN, Q_MAX), 2),
    enabled: band.enabled,
  };
}

export function flatBands(): Band[] {
  const seeds: Array<[FilterType, number, number]> = [
    ["pk", 80, 1],
    ["pk", 300, 1],
    ["pk", 1000, 1],
    ["pk", 4000, 1],
    ["hs", 12000, 0.7],
  ];
  return seeds.map(([type, freq, q]) => ({
    type,
    freq,
    gain: 0,
    q,
    enabled: true,
  }));
}

export function flatModel(name = "Flat"): EqModel {
  return {
    name,
    bands: flatBands(),
    preamp: 0,
    autoPreamp: false,
  };
}

/** Studio factory reset: five bells at 0 dB, Q 1, auto level match. */
export function factoryResetModel(): EqModel {
  const freqs = [80, 300, 1000, 4000, 10000];
  return normalizeEq({
    name: "Flat",
    preamp: 0,
    autoPreamp: true,
    bands: freqs.map((freq) => ({ type: "pk" as const, freq, gain: 0, q: 1, enabled: true })),
  });
}

/** Largest enabled boost. Cuts and disabled bands stay at 0, so they do not spend headroom. */
export function largestEnabledBoost(bands: readonly Band[]): number {
  let boost = 0;
  for (const band of bands) {
    if (band.enabled && band.gain > boost) boost = band.gain;
  }
  return boost;
}

/**
 * Auto level match written to the JA11 global-gain report.
 * Sent preamp = clamp(12 − max(0, largest enabled boost), −12, +12).
 * A +3 dB bell is the only boost → +9 dB. Cuts alone stay at +12 dB.
 */
export function autoPreampDb(bands: Band[]): number {
  return roundTo(clamp(12 - largestEnabledBoost(bands), GAIN_MIN, GAIN_MAX), 1);
}

export function effectivePreamp(eq: EqModel): number {
  return eq.autoPreamp ? autoPreampDb(eq.bands) : roundTo(clamp(eq.preamp, GAIN_MIN, GAIN_MAX), 1);
}

export function normalizeEq(eq: EqModel): EqModel {
  const bands = eq.bands.slice(0, BAND_COUNT).map(clampBand);
  while (bands.length < BAND_COUNT) {
    bands.push({ type: "pk", freq: 1000, gain: 0, q: 1, enabled: false });
  }
  const next: EqModel = {
    name: eq.name.trim() || "Untitled",
    bands,
    preamp: roundTo(clamp(eq.preamp, GAIN_MIN, GAIN_MAX), 1),
    autoPreamp: eq.autoPreamp,
  };
  if (next.autoPreamp) next.preamp = autoPreampDb(next.bands);
  return next;
}

export function eqSignature(eq: EqModel): string {
  return JSON.stringify(normalizeEq(eq));
}

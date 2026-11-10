import { FREQ_MAX, FREQ_MIN, GAIN_MAX, GAIN_MIN, Q_MAX, Q_MIN, clamp } from "./types";

export function formatFreq(hz: number): string {
  if (hz >= 1000) {
    const k = Math.round((hz / 1000) * 100) / 100;
    return `${k}k`;
  }
  return String(Math.round(hz));
}

export function parseFreq(input: string): number | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, "").replace(/hz$/, "");
  const match = text.match(/^([0-9]*\.?[0-9]+)(k)?$/);
  if (!match || match[1] === "" || match[1] === ".") return null;
  const value = Number(match[1]) * (match[2] ? 1000 : 1);
  return Number.isFinite(value) ? value : null;
}

export function parseDecimal(input: string): number | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, "").replace(/db$/, "");
  if (!/^[-+]?[0-9]*\.?[0-9]+$/.test(text) || text === "." || text === "+" || text === "-") return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

export function formatGain(db: number): string {
  const rounded = Math.round(db * 10) / 10;
  return rounded > 0 ? `+${rounded.toFixed(1)}` : rounded.toFixed(1);
}

export function formatQ(q: number): string {
  return (Math.round(q * 100) / 100).toFixed(2);
}

export function formatSigned(db: number): string {
  const rounded = Math.round(db * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)} dB`;
}

export function nudgeFreq(freq: number, direction: 1 | -1, coarse: boolean): number {
  const factor = coarse ? 1.06 : 1.02;
  const next = direction > 0 ? freq * factor : freq / factor;
  return Math.round(clamp(next, FREQ_MIN, FREQ_MAX));
}

export function nudgeGain(gain: number, direction: 1 | -1, coarse: boolean): number {
  const step = coarse ? 1 : 0.1;
  return clamp(Math.round((gain + direction * step) * 10) / 10, GAIN_MIN, GAIN_MAX);
}

export function nudgeQ(q: number, direction: 1 | -1, coarse: boolean): number {
  const step = coarse ? 0.1 : 0.01;
  return clamp(Math.round((q + direction * step) * 100) / 100, Q_MIN, Q_MAX);
}

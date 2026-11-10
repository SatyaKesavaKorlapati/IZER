import { SAMPLE_RATE, type Band } from "./types";

interface Coeffs {
  b0: number;
  b1: number;
  b2: number;
  a0: number;
  a1: number;
  a2: number;
}

/**
 * RBJ biquad at 48 kHz.
 * Shelf filters follow Equalizer APO: the Q number is used as RBJ shelf slope S.
 */
export function designBiquad(band: Band, sampleRate = SAMPLE_RATE): Coeffs {
  const A = 10 ** (band.gain / 40);
  const w0 = (2 * Math.PI * band.freq) / sampleRate;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);

  if (band.type === "pk") {
    const alpha = sin / (2 * band.q);
    return {
      b0: 1 + alpha * A,
      b1: -2 * cos,
      b2: 1 - alpha * A,
      a0: 1 + alpha / A,
      a1: -2 * cos,
      a2: 1 - alpha / A,
    };
  }

  const slopeInner = (A + 1 / A) * (1 / band.q - 1) + 2;
  const alpha = (sin / 2) * Math.sqrt(Math.max(slopeInner, 1e-8));
  const two = 2 * Math.sqrt(A) * alpha;

  if (band.type === "ls") {
    return {
      b0: A * (A + 1 - (A - 1) * cos + two),
      b1: 2 * A * (A - 1 - (A + 1) * cos),
      b2: A * (A + 1 - (A - 1) * cos - two),
      a0: A + 1 + (A - 1) * cos + two,
      a1: -2 * (A - 1 + (A + 1) * cos),
      a2: A + 1 + (A - 1) * cos - two,
    };
  }

  return {
    b0: A * (A + 1 + (A - 1) * cos + two),
    b1: -2 * A * (A - 1 + (A + 1) * cos),
    b2: A * (A + 1 + (A - 1) * cos - two),
    a0: A + 1 - (A - 1) * cos + two,
    a1: 2 * (A - 1 - (A + 1) * cos),
    a2: A + 1 - (A - 1) * cos - two,
  };
}

export function biquadDb(freq: number, coeffs: Coeffs, sampleRate = SAMPLE_RATE): number {
  const w = (2 * Math.PI * freq) / sampleRate;
  const cw = Math.cos(w);
  const c2 = Math.cos(2 * w);
  const sw = Math.sin(w);
  const s2 = Math.sin(2 * w);
  const nr = coeffs.b0 + coeffs.b1 * cw + coeffs.b2 * c2;
  const ni = coeffs.b1 * sw + coeffs.b2 * s2;
  const dr = coeffs.a0 + coeffs.a1 * cw + coeffs.a2 * c2;
  const di = coeffs.a1 * sw + coeffs.a2 * s2;
  const mag = Math.hypot(nr, ni) / Math.hypot(dr, di);
  if (!Number.isFinite(mag) || mag <= 1e-12) return -120;
  return 20 * Math.log10(mag);
}

export function bandDb(freq: number, band: Band, sampleRate = SAMPLE_RATE): number {
  if (!band.enabled || band.gain === 0) return 0;
  return biquadDb(freq, designBiquad(band, sampleRate), sampleRate);
}

/** Sum of enabled bands. Preamp is not included; the studio shows it beside the plot. */
export function responseDb(freq: number, bands: Band[], sampleRate = SAMPLE_RATE): number {
  let db = 0;
  for (const band of bands) db += bandDb(freq, band, sampleRate);
  return db;
}

export function sampleBand(band: Band, count = 160): Array<{ freq: number; db: number }> {
  const points: Array<{ freq: number; db: number }> = [];
  const last = Math.max(1, count - 1);
  for (let i = 0; i < count; i += 1) {
    const freq = 20 * 1000 ** (i / last);
    points.push({ freq, db: bandDb(freq, band) });
  }
  return points;
}

export function sampleResponse(bands: Band[], count = 220): Array<{ freq: number; db: number }> {
  const points: Array<{ freq: number; db: number }> = [];
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : i / (count - 1);
    const freq = 20 * 1000 ** t;
    points.push({ freq, db: responseDb(freq, bands) });
  }
  return points;
}

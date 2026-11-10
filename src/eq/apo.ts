import {
  BAND_COUNT,
  GAIN_MAX,
  GAIN_MIN,
  Q_MAX,
  Q_MIN,
  type Band,
  type EqModel,
  type FilterType,
  clamp,
  clampBand,
  effectivePreamp,
  normalizeEq,
  roundTo,
} from "./types";

export interface ImportFilter {
  id: string;
  index: number;
  kind: "supported" | "skipped";
  rawType: string;
  type?: FilterType;
  freq: number;
  gain: number;
  q: number;
  notes: string[];
  reason?: string;
}

export interface ImportInspection {
  format: "apo" | "json";
  name?: string;
  autoPreamp: boolean;
  preamp: number;
  filters: ImportFilter[];
  warnings: string[];
  error?: string;
}

const FILTER_RE =
  /^Filter\s+(\d+)\s*:\s*(ON|OFF)\s+([A-Za-z_]+)\s+Fc\s+([+-]?[0-9]*\.?[0-9]+)\s*(k)?\s*Hz\s+Gain\s+([+-]?[0-9]*\.?[0-9]+)\s*dB\s+Q\s+([+-]?[0-9]*\.?[0-9]+)/i;

const PREAMP_RE = /^Preamp\s*:\s*([+-]?[0-9]*\.?[0-9]+)\s*dB/i;

const TYPE_MAP: Record<string, FilterType> = {
  PK: "pk",
  PEQ: "pk",
  PEAK: "pk",
  PEAKING: "pk",
  LS: "ls",
  LSC: "ls",
  LOWSHELF: "ls",
  LOW_SHELF: "ls",
  HS: "hs",
  HSC: "hs",
  HIGHSHELF: "hs",
  HIGH_SHELF: "hs",
};

const UNSUPPORTED_REASON: Record<string, string> = {
  LP: "Low pass is not available on this DAC (pk, ls, hs only).",
  LPF: "Low pass is not available on this DAC (pk, ls, hs only).",
  HP: "High pass is not available on this DAC (pk, ls, hs only).",
  HPF: "High pass is not available on this DAC (pk, ls, hs only).",
  NO: "Notch is not available on this DAC (pk, ls, hs only).",
  NOTCH: "Notch is not available on this DAC (pk, ls, hs only).",
  AP: "All-pass is not available on this DAC (pk, ls, hs only).",
  ALLPASS: "All-pass is not available on this DAC (pk, ls, hs only).",
  BP: "Band pass is not available on this DAC (pk, ls, hs only).",
  BANDPASS: "Band pass is not available on this DAC (pk, ls, hs only).",
};

function mapType(raw: string): FilterType | undefined {
  return TYPE_MAP[raw.toUpperCase()];
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function inspectImport(text: string): ImportInspection {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      format: "apo",
      autoPreamp: false,
      preamp: 0,
      filters: [],
      warnings: [],
      error: "Paste Equalizer APO parametric text or an Eq JSON preset.",
    };
  }
  if (trimmed.startsWith("{")) return inspectJson(trimmed);
  return inspectApo(trimmed);
}

function inspectJson(text: string): ImportInspection {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return {
      format: "json",
      autoPreamp: false,
      preamp: 0,
      filters: [],
      warnings: [],
      error: "That JSON could not be parsed.",
    };
  }
  if (!data || typeof data !== "object" || !Array.isArray((data as { bands?: unknown }).bands)) {
    return {
      format: "json",
      autoPreamp: false,
      preamp: 0,
      filters: [],
      warnings: [],
      error: "JSON presets need a bands array.",
    };
  }
  const record = data as {
    name?: unknown;
    preamp?: unknown;
    autoPreamp?: unknown;
    bands: unknown[];
  };
  const warnings: string[] = [];
  const preampRaw = numberOr(record.preamp, 0);
  const preamp = roundTo(clamp(preampRaw, GAIN_MIN, GAIN_MAX), 1);
  if (preamp !== roundTo(preampRaw, 1)) {
    warnings.push(`Preamp ${preampRaw} dB clamped to ${preamp} dB.`);
  }
  const filters = record.bands.map((item, index) => bandToFilter(item, index + 1));
  if (filters.length === 0) {
    return {
      format: "json",
      autoPreamp: false,
      preamp,
      filters,
      warnings,
      error: "The JSON preset has no bands.",
    };
  }
  return {
    format: "json",
    name: typeof record.name === "string" ? record.name : undefined,
    autoPreamp: record.autoPreamp === true,
    preamp,
    filters,
    warnings,
  };
}

function bandToFilter(item: unknown, index: number): ImportFilter {
  const row = (item ?? {}) as {
    type?: unknown;
    freq?: unknown;
    gain?: unknown;
    q?: unknown;
    enabled?: unknown;
  };
  const rawType = String(row.type ?? "");
  const enabled = row.enabled !== false;
  if (!enabled) {
    return {
      id: `f${index}`,
      index,
      kind: "skipped",
      rawType: rawType || "OFF",
      freq: 1000,
      gain: 0,
      q: 1,
      notes: [],
      reason: `Band ${index} is disabled, so it was not imported as an active filter.`,
    };
  }
  return describeFilter(index, rawType || "pk", numberOr(row.freq, 1000), numberOr(row.gain, 0), numberOr(row.q, 1), true);
}

function inspectApo(text: string): ImportInspection {
  const warnings: string[] = [];
  if (/GraphicEQ\s*:/i.test(text)) {
    warnings.push("GraphicEQ rows are ignored. Only parametric Filter lines are read.");
  }
  let preamp = 0;
  let sawPreamp = false;
  const filters: ImportFilter[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;
    const pre = line.match(PREAMP_RE);
    if (pre) {
      const value = Number(pre[1]);
      if (sawPreamp) warnings.push("More than one Preamp line. The first value is used.");
      else {
        sawPreamp = true;
        const clamped = roundTo(clamp(value, GAIN_MIN, GAIN_MAX), 1);
        preamp = clamped;
        if (clamped !== roundTo(value, 1)) warnings.push(`Preamp ${value} dB clamped to ${clamped} dB.`);
      }
      continue;
    }
    const match = line.match(FILTER_RE);
    if (!match) continue;
    const index = Number(match[1]);
    const on = match[2].toUpperCase() === "ON";
    const freq = Number(match[4]) * (match[5] ? 1000 : 1);
    filters.push(describeFilter(index, match[3], freq, Number(match[6]), Number(match[7]), on));
  }
  filters.sort((a, b) => a.index - b.index);
  if (!filters.some((filter) => filter.kind === "supported")) {
    return {
      format: "apo",
      autoPreamp: false,
      preamp,
      filters,
      warnings,
      error: filters.length
        ? "None of the filters can run on this DAC. It only stores pk, ls, and hs."
        : "No parametric filters found. Expected lines like Filter 1: ON PK Fc 1000 Hz Gain 3 dB Q 1.0",
    };
  }
  return { format: "apo", autoPreamp: false, preamp, filters, warnings };
}

function describeFilter(
  index: number,
  rawType: string,
  freq: number,
  gain: number,
  q: number,
  on: boolean,
): ImportFilter {
  const id = `f${index}`;
  if (!on) {
    return {
      id,
      index,
      kind: "skipped",
      rawType,
      freq,
      gain,
      q,
      notes: [],
      reason: `Filter ${index} is OFF.`,
    };
  }
  const type = mapType(rawType);
  if (!type) {
    const key = rawType.toUpperCase();
    return {
      id,
      index,
      kind: "skipped",
      rawType,
      freq,
      gain,
      q,
      notes: [],
      reason: UNSUPPORTED_REASON[key] ?? `Filter ${index} type ${rawType} is not a pk, ls, or hs filter.`,
    };
  }
  const notes: string[] = [];
  const nextFreq = Math.round(clamp(freq, 20, 20000));
  const nextGain = roundTo(clamp(gain, GAIN_MIN, GAIN_MAX), 1);
  const nextQ = roundTo(clamp(q, Q_MIN, Q_MAX), 2);
  if (nextFreq !== Math.round(freq)) notes.push(`Filter ${index} frequency ${freq} Hz clamped to ${nextFreq} Hz.`);
  if (nextGain !== roundTo(gain, 1)) notes.push(`Filter ${index} gain ${gain} dB clamped to ${nextGain} dB.`);
  if (nextQ !== roundTo(q, 2)) notes.push(`Filter ${index} Q ${q} clamped to ${nextQ}.`);
  return {
    id,
    index,
    kind: "supported",
    rawType,
    type,
    freq: nextFreq,
    gain: nextGain,
    q: nextQ,
    notes,
  };
}

export function chooseFilterIds(filters: ImportFilter[], pinned: string[]): string[] {
  const supported = filters.filter((filter) => filter.kind === "supported");
  const pinnedIds = new Set(
    pinned.filter((id) => supported.some((filter) => filter.id === id && filter.type !== "pk")),
  );
  const forced = supported.filter((filter) => pinnedIds.has(filter.id)).slice(0, BAND_COUNT);
  const rest = supported
    .filter((filter) => !pinnedIds.has(filter.id))
    .sort((a, b) => Math.abs(b.gain) - Math.abs(a.gain) || a.index - b.index);
  const chosen = [...forced];
  for (const filter of rest) {
    if (chosen.length >= BAND_COUNT) break;
    chosen.push(filter);
  }
  chosen.sort((a, b) => a.index - b.index);
  return chosen.map((filter) => filter.id);
}

export function modelFromFilters(
  inspection: ImportInspection,
  keepIds: string[],
  name: string,
): { model: EqModel; notes: string[]; fitsJa11: boolean } {
  const supported = inspection.filters.filter((filter) => filter.kind === "supported");
  const keep = new Set(keepIds);
  const chosen = supported.filter((filter) => keep.has(filter.id)).slice(0, BAND_COUNT);
  const bands: Band[] = chosen.map((filter) =>
    clampBand({
      type: filter.type ?? "pk",
      freq: filter.freq,
      gain: filter.gain,
      q: filter.q,
      enabled: true,
    }),
  );
  while (bands.length < BAND_COUNT) {
    bands.push({ type: "pk", freq: 1000, gain: 0, q: 1, enabled: false });
  }
  const notes = [
    ...inspection.warnings,
    ...inspection.filters.flatMap((filter) => filter.notes),
    ...inspection.filters.filter((filter) => filter.kind === "skipped" && filter.reason).map((filter) => filter.reason as string),
  ];
  const dropped = supported.filter((filter) => !keep.has(filter.id));
  if (dropped.length > 0) {
    notes.push(
      `Kept ${chosen.length} of ${supported.length} supported filters by largest |gain|, with pinned shelves forced in. This is not the original curve.`,
    );
    for (const filter of dropped) {
      notes.push(`Filter ${filter.index} (${filter.rawType} ${filter.gain} dB) was not kept.`);
    }
  }
  const fitsJa11 =
    supported.length <= BAND_COUNT &&
    supported.length > 0 &&
    dropped.length === 0 &&
    inspection.filters.every((filter) => filter.kind === "supported" && filter.notes.length === 0) &&
    inspection.warnings.length === 0;
  const model = normalizeEq({
    name,
    bands,
    preamp: inspection.preamp,
    autoPreamp: inspection.autoPreamp,
  });
  return { model, notes, fitsJa11 };
}

/** AutoEq publishes filters 1–5 as the short preset and 6–10 as the extra correction. */
export function firstFiveModel(text: string, name: string, preamp: number): { model: EqModel; notes: string[] } {
  const inspection = inspectImport(text);
  const subset = inspection.filters.filter((filter) => filter.kind === "supported" && filter.index <= 5);
  const supportedCount = inspection.filters.filter((filter) => filter.kind === "supported").length;
  const notes = [
    `Published AutoEq filters 1–5 (${subset.length} bands) with the 5-band preamp of ${preamp.toFixed(1)} dB.`,
    supportedCount > 5
      ? `The source file has ${supportedCount} supported filters. Filters after 5 are not on this card, so the curve is not the 10-filter correction.`
      : "The source file did not contain more than five supported filters.",
    ...subset.flatMap((filter) => filter.notes),
  ];
  const bands: Band[] = subset.slice(0, 5).map((filter) =>
    clampBand({
      type: filter.type ?? "pk",
      freq: filter.freq,
      gain: filter.gain,
      q: filter.q,
      enabled: true,
    }),
  );
  while (bands.length < BAND_COUNT) bands.push({ type: "pk", freq: 1000, gain: 0, q: 1, enabled: false });
  return {
    model: normalizeEq({ name, bands, preamp, autoPreamp: false }),
    notes,
  };
}

export function exportApo(eq: EqModel): string {
  const model = normalizeEq(eq);
  const lines = [`Preamp: ${effectivePreamp(model).toFixed(1)} dB`];
  model.bands.forEach((band, index) => {
    const type = band.type === "pk" ? "PK" : band.type === "ls" ? "LSC" : "HSC";
    lines.push(
      `Filter ${index + 1}: ${band.enabled ? "ON" : "OFF"} ${type} Fc ${band.freq} Hz Gain ${band.gain.toFixed(1)} dB Q ${band.q.toFixed(2)}`,
    );
  });
  return `${lines.join("\n")}\n`;
}

export function exportJson(eq: EqModel): string {
  const model = normalizeEq(eq);
  return `${JSON.stringify(
    {
      app: "Eq",
      name: model.name,
      preamp: effectivePreamp(model),
      autoPreamp: model.autoPreamp,
      bands: model.bands,
    },
    null,
    2,
  )}\n`;
}

export function typeLabel(type: FilterType): string {
  if (type === "pk") return "Bell";
  if (type === "ls") return "Low shelf";
  return "High shelf";
}

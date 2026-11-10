import { inspectImport, chooseFilterIds, modelFromFilters } from "./apo";
import { bandDb, responseDb } from "./biquad";
import { builtInPresets, presetById, presetsMatchingQuery } from "../data/presets";
import { dacCurveSentence, dacEditorName, matchCurveToPresets, matchSummary, presetCurve, type CurveBand } from "./match";
import {
  beginJa11SaveDrop,
  buildJa11User1Reports,
  clearJa11SaveDrop,
  JA11_LIVE_FLUSH_MS,
  decodeFiioGain,
  JA11_FILTERS,
  ja11EqOffTarget,
  ja11ReadCountPacket,
  ja11ReadFilterPacket,
  ja11ReadGainPacket,
  ja11ReadPresetPacket,
  ja11ReportsTarget,
  ja11SaveReconnectPermit,
  ja11SaveReconnects,
  ja11SlotPlainName,
  noteJa11SaveReconnectAttempt,
  noteJa11SaveReconnectSuccess,
  parseJa11InputReport,
} from "../lib/hid";
import { autoPreampDb, normalizeEq, type Band } from "./types";

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(" ");
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const peak = bandDb(1000, { type: "pk", freq: 1000, gain: 6, q: 1.41, enabled: true });
assert(Math.abs(peak - 6) < 0.05, `peaking gain at fc was ${peak}`);

const low = bandDb(20, { type: "ls", freq: 120, gain: 6, q: 0.7, enabled: true });
assert(low > 4, `low shelf at 20 Hz was ${low}`);

const high = bandDb(16000, { type: "hs", freq: 4000, gain: 6, q: 0.7, enabled: true });
assert(high > 4, `high shelf at 16 kHz was ${high}`);

const silent = responseDb(1000, [
  { type: "pk", freq: 1000, gain: 3, q: 1, enabled: false },
]);
assert(Math.abs(silent) < 0.001, "disabled band leaked into the curve");

const bands: Band[] = [
  { type: "ls", freq: 80, gain: 4, q: 0.7, enabled: true },
  { type: "pk", freq: 1000, gain: -2, q: 1, enabled: true },
  { type: "pk", freq: 3000, gain: 1.5, q: 1, enabled: false },
];
assert(autoPreampDb(bands) === 8, `auto preamp was ${autoPreampDb(bands)}`);

const bellBoost: Band[] = [
  { type: "pk", freq: 1000, gain: 3, q: 1, enabled: true },
  { type: "pk", freq: 300, gain: -6, q: 1, enabled: true },
  { type: "pk", freq: 4000, gain: 6, q: 1, enabled: false },
];
assert(autoPreampDb(bellBoost) === 9, `+3 dB bell preamp was ${autoPreampDb(bellBoost)}`);
const cutsOnly: Band[] = [
  { type: "pk", freq: 80, gain: -4, q: 1, enabled: true },
  { type: "hs", freq: 8000, gain: -2, q: 0.7, enabled: true },
];
assert(autoPreampDb(cutsOnly) === 12, `cuts-only preamp was ${autoPreampDb(cutsOnly)}`);
const nine = buildJa11User1Reports(
  {
    preamp: 9,
    bands: [
      { type: "pk", freq: 1000, gain: 3, q: 1, enabled: true },
      { type: "pk", freq: 300, gain: 0, q: 1, enabled: true },
      { type: "pk", freq: 1000, gain: 0, q: 1, enabled: true },
      { type: "pk", freq: 4000, gain: 0, q: 1, enabled: true },
      { type: "pk", freq: 10000, gain: 0, q: 1, enabled: true },
    ],
  },
  "flush",
);
assert(hex(nine[1]) === "aa 0a 00 00 17 02 00 5a 00 ee", `+9 dB global gain ${hex(nine[1])}`);
assert(nine.every((packet) => packet[4] !== 0x19), "+3 dB flush included a save report");

const sample = `Preamp: -3.0 dB
Filter 1: ON LSC Fc 105 Hz Gain 6.0 dB Q 0.70
Filter 2: ON PK Fc 1000 Hz Gain 1.0 dB Q 1.20
Filter 3: OFF PK Fc 2000 Hz Gain 4.0 dB Q 1.00
Filter 4: ON HSC Fc 10000 Hz Gain -2.0 dB Q 0.70
Filter 5: ON LPF Fc 8000 Hz Gain -6.0 dB Q 0.70
Filter 6: ON PK Fc 4000 Hz Gain 3.5 dB Q 2.00
`;
const inspection = inspectImport(sample);
assert(!inspection.error, inspection.error ?? "import failed");
const kept = chooseFilterIds(inspection.filters, ["f4"]);
const built = modelFromFilters(inspection, kept, "Sample");
assert(built.model.bands.filter((band) => band.enabled).length === 4, "expected four kept filters");
assert(built.notes.some((note) => note.includes("Low pass")), "missing low-pass skip note");
assert(built.notes.some((note) => note.includes("OFF")), "missing OFF note");
assert(built.fitsJa11 === false, "truncated import was marked identical");

for (const preset of builtInPresets) {
  assert(preset.eq.bands.length === 5, `${preset.id} band count`);
  for (const band of preset.eq.bands) {
    assert(band.freq >= 20 && band.freq <= 20000, `${preset.id} freq`);
    assert(band.gain >= -12 && band.gain <= 12, `${preset.id} gain`);
    assert(band.q >= 0.1 && band.q <= 10, `${preset.id} q`);
    assert(band.type === "pk" || band.type === "ls" || band.type === "hs", `${preset.id} type`);
  }
  if (preset.id === "metal") {
    const max = Math.max(...preset.eq.bands.map((band) => band.gain));
    assert(max <= 3.5, `metal gain ${max}`);
  }
}

const originals = builtInPresets.filter((preset) => preset.origin === "original").length;
const extracted = builtInPresets.filter((preset) => preset.origin === "extracted").length;
assert(originals === 50, `expected 50 original presets, got ${originals}`);
assert(extracted === 18, `expected 18 extracted presets, got ${extracted}`);

const basetrumental = presetById("basetrumental");
if (!basetrumental) throw new Error("basetrumental preset");
assert(basetrumental.origin === "original" && basetrumental.fitsJa11, "basetrumental marking");
assert(basetrumental.category === "Tone" && basetrumental.target === "JA11", "basetrumental place");
assert(basetrumental.eq.autoPreamp === true, "basetrumental auto preamp");
assert(basetrumental.eq.preamp === 12, `basetrumental preamp ${basetrumental.eq.preamp}`);
assert(autoPreampDb(basetrumental.eq.bands) === 12, "basetrumental makeup");
assert(basetrumental.eq.bands.every((band) => band.gain <= 0 && band.enabled), "basetrumental boost");
const basetrumentalTags = basetrumental.tags ?? [];
assert(
  basetrumentalTags.includes("bass") && basetrumentalTags.includes("instruments") && basetrumentalTags.includes("thump"),
  `basetrumental tags ${basetrumentalTags.join(",")}`,
);
const basetrumentalBands: Array<[Band["type"], number, number, number]> = [
  ["ls", 90, 0, 0.7],
  ["pk", 180, -0.5, 0.8],
  ["pk", 1200, -0.5, 1],
  ["pk", 3500, -2.5, 1.3],
  ["hs", 8000, -2, 0.7],
];
basetrumental.eq.bands.forEach((band, index) => {
  const [type, freq, gain, q] = basetrumentalBands[index];
  assert(
    band.type === type && band.freq === freq && band.gain === gain && band.q === q,
    `basetrumental band ${index} ${band.type} ${band.freq} ${band.gain} ${band.q}`,
  );
});

const basetrumentalEnhanced = presetById("basetrumental-enhanced");
if (!basetrumentalEnhanced) throw new Error("basetrumental-enhanced preset");
assert(basetrumentalEnhanced.origin === "original" && basetrumentalEnhanced.fitsJa11, "basetrumental-enhanced marking");
assert(basetrumentalEnhanced.category === "Tone" && basetrumentalEnhanced.target === "JA11", "basetrumental-enhanced place");
assert(basetrumentalEnhanced.eq.autoPreamp === false, "basetrumental-enhanced manual preamp");
assert(basetrumentalEnhanced.eq.preamp === 12, `basetrumental-enhanced preamp ${basetrumentalEnhanced.eq.preamp}`);
assert(autoPreampDb(basetrumentalEnhanced.eq.bands) === 8.5, "basetrumental-enhanced auto would duck the rest");
const enhancedTags = basetrumentalEnhanced.tags ?? [];
assert(
  enhancedTags.includes("bass") &&
    enhancedTags.includes("instruments") &&
    enhancedTags.includes("thump") &&
    enhancedTags.includes("clear"),
  `basetrumental-enhanced tags ${enhancedTags.join(",")}`,
);
const enhancedBands: Array<[Band["type"], number, number, number]> = [
  ["pk", 58, 3.5, 1.1],
  ["pk", 260, -1.5, 1.8],
  ["pk", 2500, 0, 1],
  ["pk", 6500, 0, 1],
  ["hs", 12000, 0, 0.7],
];
basetrumentalEnhanced.eq.bands.forEach((band, index) => {
  const [type, freq, gain, q] = enhancedBands[index];
  assert(
    band.type === type && band.freq === freq && band.gain === gain && band.q === q && band.enabled,
    `basetrumental-enhanced band ${index} ${band.type} ${band.freq} ${band.gain} ${band.q}`,
  );
});
const toneIds = builtInPresets.filter((preset) => preset.category === "Tone").map((preset) => preset.id);
assert(
  toneIds[toneIds.indexOf("basetrumental") + 1] === "basetrumental-enhanced",
  "basetrumental-enhanced follows Basetrumental",
);

const bassNames = presetsMatchingQuery(builtInPresets, "bass").map((preset) => preset.name);
assert(
  bassNames.join("|") === "Warm Bass|Bass Boost|Bass-like|Loric — easy bass start|Basetrumental|Basetrumental-enhanced",
  `bass search ${bassNames.join("|")}`,
);
assert(!bassNames.includes("Jazz") && !bassNames.includes("Orchestral") && !bassNames.includes("Classic"), "bass description leak");
const basedNames = presetsMatchingQuery(
  [
    { name: "Based", description: "a bass note", tags: [] },
    { name: "Bass Boost", description: "kick", tags: ["bass"] },
  ],
  "bass",
).map((preset) => preset.name);
assert(basedNames.join("|") === "Bass Boost", `based leaked ${basedNames.join("|")}`);
assert(presetsMatchingQuery(builtInPresets, "   ").length === builtInPresets.length, "empty query");
const warmBassNames = presetsMatchingQuery(builtInPresets, "warm bass").map((preset) => preset.name);
assert(warmBassNames.join("|") === "Warm Bass", `warm bass ${warmBassNames.join("|")}`);
const hallAir = presetsMatchingQuery(builtInPresets, "hall air").map((preset) => preset.name);
assert(hallAir.includes("Live Hall") && hallAir.includes("Orchestral"), `hall air ${hallAir.join("|")}`);

const editor = {
  preamp: 12,
  bands: [
    { type: "pk" as const, freq: 1000, gain: 6, q: 1, enabled: true },
    { type: "ls" as const, freq: 80, gain: -3.5, q: 0.7, enabled: true },
    { type: "hs" as const, freq: 12000, gain: 2, q: 0.7, enabled: false },
    { type: "pk" as const, freq: 4000, gain: 0, q: 1, enabled: true },
    { type: "pk" as const, freq: 10000, gain: 1, q: 10, enabled: true },
  ],
};
const flushed = buildJa11User1Reports(editor, "flush");
const saved = buildJa11User1Reports(editor, "save");
assert(flushed.length === 8, `flush reports ${flushed.length}`);
assert(saved.length === 9, `save reports ${saved.length}`);
assert(hex(flushed[0]) === "aa 0a 00 00 16 01 03 00 ee", `preset ${hex(flushed[0])}`);
assert(hex(flushed[1]) === "aa 0a 00 00 17 02 00 78 00 ee", `gain ${hex(flushed[1])}`);
assert(hex(flushed[2]) === "aa 0a 00 00 18 01 05 00 ee", `count ${hex(flushed[2])}`);
assert(hex(flushed[3]) === "aa 0a 00 00 15 08 00 00 3c 03 e8 00 64 00 00 ee", `peak ${hex(flushed[3])}`);
assert(hex(flushed[4]) === "aa 0a 00 00 15 08 01 ff dd 00 50 00 46 01 00 ee", `shelf ${hex(flushed[4])}`);
assert(hex(flushed[5]) === "aa 0a 00 00 15 08 02 00 00 2e e0 00 46 02 00 ee", `off ${hex(flushed[5])}`);
assert(flushed.every((packet) => packet[4] !== 0x19), "flush included a save report");
assert(JA11_LIVE_FLUSH_MS >= 80 && JA11_LIVE_FLUSH_MS <= 120, `live debounce ${JA11_LIVE_FLUSH_MS}`);
assert(hex(saved[8]) === "aa 0a 00 00 19 01 03 00 ee", `save ${hex(saved[8])}`);
assert(ja11EqOffTarget({ vendorId: 0x2972, productId: 0x0102 }), "JA11 product");
assert(!ja11EqOffTarget({ vendorId: 0x2972, productId: 0x0101 }), "UAC1 is not a write target");
assert(!ja11EqOffTarget({ vendorId: 0x1234, productId: 0x0102 }), "other vendor");

function bytes(text: string): Uint8Array {
  return Uint8Array.from(text.trim().split(/\s+/).map((part) => Number.parseInt(part, 16)));
}

assert(hex(ja11ReadPresetPacket()) === "bb 0b 00 00 16 00 00 ee", "read preset");
assert(hex(ja11ReadGainPacket()) === "bb 0b 00 00 17 00 00 ee", "read gain");
assert(hex(ja11ReadCountPacket()) === "bb 0b 00 00 18 00 00 ee", "read count");
assert(hex(ja11ReadFilterPacket(0)) === "bb 0b 00 00 15 01 00 00 ee", "read filter 0");
assert(hex(ja11ReadFilterPacket(2)) === "bb 0b 00 00 15 01 02 00 ee", "read filter 2");
assert(decodeFiioGain(0x00, 0x3c) === 6, "gain +6");
assert(decodeFiioGain(0xff, 0xdd) === -3.5, "gain -3.5");
assert(decodeFiioGain(0x00, 0x78) === 12, "gain +12");

const readPeak = parseJa11InputReport(bytes("bb 0b 00 00 15 08 00 00 3c 03 e8 00 64 00 00 ee"));
assert(readPeak?.kind === "band" && readPeak.freq === 1000 && readPeak.gain === 6 && readPeak.q === 1 && readPeak.type === "pk" && readPeak.index === 0, "peak read");
const readShelf = parseJa11InputReport(bytes("bb 0b 00 00 15 08 01 ff dd 00 50 00 46 01 00 ee"));
assert(
  readShelf?.kind === "band" && readShelf.freq === 80 && readShelf.gain === -3.5 && readShelf.q === 0.7 && readShelf.type === "ls" && readShelf.index === 1,
  "shelf read",
);
const slotReport = parseJa11InputReport(bytes("bb 0b 00 00 16 01 03 00 ee"));
assert(slotReport?.kind === "slot" && slotReport.slot === 3, "slot read");
const countReport = parseJa11InputReport(bytes("bb 0b 00 00 18 01 05 00 ee"));
assert(countReport?.kind === "count" && countReport.count === 5, "count read");
const gainReport = parseJa11InputReport(bytes("bb 0b 00 00 17 02 00 78 00 ee"));
assert(gainReport?.kind === "preamp" && gainReport.preamp === 12, "preamp read");
const zeroQ = parseJa11InputReport(bytes("bb 0b 00 00 15 08 00 00 00 03 e8 00 00 00 00 ee"));
assert(zeroQ?.kind === "band" && zeroQ.q === 1, "stored Q 0 is reported as 1");
assert(parseJa11InputReport(bytes("aa 0a 00 00 15 08 00 00 3c 03 e8 00 64 00 00 ee")) === null, "set header is not a read");

const jazz = presetById("jazz");
if (!jazz) throw new Error("jazz preset");
const jazzCurve = presetCurve(jazz.eq);
const jazzExact = matchCurveToPresets(jazzCurve, builtInPresets);
assert(jazzExact.exactNames.includes("Jazz"), `jazz exact ${jazzExact.exactNames.join(",")}`);
assert(matchSummary(jazzExact).startsWith("Matches Jazz"), matchSummary(jazzExact));
assert(!/close to|nearest/i.test(matchSummary(jazzExact)), matchSummary(jazzExact));

const shifted: CurveBand[] = jazzCurve.map((band, index) => (index === 0 ? { ...band, gain: band.gain + 0.2 } : band));
const jazzNear = matchCurveToPresets(shifted, builtInPresets);
assert(jazzNear.exactNames.length === 0, "0.2 dB was labeled exact");
assert(jazzNear.closest[0]?.name === "Jazz", jazzNear.closest.map((hit) => hit.name).join(","));
assert(jazzNear.closest[0]?.note.startsWith("close to Jazz"), jazzNear.closest[0]?.note ?? "");
assert(!/exact|matches/i.test(jazzNear.closest[0]?.note ?? ""), jazzNear.closest[0]?.note ?? "");
assert(jazzNear.closest.length <= 3, "too many closest");
assert(!matchSummary(jazzNear).includes("Matches"), matchSummary(jazzNear));

const withinHz = jazzCurve.map((band, index) => (index === 3 ? { ...band, freq: band.freq + 1 } : band));
assert(matchCurveToPresets(withinHz, [jazz]).exactNames.includes("Jazz"), "1 Hz still exact");
const overHz = jazzCurve.map((band, index) => (index === 3 ? { ...band, freq: band.freq + 2 } : band));
assert(matchCurveToPresets(overHz, [jazz]).exactNames.length === 0, "2 Hz was exact");
const overQ = jazzCurve.map((band, index) => (index === 2 ? { ...band, q: band.q + 0.06 } : band));
assert(matchCurveToPresets(overQ, [jazz]).exactNames.length === 0, "Q 0.06 was exact");
const typed = jazzCurve.map((band, index) => (index === 2 ? { ...band, type: "hs" as const } : band));
const typedMatch = matchCurveToPresets(typed, [jazz]);
assert(typedMatch.exactNames.length === 0, "type change was exact");
assert(typedMatch.closest[0]?.note.includes("type"), typedMatch.closest[0]?.note ?? "");
assert(typedMatch.closest[0]?.note.startsWith("nearest"), typedMatch.closest[0]?.note ?? "");

const disabled = normalizeEq({
  name: "Probe",
  preamp: 0,
  autoPreamp: false,
  bands: [
    { type: "pk", freq: 1000, gain: 4, q: 1, enabled: false },
    { type: "pk", freq: 300, gain: 0, q: 1, enabled: true },
    { type: "pk", freq: 1000, gain: 0, q: 1, enabled: true },
    { type: "pk", freq: 4000, gain: 0, q: 1, enabled: true },
    { type: "hs", freq: 10000, gain: 0, q: 0.7, enabled: true },
  ],
});
const disabledCurve: CurveBand[] = disabled.bands.map((band) => ({
  type: band.type,
  freq: band.freq,
  gain: 0,
  q: band.q,
}));
assert(matchCurveToPresets(disabledCurve, [{ name: "Probe", eq: disabled }]).exactNames.includes("Probe"), "disabled band gain");

const probe: CurveBand[] = [
  { type: "pk", freq: 80, gain: 0, q: 1 },
  { type: "pk", freq: 300, gain: 0, q: 1 },
  { type: "pk", freq: 1000, gain: 3, q: 1 },
  { type: "pk", freq: 4000, gain: 0, q: 1 },
  { type: "pk", freq: 10000, gain: 0, q: 1 },
];
const probeMatch = matchCurveToPresets(probe, builtInPresets);
assert(probeMatch.exactNames.length === 0, `probe labeled exact: ${probeMatch.exactNames.join(",")}`);
assert(probeMatch.closest.length > 0 && probeMatch.closest.length <= 3, "probe closest count");
assert(probeMatch.closest.every((hit) => !/exact|matches/i.test(hit.note)), "probe note");

const onDac: CurveBand[] = [
  { type: "pk", freq: 80, gain: 0, q: 1 },
  { type: "pk", freq: 300, gain: 0, q: 1 },
  { type: "pk", freq: 1000, gain: 0, q: 1 },
  { type: "pk", freq: 4000, gain: 0, q: 1 },
  { type: "pk", freq: 10000, gain: 0, q: 1 },
];
const onDacMatch = matchCurveToPresets(onDac, builtInPresets);
const onDacSentence = dacCurveSentence(onDac, onDacMatch, builtInPresets);
assert(onDacSentence === "This is a flat curve.", onDacSentence);
assert(!/nearest|Choir|Classic|\bFlat\b/.test(onDacSentence), onDacSentence);
assert(dacEditorName(onDacMatch) === "On the DAC", dacEditorName(onDacMatch));
assert(dacCurveSentence(jazzCurve, jazzExact, [jazz]) === "This matches Jazz.", dacCurveSentence(jazzCurve, jazzExact, [jazz]));
assert(dacEditorName(jazzExact) === "Jazz", dacEditorName(jazzExact));
const nearSentence = dacCurveSentence(shifted, jazzNear, [jazz]);
assert(nearSentence === "This is close to Jazz.", nearSentence);
assert(!/nearest/.test(nearSentence), nearSentence);

assert(JA11_FILTERS.length === 1, "chooser filters");
assert(JA11_FILTERS[0]?.vendorId === 0x2972 && JA11_FILTERS[0]?.productId === 0x0102, "chooser vid pid");
assert(JA11_FILTERS[0]?.usagePage === 0x000c && JA11_FILTERS[0]?.usage === 0x0001, "chooser peq usage");
assert(!JA11_FILTERS.some((filter) => filter.productId == null), "no vendor-only chooser filter");
const peq = { vendorId: 0x2972, productId: 0x0102, productName: "JadeAudio JA11", collections: [{ usagePage: 0x000c, usage: 0x0001 }] };
assert(ja11ReportsTarget(peq), "consumer collection is the PEQ interface");
assert(
  ja11ReportsTarget({ ...peq, collections: [{ usagePage: 0xff00, usage: 0x0001 }] }),
  "vendor collection is the PEQ interface",
);
assert(
  !ja11ReportsTarget({ ...peq, productName: "HIDI2C Device" }),
  "HIDI2C is not a write target",
);
assert(
  !ja11ReportsTarget({ ...peq, collections: [{ usagePage: 0x0001, usage: 0x0002 }] }),
  "missing PEQ collection",
);
assert(ja11SlotPlainName(3) === "Your curve", "user slot label");
assert(ja11SlotPlainName(0) === "Vocal" && ja11SlotPlainName(4) === "Off", "factory slot labels");

beginJa11SaveDrop();
assert(ja11SaveReconnectPermit() === "open", "save window opens");
noteJa11SaveReconnectAttempt();
noteJa11SaveReconnectSuccess();
assert(ja11SaveReconnects() === 1, "one reconnect");
assert(ja11SaveReconnectPermit() === "settled", "second reopen refused");
beginJa11SaveDrop();
assert(ja11SaveReconnects() === 0, "new save clears the count");
noteJa11SaveReconnectAttempt();
noteJa11SaveReconnectAttempt();
noteJa11SaveReconnectAttempt();
assert(ja11SaveReconnectPermit() === "stopped", "three misses stop");
beginJa11SaveDrop(Date.now() - 5000, 1000);
assert(ja11SaveReconnectPermit() === "normal", "expired window is normal");
clearJa11SaveDrop();

console.log(`selfcheck ok: ${originals} original, ${extracted} extracted`);

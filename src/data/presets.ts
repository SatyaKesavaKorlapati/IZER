import rawEntries from "./autoeq-presets.json";
import { firstFiveModel } from "../eq/apo";
import { type Band, type EqModel, type FilterType, normalizeEq } from "../eq/types";

export interface Preset {
  id: string;
  name: string;
  category: string;
  description: string;
  target: string;
  author: string;
  sourceUrl?: string;
  readmeUrl?: string;
  license: string;
  origin: "original" | "extracted" | "user";
  fitsJa11: boolean;
  subsetNote?: string;
  importNotes?: string[];
  sourceText?: string;
  kind?: "IEM" | "Headphone" | "Voicing";
  /** Whole-word search keys. A tag hit ranks with the name and hides description-only results. */
  tags?: string[];
  eq: EqModel;
}

const ORIGINAL_LICENSE =
  "Original voicing written for Eq. It is a generic mastering-style starting point, not a measurement and not a copy of a commercial preset library.";

const AUTOEQ_LICENSE =
  "Parametric text from the public AutoEq results repository (MIT license, copyright 2018-2022 Jaakko Pasanen). Measurements are credited to the named source. This card is the published filters 1-5 subset, not the full 10-filter correction.";

function band(type: FilterType, freq: number, gain: number, q: number): Band {
  return { type, freq, gain, q, enabled: true };
}

function original(
  id: string,
  name: string,
  category: string,
  description: string,
  bands: Band[],
  target = "Generic",
  kind: Preset["kind"] = "Voicing",
  tags: readonly string[] = [],
  levelMatch?: { autoPreamp: false; preamp: number },
): Preset {
  const eq = normalizeEq({
    name,
    bands,
    preamp: levelMatch?.preamp ?? 0,
    autoPreamp: levelMatch ? false : true,
  });
  if (eq.bands.length !== 5) throw new Error(`Preset ${id} does not have 5 bands`);
  return {
    id,
    name,
    category,
    description,
    target,
    author: "Eq",
    license: ORIGINAL_LICENSE,
    origin: "original",
    fitsJa11: true,
    kind,
    ...(tags.length > 0 ? { tags: [...tags] } : {}),
    eq,
  };
}

const b = band;

export const originalPresets: Preset[] = [
  original("flat", "Flat", "Reference", "All five bands at 0 dB, so the filter curve is a straight line. Auto level match still adds the compensation.", [
    b("pk", 80, 0, 1),
    b("pk", 300, 0, 1),
    b("pk", 1000, 0, 1),
    b("pk", 4000, 0, 1),
    b("hs", 12000, 0, 0.7),
  ]),
  original("studio-monitor", "Studio Monitor", "Reference", "A small low-mid cut, a little presence, and a restrained air shelf. Meant to stay close to a desk monitor.", [
    b("ls", 90, -1.2, 0.7),
    b("pk", 250, -1.5, 1.1),
    b("pk", 3200, 1.2, 1.3),
    b("pk", 6500, 0.6, 1.6),
    b("hs", 12000, 0.8, 0.7),
  ]),
  original(
    "harman-ish",
    "Harman-ish",
    "Reference",
    "Five-band approximation of a Harman-like in-ear shape: a bass shelf and an ear-gain rise. It is not the Harman target and not a measurement of any headphone.",
    [b("ls", 105, 4.5, 0.71), b("pk", 220, -1.2, 0.9), b("pk", 2700, 3.2, 1.1), b("pk", 5500, -1, 1.8), b("hs", 11000, 1.2, 0.7)],
  ),
  original("diffuse-field-tilt", "Diffuse-field tilt", "Reference", "A gentle downward tilt, a little warmer in the bass and softer through the treble.", [
    b("ls", 120, 1.2, 0.7),
    b("pk", 400, 0.4, 0.8),
    b("pk", 1800, -0.6, 0.9),
    b("pk", 5000, -1, 1),
    b("hs", 10000, -1.6, 0.7),
  ]),
  original("classic", "Classic", "Music", "Mild warmth, a tidy low mid, and a soft top. A general classical-listening balance.", [
    b("ls", 90, 1.6, 0.7),
    b("pk", 250, 0.8, 0.8),
    b("pk", 800, -0.6, 1),
    b("pk", 3200, 1, 1.1),
    b("hs", 10000, -0.8, 0.7),
  ]),
  original("orchestral", "Orchestral", "Music", "Bass body for the orchestra, a mud cut, and a little silk for strings and hall air.", [
    b("ls", 70, 1.4, 0.7),
    b("pk", 220, -0.8, 1),
    b("pk", 1800, 0.8, 0.9),
    b("pk", 4500, 0.6, 1.4),
    b("hs", 12000, 1.4, 0.7),
  ]),
  original("jazz", "Jazz", "Music", "Upright-bass weight, a small low-mid tuck, and presence for horns without a bright shelf.", [
    b("ls", 80, 2.2, 0.7),
    b("pk", 180, 0.6, 0.8),
    b("pk", 450, -0.8, 1),
    b("pk", 2500, 1.2, 1),
    b("hs", 9000, -0.6, 0.7),
  ]),
  original("jazz-vocal", "Jazz Vocal", "Music", "Keeps the jazz warmth and lifts the vocal octave so a singer sits in front of the combo.", [
    b("ls", 100, 1.2, 0.7),
    b("pk", 300, -1, 1),
    b("pk", 1600, 1.4, 1.1),
    b("pk", 3500, 1.6, 1.3),
    b("hs", 11000, 0.6, 0.7),
  ]),
  original("instrumental", "Instrumental", "Music", "Controlled bass, an open midrange, and a bit of detail for acoustic and electric instruments.", [
    b("ls", 80, 0.8, 0.7),
    b("pk", 240, -1.2, 1.1),
    b("pk", 2000, 1, 0.9),
    b("pk", 5000, 1.2, 1.4),
    b("hs", 12000, 1, 0.7),
  ]),
  original("melody", "Melody", "Music", "The tune is the point: a lift through the melody range and only a light bass shelf.", [
    b("ls", 110, 0.6, 0.7),
    b("pk", 280, -0.8, 1),
    b("pk", 1400, 1.6, 1),
    b("pk", 3200, 1.8, 1.2),
    b("hs", 10000, 0.4, 0.7),
  ]),
  original("acoustic", "Acoustic", "Music", "Body for guitar and voice, a small boxiness cut, and a natural air shelf.", [
    b("ls", 100, 1.8, 0.7),
    b("pk", 220, 0.6, 0.8),
    b("pk", 400, -0.6, 1.2),
    b("pk", 3500, 1.2, 1.1),
    b("hs", 10000, 1, 0.7),
  ]),
  original("singer-songwriter", "Singer-Songwriter", "Music", "Close and warm, with the vocal a step forward and the top left soft.", [
    b("ls", 120, 1.4, 0.7),
    b("pk", 250, 0.4, 0.7),
    b("pk", 500, -0.8, 1),
    b("pk", 2800, 1.5, 1.1),
    b("hs", 9000, -0.4, 0.7),
  ]),
  original("piano-focus", "Piano Focus", "Music", "Fundamental weight, a boxiness cut, hammer presence, and a short air shelf.", [
    b("ls", 70, 0.6, 0.7),
    b("pk", 180, 1.2, 0.9),
    b("pk", 400, -0.8, 1.2),
    b("pk", 4500, 1.4, 1.6),
    b("hs", 12000, 0.8, 0.7),
  ]),
  original("strings", "Strings", "Music", "Lower-mid body for the section, a presence lift, and silk rather than glare.", [
    b("ls", 140, 1, 0.7),
    b("pk", 300, -0.6, 1),
    b("pk", 1800, 1, 0.9),
    b("pk", 4000, 0.8, 1.3),
    b("hs", 11000, 1.6, 0.7),
  ]),
  original("live-hall", "Live Hall", "Music", "A hint of room: less 300 Hz build-up, a wide mid, and a gentle hall air shelf.", [
    b("ls", 80, 1, 0.7),
    b("pk", 280, -1.4, 0.9),
    b("pk", 1200, 0.4, 0.8),
    b("pk", 5000, 0.8, 1.2),
    b("hs", 10000, 1.2, 0.7),
  ]),
  original("lo-fi", "Lo-fi", "Music", "Soft top, a warm mid bump, and rolled air. Intentionally dull, not a repair curve.", [
    b("ls", 100, 2, 0.7),
    b("pk", 400, 0.8, 0.7),
    b("pk", 2500, -1.4, 0.8),
    b("pk", 6000, -1.6, 1.2),
    b("hs", 10000, -1.8, 0.7),
  ]),
  original("folk", "Folk", "Music", "Light bass, a bit of wood, and a modest string presence for voice-and-guitar records.", [
    b("ls", 110, 1.6, 0.7),
    b("pk", 250, 0.6, 0.8),
    b("pk", 700, -0.4, 1),
    b("pk", 3500, 1, 1.1),
    b("hs", 9000, 0.4, 0.7),
  ]),
  original("cinema", "Cinema", "Music", "A wider bottom end and a little dialogue presence, kept well under the gain ceiling.", [
    b("ls", 60, 2.6, 0.7),
    b("pk", 250, -1, 1),
    b("pk", 800, 0.4, 0.8),
    b("pk", 3500, 1, 1.2),
    b("hs", 11000, 1.2, 0.7),
  ]),
  original("choir", "Choir", "Music", "Opens the blend around 1.5 kHz and adds air so massed voices do not sit in a box.", [
    b("ls", 130, 0.8, 0.7),
    b("pk", 300, -0.8, 1),
    b("pk", 1500, 1, 0.8),
    b("pk", 4000, 0.6, 1.3),
    b("hs", 10000, 1.4, 0.7),
  ]),
  original("pop", "Pop", "Popular", "Bass shelf, a low-mid scoop, vocal presence, and a small air shelf. Gains stay modest.", [
    b("ls", 80, 3.2, 0.7),
    b("pk", 250, -1.4, 1),
    b("pk", 3000, 1.8, 1.2),
    b("pk", 7000, 1, 1.5),
    b("hs", 12000, 1.2, 0.7),
  ]),
  original("rock", "Rock", "Popular", "Guitar-body weight, a mud cut, and bite around 2.5 kHz without a harsh shelf.", [
    b("ls", 90, 2.4, 0.7),
    b("pk", 200, 0.8, 0.8),
    b("pk", 400, -1, 1.1),
    b("pk", 2500, 1.8, 1.1),
    b("hs", 8000, 0.6, 0.7),
  ]),
  original("indie", "Indie", "Popular", "A scooped low mid and a jangle lift through the upper mids.", [
    b("ls", 100, 1.2, 0.7),
    b("pk", 300, -1.6, 0.9),
    b("pk", 1800, 0.6, 1),
    b("pk", 5500, 1.6, 1.3),
    b("hs", 11000, 0.8, 0.7),
  ]),
  original("electronic", "Electronic", "Popular", "Sub weight, a cleared low mid, and air for synths. The shelf stops at +3.6 dB.", [
    b("ls", 55, 3.6, 0.7),
    b("pk", 180, -1.2, 1),
    b("pk", 450, -0.8, 1.2),
    b("pk", 3500, 1.2, 1.2),
    b("hs", 10000, 1.4, 0.7),
  ]),
  original("dance", "Dance", "Popular", "Kick weight and a clap-range lift. The bass shelf is +4 dB, not stacked to the ceiling.", [
    b("ls", 60, 4, 0.71),
    b("pk", 250, -1.6, 1),
    b("pk", 2000, 0.6, 1),
    b("pk", 4500, 1.4, 1.3),
    b("hs", 11000, 1, 0.7),
  ]),
  original("hip-hop", "Hip-hop", "Popular", "Bass shelf with the low mids pulled back so vocals stay intelligible.", [
    b("ls", 70, 4.2, 0.7),
    b("pk", 220, -1.2, 0.9),
    b("pk", 450, -0.8, 1.1),
    b("pk", 3000, 1.4, 1.1),
    b("hs", 9000, -0.4, 0.7),
  ]),
  original("rnb-soul", "R&B / Soul", "Popular", "Warm bass, a smooth mid, and only a touch of air.", [
    b("ls", 90, 2.8, 0.7),
    b("pk", 250, 0.6, 0.8),
    b("pk", 500, -0.6, 1),
    b("pk", 2800, 1.2, 1),
    b("hs", 10000, 0.4, 0.7),
  ]),
  original(
    "metal",
    "Metal",
    "Popular",
    "Tight bass and guitar cut-through with headroom left. The loudest band is +2.4 dB, so nothing stacks toward +12.",
    [b("ls", 80, 2.4, 0.75), b("pk", 280, -2, 1.1), b("pk", 1800, 1.8, 1.2), b("pk", 3800, 1.4, 1.4), b("hs", 10000, 0.8, 0.7)],
  ),
  original("vocal-presence", "Vocal Presence", "Voice", "Clears mud under the voice and lifts 3–4 kHz so lyrics sit forward.", [
    b("ls", 120, -0.6, 0.7),
    b("pk", 300, -1.4, 1),
    b("pk", 1800, 1.2, 1),
    b("pk", 3500, 2.4, 1.3),
    b("hs", 11000, 0.8, 0.7),
  ]),
  original("podcast", "Podcast", "Voice", "Less rumble and mud, more speech clarity, and a softer 6 kHz so sibilance does not spike.", [
    b("ls", 90, -2.4, 0.7),
    b("pk", 220, -1.8, 1),
    b("pk", 3000, 2.2, 1.1),
    b("pk", 6200, -1.6, 1.6),
    b("hs", 10000, -1.2, 0.7),
  ]),
  original("spoken-word", "Spoken Word", "Voice", "A quieter version of the podcast balance for narration and audiobooks.", [
    b("ls", 100, -1.6, 0.7),
    b("pk", 250, -1.2, 1),
    b("pk", 2200, 1.6, 0.9),
    b("pk", 4500, 0.8, 1.4),
    b("hs", 9000, -0.8, 0.7),
  ]),
  original("asmr-soft", "ASMR-soft", "Voice", "Keeps close warmth and eases the 3–6 kHz edge that gets fatiguing at high volume.", [
    b("ls", 140, 1, 0.7),
    b("pk", 400, -0.6, 0.8),
    b("pk", 3500, -1.8, 1),
    b("pk", 6500, -1.2, 1.4),
    b("hs", 12000, 0.6, 0.7),
  ]),
  original("female-vocal", "Female Vocal", "Voice", "A lighter low end and presence through the upper mid where many sung leads live.", [
    b("ls", 100, -0.4, 0.7),
    b("pk", 250, -0.8, 1),
    b("pk", 2500, 1.4, 1.1),
    b("pk", 5000, 1.2, 1.4),
    b("hs", 12000, 0.8, 0.7),
  ]),
  original("male-vocal", "Male Vocal", "Voice", "A little chest, less boxiness, and presence around 2 kHz.", [
    b("ls", 120, 1.2, 0.7),
    b("pk", 250, 0.6, 0.8),
    b("pk", 500, -0.6, 1),
    b("pk", 2200, 1.6, 1),
    b("hs", 8000, -0.4, 0.7),
  ]),
  original("warm", "Warm", "Tone", "Bass and low-mid lift with the treble shelf pulled down.", [
    b("ls", 120, 2.2, 0.7),
    b("pk", 400, 0.6, 0.8),
    b("pk", 2500, -0.6, 1),
    b("pk", 6000, -1, 1.2),
    b("hs", 10000, -1.4, 0.7),
  ]),
  original("warm-bass", "Warm Bass", "Tone", "More bass than Warm, with a low-mid cut so it does not turn to mud.", [
    b("ls", 80, 4, 0.7),
    b("pk", 180, 1, 0.8),
    b("pk", 350, -1.4, 1),
    b("pk", 3000, 0.4, 1),
    b("hs", 10000, -0.6, 0.7),
  ]),
  original("bright", "Bright", "Tone", "Presence and a high shelf, with a small low-end trim so the tilt reads as brighter.", [
    b("ls", 100, -0.8, 0.7),
    b("pk", 250, -0.6, 1),
    b("pk", 4000, 1.2, 1.2),
    b("pk", 8000, 1.6, 1.5),
    b("hs", 12000, 2.2, 0.7),
  ]),
  original("air", "Air", "Tone", "Most of the change is above 8 kHz. The lower bands only make a little room for it.", [
    b("pk", 200, -0.4, 0.8),
    b("pk", 1000, -0.2, 1),
    b("pk", 4000, 0.4, 1.2),
    b("pk", 8000, 1.2, 1.6),
    b("hs", 12000, 2.6, 0.7),
  ]),
  original("treble-detail", "Treble Detail", "Tone", "A narrower lift around 7–8 kHz for cymbals and consonants, not a broad brightness shelf.", [
    b("ls", 90, -0.4, 0.7),
    b("pk", 300, -0.8, 1),
    b("pk", 4500, 1, 1.4),
    b("pk", 7500, 1.8, 2),
    b("hs", 12000, 1.2, 0.7),
  ]),
  original("bass-boost", "Bass Boost", "Tone", "A +4.8 dB low shelf plus a small kick-range bell, with a cut just above so speech stays clear.", [
    b("ls", 70, 4.8, 0.7),
    b("pk", 140, 1.2, 0.8),
    b("pk", 280, -1.6, 1),
    b("pk", 2000, 0.2, 1),
    b("hs", 10000, 0.2, 0.7),
  ]),
  original(
    "basetrumental",
    "Basetrumental",
    "Tone",
    "Tight bass thump, vocals less crisp, and instruments still clear. Loudness is unchanged because nothing is boosted.",
    [
      b("ls", 90, 0, 0.7),
      b("pk", 180, -0.5, 0.8),
      b("pk", 1200, -0.5, 1),
      b("pk", 3500, -2.5, 1.3),
      b("hs", 8000, -2, 0.7),
    ],
    "JA11",
    "Voicing",
    ["bass", "instruments", "thump"],
  ),
  original(
    "basetrumental-enhanced",
    "Basetrumental-enhanced",
    "Tone",
    "Tight sub thump, mud pulled down, vocals and treble left exactly flat. Level match is held at +12 so detail stays as loud as flat.",
    [
      b("pk", 58, 3.5, 1.1),
      b("pk", 260, -1.5, 1.8),
      b("pk", 2500, 0, 1),
      b("pk", 6500, 0, 1),
      b("hs", 12000, 0, 0.7),
    ],
    "JA11",
    "Voicing",
    ["bass", "instruments", "thump", "clear"],
    { autoPreamp: false, preamp: 12 },
  ),
  original("midrange-forward", "Midrange Forward", "Tone", "Puts 1–2.5 kHz in front. Useful when a mix feels distant.", [
    b("ls", 80, -0.6, 0.7),
    b("pk", 400, 0.8, 0.8),
    b("pk", 1200, 2.2, 0.9),
    b("pk", 2500, 1.6, 1.1),
    b("hs", 10000, -0.4, 0.7),
  ]),
  original(
    "night-low-volume",
    "Night / Low Volume",
    "Tone",
    "A small loudness-style lift of bass and treble for quiet sessions. It is not a hearing-loss prescription.",
    [b("ls", 80, 3, 0.7), b("pk", 300, -0.4, 0.9), b("pk", 1500, -0.6, 0.8), b("pk", 5000, 1, 1.2), b("hs", 10000, 2, 0.7)],
  ),
  original("fatigue-relief", "Fatigue Relief", "Tone", "Eases the 3–6 kHz region that often causes listening fatigue, and leaves a little warmth.", [
    b("ls", 100, 0.8, 0.7),
    b("pk", 280, -0.4, 0.9),
    b("pk", 3200, -1.8, 1.1),
    b("pk", 6000, -1.6, 1.5),
    b("hs", 11000, -0.6, 0.7),
  ]),
  original(
    "ja11-vocal-like",
    "Vocal-like",
    "Device",
    "Inspired by the factory slot name Vocal. Original approximation for this app, not a dump of device firmware.",
    [b("ls", 110, 0.6, 0.7), b("pk", 250, -1, 1), b("pk", 2000, 1.2, 1), b("pk", 3800, 2, 1.3), b("hs", 10000, 0.6, 0.7)],
  ),
  original(
    "ja11-classic-like",
    "Classic-like",
    "Device",
    "Inspired by the factory slot name Classic. A mild warm balance written for this app, not a firmware readout.",
    [b("ls", 100, 1.5, 0.7), b("pk", 250, 0.4, 0.8), b("pk", 800, -0.4, 1), b("pk", 3000, 0.8, 1), b("hs", 10000, -0.3, 0.7)],
  ),
  original(
    "ja11-bass-like",
    "Bass-like",
    "Device",
    "Inspired by the factory slot name Bass. A moderate shelf, not a measured copy of a device preset.",
    [b("ls", 75, 3.8, 0.7), b("pk", 160, 0.8, 0.8), b("pk", 350, -1, 1), b("pk", 3000, 0.4, 1.1), b("hs", 10000, -0.2, 0.7)],
  ),
  original(
    "loric-balanced",
    "Loric — balanced start",
    "Kefine Loric",
    "Original starting voicing for the Kefine Loric. No public Loric parametric file was found, so this is not a measurement.",
    [b("ls", 90, 1, 0.7), b("pk", 250, -0.8, 1), b("pk", 2000, 0.6, 0.9), b("pk", 5000, 0.6, 1.3), b("hs", 11000, 0.4, 0.7)],
    "Kefine Loric",
    "IEM",
  ),
  original(
    "loric-vocal",
    "Loric — vocal start",
    "Kefine Loric",
    "Original Loric starting point with the vocal range a bit forward. Not an AutoEq or manufacturer curve.",
    [b("ls", 100, 0.4, 0.7), b("pk", 280, -1, 1), b("pk", 1800, 1, 1), b("pk", 3400, 1.6, 1.2), b("hs", 10000, 0.4, 0.7)],
    "Kefine Loric",
    "IEM",
  ),
  original(
    "loric-bass",
    "Loric — easy bass start",
    "Kefine Loric",
    "Original Loric starting point with a modest bass shelf. Not a measurement of the Loric.",
    [b("ls", 80, 2.4, 0.7), b("pk", 220, -0.6, 0.9), b("pk", 500, -0.4, 1), b("pk", 3000, 0.4, 1.1), b("hs", 10000, 0.2, 0.7)],
    "Kefine Loric",
    "IEM",
  ),
];

interface AutoEqFile {
  id: string;
  name: string;
  kind: string;
  measurementAuthor: string;
  sourceUrl: string;
  readmeUrl: string;
  preamp5: number | null;
  preamp10: number | null;
  filePreamp: number | null;
  text: string;
}

function extractedPreset(entry: AutoEqFile): Preset {
  const preamp = entry.preamp5 ?? entry.filePreamp ?? 0;
  const { model, notes } = firstFiveModel(entry.text, entry.name, preamp);
  if (entry.filePreamp != null && Math.abs(entry.filePreamp - preamp) >= 0.05) {
    notes.push(
      `The ParametricEQ.txt preamp line is ${entry.filePreamp.toFixed(1)} dB. This card uses the README 5-band preamp of ${preamp.toFixed(1)} dB instead.`,
    );
  }
  if (entry.preamp10 != null && entry.preamp5 != null && Math.abs(entry.preamp10 - entry.preamp5) >= 0.05) {
    notes.push(`The README 10-filter preamp is ${entry.preamp10.toFixed(1)} dB, which is not what this card loads.`);
  }
  const clamped = notes.some((note) => note.includes("clamped"));
  const kind = entry.kind === "Headphone" ? "Headphone" : "IEM";
  return {
    id: entry.id,
    name: entry.name,
    category: "Measurements",
    description: `${entry.name} from ${entry.measurementAuthor}, fitted by AutoEq. Loads published filters 1–5 only. Open the full file in Import if you want to pick a different five.`,
    target: entry.name,
    author: `${entry.measurementAuthor} via AutoEq`,
    sourceUrl: entry.sourceUrl,
    readmeUrl: entry.readmeUrl,
    license: AUTOEQ_LICENSE,
    origin: "extracted",
    fitsJa11: !clamped,
    subsetNote: "5-band subset, not the 10-filter curve",
    importNotes: notes,
    sourceText: entry.text,
    kind,
    eq: model,
  };
}

export const extractedPresets: Preset[] = (rawEntries as AutoEqFile[]).map(extractedPreset);

export const builtInPresets: Preset[] = [...originalPresets, ...extractedPresets];

export function presetById(id: string): Preset | undefined {
  return builtInPresets.find((preset) => preset.id === id);
}

const SEARCH_WORD = /[a-z0-9]+/g;

function searchWords(text: string): string[] {
  return text.toLowerCase().match(SEARCH_WORD) ?? [];
}

function wordSet(text: string): Set<string> {
  return new Set(searchWords(text));
}

/**
 * Whole-word preset search.
 * Name and tag hits are the entire result when any exist.
 * Description is used only when no name or tag covers every word.
 * An empty query returns the list unchanged.
 */
export function presetsMatchingQuery<T extends { name: string; description: string; tags?: readonly string[] }>(
  presets: readonly T[],
  query: string,
): T[] {
  const words = searchWords(query);
  if (words.length === 0) return [...presets];

  const rows = presets.map((preset) => {
    const name = wordSet(preset.name);
    const tags = wordSet((preset.tags ?? []).join(" "));
    const primary = words.every((word) => name.has(word) || tags.has(word));
    const nameHit = words.every((word) => name.has(word));
    return { preset, name, tags, primary, nameHit };
  });

  const primary = rows.filter((row) => row.primary);
  if (primary.length > 0) {
    return primary
      .slice()
      .sort((a, b) => Number(b.nameHit) - Number(a.nameHit))
      .map((row) => row.preset);
  }

  return rows
    .filter((row) => {
      const description = wordSet(row.preset.description);
      return words.every((word) => row.name.has(word) || row.tags.has(word) || description.has(word));
    })
    .map((row) => row.preset);
}

export const FACTORY_PREVIEW: Record<"vocal" | "classic" | "bass", Preset> = {
  vocal: presetById("ja11-vocal-like") as Preset,
  classic: presetById("ja11-classic-like") as Preset,
  bass: presetById("ja11-bass-like") as Preset,
};

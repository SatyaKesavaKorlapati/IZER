import { builtInPresets, type Preset } from "../data/presets";
import { type Band, type EqModel, type FilterType, flatModel, normalizeEq } from "../eq/types";

const KEY = "ja11-glass-eq-v1";
/** Stored "paper" before this version is the ivory Earth look. */
const LOOK_VERSION = 2;

export type Look = "papein" | "paper" | "cyan" | "cyan-light" | "earth";
export type ThemeChoice = Look;

export interface Settings {
  autoPreampDefault: boolean;
  confirmBeforeSave: boolean;
  /** Look. Absent until the user picks one. First launch follows the system. */
  theme?: Look;
  /** Night variation of the selected look. Absent until the user toggles it. */
  dark?: boolean;
  /** 0–100. Refines the dark variation. Hidden while the look is light. */
  themeIntensity: number;
  /**
   * 2 means a stored "paper" is the ruled sheet.
   * Older saves used "paper" for the ivory look, now called Earth.
   */
  lookVersion?: number;
}

export interface PersistedState {
  settings: Settings;
  saved: EqModel;
  /** Stored compare curve. Updated only by Set A. */
  draftA: EqModel;
  /** Stored compare curve. Updated only by Set B. */
  draftB: EqModel;
  /** Working editor. Older saves omit this and reopen on the active side. */
  editor: EqModel;
  ab: "A" | "B";
  userPresets: Preset[];
}

export const defaultSettings: Settings = {
  theme: "papein",
  dark: false,
  autoPreampDefault: true,
  confirmBeforeSave: true,
  themeIntensity: 0,
};

function lookChoice(value: unknown, _lookVersion?: unknown): Look | undefined {
  if (value === "papein") return "papein";
  if (value === "earth") return "earth";
  if (value === "paper") return "paper";
  if (value === "cyan" || value === "cyan-light") return value;
  if (value === "custom-dark" || value === "dark") return "cyan";
  if (value === "light") return "cyan-light";
  return undefined;
}

export function themeColorScheme(dark: boolean): "light" | "dark" {
  return dark ? "dark" : "light";
}

interface AppearancePrefs {
  theme?: Look;
  dark?: boolean;
  themeIntensity: number;
}

/** New saves store a look plus a dark flag. Older saves stored one theme name, including a standalone Dark. */
function appearanceFromSettings(
  settings: { theme?: unknown; dark?: unknown; themeIntensity?: unknown; lookVersion?: unknown } | undefined,
): AppearancePrefs {
  const intensity = themeIntensity(settings?.themeIntensity);
  const lookVersion = settings?.lookVersion;
  if (typeof settings?.dark === "boolean") {
    const theme = lookChoice(settings.theme, lookVersion);
    return {
      themeIntensity: intensity,
      dark: settings.dark,
      ...(theme ? { theme } : {}),
    };
  }
  const legacy = settings?.theme;
  if (legacy === "custom-dark") return { theme: "cyan", dark: true, themeIntensity: intensity };
  if (legacy === "cyan" || legacy === "dark") return { theme: "cyan", dark: true, themeIntensity: 0 };
  if (legacy === "paper") return { theme: lookChoice("paper", lookVersion), dark: false, themeIntensity: 0 };
  if (legacy === "earth") return { theme: "earth", dark: false, themeIntensity: 0 };
  if (legacy === "cyan-light" || legacy === "light") return { theme: "cyan-light", dark: false, themeIntensity: 0 };
  return { themeIntensity: 0 };
}

function themeIntensity(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return defaultSettings.themeIntensity;
  return Math.round(Math.min(100, Math.max(0, value)));
}

function isType(value: unknown): value is FilterType {
  return value === "pk" || value === "ls" || value === "hs";
}

function isBand(value: unknown): value is Band {
  if (!value || typeof value !== "object") return false;
  const band = value as Band;
  return (
    isType(band.type) &&
    typeof band.freq === "number" &&
    band.freq >= 20 &&
    band.freq <= 20000 &&
    typeof band.gain === "number" &&
    band.gain >= -12 &&
    band.gain <= 12 &&
    typeof band.q === "number" &&
    band.q >= 0.1 &&
    band.q <= 10 &&
    typeof band.enabled === "boolean"
  );
}

function isEq(value: unknown): value is EqModel {
  if (!value || typeof value !== "object") return false;
  const eq = value as EqModel;
  return (
    typeof eq.name === "string" &&
    typeof eq.preamp === "number" &&
    typeof eq.autoPreamp === "boolean" &&
    Array.isArray(eq.bands) &&
    eq.bands.length === 5 &&
    eq.bands.every(isBand)
  );
}

function isPreset(value: unknown): value is Preset {
  if (!value || typeof value !== "object") return false;
  const preset = value as Preset;
  return (
    typeof preset.id === "string" &&
    typeof preset.name === "string" &&
    typeof preset.category === "string" &&
    typeof preset.description === "string" &&
    typeof preset.target === "string" &&
    preset.origin === "user" &&
    typeof preset.fitsJa11 === "boolean" &&
    isEq(preset.eq)
  );
}

export function freshState(): PersistedState {
  const base = normalizeEq({ ...flatModel("Flat"), autoPreamp: defaultSettings.autoPreampDefault });
  return {
    settings: { ...defaultSettings },
    saved: base,
    draftA: normalizeEq(base),
    draftB: normalizeEq(base),
    editor: normalizeEq(base),
    ab: "A",
    userPresets: [],
  };
}

export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshState();
    const data = JSON.parse(raw) as Partial<PersistedState>;
    const base = freshState();
    const appearance = appearanceFromSettings(data.settings);
    const settings: Settings = {
      autoPreampDefault:
        typeof data.settings?.autoPreampDefault === "boolean"
          ? data.settings.autoPreampDefault
          : base.settings.autoPreampDefault,
      confirmBeforeSave:
        typeof data.settings?.confirmBeforeSave === "boolean"
          ? data.settings.confirmBeforeSave
          : base.settings.confirmBeforeSave,
      themeIntensity: appearance.themeIntensity,
      ...(appearance.theme ? { theme: appearance.theme } : {}),
      ...(typeof appearance.dark === "boolean" ? { dark: appearance.dark } : {}),
    };
    const draftA = isEq(data.draftA) ? normalizeEq(data.draftA) : base.draftA;
    const draftB = isEq(data.draftB) ? normalizeEq(data.draftB) : base.draftB;
    const ab = data.ab === "B" ? "B" : "A";
    return {
      settings,
      saved: isEq(data.saved) ? normalizeEq(data.saved) : base.saved,
      draftA,
      draftB,
      editor: isEq(data.editor) ? normalizeEq(data.editor) : ab === "B" ? draftB : draftA,
      ab,
      userPresets: Array.isArray(data.userPresets) ? data.userPresets.filter(isPreset) : [],
    };
  } catch {
    return freshState();
  }
}

export function saveState(state: PersistedState): void {
  const settings = { ...state.settings, lookVersion: LOOK_VERSION };
  localStorage.setItem(KEY, JSON.stringify({ ...state, settings }));
}

export function userPresetFromEq(eq: EqModel, id: string): Preset {
  const model = normalizeEq(eq);
  return {
    id,
    name: model.name,
    category: "My presets",
    description: "Saved from the editor on this computer.",
    target: "Generic",
    author: "You",
    license: "Stored locally in this browser.",
    origin: "user",
    fitsJa11: true,
    kind: "Voicing",
    eq: model,
  };
}

export function knownPresetCount(): { original: number; extracted: number } {
  return {
    original: builtInPresets.filter((preset) => preset.origin === "original").length,
    extracted: builtInPresets.filter((preset) => preset.origin === "extracted").length,
  };
}

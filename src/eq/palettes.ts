import { BAND_COLORS } from "./types";

export type GraphPaletteId = "current" | "aurora" | "ember" | "mono";

export interface GraphPalette {
  id: GraphPaletteId;
  label: string;
  /** Summed curve. CSS color, including variables. */
  curve: string;
  bands: readonly [string, string, string, string, string];
  /** Soft fill strength for each band. Overlaps stay translucent. */
  fillAlpha: readonly [number, number, number, number, number];
  /** Dashed stroke strength. Mono uses this to separate bands. */
  strokeAlpha: readonly [number, number, number, number, number];
}

export const GRAPH_PALETTES: Record<GraphPaletteId, GraphPalette> = {
  current: {
    id: "current",
    label: "Current",
    curve: "var(--ja11-color-accent)",
    bands: BAND_COLORS,
    fillAlpha: [0.3, 0.3, 0.3, 0.3, 0.3],
    strokeAlpha: [0.95, 0.95, 0.95, 0.95, 0.95],
  },
  aurora: {
    id: "aurora",
    label: "Aurora",
    curve: "#5ee9f5",
    bands: ["#2ec4b6", "#e8a317", "#7c6cf0", "#3b82f6", "#e86b9a"],
    fillAlpha: [0.34, 0.32, 0.32, 0.32, 0.32],
    strokeAlpha: [0.95, 0.95, 0.95, 0.95, 0.95],
  },
  ember: {
    id: "ember",
    label: "Ember",
    curve: "#ffb15a",
    bands: ["#ff5d36", "#ff9f1c", "#e85d4c", "#d4527a", "#f2c14e"],
    fillAlpha: [0.34, 0.3, 0.3, 0.3, 0.28],
    strokeAlpha: [0.95, 0.95, 0.95, 0.95, 0.95],
  },
  mono: {
    id: "mono",
    label: "Mono",
    curve: "#7eebf4",
    bands: ["#7eebf4", "#7eebf4", "#7eebf4", "#7eebf4", "#7eebf4"],
    fillAlpha: [0.14, 0.24, 0.34, 0.46, 0.6],
    strokeAlpha: [0.45, 0.62, 0.78, 0.9, 1],
  },
};

export const GRAPH_PALETTE_IDS: GraphPaletteId[] = ["current", "aurora", "ember", "mono"];

export function isGraphPaletteId(value: string | null): value is GraphPaletteId {
  return value === "current" || value === "aurora" || value === "ember" || value === "mono";
}

const PALETTE_KEY = "eq-graph-palette";

export function readGraphPalette(): GraphPalette {
  const stored = localStorage.getItem(PALETTE_KEY);
  return isGraphPaletteId(stored) ? GRAPH_PALETTES[stored] : GRAPH_PALETTES.current;
}

export function writeGraphPalette(id: GraphPaletteId): void {
  localStorage.setItem(PALETTE_KEY, id);
}

/** Darker ink so Aurora, Ember, and Mono stay visible on light appearances. */
const LIGHT_INK: Record<GraphPaletteId, Pick<GraphPalette, "curve" | "bands">> = {
  current: {
    curve: "var(--ja11-color-accent)",
    bands: BAND_COLORS,
  },
  aurora: {
    curve: "#0f7c88",
    bands: ["#15786e", "#a56d08", "#5344b0", "#2158b8", "#b34270"],
  },
  ember: {
    curve: "#c65a14",
    bands: ["#c83d24", "#b56e08", "#b33d32", "#a3385c", "#a67416"],
  },
  mono: {
    curve: "#0e6e7c",
    bands: ["#0e6e7c", "#0e6e7c", "#0e6e7c", "#0e6e7c", "#0e6e7c"],
  },
};

const EARTH_CURRENT_BANDS = ["#d4654e", "#c47a12", "#2f7a4e", "#2d62b0", "#b44d6e"] as const;
const EARTH_DARK_BANDS = ["#f2b2a4", "#f0c56a", "#9ed4b0", "#a9c8f5", "#f0b0c4"] as const;
const SHEET_CURRENT_BANDS = ["#de4264", "#d97706", "#16a34a", "#0284c7", "#7c3aed"] as const;
const SHEET_DARK_BANDS = ["#f4788c", "#f0a248", "#64be8a", "#48a6d4", "#b388d9"] as const;
const PAPEIN_CURRENT_BANDS = ["#d87977", "#d7a33d", "#5c9a70", "#55a9c8", "#a77bc6"] as const;
const PAPEIN_DARK_BANDS = ["#ff6370", "#ffb426", "#3ded6b", "#2ee0ff", "#d966ff"] as const;

/** Palettes still recolor the curve and tiles. Light appearances use darker ink. */
export function presentPalette(palette: GraphPalette, appearance: string, dark = false): GraphPalette {
  if (appearance === "papein" && palette.id === "current") {
    return {
      ...palette,
      curve: dark ? "#00ffd5" : "#278b91",
      bands: dark ? PAPEIN_DARK_BANDS : PAPEIN_CURRENT_BANDS,
      fillAlpha: dark ? [0.42, 0.42, 0.42, 0.42, 0.42] : [0.38, 0.38, 0.38, 0.38, 0.38],
      strokeAlpha: [0.95, 0.95, 0.95, 0.95, 0.95],
    };
  }
  if (appearance === "earth" && palette.id === "current") {
    return {
      ...palette,
      curve: "var(--ja11-color-accent)",
      bands: dark ? EARTH_DARK_BANDS : EARTH_CURRENT_BANDS,
    };
  }
  if (appearance === "paper" && palette.id === "current") {
    return {
      ...palette,
      curve: dark ? "#38d9d6" : "#0097a7",
      bands: dark ? SHEET_DARK_BANDS : SHEET_CURRENT_BANDS,
    };
  }
  if (!dark && (appearance === "papein" || appearance === "earth" || appearance === "paper" || appearance === "cyan-light" || appearance === "cyan")) {
    const ink = LIGHT_INK[palette.id];
    if (palette.id === "current" || !ink) return palette;
    return { ...palette, curve: ink.curve, bands: ink.bands };
  }
  return palette;
}

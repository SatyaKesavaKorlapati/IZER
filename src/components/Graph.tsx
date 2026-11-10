import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { sampleBand, sampleResponse } from "../eq/biquad";
import type { GraphPalette } from "../eq/palettes";
import { GAIN_MAX, GAIN_MIN, type Band } from "../eq/types";

interface GraphProps {
  bands: Band[];
  selected: number;
  interactive: boolean;
  bypass?: boolean;
  palette: GraphPalette;
  onSelect: (index: number) => void;
  onChange: (index: number, freq: number, gain: number) => void;
}

const FREQ_MAJOR = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
const FREQ_MAJOR_SET = new Set(FREQ_MAJOR);
const FREQ_MINOR = buildFreqMinors();
const DB_LABELS = [-12, -9, -6, -3, 0, 3, 6, 9, 12];
const DB_LABEL_SET = new Set(DB_LABELS);
const DB_HAIR = [-11, -10, -8, -7, -5, -4, -2, -1, 1, 2, 4, 5, 7, 8, 10, 11];

const PAD_L = 42;
const PAD_R = 14;
const PAD_T = 14;
const PAD_B = 22;

function buildFreqMinors(): number[] {
  const out: number[] = [];
  for (const decade of [10, 100, 1000, 10000]) {
    for (let step = 2; step <= 9; step += 1) {
      const freq = decade * step;
      if (freq > 20 && freq < 20000 && !FREQ_MAJOR_SET.has(freq)) out.push(freq);
    }
  }
  for (const freq of [150, 1500, 15000]) out.push(freq);
  return out;
}

function tickLabel(freq: number): string {
  if (freq >= 1000) {
    const k = freq / 1000;
    return Number.isInteger(k) ? `${k}k` : `${k}k`;
  }
  return String(freq);
}

interface PlotSize {
  w: number;
  h: number;
}

function xOf(freq: number, size: PlotSize): number {
  const plotW = Math.max(1, size.w - PAD_L - PAD_R);
  const t = Math.log(freq / 20) / Math.log(1000);
  return PAD_L + Math.min(1, Math.max(0, t)) * plotW;
}

function yOf(db: number, size: PlotSize): number {
  const plotH = Math.max(1, size.h - PAD_T - PAD_B);
  const t = (GAIN_MAX - db) / (GAIN_MAX - GAIN_MIN);
  return PAD_T + Math.min(1, Math.max(0, t)) * plotH;
}

function freqOf(x: number, size: PlotSize): number {
  const plotW = Math.max(1, size.w - PAD_L - PAD_R);
  const t = (x - PAD_L) / plotW;
  return 20 * 1000 ** Math.min(1, Math.max(0, t));
}

function dbOf(y: number, size: PlotSize): number {
  const plotH = Math.max(1, size.h - PAD_T - PAD_B);
  const t = (y - PAD_T) / plotH;
  return GAIN_MAX - Math.min(1, Math.max(0, t)) * (GAIN_MAX - GAIN_MIN);
}

function linePath(samples: Array<{ freq: number; db: number }>, size: PlotSize): string {
  return samples
    .map((point, index) => `${index === 0 ? "M" : "L"}${xOf(point.freq, size).toFixed(2)},${yOf(point.db, size).toFixed(2)}`)
    .join(" ");
}

function fillPath(samples: Array<{ freq: number; db: number }>, size: PlotSize): string {
  if (samples.length === 0) return "";
  const line = linePath(samples, size);
  const first = samples[0];
  const last = samples[samples.length - 1];
  return `${line} L${xOf(last.freq, size).toFixed(2)},${yOf(0, size).toFixed(2)} L${xOf(first.freq, size).toFixed(2)},${yOf(0, size).toFixed(2)} Z`;
}

function himalayaPaths(size: PlotSize) {
  const x0 = PAD_L;
  const x1 = PAD_L + Math.max(1, size.w - PAD_L - PAD_R);
  const w = x1 - x0;
  const h = Math.max(1, size.h - PAD_T - PAD_B);
  const yBottom = PAD_T + h;

  // Gentle misty Himalayan ridges (soft, faint, unobtrusive)
  const far = [
    `M${x0.toFixed(1)},${yBottom.toFixed(1)}`,
    `L${x0.toFixed(1)},${(yBottom - 0.05 * h).toFixed(1)}`,
    `Q${(x0 + 0.10 * w).toFixed(1)},${(yBottom - 0.16 * h).toFixed(1)} ${(x0 + 0.20 * w).toFixed(1)},${(yBottom - 0.22 * h).toFixed(1)}`,
    `Q${(x0 + 0.26 * w).toFixed(1)},${(yBottom - 0.12 * h).toFixed(1)} ${(x0 + 0.35 * w).toFixed(1)},${(yBottom - 0.18 * h).toFixed(1)}`,
    `Q${(x0 + 0.44 * w).toFixed(1)},${(yBottom - 0.28 * h).toFixed(1)} ${(x0 + 0.52 * w).toFixed(1)},${(yBottom - 0.14 * h).toFixed(1)}`,
    `Q${(x0 + 0.62 * w).toFixed(1)},${(yBottom - 0.24 * h).toFixed(1)} ${(x0 + 0.72 * w).toFixed(1)},${(yBottom - 0.12 * h).toFixed(1)}`,
    `Q${(x0 + 0.82 * w).toFixed(1)},${(yBottom - 0.20 * h).toFixed(1)} ${(x0 + 0.92 * w).toFixed(1)},${(yBottom - 0.08 * h).toFixed(1)}`,
    `L${x1.toFixed(1)},${(yBottom - 0.04 * h).toFixed(1)}`,
    `L${x1.toFixed(1)},${yBottom.toFixed(1)} Z`,
  ].join(" ");

  // Mid rolling foothills
  const mid = [
    `M${x0.toFixed(1)},${yBottom.toFixed(1)}`,
    `L${x0.toFixed(1)},${(yBottom - 0.03 * h).toFixed(1)}`,
    `Q${(x0 + 0.14 * w).toFixed(1)},${(yBottom - 0.12 * h).toFixed(1)} ${(x0 + 0.28 * w).toFixed(1)},${(yBottom - 0.06 * h).toFixed(1)}`,
    `Q${(x0 + 0.42 * w).toFixed(1)},${(yBottom - 0.14 * h).toFixed(1)} ${(x0 + 0.56 * w).toFixed(1)},${(yBottom - 0.07 * h).toFixed(1)}`,
    `Q${(x0 + 0.70 * w).toFixed(1)},${(yBottom - 0.15 * h).toFixed(1)} ${(x0 + 0.84 * w).toFixed(1)},${(yBottom - 0.05 * h).toFixed(1)}`,
    `L${x1.toFixed(1)},${(yBottom - 0.02 * h).toFixed(1)}`,
    `L${x1.toFixed(1)},${yBottom.toFixed(1)} Z`,
  ].join(" ");

  // River water ribbon
  const river = [
    `M${x0.toFixed(1)},${(yBottom - 0.02 * h).toFixed(1)}`,
    `Q${(x0 + 0.25 * w).toFixed(1)},${(yBottom - 0.04 * h).toFixed(1)} ${(x0 + 0.50 * w).toFixed(1)},${(yBottom - 0.01 * h).toFixed(1)}`,
    `Q${(x0 + 0.75 * w).toFixed(1)},${(yBottom - 0.04 * h).toFixed(1)} ${x1.toFixed(1)},${(yBottom - 0.01 * h).toFixed(1)}`,
    `L${x1.toFixed(1)},${yBottom.toFixed(1)}`,
    `L${x0.toFixed(1)},${yBottom.toFixed(1)} Z`,
  ].join(" ");

  return { far, mid, river };
}

function papeinPaths(size: PlotSize) {
  const x0 = PAD_L;
  const x1 = PAD_L + Math.max(1, size.w - PAD_L - PAD_R);
  const w = x1 - x0;
  const h = Math.max(1, size.h - PAD_T - PAD_B);
  const yBottom = PAD_T + h;

  // Layer 1: Deep rolling waves in background (Godavari teal)
  const waveBack = [
    `M${x0.toFixed(1)},${yBottom.toFixed(1)}`,
    `L${x0.toFixed(1)},${(yBottom - 0.24 * h).toFixed(1)}`,
    `Q${(x0 + 0.12 * w).toFixed(1)},${(yBottom - 0.32 * h).toFixed(1)} ${(x0 + 0.25 * w).toFixed(1)},${(yBottom - 0.22 * h).toFixed(1)}`,
    `Q${(x0 + 0.38 * w).toFixed(1)},${(yBottom - 0.12 * h).toFixed(1)} ${(x0 + 0.52 * w).toFixed(1)},${(yBottom - 0.20 * h).toFixed(1)}`,
    `Q${(x0 + 0.65 * w).toFixed(1)},${(yBottom - 0.28 * h).toFixed(1)} ${(x0 + 0.78 * w).toFixed(1)},${(yBottom - 0.18 * h).toFixed(1)}`,
    `Q${(x0 + 0.88 * w).toFixed(1)},${(yBottom - 0.10 * h).toFixed(1)} ${x1.toFixed(1)},${(yBottom - 0.15 * h).toFixed(1)}`,
    `L${x1.toFixed(1)},${yBottom.toFixed(1)} Z`,
  ].join(" ");

  // Layer 2: Mid-ground ocean swell with foam
  const waveMid = [
    `M${x0.toFixed(1)},${yBottom.toFixed(1)}`,
    `L${x0.toFixed(1)},${(yBottom - 0.16 * h).toFixed(1)}`,
    `Q${(x0 + 0.10 * w).toFixed(1)},${(yBottom - 0.22 * h).toFixed(1)} ${(x0 + 0.22 * w).toFixed(1)},${(yBottom - 0.14 * h).toFixed(1)}`,
    `Q${(x0 + 0.34 * w).toFixed(1)},${(yBottom - 0.06 * h).toFixed(1)} ${(x0 + 0.48 * w).toFixed(1)},${(yBottom - 0.15 * h).toFixed(1)}`,
    `Q${(x0 + 0.60 * w).toFixed(1)},${(yBottom - 0.22 * h).toFixed(1)} ${(x0 + 0.74 * w).toFixed(1)},${(yBottom - 0.10 * h).toFixed(1)}`,
    `Q${(x0 + 0.86 * w).toFixed(1)},${(yBottom - 0.04 * h).toFixed(1)} ${x1.toFixed(1)},${(yBottom - 0.09 * h).toFixed(1)}`,
    `L${x1.toFixed(1)},${yBottom.toFixed(1)} Z`,
  ].join(" ");

  // Layer 3: Foreground crashing surf
  const waveFront = [
    `M${x0.toFixed(1)},${yBottom.toFixed(1)}`,
    `L${x0.toFixed(1)},${(yBottom - 0.08 * h).toFixed(1)}`,
    `Q${(x0 + 0.15 * w).toFixed(1)},${(yBottom - 0.14 * h).toFixed(1)} ${(x0 + 0.30 * w).toFixed(1)},${(yBottom - 0.06 * h).toFixed(1)}`,
    `Q${(x0 + 0.45 * w).toFixed(1)},${(yBottom - 0.02 * h).toFixed(1)} ${(x0 + 0.62 * w).toFixed(1)},${(yBottom - 0.09 * h).toFixed(1)}`,
    `Q${(x0 + 0.78 * w).toFixed(1)},${(yBottom - 0.15 * h).toFixed(1)} ${(x0 + 0.90 * w).toFixed(1)},${(yBottom - 0.05 * h).toFixed(1)}`,
    `L${x1.toFixed(1)},${(yBottom - 0.03 * h).toFixed(1)}`,
    `L${x1.toFixed(1)},${yBottom.toFixed(1)} Z`,
  ].join(" ");

  const boatX = x0 + 0.14 * w;
  const boatY = yBottom - 0.15 * h;
  const lotus1X = x0 + 0.68 * w;
  const lotus1Y = yBottom - 0.06 * h;
  const lotus2X = x0 + 0.82 * w;
  const lotus2Y = yBottom - 0.07 * h;
  const heronX = x0 + 0.92 * w;
  const heronY = yBottom - 0.16 * h;

  return { waveBack, waveMid, waveFront, boatX, boatY, lotus1X, lotus1Y, lotus2X, lotus2Y, heronX, heronY };
}

export function EqGraph({ bands, selected, interactive, bypass = false, palette, onSelect, onChange }: GraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<PlotSize>({ w: 800, h: 320 });
  const gradientId = useId().replace(/:/g, "");
  const [size, setSize] = useState<PlotSize>({ w: 800, h: 320 });
  sizeRef.current = size;

  const samples = sampleResponse(bypass ? [] : bands, 520);
  const line = linePath(samples, size);
  const himalayas = himalayaPaths(size);
  const papein = papeinPaths(size);
  const plotW = Math.max(1, size.w - PAD_L - PAD_R);
  const plotH = Math.max(1, size.h - PAD_T - PAD_B);
  const labelFreqs = size.w < 760 ? new Set([20, 100, 1000, 10000, 20000]) : FREQ_MAJOR_SET;
  const labelDb = size.h < 200 ? new Set([-12, 0, 12]) : DB_LABEL_SET;

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => {
      const w = Math.round(frame.clientWidth);
      const h = Math.round(frame.clientHeight);
      if (w < 48 || h < 48) return;
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  function clientPoint(clientX: number, clientY: number) {
    const svg = svgRef.current;
    const plot = sizeRef.current;
    if (!svg) return { freq: 1000, gain: 0 };
    const matrix = svg.getScreenCTM();
    if (matrix) {
      const point = svg.createSVGPoint();
      point.x = clientX;
      point.y = clientY;
      const local = point.matrixTransform(matrix.inverse());
      return { freq: freqOf(local.x, plot), gain: dbOf(local.y, plot) };
    }
    const rect = svg.getBoundingClientRect();
    const x = rect.width > 0 ? ((clientX - rect.left) / rect.width) * plot.w : PAD_L;
    const y = rect.height > 0 ? ((clientY - rect.top) / rect.height) * plot.h : PAD_T;
    return { freq: freqOf(x, plot), gain: dbOf(y, plot) };
  }

  function startDrag(index: number, event: ReactPointerEvent<SVGGElement>) {
    if (!interactive) return;
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    onSelect(index);
    const apply = (clientX: number, clientY: number) => {
      const next = clientPoint(clientX, clientY);
      onChange(index, next.freq, next.gain);
    };
    apply(event.clientX, event.clientY);
    const move = (native: PointerEvent) => {
      if (native.pointerId !== event.pointerId) return;
      apply(native.clientX, native.clientY);
    };
    const stop = (native: PointerEvent) => {
      if (native.pointerId !== event.pointerId) return;
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  }

  return (
    <div className="eq-graph-frame" ref={frameRef}>
      <svg
        ref={svgRef}
        className="eq-graph"
        viewBox={`0 0 ${size.w} ${size.h}`}
        preserveAspectRatio="none"
        role="application"
        aria-label="Frequency response from 20 hertz to 20 kilohertz"
      >
        <defs>
          <linearGradient id={`${gradientId}-well`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="well-stop-top" />
            <stop offset="20%" className="well-stop-mid" />
            <stop offset="100%" className="well-stop-bottom" />
          </linearGradient>
          <clipPath id={`${gradientId}-clip`}>
            <rect x={PAD_L} y={PAD_T} width={plotW} height={plotH} rx="10" />
          </clipPath>
        </defs>
        <rect x={PAD_L} y={PAD_T} width={plotW} height={plotH} rx="10" className="plot-well" fill={`url(#${gradientId}-well)`} />
        <g className="graph-himalayas" clipPath={`url(#${gradientId}-clip)`} aria-hidden="true">
          <path d={himalayas.far} className="himalaya-far" />
          <path d={himalayas.mid} className="himalaya-mid" />
          <path d={himalayas.river} className="himalaya-river" />
        </g>
        <g className="graph-papein-waves" clipPath={`url(#${gradientId}-clip)`} aria-hidden="true">
          <path d={papein.waveBack} className="papein-wave-back" />
          <path d={papein.waveMid} className="papein-wave-mid" />
          <path d={papein.waveFront} className="papein-wave-front" />
          {/* Folded origami paper boat on waves */}
          <g className="papein-boat" transform={`translate(${papein.boatX}, ${papein.boatY})`}>
            <path d="M-22 4 L-10 16 L12 16 L24 4 Z" fill="#f2dec0" stroke="#8c5832" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M-10 4 L-2 -16 L-2 4 Z" fill="#fdfaf3" stroke="#8c5832" strokeWidth="1.1" strokeLinejoin="round" />
            <path d="M0 4 L14 -10 L0 -10 Z" fill="#edd0a4" stroke="#8c5832" strokeWidth="1.1" strokeLinejoin="round" />
            <path d="M-2 -16 L-2 -22 L6 -19 Z" fill="#b94b35" />
          </g>
          {/* Blooming Pink Lotus 1 */}
          <g className="papein-lotus lotus-1" transform={`translate(${papein.lotus1X}, ${papein.lotus1Y})`}>
            <ellipse cx="0" cy="4" rx="14" ry="4.5" fill="#3d7a46" opacity="0.65" />
            <path d="M-9 2 C-14 -4 -6 -10 0 -2 C6 -10 14 -4 9 2 Z" fill="#d9758f" />
            <path d="M-5 2 C-8 -2 -4 -6 0 0 C4 -6 8 -2 5 2 Z" fill="#fae6ea" />
            <circle cx="0" cy="-1" r="2.2" fill="#d99425" />
          </g>
          {/* Blooming Pink Lotus 2 */}
          <g className="papein-lotus lotus-2" transform={`translate(${papein.lotus2X}, ${papein.lotus2Y})`}>
            <ellipse cx="0" cy="3" rx="11" ry="3.8" fill="#3d7a46" opacity="0.65" />
            <path d="M-7 1 C-11 -3 -4 -8 0 -1 C4 -8 11 -3 7 1 Z" fill="#d9758f" />
            <path d="M-4 1 C-6 -2 -3 -5 0 0 C3 -5 6 -2 4 1 Z" fill="#fae6ea" />
            <circle cx="0" cy="-0.5" r="1.8" fill="#d99425" />
          </g>
          {/* Paper-cut Heron / Crane Bird */}
          <g className="papein-heron" transform={`translate(${papein.heronX}, ${papein.heronY})`}>
            <path d="M-1 14 L-2 36 M3 14 L4 36" stroke="#b97b45" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M-8 4 C-10 14 0 16 6 12 C10 8 8 2 2 -2 C-4 -4 -6 0 -8 4 Z" fill="#fffdfa" stroke="#8c5832" strokeWidth="0.9" />
            <path d="M2 -2 C6 -8 2 -16 6 -20 C8 -22 12 -22 14 -20" stroke="#fffdfa" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M14 -20 L24 -18" stroke="#d99425" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="12" cy="-20" r="1" fill="#402719" />
            <path d="M-4 3 C0 7 4 7 7 4" fill="none" stroke="#d4be9e" strokeWidth="1" />
          </g>
        </g>
        {DB_HAIR.map((db) => (
          <line
            key={`hair-${db}`}
            x1={PAD_L}
            x2={PAD_L + plotW}
            y1={yOf(db, size)}
            y2={yOf(db, size)}
            className="grid-hair"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {DB_LABELS.map((db) => (
          <g key={`db-${db}`}>
            <line
              x1={PAD_L}
              x2={PAD_L + plotW}
              y1={yOf(db, size)}
              y2={yOf(db, size)}
              className={db === 0 ? "grid-zero" : "grid-line"}
              vectorEffect="non-scaling-stroke"
            />
            {labelDb.has(db) ? (
              <text x={PAD_L - 6} y={yOf(db, size) + 3} className="axis-label" textAnchor="end">
                {db > 0 ? `+${db}` : db}
              </text>
            ) : null}
          </g>
        ))}
        {FREQ_MINOR.map((freq) => (
          <line
            key={`fmin-${freq}`}
            x1={xOf(freq, size)}
            x2={xOf(freq, size)}
            y1={PAD_T}
            y2={PAD_T + plotH}
            className="grid-minor"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {FREQ_MAJOR.map((freq) => (
          <g key={`fmaj-${freq}`}>
            <line
              x1={xOf(freq, size)}
              x2={xOf(freq, size)}
              y1={PAD_T}
              y2={PAD_T + plotH}
              className="grid-line"
              vectorEffect="non-scaling-stroke"
            />
            {labelFreqs.has(freq) ? (
              <text x={xOf(freq, size)} y={size.h - 6} className="axis-label" textAnchor="middle">
                {tickLabel(freq)}
              </text>
            ) : null}
          </g>
        ))}
        {/* EQ Response Curve */}
        <g clipPath={`url(#${gradientId}-clip)`}>
          {bypass
            ? null
            : bands.map((band, index) => {
                if (!band.enabled || band.gain === 0) return null;
                const bandSamples = sampleBand(band, 360);
                const color = palette.bands[index];
                return (
                  <g key={`band-${index}`}>
                    <path
                      d={fillPath(bandSamples, size)}
                      className="band-fill"
                      fill={color}
                      fillOpacity={palette.fillAlpha[index]}
                    />
                    <path
                      d={linePath(bandSamples, size)}
                      className={index === selected ? "band-stroke is-selected" : "band-stroke"}
                      stroke={color}
                      strokeOpacity={palette.strokeAlpha[index]}
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                );
              })}
          <line
            x1={PAD_L}
            x2={PAD_L + plotW}
            y1={yOf(0, size)}
            y2={yOf(0, size)}
            className="grid-zero"
            vectorEffect="non-scaling-stroke"
          />
          <path d={line} className="response-curve" style={{ stroke: palette.curve }} vectorEffect="non-scaling-stroke" />
        </g>
        {bands.map((band, index) => {
          if (bypass) return null;
          const cx = xOf(band.freq, size);
          const cy = yOf(band.gain, size);
          const active = index === selected;
          const color = palette.bands[index];
          return (
            <g
              key={`dot-${index}`}
              className={band.enabled ? "band-handle" : "band-handle off"}
              tabIndex={interactive ? 0 : -1}
              role="button"
              aria-label={`Band ${index + 1}, ${band.freq} hertz, ${band.gain} decibels`}
              onPointerDown={(event) => startDrag(index, event)}
              onKeyDown={(event: ReactKeyboardEvent<SVGGElement>) => {
                if (!interactive) return;
                if (event.key.startsWith("Arrow")) event.preventDefault();
                const coarse = event.shiftKey;
                const ratio = coarse ? 1.08 : 1.03;
                if (event.key === "ArrowLeft") onChange(index, band.freq / ratio, band.gain);
                if (event.key === "ArrowRight") onChange(index, band.freq * ratio, band.gain);
                if (event.key === "ArrowUp") onChange(index, band.freq, band.gain + (coarse ? 1 : 0.5));
                if (event.key === "ArrowDown") onChange(index, band.freq, band.gain - (coarse ? 1 : 0.5));
                if (event.key === "Enter" || event.key === " ") onSelect(index);
              }}
              onClick={() => onSelect(index)}
            >
              <circle cx={cx} cy={cy} r={13} className="band-hit" />
              <circle cx={cx} cy={cy} r={active ? 6.5 : 5.25} className="band-point" fill={color} />
              <text x={cx} y={cy} className="band-num">
                {index + 1}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

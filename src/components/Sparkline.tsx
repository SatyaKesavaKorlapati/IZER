import { useId } from "react";
import { sampleResponse } from "../eq/biquad";
import type { Band } from "../eq/types";

export function Sparkline({ bands }: { bands: Band[] }) {
  const gradientId = useId().replace(/:/g, "");
  const samples = sampleResponse(bands, 72);
  const width = 168;
  const height = 46;
  const coords = samples.map((point, index) => {
    const x = (index / (samples.length - 1)) * width;
    const y = ((12 - Math.max(-12, Math.min(12, point.db))) / 24) * height;
    return { x, y };
  });
  const line = coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const zero = ((12 - 0) / 24) * height;
  const fill = `${line} L${width},${zero.toFixed(1)} L0,${zero.toFixed(1)} Z`;
  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className="curve-stop-top" />
          <stop offset="100%" className="curve-stop-bottom" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#${gradientId})`} />
      <path d={line} className="spark-glow" />
      <path d={line} className="spark-line" />
    </svg>
  );
}

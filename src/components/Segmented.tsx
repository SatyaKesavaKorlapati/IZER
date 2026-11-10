import type { CSSProperties } from "react";

interface SegmentedProps<T extends string> {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
  disabled?: boolean;
}

export function Segmented<T extends string>({ value, options, onChange, label, disabled = false }: SegmentedProps<T>) {
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const style = { "--seg-count": options.length, "--seg-index": index } as CSSProperties;
  return (
    <div className={disabled ? "segmented is-disabled" : "segmented"} role="radiogroup" aria-label={label} style={style}>
      <span className="segment-thumb" aria-hidden="true" />
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={selected ? "segment on" : "segment"}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

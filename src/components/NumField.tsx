import { useEffect, useState } from "react";

interface NumFieldProps {
  label: string;
  value: number;
  textFor: (value: number) => string;
  parse: (text: string) => number | null;
  commit: (value: number) => void;
  nudge: (value: number, direction: 1 | -1, coarse: boolean) => number;
  min: number;
  max: number;
  suffix?: string;
  disabled?: boolean;
  compact?: boolean;
  /** Short visible caption. The accessible name stays `label`. */
  caption?: string;
}

export function NumField({
  label,
  value,
  textFor,
  parse,
  commit,
  nudge,
  min,
  max,
  suffix,
  disabled = false,
  compact = false,
  caption,
}: NumFieldProps) {
  const [text, setText] = useState(textFor(value));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(textFor(value));
    setInvalid(false);
  }, [value, textFor]);

  function commitText(nextText: string) {
    const parsed = parse(nextText);
    if (parsed == null || parsed < min || parsed > max) {
      setInvalid(true);
      setText(textFor(value));
      return;
    }
    setInvalid(false);
    commit(parsed);
  }

  return (
    <label className={invalid ? `num-field invalid${compact ? " compact" : ""}` : `num-field${compact ? " compact" : ""}`}>
      {compact ? null : <span>{caption ?? label}</span>}
      <span className="num-wrap">
        <input
          value={text}
          disabled={disabled}
          inputMode="decimal"
          aria-invalid={invalid}
          aria-label={label}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => {
            setText(event.target.value);
            setInvalid(false);
          }}
          onBlur={() => commitText(text)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitText(text);
            } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              const direction = event.key === "ArrowUp" ? 1 : -1;
              commit(nudge(value, direction, event.shiftKey));
            } else if (event.key === "Escape") {
              setText(textFor(value));
              setInvalid(false);
              event.currentTarget.blur();
            }
          }}
        />
        {suffix ? <em>{suffix}</em> : null}
      </span>
    </label>
  );
}

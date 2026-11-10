import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { builtInPresets, type Preset } from "../data/presets";
import { readPresetAliases } from "../lib/presetAliases";
import { useStore } from "../state/store";

export function PresetDisplayPill() {
  const store = useStore();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const aliases = useMemo(() => readPresetAliases(), [store.userPresets]);

  const allPresets = useMemo(() => {
    return [...store.userPresets, ...builtInPresets].map((preset) => {
      const alias = aliases.get(preset.id);
      return alias ? { ...preset, name: alias } : preset;
    });
  }, [aliases, store.userPresets]);

  useEffect(() => {
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, []);

  function handleSelect(preset: Preset) {
    store.applyPreset(preset);
    setOpen(false);
  }

  const currentDisplayName = store.active.name.trim() || "Default";

  return (
    <div className="preset-display-pill-wrap" ref={rootRef}>
      <div
        className={open ? "preset-display-pill open" : "preset-display-pill"}
        onClick={() => {
          if (store.editLocked) return;
          setOpen(!open);
        }}
        title={`Preset: ${currentDisplayName}. Click to choose`}
        role="button"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!store.editLocked) setOpen(!open);
          }
          if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      >
        <svg className="preset-folder-ico" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M1.5 3.5A1.5 1.5 0 0 1 3 2h2.879a1.5 1.5 0 0 1 1.06.44l1.122 1.12A1.5 1.5 0 0 0 9.12 4H13a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 13 14H3a1.5 1.5 0 0 1-1.5-1.5V3.5z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          />
        </svg>

        <div className="preset-pill-body">
          <span className="preset-pill-subtitle">Presets</span>
          {/* Non-editable rolling text */}
          <PresetRollingText text={currentDisplayName} />
        </div>
      </div>

      {open && !store.editLocked ? (
        <div className="preset-display-dropdown" role="listbox">
          <ul className="preset-display-results">
            {allPresets.map((preset) => {
              const isSelected = preset.name === store.active.name;
              return (
                <li key={preset.id}>
                  <button
                    type="button"
                    className={`preset-display-item ${isSelected ? "selected" : ""}`}
                    onClick={() => handleSelect(preset)}
                  >
                    <span className="preset-item-name">{preset.name}</span>
                    <span className="preset-item-category">{preset.category}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function PresetRollingText({ text }: { text: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    function measure() {
      if (containerRef.current && measureRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const textWidth = measureRef.current.scrollWidth;
        setOverflows(textWidth > containerWidth);
      }
    }
    measure();
    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [text]);

  const durationSec = Math.max(9, Math.round(text.length * 0.45));

  if (!overflows) {
    return (
      <div className="preset-marquee-wrap" ref={containerRef}>
        <span className="preset-marquee-static" ref={measureRef} title={text}>
          {text}
        </span>
      </div>
    );
  }

  return (
    <div className="preset-marquee-wrap overflowing" ref={containerRef} title={text}>
      {/* Hidden element for measuring exact width */}
      <span className="preset-marquee-measurer" ref={measureRef} aria-hidden="true">
        {text}
      </span>
      {/* Circular linked-list style infinite seamless ticker */}
      <div
        className="preset-marquee-track"
        style={{ animationDuration: `${durationSec}s` }}
      >
        <span className="preset-marquee-item">{text}</span>
        <span className="preset-marquee-spacer" aria-hidden="true">
          &nbsp;&nbsp;&nbsp;✦&nbsp;&nbsp;&nbsp;
        </span>
        <span className="preset-marquee-item" aria-hidden="true">
          {text}
        </span>
        <span className="preset-marquee-spacer" aria-hidden="true">
          &nbsp;&nbsp;&nbsp;✦&nbsp;&nbsp;&nbsp;
        </span>
      </div>
    </div>
  );
}

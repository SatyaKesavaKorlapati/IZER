import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { builtInPresets, presetsMatchingQuery, type Preset } from "../data/presets";
import { readPresetAliases } from "../lib/presetAliases";
import { useStore } from "../state/store";

export function TopQuickSearch() {
  const store = useStore();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const aliases = useMemo(() => readPresetAliases(), [store.userPresets]);

  const allPresets = useMemo(() => {
    return [...store.userPresets, ...builtInPresets].map((preset) => {
      const alias = aliases.get(preset.id);
      return alias ? { ...preset, name: alias } : preset;
    });
  }, [aliases, store.userPresets]);

  const matches = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return allPresets.slice(0, 10);
    }
    return presetsMatchingQuery(allPresets, trimmed).slice(0, 12);
  }, [allPresets, query]);

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
    store.setScreen("studio");
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlightIndex((prev) => (prev + 1) % Math.max(1, matches.length));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setHighlightIndex((prev) => (prev - 1 + matches.length) % Math.max(1, matches.length));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (matches.length > 0) {
        const target = matches[highlightIndex] ?? matches[0];
        handleSelect(target);
      }
    }
  }

  return (
    <div className="top-quick-search" ref={rootRef}>
      <label className="top-search-pill" title="Search and load presets to graph">
        <svg className="top-search-icon" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="7" cy="7" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10.2 10.2 13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          className="top-search-input"
          value={query}
          placeholder="Search presets…"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setHighlightIndex(0);
          }}
          onKeyDown={handleKeyDown}
        />
        {query ? (
          <button
            type="button"
            className="top-search-clear"
            aria-label="Clear search"
            tabIndex={-1}
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
          >
            ×
          </button>
        ) : null}
      </label>

      {open ? (
        <div className="top-search-dropdown" role="listbox">
          {matches.length === 0 ? (
            <div className="top-search-empty">No preset matches.</div>
          ) : (
            <ul className="top-search-results">
              {matches.map((preset, idx) => {
                const isSelected = preset.name === store.active.name;
                const isHighlighted = idx === highlightIndex;
                return (
                  <li key={preset.id}>
                    <button
                      type="button"
                      className={`top-search-hit ${isSelected ? "selected" : ""} ${
                        isHighlighted ? "highlighted" : ""
                      }`}
                      onClick={() => handleSelect(preset)}
                      onMouseEnter={() => setHighlightIndex(idx)}
                    >
                      <div className="top-search-hit-main">
                        <strong className="top-search-hit-name">{preset.name}</strong>
                        <span className="top-search-hit-cat">{preset.category}</span>
                      </div>
                      <span className="top-search-hit-load">Load</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

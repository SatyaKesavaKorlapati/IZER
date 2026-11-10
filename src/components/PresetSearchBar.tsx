import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { builtInPresets, presetsMatchingQuery, type Preset } from "../data/presets";
import { readPresetAliases } from "../lib/presetAliases";
import { useStore } from "../state/store";

export function PresetSearchBar() {
  const store = useStore();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
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
      return allPresets.slice(0, 15);
    }
    return presetsMatchingQuery(allPresets, trimmed).slice(0, 15);
  }, [allPresets, query]);

  useEffect(() => {
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setIsEditing(false);
        setQuery("");
      }
    }
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, []);

  function handleSelect(preset: Preset) {
    store.applyPreset(preset);
    setQuery("");
    setIsEditing(false);
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setIsEditing(false);
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

  const currentDisplayName = store.active.name.trim() || "Default";

  return (
    <div className="preset-search-pill-wrap" ref={rootRef}>
      <div
        className={open ? "preset-search-pill open" : "preset-search-pill"}
        onClick={() => {
          if (store.editLocked) return;
          setIsEditing(true);
          setOpen(true);
          inputRef.current?.focus();
        }}
        title={store.editLocked ? "Editor locked" : `Preset: ${currentDisplayName}. Click to search`}
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
          <input
            ref={inputRef}
            className="preset-pill-input"
            value={isEditing ? query : currentDisplayName}
            placeholder={store.editLocked ? "Locked" : "Search presets…"}
            disabled={store.editLocked}
            onFocus={() => {
              setIsEditing(true);
              setOpen(true);
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsEditing(true);
              setOpen(true);
              setHighlightIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
        </div>

        <button
          type="button"
          className="preset-chevron-btn"
          aria-label="Toggle preset list"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            if (store.editLocked) return;
            setOpen(!open);
            if (!open) {
              setIsEditing(true);
              inputRef.current?.focus();
            }
          }}
        >
          <svg className="preset-chevron-ico" viewBox="0 0 12 12" aria-hidden="true">
            <path
              d="M2.5 4.5 6 8l3.5-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {open && !store.editLocked ? (
        <div className="preset-search-dropdown" role="listbox">
          {matches.length === 0 ? (
            <div className="preset-search-empty">No presets found.</div>
          ) : (
            <ul className="preset-search-results">
              {matches.map((preset, idx) => {
                const isSelected = preset.name === store.active.name;
                const isHighlighted = idx === highlightIndex;
                return (
                  <li key={preset.id}>
                    <button
                      type="button"
                      className={`preset-search-item ${isSelected ? "selected" : ""} ${
                        isHighlighted ? "highlighted" : ""
                      }`}
                      onClick={() => handleSelect(preset)}
                      onMouseEnter={() => setHighlightIndex(idx)}
                    >
                      <span className="preset-item-name">{preset.name}</span>
                      <span className="preset-item-category">{preset.category}</span>
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

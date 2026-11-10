import { useEffect, useMemo, useRef, useState } from "react";
import { builtInPresets, presetsMatchingQuery } from "../data/presets";
import { readPresetAliases } from "../lib/presetAliases";
import { useStore } from "../state/store";

export function QuickPresetSearch() {
  const store = useStore();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const presets = useMemo(() => {
    const aliases = readPresetAliases();
    const list = [...store.userPresets, ...builtInPresets].map((preset) => {
      const alias = aliases.get(preset.id);
      return alias ? { ...preset, name: alias } : preset;
    });
    return presetsMatchingQuery(list, query).slice(0, 8);
  }, [query, store.userPresets]);

  useEffect(() => {
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, []);

  return (
    <div className="quick-search" ref={rootRef}>
      <label className="quick-search-field">
        <svg className="quick-search-icon" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="7" cy="7" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.2 10.2 13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="sr-only">Load a preset into the current slot</span>
        <input
          value={query}
          placeholder={store.editLocked ? "Unlock to load" : "Search presets"}
          disabled={store.editLocked}
          aria-expanded={open}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            if (event.key === "Enter" && presets[0] && !store.editLocked) {
              store.applyPreset(presets[0]);
              setQuery("");
              setOpen(false);
            }
          }}
        />
      </label>
      {open && !store.editLocked && query.trim() ? (
        <ul className="quick-search-list" role="listbox">
          {presets.length === 0 ? (
            <li className="quick-search-empty">No preset matches.</li>
          ) : (
            presets.map((preset) => (
              <li key={preset.id}>
                <button
                  type="button"
                  className="quick-search-hit"
                  onClick={() => {
                    store.applyPreset(preset);
                    setQuery("");
                    setOpen(false);
                    store.setScreen("studio");
                  }}
                >
                  <strong>{preset.name}</strong>
                  <span>{preset.category}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

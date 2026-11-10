import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { Modal } from "../components/Modal";
import { Dropdown } from "../components/Dropdown";
import type { Preset } from "../data/presets";
import { EqGraph } from "../components/Graph";
import { Sparkline } from "../components/Sparkline";
import { Segmented } from "../components/Segmented";
import { builtInPresets, presetsMatchingQuery } from "../data/presets";
import { sortPresets, type SortPresetMode } from "../lib/driveClient";
import { hidePresetFromLibrary, readHiddenPresetIds } from "../lib/hiddenPresets";
import { readFavoriteIds, removeFavorite, toggleFavorite } from "../lib/favorites";
import { clearPresetAlias, readPresetAliases, setPresetAlias } from "../lib/presetAliases";
import { presentPalette, readGraphPalette } from "../eq/palettes";
import { useStore } from "../state/store";
import { PresetTileArtwork } from "../components/PaperArtwork";

const PRESET_COLUMNS_KEY = "ja11-preset-columns";
const PRESET_SORT_KEY = "ja11-preset-sort";

function readPresetColumns(): 3 | 4 | 5 {
  try {
    const raw = localStorage.getItem(PRESET_COLUMNS_KEY);
    if (raw === "3" || raw === "4" || raw === "5") return Number(raw) as 3 | 4 | 5;
  } catch {
    /* this browser blocked storage */
  }
  return 3;
}

function readSortMode(): SortPresetMode {
  try {
    const raw = localStorage.getItem(PRESET_SORT_KEY);
    if (raw === "name-asc" || raw === "name-desc" || raw === "category" || raw === "favorites-first") return raw;
  } catch {
    /* this browser blocked storage */
  }
  return "favorites-first";
}

const SORT_OPTIONS: Array<{ value: SortPresetMode; label: string }> = [
  { value: "favorites-first", label: "Favorites first" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
  { value: "category", label: "Category" },
];

const CATEGORY_ORDER = [
  "All",
  "Reference",
  "Music",
  "Popular",
  "Voice",
  "Tone",
  "Device",
  "Kefine Loric",
  "Measurements",
  "My presets",
];

export function Presets() {
  const store = useStore();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState("All");
  const [target, setTarget] = useState("All targets");
  const [columns, setColumns] = useState<3 | 4 | 5>(readPresetColumns);
  const [sort, setSort] = useState<SortPresetMode>(readSortMode);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState(() => readFavoriteIds());
  const [hiddenIds, setHiddenIds] = useState(() => readHiddenPresetIds());
  const [selectedId, setSelectedId] = useState<string | null>(builtInPresets[0]?.id ?? null);
  const [deleteTarget, setDeleteTarget] = useState<Preset | null>(null);
  const [renameTarget, setRenameTarget] = useState<Preset | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [aliases, setAliases] = useState(() => readPresetAliases());
  const renameRef = useRef<HTMLInputElement>(null);

  const builtInById = useMemo(() => new Map(builtInPresets.map((preset) => [preset.id, preset])), []);

  useEffect(() => {
    try {
      localStorage.setItem(PRESET_COLUMNS_KEY, String(columns));
    } catch {
      /* this browser blocked storage */
    }
  }, [columns]);

  useEffect(() => {
    try {
      localStorage.setItem(PRESET_SORT_KEY, sort);
    } catch {
      /* this browser blocked storage */
    }
  }, [sort]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (renameTarget) renameRef.current?.focus();
  }, [renameTarget]);

  function isUserPreset(preset: Preset): boolean {
    return preset.origin === "user" || store.userPresets.some((item) => item.id === preset.id);
  }

  function labelPreset(preset: Preset): Preset {
    if (isUserPreset(preset)) return preset;
    const alias = aliases.get(preset.id);
    return alias ? { ...preset, name: alias } : preset;
  }

  const presets = useMemo(
    () => [...store.userPresets, ...builtInPresets].map(labelPreset),
    // labelPreset reads aliases + userPresets via closure
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.userPresets, aliases],
  );
  const targets = useMemo(() => {
    const names = new Set<string>();
    for (const preset of presets) names.add(preset.target);
    const preferred = ["Generic", "Kefine Loric"].filter((name) => names.has(name));
    const rest = [...names].filter((name) => !preferred.includes(name)).sort((a, b) => a.localeCompare(b));
    return ["All targets", ...preferred, ...rest];
  }, [presets]);

  const visible = useMemo(() => {
    const scoped = presets.filter((preset) => {
      if (hiddenIds.has(preset.id)) return false;
      if (category !== "All" && preset.category !== category) return false;
      if (target !== "All targets" && preset.target !== target) return false;
      if (favoritesOnly && !favoriteIds.has(preset.id)) return false;
      return true;
    });
    const matched = presetsMatchingQuery(scoped, query);
    return sortPresets(matched, sort, favoriteIds);
  }, [presets, category, target, query, sort, favoriteIds, favoritesOnly, hiddenIds]);
  const selected = presets.find((preset) => preset.id === selectedId) ?? visible[0] ?? null;

  function onFavorite(id: string, event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    setFavoriteIds(toggleFavorite(id));
  }

  function confirmDelete(preset: Preset) {
    if (isUserPreset(preset)) {
      store.deleteUserPreset(preset.id);
    } else {
      setHiddenIds(hidePresetFromLibrary(preset.id));
    }
    setFavoriteIds(removeFavorite(preset.id));
    if (selectedId === preset.id) {
      const next = visible.find((item) => item.id !== preset.id);
      setSelectedId(next?.id ?? builtInPresets[0]?.id ?? null);
    }
    setDeleteTarget(null);
  }

  function openRename(preset: Preset) {
    setRenameTarget(preset);
    setRenameDraft(preset.name);
  }

  function confirmRename() {
    if (!renameTarget) return;
    const trimmed = renameDraft.trim();
    if (!trimmed) return;
    if (isUserPreset(renameTarget)) {
      store.renameUserPreset(renameTarget.id, trimmed);
    } else {
      const original = builtInById.get(renameTarget.id)?.name;
      if (original === trimmed) setAliases(clearPresetAlias(renameTarget.id));
      else setAliases(setPresetAlias(renameTarget.id, trimmed));
    }
    setRenameTarget(null);
    setRenameDraft("");
  }

  return (
    <section className="screen">
      <header className="screen-head presets-head">
        <div>
          <p className="eyebrow">Presets</p>
          <h1>Library</h1>
          <p className="lede library-count">
            {builtInPresets.filter((preset) => preset.origin === "original").length} original ·{" "}
            {builtInPresets.filter((preset) => preset.origin === "extracted").length} measured · {store.userPresets.length}{" "}
            yours · {favoriteIds.size} favorites
          </p>
        </div>
      </header>

      <div className="card toolbar-card library-toolbar">
        <div className="library-toolbar-row">
          <div className="search-toggle">
            <button
              type="button"
              className={searchOpen || query ? "icon-btn on" : "icon-btn"}
              aria-label={searchOpen ? "Close search" : "Search presets"}
              aria-expanded={searchOpen}
              aria-controls="preset-search"
              onClick={() => setSearchOpen((open) => !open)}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <circle cx="8.5" cy="8.5" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="M12.5 12.5 17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
            {searchOpen ? (
              <input
                id="preset-search"
                ref={searchRef}
                value={query}
                placeholder="Search EQ"
                aria-label="Search EQ"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setSearchOpen(false);
                }}
              />
            ) : null}
          </div>
          <Dropdown label="Sort" value={sort} options={SORT_OPTIONS} onChange={(value) => setSort(value as SortPresetMode)} />
          <Dropdown
            label="Target"
            value={target}
            options={targets.map((name) => ({ value: name, label: name }))}
            onChange={setTarget}
          />
          <div className="preset-density">
            <span>Layout</span>
            <Segmented
              label="Presets per row"
              value={String(columns)}
              options={[
                { value: "3", label: "3" },
                { value: "4", label: "4" },
                { value: "5", label: "5" },
              ]}
              onChange={(value) => setColumns(Number(value) as 3 | 4 | 5)}
            />
          </div>
          <button
            type="button"
            className={favoritesOnly ? "chip on" : "chip"}
            aria-pressed={favoritesOnly}
            onClick={() => setFavoritesOnly((on) => !on)}
          >
            Favorites only
          </button>
        </div>
      </div>

      <div className="chips" role="tablist" aria-label="Preset category">
        {CATEGORY_ORDER.map((item) => (
          <button
            key={item}
            type="button"
            className={item === category ? "chip on" : "chip"}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {selected ? (
        <div className="card detail-card">
          <div className="detail-copy">
            <p className="eyebrow">{selected.category}</p>
            <h2>{selected.name}</h2>
            <p>{selected.description}</p>
            <p className="meta">
              {selected.author}
              {selected.kind ? ` · ${selected.kind}` : ""}
            </p>
            <div className="badges">
              {selected.fitsJa11 ? <span className="badge ok">5-band</span> : <span className="badge">Needs review</span>}
              {selected.subsetNote ? <span className="badge warn">{selected.subsetNote}</span> : null}
              {favoriteIds.has(selected.id) ? <span className="badge ok">Favorite</span> : null}
            </div>
            {selected.importNotes?.length ? (
              <ul className="note-list">
                {selected.importNotes.slice(0, 3).map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
            <div className="detail-actions">
              <button type="button" className="btn btn-primary" onClick={() => store.applyPreset(selected)}>
                Apply
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setFavoriteIds(toggleFavorite(selected.id))}
              >
                {favoriteIds.has(selected.id) ? "Unfavorite" : "Favorite"}
              </button>
              {selected.sourceText ? (
                <button type="button" className="btn btn-ghost" onClick={() => store.openImport(selected.sourceText ?? "")}>
                  Review all filters
                </button>
              ) : null}
              {selected.sourceUrl ? (
                <a className="text-link" href={selected.sourceUrl} target="_blank" rel="noreferrer">
                  Source
                </a>
              ) : null}
              <button type="button" className="btn btn-ghost" onClick={() => openRename(selected)}>
                Rename
              </button>
              <button type="button" className="btn btn-ghost btn-delete" onClick={() => setDeleteTarget(selected)}>
                Delete
              </button>
            </div>
          </div>
          <EqGraph
            bands={selected.eq.bands}
            selected={0}
            interactive={false}
            palette={presentPalette(readGraphPalette(), store.theme, store.dark)}
            onSelect={() => undefined}
            onChange={() => undefined}
          />
        </div>
      ) : null}

      {visible.length === 0 ? (
        <div className="card empty-card">
          <h2>Nothing matches</h2>
          <p>
            {category === "My presets"
              ? "No presets saved on this computer yet. Use Save to library in Studio."
              : "Try another category, target, sort, or a shorter search."}
          </p>
        </div>
      ) : (
        <div className="preset-grid" style={{ "--preset-cols": columns } as CSSProperties}>
          {visible.map((preset, index) => (
            <article key={preset.id} className={preset.id === selected?.id ? "preset-card selected" : "preset-card"}>
              <PresetTileArtwork preset={preset} index={index} />
              <div className="preset-card-top">
                <button
                  type="button"
                  className={favoriteIds.has(preset.id) ? "fav-btn on" : "fav-btn"}
                  aria-label={favoriteIds.has(preset.id) ? "Remove from favorites" : "Add to favorites"}
                  onClick={(event) => onFavorite(preset.id, event)}
                >
                  ★
                </button>
                <button type="button" className="card-select" onClick={() => setSelectedId(preset.id)}>
                  <strong>{preset.name}</strong>
                  <span className="card-copy">{preset.description}</span>
                  <Sparkline bands={preset.eq.bands} />
                </button>
              </div>
              <div className="preset-foot">
                <span className="badges">
                  {preset.fitsJa11 ? <span className="badge ok">5-band</span> : <span className="badge">Needs review</span>}
                  {preset.subsetNote ? <span className="badge warn">Subset</span> : null}
                </span>
                <div className="preset-foot-actions">
                  <button type="button" className="btn btn-ghost preset-rename-btn" onClick={() => openRename(preset)}>
                    Rename
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-delete preset-delete-btn"
                    onClick={() => setDeleteTarget(preset)}
                  >
                    Delete
                  </button>
                  <button type="button" className="apply-link" onClick={() => store.applyPreset(preset)}>
                    Apply →
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={renameTarget != null} title="Rename preset" onClose={() => setRenameTarget(null)}>
        <p className="stack-field">
          <label htmlFor="preset-rename-input">
            {renameTarget && isUserPreset(renameTarget)
              ? "Name saved with this curve on this computer."
              : "Display name on this computer. The built-in file in the app stays the same."}
          </label>
          <input
            id="preset-rename-input"
            ref={renameRef}
            value={renameDraft}
            maxLength={80}
            onChange={(event) => setRenameDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") confirmRename();
              if (event.key === "Escape") setRenameTarget(null);
            }}
          />
        </p>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setRenameTarget(null)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!renameDraft.trim()}
            onClick={() => confirmRename()}
          >
            Save name
          </button>
        </div>
      </Modal>

      <Modal
        open={deleteTarget != null}
        title="Delete preset?"
        onClose={() => setDeleteTarget(null)}
      >
        <p>
          {deleteTarget && isUserPreset(deleteTarget) ? (
            <>
              Permanently remove <strong>{deleteTarget.name}</strong> from your saved presets on this computer? This does not
              change the DAC.
            </>
          ) : (
            <>
              Remove <strong>{deleteTarget?.name}</strong> from the library on this computer? The factory file stays in the app;
              you can restore it by clearing browser data for this site.
            </>
          )}
        </p>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-delete"
            onClick={() => deleteTarget && confirmDelete(deleteTarget)}
          >
            Delete
          </button>
        </div>
      </Modal>
    </section>
  );
}

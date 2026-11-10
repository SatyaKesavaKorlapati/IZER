import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { PresetDisplayPill } from "../components/PresetDisplayPill";
import { DacReading } from "../components/DacReadout";
import { Dropdown } from "../components/Dropdown";
import { EqGraph } from "../components/Graph";
import { Modal } from "../components/Modal";
import { NumField } from "../components/NumField";
import { Toggle } from "../components/Toggle";
import { formatFreq, formatGain, formatQ, formatSigned, nudgeFreq, nudgeGain, nudgeQ, parseDecimal, parseFreq } from "../eq/format";
import { presentPalette, readGraphPalette } from "../eq/palettes";
import { effectivePreamp, largestEnabledBoost, GAIN_MAX, GAIN_MIN, Q_MAX, Q_MIN, FREQ_MAX, FREQ_MIN, type FilterType } from "../eq/types";
import { ja11EqOffTarget } from "../lib/hid";
import { TILE_GAP, TILE_MIN, readTileWidth } from "../lib/tiles";
import { useStore } from "../state/store";
import { BandCardArtwork, PapeinCardOrnament } from "../components/PaperArtwork";

const TYPES: Array<{ value: FilterType; label: string }> = [
  { value: "pk", label: "Bell" },
  { value: "ls", label: "Low shelf" },
  { value: "hs", label: "High shelf" },
];

function fitTiles(available: number, preferred: number): number {
  if (available <= 0) return preferred;
  const room = available - TILE_GAP * 4;
  const share = Math.floor(room / 5);
  if (share >= preferred) return preferred;
  return Math.max(TILE_MIN, share);
}

function gainTrack(gain: number): string {
  const pct = ((gain - GAIN_MIN) / (GAIN_MAX - GAIN_MIN)) * 100;
  const edge = "color-mix(in srgb, var(--band) 26%, transparent)";
  const hue = "var(--band)";
  if (pct >= 50) {
    return `linear-gradient(90deg, ${edge} 0%, ${edge} 50%, ${hue} 50%, ${hue} ${pct}%, ${edge} ${pct}%, ${edge} 100%)`;
  }
  return `linear-gradient(90deg, ${edge} 0%, ${edge} ${pct}%, ${hue} ${pct}%, ${hue} 50%, ${edge} 50%, ${edge} 100%)`;
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

export function Studio() {
  const store = useStore();
  const shown = store.preview;
  const locked = store.editLocked;
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryName, setLibraryName] = useState(shown.name);
  const [resetting, setResetting] = useState(false);
  const [tileWidth] = useState(readTileWidth);
  const [fitted, setFitted] = useState(tileWidth);
  const rowRef = useRef<HTMLDivElement>(null);
  const lastPreampRef = useRef<number>(-5.6);
  const palette = presentPalette(readGraphPalette(), store.theme, store.dark);
  const writesDac = store.device.phase === "connected" && ja11EqOffTarget(store.device.identity);
  const saveDacTitle = store.canWriteDac
    ? "Write active curve to DAC flash memory. The dongle may disconnect and reconnect."
    : store.dacActionReason;

  const resetLabel = writesDac
    ? "Factory reset. Sends the documented EQ off command to the DAC."
    : "Factory reset. The DAC was not written.";

  const note =
    `48 kHz RBJ preview, filters only, from 20 Hz to 20 kHz. Level match sits on top of this curve: ${formatSigned(effectivePreamp(shown))}. Drag a point to set frequency and gain. Arrow keys nudge a focused point.`;
  const boosted = shown.autoPreamp && largestEnabledBoost(shown.bands) > 0;

  const currentPreamp = effectivePreamp(shown);
  const levelMatchActive = shown.autoPreamp || currentPreamp !== 0;

  function toggleLevelMatch(checked: boolean) {
    if (locked) return;
    if (!checked) {
      if (currentPreamp !== 0) {
        lastPreampRef.current = currentPreamp;
      }
      store.setAutoPreamp(false);
      store.setPreamp(0);
    } else {
      store.setPreamp(lastPreampRef.current || -5.6);
    }
  }

  function handleDeletePreset() {
    if (locked) return;
    const userMatch = store.userPresets.find(
      (p) => p.name.trim().toLowerCase() === store.active.name.trim().toLowerCase(),
    );
    if (userMatch) {
      store.deleteUserPreset(userMatch.id);
    } else {
      store.resetUser1();
    }
  }

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const measure = () => setFitted(fitTiles(row.clientWidth, tileWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [tileWidth]);

  return (
    <section className="screen studio-screen">
      <div className="card plot-card">
        <h1 className="sr-only">Five-band USER1</h1>

        {/* PORTION ABOVE THE GRAPH: EXACT TWO-ROW LAYOUT FROM REFERENCE IMAGE */}
        <div className="studio-top-toolbar">
          {/* ROW 1 */}
          <div className="toolbar-row toolbar-row-top">
            <div className="toolbar-cluster-left">
              {/* Presets Default Display Pill with horizontal expansion and seamless rolling marquee */}
              <PresetDisplayPill />

              {/* Save, Copy, Delete action icons */}
              <button
                type="button"
                className="toolbar-round-icon-btn"
                disabled={locked}
                title="Save preset to library"
                onClick={() => {
                  setLibraryName(store.active.name);
                  setLibraryOpen(true);
                }}
              >
                <SaveDiskIcon />
              </button>
              <button
                type="button"
                className="toolbar-round-icon-btn"
                disabled={locked}
                title="Copy preset EQ"
                onClick={store.copyEq}
              >
                <CopyDocIcon />
              </button>
              <button
                type="button"
                className="toolbar-round-icon-btn"
                disabled={locked}
                title="Delete preset or reset to flat"
                onClick={handleDeletePreset}
              >
                <TrashIcon />
              </button>

              {/* A/B compare capsule */}
              <div className="ab-hear-group" role="group" aria-label="A B compare">
                <span className="toolbar-tag-muted">A/B</span>
                <div className="ab-capsule">
                  <button
                    type="button"
                    className={store.ab === "A" ? "ab-tab active" : "ab-tab"}
                    aria-pressed={store.ab === "A"}
                    title="Load stored curve A"
                    onClick={() => void store.hearSide("A")}
                  >
                    A
                  </button>
                  <button
                    type="button"
                    className={store.ab === "B" ? "ab-tab active" : "ab-tab"}
                    aria-pressed={store.ab === "B"}
                    title="Load stored curve B"
                    onClick={() => void store.hearSide("B")}
                  >
                    B
                  </button>
                </div>
              </div>

              {/* Set: [A] [B] */}
              <div className="set-side-group" role="group" aria-label="Store A or B">
                <span className="toolbar-tag-muted">Set:</span>
                <button
                  type="button"
                  className="set-pill-btn"
                  disabled={locked}
                  title={locked ? "Unlock to store A" : "Store current curve as A"}
                  onClick={() => store.storeSide("A")}
                >
                  A
                </button>
                <button
                  type="button"
                  className="set-pill-btn"
                  disabled={locked}
                  title={locked ? "Unlock to store B" : "Store current curve as B"}
                  onClick={() => store.storeSide("B")}
                >
                  B
                </button>
              </div>

              {/* Match: [ Factory v ] */}
              <MatchDropdown disabled={locked} />

              {/* Level Match [Toggle] [-5.6 dB] */}
              <div className="level-match-section">
                <span className="toolbar-label-white">Level Match</span>
                <Toggle
                  label="Level Match Toggle"
                  checked={levelMatchActive}
                  disabled={locked}
                  onChange={toggleLevelMatch}
                />
                <NumField
                  compact
                  label="Level match gain"
                  value={currentPreamp}
                  textFor={formatGain}
                  parse={parseDecimal}
                  min={GAIN_MIN}
                  max={GAIN_MAX}
                  suffix="dB"
                  disabled={locked || shown.autoPreamp || !levelMatchActive}
                  nudge={nudgeGain}
                  commit={store.setPreamp}
                />
              </div>

              {/* Auto [Toggle] */}
              <div className="auto-match-section">
                <span className="toolbar-label-white">Auto</span>
                <Toggle
                  label="Auto level match"
                  checked={shown.autoPreamp}
                  disabled={locked}
                  onChange={store.setAutoPreamp}
                />
              </div>
            </div>

            {/* Right group: Undo, Redo, Sparkle, Info, Fullscreen */}
            <div className="toolbar-cluster-right">
              <button
                type="button"
                className="toolbar-round-btn"
                disabled={locked || !store.canUndo}
                title="Undo edit (Ctrl+Z)"
                onClick={store.undoEdit}
              >
                <UndoIcon />
              </button>
              <button
                type="button"
                className="toolbar-round-btn"
                disabled={locked || !store.canRedo}
                title="Redo edit (Ctrl+Y)"
                onClick={store.redoEdit}
              >
                <RedoIcon />
              </button>
              <button
                type="button"
                className="toolbar-round-btn"
                disabled={locked}
                title="Auto level match and factory headroom"
                onClick={() => void store.matchFactory()}
              >
                <SparkleIcon />
              </button>
              <StudioInfo note={note} listenReason={store.dacActionReason} />
              <button
                type="button"
                className="toolbar-round-btn"
                title="Toggle fullscreen"
                onClick={toggleFullscreen}
              >
                <FullscreenIcon />
              </button>
            </div>
          </div>

          {/* ROW 2 */}
          <div className="toolbar-row toolbar-row-bottom">
            <div className="toolbar-cluster-left">
              {/* Slot circle selector: (1) ((2)) (3) (4) */}
              <div className="slot-ring-group" role="group" aria-label="Slot selection">
                {(["1", "2", "3", "4"] as const).map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={store.activeSlot === id ? "slot-ring-btn active" : "slot-ring-btn"}
                    aria-pressed={store.activeSlot === id}
                    title={`Slot ${id}`}
                    onClick={() => store.selectSlot(id)}
                  >
                    {id}
                  </button>
                ))}
              </div>

              {/* Mode switch: [ ~ Static | ılı Live ] */}
              <div className="mode-capsule" role="radiogroup" aria-label="DAC mode">
                <button
                  type="button"
                  role="radio"
                  aria-checked={store.dacMode === "static"}
                  className={store.dacMode === "static" ? "mode-tab active" : "mode-tab"}
                  onClick={() => store.setDacMode("static")}
                >
                  <WaveIcon />
                  <span>Static</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={store.dacMode === "live"}
                  className={store.dacMode === "live" ? "mode-tab active" : "mode-tab"}
                  onClick={() => store.setDacMode("live")}
                >
                  <BarsIcon />
                  <span>Live</span>
                </button>
              </div>

              {/* Status caption: ⓘ Slot 2 is static. Nothing is sent to the DAC. */}
              <div className="slot-status-phrase">
                <svg className="slot-phrase-ico" viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="8" cy="8" r="6.8" fill="none" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M8 7v4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  <circle cx="8" cy="4.8" r="0.75" fill="currentColor" />
                </svg>
                <span>
                  {store.dacMode === "live"
                    ? `Slot ${store.activeSlot} is live. Edits go to an open DAC. Flash waits for Save to DAC.`
                    : `Slot ${store.activeSlot} is static. Nothing is sent to the DAC.`}
                </span>
              </div>
            </div>

            {/* Right group: Lock, Copy, Paste, Reset, Read from DAC, Save to DAC */}
            <div className="toolbar-cluster-right">
              <button
                type="button"
                className={store.editLocked ? "action-pill-btn locked" : "action-pill-btn"}
                aria-label={store.editLocked ? "Unlock editing" : "Lock editing"}
                title={store.editLocked ? "Unlock editing" : "Lock editing"}
                onClick={() => store.setEditLocked(!store.editLocked)}
              >
                <LockIcon locked={store.editLocked} />
                <span>{store.editLocked ? "Unlock" : "Lock"}</span>
              </button>

              <button
                type="button"
                className="action-pill-btn"
                disabled={locked}
                title="Copy EQ to clipboard"
                onClick={store.copyEq}
              >
                <CopyPillIcon />
                <span>Copy</span>
              </button>

              <button
                type="button"
                className="action-pill-btn"
                disabled={locked || !store.canPaste}
                title="Paste EQ from clipboard"
                onClick={store.pasteEq}
              >
                <PastePillIcon />
                <span>Paste</span>
              </button>

              <button
                type="button"
                className="action-pill-btn"
                disabled={resetting}
                title={resetLabel}
                onClick={() => {
                  setResetting(true);
                  void store.factoryReset().finally(() => setResetting(false));
                }}
              >
                <ResetPillIcon />
                <span>Reset</span>
              </button>

              <button
                type="button"
                className="action-pill-btn"
                disabled={!store.canWriteDac}
                title={store.canWriteDac ? "Read EQ currently on the DAC" : store.dacActionReason}
                onClick={() => void store.readFromDac()}
              >
                <ReadDacIcon />
                <span>Read from DAC</span>
              </button>

              <button
                type="button"
                className="action-pill-btn primary-save-btn"
                disabled={!store.canWriteDac || store.dacMode !== "live"}
                title={saveDacTitle}
                onClick={() => void store.saveToDac()}
              >
                <SaveDacIcon />
                <span>Save to DAC</span>
              </button>
            </div>
          </div>
        </div>

        {boosted ? (
          <p className="level-headroom">
            A boosted curve is quieter because the DAC keeps 12 dB of headroom and the biggest boost uses part of it.
          </p>
        ) : null}
        <DacReading />
        <EqGraph
          bands={shown.bands}
          selected={store.selectedBand}
          interactive={!locked}
          bypass={false}
          palette={palette}
          onSelect={store.setSelectedBand}
          onChange={(index, freq, gain) => store.updateBand(index, { freq, gain })}
        />
      </div>

      <div className="band-dock">
        <div className="band-scroll" ref={rowRef}>
          <div className="band-row" style={{ "--tile-w": `${fitted}px` } as CSSProperties}>
            {shown.bands.map((band, index) => {
              const wash = Math.round(22 + palette.fillAlpha[index] * 48);
              return (
                <article
                  key={index}
                  className={index === store.selectedBand && !locked ? "band-card selected" : "band-card"}
                  style={{ "--band": palette.bands[index], "--wash": wash } as CSSProperties}
                  onClick={() => store.setSelectedBand(index)}
                >
                  <BandCardArtwork bandIndex={index} />
                  {store.theme === "papein" ? <PapeinCardOrnament bandIndex={index} /> : null}
                  <div className="band-card-top">
                    <span className="band-index">{index + 1}</span>
                    <Dropdown
                      label={`Band ${index + 1} filter`}
                      value={band.type}
                      options={TYPES}
                      disabled={locked}
                      onChange={(type) => store.updateBand(index, { type })}
                    />
                    <button
                      type="button"
                      className={band.enabled ? "band-power on" : "band-power"}
                      disabled={locked}
                      aria-pressed={band.enabled}
                      onClick={(event) => {
                        event.stopPropagation();
                        store.updateBand(index, { enabled: !band.enabled });
                      }}
                    >
                      {band.enabled ? "ON" : "OFF"}
                    </button>
                  </div>
                  <div className="band-field">
                    <span>Freq</span>
                    <NumField
                      compact
                      label={`Band ${index + 1} frequency`}
                      value={band.freq}
                      textFor={formatFreq}
                      parse={parseFreq}
                      min={FREQ_MIN}
                      max={FREQ_MAX}
                      disabled={locked}
                      nudge={nudgeFreq}
                      commit={(freq) => store.updateBand(index, { freq })}
                    />
                  </div>
                  <div className="band-field band-gain">
                    <span>Gain</span>
                    <input
                      className="gain-slider"
                      type="range"
                      min={GAIN_MIN}
                      max={GAIN_MAX}
                      step={0.1}
                      value={band.gain}
                      disabled={locked}
                      aria-label={`Band ${index + 1} gain`}
                      aria-valuemin={GAIN_MIN}
                      aria-valuemax={GAIN_MAX}
                      aria-valuenow={band.gain}
                      style={{ "--gain-track": gainTrack(band.gain) } as CSSProperties}
                      onChange={(event) => store.updateBand(index, { gain: Number(event.target.value) })}
                    />
                    <NumField
                      compact
                      label={`Band ${index + 1} gain value`}
                      value={band.gain}
                      textFor={formatGain}
                      parse={parseDecimal}
                      min={GAIN_MIN}
                      max={GAIN_MAX}
                      disabled={locked}
                      nudge={nudgeGain}
                      commit={(gain) => store.updateBand(index, { gain })}
                    />
                  </div>
                  <div className="band-field">
                    <span>Q</span>
                    <NumField
                      compact
                      label={`Band ${index + 1} Q`}
                      value={band.q}
                      textFor={formatQ}
                      parse={parseDecimal}
                      min={Q_MIN}
                      max={Q_MAX}
                      disabled={locked}
                      nudge={nudgeQ}
                      commit={(q) => store.updateBand(index, { q })}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      <Modal open={store.confirmOpen} title="Save curve on this computer?" onClose={store.cancelSave}>
        <p>This writes the editor into local storage. The DAC is not updated, even if one is connected.</p>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={store.cancelSave}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={store.confirmSave}>
            Save
          </button>
        </div>
      </Modal>

      <Modal open={libraryOpen} title="Save preset" onClose={() => setLibraryOpen(false)}>
        <p>Saves this curve in My presets on this computer. The DAC is not written.</p>
        <label className="stack-field">
          <span>Name</span>
          <input
            value={libraryName}
            autoFocus
            onChange={(event) => setLibraryName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              const name = libraryName.trim();
              if (!name) return;
              store.saveToLibrary(name);
              setLibraryOpen(false);
            }}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setLibraryOpen(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              const name = libraryName.trim();
              if (!name) return;
              store.saveToLibrary(name);
              setLibraryOpen(false);
            }}
          >
            Save
          </button>
        </div>
      </Modal>
    </section>
  );
}

function MatchDropdown({ disabled }: { disabled?: boolean }) {
  const store = useStore();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<"Factory" | "Flat">("Factory");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointer(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, []);

  return (
    <div className="match-dropdown-container" ref={rootRef}>
      <span className="toolbar-tag-muted">Match:</span>
      <div className="match-dropdown-anchor">
        <button
          type="button"
          className="match-select-pill"
          disabled={disabled}
          onClick={() => setOpen(!open)}
          title="Match curve headroom or reset"
        >
          <span>{selected}</span>
        </button>
        {open && !disabled ? (
          <ul className="match-menu-list" role="menu">
            <li>
              <button
                type="button"
                className={selected === "Factory" ? "match-menu-btn active" : "match-menu-btn"}
                onClick={() => {
                  setSelected("Factory");
                  setOpen(false);
                  void store.matchFactory();
                }}
              >
                Factory
              </button>
            </li>
            <li>
              <button
                type="button"
                className={selected === "Flat" ? "match-menu-btn active" : "match-menu-btn"}
                onClick={() => {
                  setSelected("Flat");
                  setOpen(false);
                  store.resetUser1();
                }}
              >
                Flat
              </button>
            </li>
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function StudioInfo({ note, listenReason }: { note: string; listenReason: string }) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const popId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function place() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(340, window.innerWidth - 24);
    let left = rect.left;
    if (left + width > window.innerWidth - 12) left = window.innerWidth - 12 - width;
    if (left < 12) left = 12;
    setBox({ top: rect.bottom + 8, left });
  }

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    place();
    setOpen(true);
  }

  const pop =
    open && box
      ? createPortal(
          <div
            ref={popRef}
            id={popId}
            className="dropdown-menu plot-info-pop"
            role="dialog"
            aria-label="Editor notes"
            style={{ top: box.top, left: box.left }}
          >
            <button
              type="button"
              className="menu-close"
              aria-label="Close editor notes"
              title="Close"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => {
                setOpen(false);
                buttonRef.current?.focus();
              }}
            >
              <span aria-hidden="true">×</span>
              Close
            </button>
            <p>{note}</p>
            <p>{listenReason}</p>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="toolbar-info-wrap" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={open ? "toolbar-round-btn open" : "toolbar-round-btn"}
        aria-label="Editor notes"
        aria-expanded={open}
        aria-controls={popId}
        title="Preview and device notes"
        onClick={toggle}
      >
        <HelpQuestionIcon />
      </button>
      {pop}
    </div>
  );
}

function SaveDiskIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 2.5h7.2l2.8 2.8v8.2H3z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M5 2.5v3.2h4.5M5.2 13.5V9.5h5.6v4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function CopyDocIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="5.2" y="4.5" width="7.6" height="9" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10.8 4.5V3a1.4 1.4 0 0 0-1.4-1.4H3.6A1.4 1.4 0 0 0 2.2 3v7a1.4 1.4 0 0 0 1.4 1.4H5.2" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2.5 4.5h11M6 4.5V2.8a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.7M4.2 4.5l.8 9a1.5 1.5 0 0 0 1.5 1.4h3a1.5 1.5 0 0 0 1.5-1.4l.8-9" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 7.5v4.5M9.5 7.5v4.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.2 7.2A5 5 0 1 1 4.2 11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M3 3.8v3.6h3.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M12.8 7.2A5 5 0 1 0 11.8 11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M13 3.8v3.6H9.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 1.5l1.6 3.8 3.9 1.7-3.9 1.7L8 12.5l-1.6-3.8-3.9-1.7 3.9-1.7L8 1.5z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="13" cy="3" r="0.75" fill="currentColor" />
      <circle cx="3" cy="13" r="0.75" fill="currentColor" />
    </svg>
  );
}

function HelpQuestionIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6.2 6.2a2 2 0 0 1 3.4 1.4c0 1.2-1.6 1.4-1.6 2.6" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8" cy="12.2" r="0.8" fill="currentColor" />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2.5 5.5v-3h3M10.5 2.5h3v3M13.5 10.5v3h-3M5.5 13.5h-3v-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon({ locked }: { locked: boolean }) {
  if (locked) {
    return (
      <svg className="action-pill-ico" viewBox="0 0 16 16" aria-hidden="true">
        <rect x="3.2" y="7" width="9.6" height="6.5" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M5.2 7V5.2a2.8 2.8 0 0 1 5.6 0V7" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg className="action-pill-ico" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3.2" y="7" width="9.6" height="6.5" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.2 7V4.8a2.8 2.8 0 0 1 5.2-1.2" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function CopyPillIcon() {
  return (
    <svg className="action-pill-ico" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="5.2" y="4.5" width="7.6" height="9" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10.8 4.5V3a1.4 1.4 0 0 0-1.4-1.4H3.6A1.4 1.4 0 0 0 2.2 3v7a1.4 1.4 0 0 0 1.4 1.4H5.2" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function PastePillIcon() {
  return (
    <svg className="action-pill-ico" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3.2" y="3.6" width="9.6" height="10" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6 3.6V2.6A1 1 0 0 1 7 1.6h2a1 1 0 0 1 1 1v1" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M5.6 7.8h4.8M5.6 10.2h3.2" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function ResetPillIcon() {
  return (
    <svg className="action-pill-ico" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M13 8a5 5 0 1 1-1.4-3.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M13 2.8v3.2H9.8" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ReadDacIcon() {
  return (
    <svg className="action-pill-ico" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2.5v7.2M5.2 7.2 8 10l2.8-2.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.2 12.8h9.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function SaveDacIcon() {
  return (
    <svg className="action-pill-ico" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 13.5V6.3M5.2 8.8 8 6l2.8 2.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.2 3.2h9.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function WaveIcon() {
  return (
    <svg className="mode-btn-ico" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M1.6 9c1.6-3.2 2.2 3.2 3.8 0S8 12.2 9.6 9s2.2 3.2 3.8 0 1-3.2 1-3.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function BarsIcon() {
  return (
    <svg className="mode-btn-ico" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.2 12.4V8.2M8 12.4V3.6M12.8 12.4V6.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

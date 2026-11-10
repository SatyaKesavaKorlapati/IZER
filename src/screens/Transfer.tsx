import { useMemo, useState } from "react";
import { Toggle } from "../components/Toggle";
import { chooseFilterIds, exportApo, exportJson, inspectImport, modelFromFilters, typeLabel } from "../eq/apo";
import { formatFreq, formatSigned } from "../eq/format";
import type { Preset } from "../data/presets";
import { useStore } from "../state/store";

function download(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function Transfer() {
  const store = useStore();
  const [pinned, setPinned] = useState<string[]>([]);
  const inspection = useMemo(() => inspectImport(store.importText), [store.importText]);
  const supported = inspection.filters.filter((filter) => filter.kind === "supported");
  const keepIds = chooseFilterIds(inspection.filters, pinned);
  const keep = new Set(keepIds);
  const needsChoice = supported.length > 5;
  const apo = exportApo(store.active);
  const json = exportJson(store.active);

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      store.notify(`${label} copied.`);
    } catch {
      store.notify("Clipboard permission was blocked. Use the download button instead.");
    }
  }

  function applyReviewed() {
    if (inspection.error) return;
    const name = inspection.name?.trim() || store.active.name || "Imported preset";
    const { model, notes, fitsJa11 } = modelFromFilters(inspection, keepIds, name);
    const preset: Preset = {
      id: "import-draft",
      name,
      category: "My presets",
      description: "Imported into the editor. Not written to the DAC.",
      target: "Generic",
      author: "Import",
      license: "Imported by you.",
      origin: "user",
      fitsJa11,
      subsetNote: supported.length > 5 ? "Mapped to 5 bands" : undefined,
      importNotes: notes,
      eq: model,
    };
    store.applyPreset(preset);
  }

  return (
    <section className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">Import / Export</p>
          <h1>Parametric text</h1>
        </div>
        <p className="lede">
          Paste Equalizer APO or AutoEq text: Preamp, then Filter N with PK, LSC, or HSC. More than five filters stop here
          so you can pin shelves and keep the five largest moves. Low pass, high pass, and notch are skipped.
        </p>
      </header>

      <div className="split">
        <div className="card">
          <h2>Import</h2>
          <textarea
            className="mono"
            value={store.importText}
            placeholder={"Preamp: -3.0 dB\nFilter 1: ON PK Fc 2.5k Hz Gain 1.5 dB Q 1.00"}
            onChange={(event) => {
              setPinned([]);
              store.setImportText(event.target.value);
            }}
            spellCheck={false}
          />
          {store.importText.trim() && inspection.error ? <p className="form-error">{inspection.error}</p> : null}
        </div>
        <div className="card">
          <h2>Export Curve ({store.ab})</h2>
          <textarea className="mono" readOnly value={apo} spellCheck={false} />
          <div className="button-row">
            <button type="button" className="btn btn-ghost" onClick={() => void copy(apo, "Equalizer APO text")}>
              Copy APO
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => download("izer-curve.txt", apo, "text/plain")}>
              Download APO
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => void copy(json, "JSON")}>
              Copy JSON
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => download("izer-curve.json", json, "application/json")}>
              Download JSON
            </button>
          </div>
        </div>
      </div>

      {!inspection.error && inspection.filters.length > 0 ? (
        <div className="card">
          <div className="section-title">
            <div>
              <h2>Review</h2>
              <p>
                {`Preamp ${formatSigned(inspection.preamp)}${inspection.autoPreamp ? " · auto level match on" : ""}. ${supported.length} supported ${supported.length === 1 ? "filter" : "filters"}. ${needsChoice ? "Pin a shelf to force it into the five." : "All of them fit."}`}
              </p>
            </div>
            <button type="button" className="btn btn-primary" onClick={applyReviewed}>
              Apply to Active Curve
            </button>
          </div>
          {inspection.warnings.length > 0 ? (
            <ul className="note-list">
              {inspection.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          <ul className="review-list">
            {inspection.filters.map((filter) => {
              const pinnedOn = pinned.includes(filter.id);
              const shelf = filter.type === "ls" || filter.type === "hs";
              return (
                <li key={filter.id} className={filter.kind === "skipped" ? "review-row skipped" : "review-row"}>
                  <div>
                    <strong>
                      Filter {filter.index} · {filter.kind === "supported" && filter.type ? typeLabel(filter.type) : filter.rawType}
                    </strong>
                    <span>
                      {filter.kind === "skipped"
                        ? filter.reason
                        : `${formatFreq(filter.freq)} Hz · ${formatSigned(filter.gain)} · Q ${filter.q.toFixed(2)}`}
                    </span>
                    {filter.notes.map((note) => (
                      <small key={note}>{note}</small>
                    ))}
                  </div>
                  <div className="review-flags">
                    {filter.kind === "supported" ? (
                      <span className={keep.has(filter.id) ? "badge ok" : "badge"}>{keep.has(filter.id) ? "Kept" : "Dropped"}</span>
                    ) : (
                      <span className="badge warn">Skipped</span>
                    )}
                    {needsChoice && shelf && filter.kind === "supported" ? (
                      <span className="switch-row">
                        <Toggle
                          label={`Pin filter ${filter.index}`}
                          checked={pinnedOn}
                          disabled={!pinnedOn && pinned.length >= 5}
                          onChange={(next) =>
                            setPinned((current) => (next ? [...current, filter.id] : current.filter((id) => id !== filter.id)))
                          }
                        />
                        <span>Pin shelf</span>
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

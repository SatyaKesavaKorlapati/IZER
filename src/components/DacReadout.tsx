import { formatGain, formatQ } from "../eq/format";
import type { FilterType } from "../eq/types";
import { useStore } from "../state/store";
import { DacStampArtwork } from "./PaperArtwork";

function filterLabel(type: FilterType): string {
  if (type === "ls") return "Low shelf";
  if (type === "hs") return "High shelf";
  return "Bell";
}

export function ReadFromDacButton() {
  const store = useStore();
  const title = store.canWriteDac
    ? "Read the EQ currently on the DAC and compare it with the library."
    : store.dacActionReason;
  return (
    <button
      type="button"
      className="btn btn-ghost"
      disabled={!store.canWriteDac}
      title={title}
      aria-label="Read from DAC"
      onClick={() => void store.readFromDac()}
    >
      <svg className="btn-ico" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 2.5v7.2M5.2 7.2 8 10l2.8-2.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3.2 12.8h9.6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      Read from DAC
    </button>
  );
}

export function DacReading({ plain = false }: { plain?: boolean }) {
  const store = useStore();
  const reading = store.dacReading;
  if (!reading) return null;

  // In Studio (non-plain), show the sleek, non-intrusive ribbon requested by the user
  if (!plain) {
    return (
      <div className="papein-dac-ribbon" aria-live="polite">
        <div className="papein-dac-ribbon-left">
          <span className="papein-dac-ribbon-badge">EQ on the DAC</span>
          {reading.ok ? (
            <>
              <span className="papein-dac-ribbon-match">{reading.summary}</span>
              <span className="papein-dac-ribbon-sep">·</span>
              <span className="papein-dac-ribbon-meta">
                {reading.slotName ?? "Your curve"}
                {reading.preamp == null ? "" : ` · Preamp ${formatGain(reading.preamp)} dB`}
              </span>
            </>
          ) : (
            <span className="papein-dac-ribbon-match">{reading.detail}</span>
          )}
        </div>
        <button
          type="button"
          className="papein-dac-ribbon-close"
          aria-label="Close EQ on the DAC"
          onClick={() => store.clearDacReading()}
          title="Dismiss notification"
        >
          <span aria-hidden="true">×</span>
          <span>Close</span>
        </button>
      </div>
    );
  }

  return (
    <div className="dac-readout in-card" aria-live="polite">
      <DacStampArtwork />
      <div className="dac-readout-head">
        <h2>EQ on the DAC</h2>
        <button
          type="button"
          className="dac-readout-close"
          aria-label="Close EQ on the DAC"
          onClick={() => store.clearDacReading()}
        >
          <span aria-hidden>×</span>
          Close
        </button>
      </div>
      {reading.ok ? (
        <>
          <p className={reading.exact ? "dac-match exact" : "dac-match"}>{reading.summary}</p>
          <p className="dac-meta">
            {reading.slotName ?? "Slot not reported"}
            {reading.preamp == null ? " · Preamp not reported" : ` · Preamp ${formatGain(reading.preamp)} dB`}
          </p>
          {reading.bands.length > 0 ? (
            <ol className="dac-bands">
              {reading.bands.map((band, index) => (
                <li key={index}>
                  <span>{index + 1}</span>
                  <span>{filterLabel(band.type)}</span>
                  <span>{Math.round(band.freq)} Hz</span>
                  <span>{formatGain(band.gain)} dB</span>
                  <span>Q {formatQ(band.q)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p>The DAC did not return any bands.</p>
          )}
        </>
      ) : (
        <p className="dac-match">{reading.detail}</p>
      )}
    </div>
  );
}

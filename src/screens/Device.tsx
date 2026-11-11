import { DacReading, ReadFromDacButton } from "../components/DacReadout";
import { dacLabel, failureHeadline, formatHidId } from "../lib/hid";
import { useStore } from "../state/store";

export function Device() {
  const store = useStore();
  const connected = store.device.phase === "connected" && store.device.identity;
  const unsupported = store.device.phase === "unsupported";
  const opening = store.device.phase === "opening";
  const product = dacLabel(store.device.identity);
  const reported = store.device.identity?.productName?.trim() ?? "";
  const flushTitle = store.canWriteDac
    ? "Send now. The curve goes to the DAC and the dongle stays connected. Flash is not written."
    : store.dacActionReason;
  const saveDacTitle = store.canWriteDac
    ? "Write active curve to DAC flash memory. The dongle may disconnect and reconnect."
    : store.dacActionReason;
  const headline = connected
    ? product
    : opening
      ? "Waiting for a DAC…"
      : unsupported
        ? "WebHID is missing"
        : failureHeadline(store.device.reason);

  return (
    <section className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">Device</p>
          <h1>{connected ? product : "DAC"}</h1>
        </div>
        <p className="lede">
          {connected
            ? `${product}. Edits reach the DAC while it is open. Save to DAC writes flash and may disconnect once. No firmware is flashed.`
            : "Userspace WebHID. No kernel driver, no firmware, no ASIO."}
        </p>
      </header>

      <div className="card device-card">
        <div className={connected ? "device-mark on" : "device-mark"} aria-hidden="true" />
        <div>
          <h2>{headline}</h2>
          <p>{store.device.detail}</p>
          <dl className="identity">
            <div>
              <dt>Vendor</dt>
              <dd>{formatHidId(store.device.identity?.vendorId)}</dd>
            </div>
            <div>
              <dt>Product</dt>
              <dd>{formatHidId(store.device.identity?.productId)}</dd>
            </div>
            <div>
              <dt>Product string</dt>
              <dd>{connected ? reported || "The device did not report a product name." : "Unavailable until a DAC is opened"}</dd>
            </div>
          </dl>
          <div className="button-row">
            {connected ? (
              <>
                <button type="button" className="btn btn-ghost" onClick={() => void store.disconnect()}>
                  Disconnect
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-unpair"
                  style={{ color: "#c0392b", borderColor: "rgba(192, 57, 43, 0.4)" }}
                  title="Unpair and forget this DAC"
                  onClick={() => void store.unpairCurrent()}
                >
                  Unpair
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-ghost"
                aria-label="Connect DAC"
                onClick={() => store.setDevicePickerOpen(true)}
                disabled={opening || unsupported}
              >
                {opening ? "Waiting…" : "Connect"}
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              aria-label="Choose another HID device"
              onClick={() => store.setDevicePickerOpen(true)}
              disabled={opening || unsupported}
            >
              Other device
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Editor and DAC</h2>
        <p>
          Studio has four slots. Each slot is Static or Live. Static edits stay on this computer. Live edits are sent to
          an open DAC as you move a point. Save to DAC writes flash and may disconnect the dongle once. Connecting a DAC
          does not change a static slot.
        </p>
        <p>
          Slot {store.activeSlot} is {store.dacMode}. Copy and Paste on the graph move a curve from one slot to another.
        </p>
        <div className="button-row">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!store.canWriteDac}
            title={flushTitle}
            aria-label="Listen"
            onClick={() => void store.flushToDac()}
          >
            Listen
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!store.canWriteDac}
            title={saveDacTitle}
            aria-label="Save to DAC"
            onClick={() => void store.saveToDac()}
          >
            Save to DAC
          </button>
          <ReadFromDacButton />
        </div>
        <p className="listen-note">{store.dacActionReason}</p>
        <DacReading plain />
      </div>
    </section>
  );
}

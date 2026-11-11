import { useEffect, useState } from "react";
import { formatHidId } from "../lib/hid";
import { useStore } from "../state/store";

interface DeviceItem {
  id: string;
  name: string;
  vendorId?: number;
  productId?: number;
  paired?: boolean;
}

interface DevicePickerModalProps {
  open: boolean;
  onClose: () => void;
}

function isDongleCandidate(d: { vendorId?: number; productId?: number; productName?: string }): boolean {
  const name = (d.productName || "").trim().toLowerCase();
  // Filter out internal system/laptop hardware: trackpads, bluetooth, sensors, keyboards
  if (
    name.includes("hidi2c") ||
    name.includes("touchpad") ||
    name.includes("trackpad") ||
    name.includes("keyboard") ||
    name.includes("mouse") ||
    name.includes("bluetooth") ||
    name.includes("elan") ||
    name.includes("synaptics")
  ) {
    return false;
  }
  // Exclude known non-dongle vendor IDs (Intel, Elan, Synaptics)
  if (d.vendorId === 0x8087 || d.vendorId === 0x04f3 || d.vendorId === 0x06cb) {
    return false;
  }
  // Allow JA11 vendor (0x2972)
  if (d.vendorId === 0x2972) return true;
  // Allow recognized audio keywords
  if (
    name.includes("ja11") ||
    name.includes("jadeaudio") ||
    name.includes("fiio") ||
    name.includes("dac") ||
    name.includes("dongle") ||
    name.includes("audio") ||
    name.includes("izer")
  ) {
    return true;
  }
  return false;
}

export function DevicePickerModal({ open, onClose }: DevicePickerModalProps) {
  const store = useStore();
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;

    async function loadDevices() {
      setLoading(true);
      const list: DeviceItem[] = [];
      try {
        const nav = navigator as unknown as {
          hid?: {
            getDevices?: () => Promise<Array<{ vendorId?: number; productId?: number; productName?: string }>>;
          };
        };
        if (nav.hid && typeof nav.hid.getDevices === "function") {
          const granted = await nav.hid.getDevices();
          granted.forEach((d, idx) => {
            // Only allow genuine audio dongles, never HIDI2C or internal system chips
            if (isDongleCandidate(d)) {
              list.push({
                id: `granted-${idx}-${d.vendorId ?? 0}-${d.productId ?? 0}`,
                name: d.productName || "JadeAudio JA11 (Dongle)",
                vendorId: d.vendorId,
                productId: d.productId,
                paired: true,
              });
            }
          });
        }
      } catch {
        /* ignore */
      }

      // If no audio dongle found in granted list, provide the primary dongle target
      if (list.length === 0) {
        list.push({
          id: "ja11-dongle",
          name: "JadeAudio JA11 (Audio Dongle)",
          vendorId: 0x2972,
          productId: 0x0102,
          paired: true,
        });
      }

      if (active) {
        setDevices(list);
        setSelectedId(list[0]?.id || "");
        setLoading(false);
      }
    }

    void loadDevices();
    return () => {
      active = false;
    };
  }, [open]);

  if (!open) return null;

  function handleConnect() {
    onClose();
    // Connect directly to the selected audio dongle with preserved user gesture
    store.pairNewDac();
  }

  return (
    <div className="themed-hid-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="hid-picker-title">
      <div className="themed-hid-modal-sheet">
        <div className="themed-hid-modal-head">
          <div className="themed-hid-modal-title-row">
            <svg className="themed-hid-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 12 C4 7.58 7.58 4 12 4 C16.42 4 20 7.58 20 12 L20 17 C20 18.66 18.66 20 17 20 L16 20 C14.9 20 14 19.1 14 18 L14 14 C14 12.9 14.9 12 16 12 L18.5 12 L18.5 12 C18.5 8.41 15.59 5.5 12 5.5 C8.41 5.5 5.5 8.41 5.5 12 L8 12 C9.1 12 10 12.9 10 14 L10 18 C10 19.1 9.1 20 8 20 L7 20 C5.34 20 4 18.66 4 17 Z"
                fill="currentColor"
              />
            </svg>
            <h2 id="hid-picker-title">IZER wants to connect to a HID device</h2>
          </div>
          <p className="themed-hid-modal-subtitle">
            Select your Audio DAC from the paired devices list or scan for a new connection.
          </p>
        </div>

        <div className="themed-hid-device-listbox" role="listbox" tabIndex={0}>
          {devices.map((device) => {
            const isSelected = device.id === selectedId;
            return (
              <div
                key={device.id}
                role="option"
                aria-selected={isSelected}
                className={`themed-hid-device-row ${isSelected ? "selected" : ""}`}
                onClick={() => setSelectedId(device.id)}
              >
                <div className="themed-hid-row-radio">
                  <div className={`themed-hid-radio-dot ${isSelected ? "checked" : ""}`} />
                </div>
                <div className="themed-hid-device-info">
                  <span className="themed-hid-device-name">{device.name}</span>
                  {device.vendorId && device.productId ? (
                    <span className="themed-hid-device-ids">
                      VID: {formatHidId(device.vendorId)} · PID: {formatHidId(device.productId)}
                    </span>
                  ) : null}
                </div>
                {device.paired ? <span className="themed-hid-badge-paired">Paired</span> : null}
              </div>
            );
          })}
        </div>

        <div className="themed-hid-modal-foot">
          <div className="themed-hid-foot-left">
            <button
              type="button"
              className="themed-hid-btn-help"
              title="Ensure your JadeAudio JA11 or compatible dongle is plugged in via USB"
              aria-label="Device connection help"
            >
              ?
            </button>
          </div>
          <div className="themed-hid-foot-actions">
            <button type="button" className="themed-hid-btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="themed-hid-btn-connect"
              disabled={loading || !selectedId}
              onClick={handleConnect}
            >
              {loading ? "Connecting..." : "Connect"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  beginDeferredHidScan,
  cancelDeferredHidScan,
  formatHidId,
  isJa11Unpaired,
} from "../lib/hid";
import { electronDefersHidPicker, subscribeHidDeviceList, type ScannedHidDevice } from "../lib/hidPicker";
import { useStore } from "../state/store";

interface DeviceItem {
  id: string;
  name: string;
  vendorId?: number;
  productId?: number;
  paired?: boolean;
  electronDeviceId?: string;
  rawDevice?: { forget?: () => Promise<void> };
}

interface DevicePickerModalProps {
  open: boolean;
  onClose: () => void;
}

type GrantedDevice = {
  vendorId?: number;
  productId?: number;
  productName?: string;
  forget?: () => Promise<void>;
};

function isJa11Grant(d: { vendorId?: number; productName?: string }): boolean {
  if (d.vendorId === 0x2972) return true;
  const name = (d.productName || "").trim().toLowerCase();
  return name.includes("ja11") || name.includes("jadeaudio");
}

function isDongleCandidate(d: { vendorId?: number; productId?: number; productName?: string }): boolean {
  if (d.vendorId === 0x2972) return true;
  const name = (d.productName || "").trim().toLowerCase();
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
  if (d.vendorId === 0x8087 || d.vendorId === 0x04f3 || d.vendorId === 0x06cb) {
    return false;
  }
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

async function readGrantedDevices(): Promise<GrantedDevice[]> {
  const nav = navigator as unknown as { hid?: { getDevices?: () => Promise<GrantedDevice[]> } };
  if (!nav.hid || typeof nav.hid.getDevices !== "function") return [];
  try {
    return await nav.hid.getDevices();
  } catch {
    return [];
  }
}

function buildPairedList(granted: GrantedDevice[]): DeviceItem[] {
  const list: DeviceItem[] = [];
  const seen = new Set<string>();
  granted.forEach((d, idx) => {
    if (isJa11Unpaired() && isJa11Grant(d)) return;
    if (!isDongleCandidate(d)) return;
    const key = `${d.vendorId ?? 0}:${d.productId ?? 0}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push({
      id: `granted-${idx}-${d.vendorId ?? 0}-${d.productId ?? 0}`,
      name:
        d.productName?.trim() ||
        (d.vendorId != null && d.productId != null
          ? `HID ${formatHidId(d.vendorId)}:${formatHidId(d.productId)}`
          : "HID device"),
      vendorId: d.vendorId,
      productId: d.productId,
      paired: true,
      rawDevice: d,
    });
  });
  return list;
}

function buildAvailableList(scanned: ScannedHidDevice[], paired: DeviceItem[]): DeviceItem[] {
  if (isJa11Unpaired()) {
    return scanned.filter((d) => isDongleCandidate(d)).map((d) => ({
      id: `usb-${d.deviceId}`,
      name: d.productName?.trim() || "HID device",
      vendorId: d.vendorId,
      productId: d.productId,
      paired: false,
      electronDeviceId: d.deviceId,
    }));
  }
  const pairedKeys = new Set(paired.map((p) => `${p.vendorId ?? 0}:${p.productId ?? 0}`));
  return scanned
    .filter((d) => isDongleCandidate(d))
    .filter((d) => !pairedKeys.has(`${d.vendorId ?? 0}:${d.productId ?? 0}`))
    .map((d) => ({
      id: `usb-${d.deviceId}`,
      name: d.productName?.trim() || "HID device",
      vendorId: d.vendorId,
      productId: d.productId,
      paired: false,
      electronDeviceId: d.deviceId,
    }));
}

function DeviceRow({
  device,
  selected,
  onSelect,
}: {
  device: DeviceItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      role="option"
      aria-selected={selected}
      className={`themed-hid-device-row ${selected ? "selected" : ""}`}
      onClick={onSelect}
    >
      <div className="themed-hid-row-radio">
        <div className={`themed-hid-radio-dot ${selected ? "checked" : ""}`} />
      </div>
      <div className="themed-hid-device-info">
        <span className="themed-hid-device-name">{device.name}</span>
        {device.vendorId != null && device.productId != null ? (
          <span className="themed-hid-device-ids">
            VID: {formatHidId(device.vendorId)} · PID: {formatHidId(device.productId)}
          </span>
        ) : null}
      </div>
      {device.paired ? (
        <span className="themed-hid-badge-paired">Paired</span>
      ) : (
        <span className="themed-hid-badge-available">Not paired</span>
      )}
    </div>
  );
}

export function DevicePickerModal({ open, onClose }: DevicePickerModalProps) {
  const store = useStore();
  const [pairedDevices, setPairedDevices] = useState<DeviceItem[]>([]);
  const [availableDevices, setAvailableDevices] = useState<DeviceItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const inElectron = electronDefersHidPicker();

  const allDevices = useMemo(() => [...pairedDevices, ...availableDevices], [pairedDevices, availableDevices]);

  const refreshPaired = useCallback(async (): Promise<DeviceItem[]> => {
    const granted = await readGrantedDevices();
    return buildPairedList(granted);
  }, []);

  const startUsbScan = useCallback(() => {
    if (!inElectron) return;
    setScanning(true);
    void beginDeferredHidScan();
  }, [inElectron]);

  useEffect(() => {
    if (!open) {
      void cancelDeferredHidScan();
      setScanning(false);
      return;
    }
    let active = true;
    setLoading(true);
    void refreshPaired().then((paired) => {
      if (!active) return;
      setPairedDevices(paired);
      setSelectedId(paired[0]?.id || "");
      setLoading(false);
      setScanning(inElectron);
    });
    const unsub = subscribeHidDeviceList((list) => {
      if (!active) return;
      void refreshPaired().then((paired) => {
        if (!active) return;
        const available = buildAvailableList(list, paired);
        setPairedDevices(paired);
        setAvailableDevices(available);
        setScanning(false);
        setSelectedId((current) => current || paired[0]?.id || available[0]?.id || "");
      });
    });
    return () => {
      active = false;
      unsub();
      void cancelDeferredHidScan();
    };
  }, [open, refreshPaired, startUsbScan]);

  useEffect(() => {
    if (!open || selectedId) return;
    const first = allDevices[0];
    if (first) setSelectedId(first.id);
  }, [allDevices, open, selectedId]);

  if (!open) return null;

  const selected = allDevices.find((device) => device.id === selectedId);
  const canUnpairSelected = Boolean(
    selected?.paired && pairedDevices.some((p) => p.id === selectedId && p.rawDevice),
  );
  const canConnect = Boolean(selected) || !inElectron;
  const empty = pairedDevices.length === 0 && availableDevices.length === 0;

  async function handleRefresh() {
    await cancelDeferredHidScan();
    setAvailableDevices([]);
    setScanning(true);
    await beginDeferredHidScan();
  }

  function handleConnect() {
    if (!selected) {
      if (!inElectron) {
        onClose();
        store.pairNewDac();
      }
      return;
    }
    onClose();
    if (selected.paired && selected.vendorId != null) {
      void store.connectFromPicker({
        mode: "paired",
        vendorId: selected.vendorId,
        productId: selected.productId,
      });
      return;
    }
    if (selected.electronDeviceId) {
      void store.connectFromPicker({
        mode: "deferred",
        deviceId: selected.electronDeviceId,
      });
      return;
    }
    store.pairNewDac();
  }

  async function handleUnpair(device: DeviceItem) {
    if (!device.rawDevice && device.vendorId == null) return;
    setLoading(true);
    try {
      await cancelDeferredHidScan();
      setScanning(false);
      const removed = await store.unpairTarget(device.vendorId, device.productId);
      const paired = await refreshPaired();
      setPairedDevices(paired);
      setAvailableDevices([]);
      setSelectedId(paired[0]?.id || availableDevices[0]?.id || "");
      store.notify(
        removed
          ? `Unpaired ${device.name}. Press Refresh USB to see it under Available.`
          : `Could not fully remove ${device.name}. Try Refresh USB, then Unpair again.`,
      );
    } finally {
      setLoading(false);
    }
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
            Choose a paired DAC or pick an available USB device — like pairing Bluetooth.
          </p>
        </div>

        <div className="themed-hid-device-listbox" role="listbox" tabIndex={0}>
          {empty && !scanning ? (
            <p className="themed-hid-empty">
              {inElectron
                ? "No devices listed yet. Refresh to scan USB, then select one and press Connect."
                : "No paired DAC on this computer. Press Connect to allow JadeAudio JA11 again."}
            </p>
          ) : null}
          {scanning && empty ? <p className="themed-hid-scanning">Scanning USB for HID devices…</p> : null}

          {pairedDevices.length > 0 ? <p className="themed-hid-section-label">Paired</p> : null}
          {pairedDevices.map((device) => (
            <DeviceRow
              key={device.id}
              device={device}
              selected={device.id === selectedId}
              onSelect={() => setSelectedId(device.id)}
            />
          ))}

          {availableDevices.length > 0 ? (
            <p className="themed-hid-section-label themed-hid-section-label-spaced">Available (not paired)</p>
          ) : null}
          {availableDevices.map((device) => (
            <DeviceRow
              key={device.id}
              device={device}
              selected={device.id === selectedId}
              onSelect={() => setSelectedId(device.id)}
            />
          ))}
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
            {inElectron ? (
              <button
                type="button"
                className="themed-hid-btn-pair-new"
                disabled={loading}
                onClick={() => void handleRefresh()}
              >
                Refresh USB
              </button>
            ) : null}
          </div>
          <div className="themed-hid-foot-actions">
            <button type="button" className="themed-hid-btn-cancel" onClick={onClose}>
              Cancel
            </button>
            {canUnpairSelected ? (
              <button
                type="button"
                className="themed-hid-btn-unpair themed-hid-btn-unpair-foot"
                disabled={loading}
                title="Unpair and remove device permission"
                onClick={() => {
                  if (selected) void handleUnpair(selected);
                }}
              >
                Unpair
              </button>
            ) : null}
            <button
              type="button"
              className="themed-hid-btn-connect"
              disabled={loading || !canConnect}
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

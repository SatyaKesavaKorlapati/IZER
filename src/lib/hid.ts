export const JA11_VENDOR_ID = 0x2972;
export const JA11_PRODUCT_ID = 0x0102;
/** UAC 1.0 product id on the same vendor. 0x0102 is UAC 2.0. */
export const JA11_UAC1_PRODUCT_ID = 0x0101;

/**
 * PEQ collection on the JA11 that enumerates as "JadeAudio JA11".
 * Measured from the open dongle: consumer control, usage page 0x000C, usage 0x0001.
 * ja11-eq also treats a vendor collection (usage page >= 0xFF00) as the PEQ
 * interface when that collection is present. HIDI2C is the other interface.
 */
export const JA11_PEQ_USAGE_PAGE = 0x000c;
export const JA11_PEQ_USAGE = 0x0001;
export const JA11_VENDOR_USAGE_PAGE = 0xff00;

/** Vendor, product, and the PEQ collection. HIDI2C does not match this usage. */
export const JA11_FILTERS: HidFilter[] = [
  {
    vendorId: JA11_VENDOR_ID,
    productId: JA11_PRODUCT_ID,
    usagePage: JA11_PEQ_USAGE_PAGE,
    usage: JA11_PEQ_USAGE,
  },
];

export const NO_DAC_DETAIL = "No DAC connected. Choose the dongle to read its name. Nothing was written.";
const JA11_UNPAIR_KEY = "ja11-hid-unpaired";

export function markJa11Unpaired(): void {
  try {
    localStorage.setItem(JA11_UNPAIR_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearJa11Unpaired(): void {
  try {
    localStorage.removeItem(JA11_UNPAIR_KEY);
  } catch {
    /* ignore */
  }
}

export function isJa11Unpaired(): boolean {
  try {
    return localStorage.getItem(JA11_UNPAIR_KEY) === "1";
  } catch {
    return false;
  }
}
const PERMISSION_DISMISSED = "Permission dismissed. No DAC was opened.";
const NO_DEVICE_CHOSEN = "No device chosen. No DAC was opened.";

export interface DacIdentity {
  productName: string;
  vendorId: number;
  productId: number;
}

export type HidFailReason = "no-hid" | "none" | "dismissed" | "none-chosen" | "choose-any" | "failed" | "busy";

export type HidResult =
  | { ok: true; identity: DacIdentity }
  | { ok: false; reason: HidFailReason; detail: string };

type HidFailure = Extract<HidResult, { ok: false }>;

interface HidFilter {
  vendorId?: number;
  productId?: number;
  usagePage?: number;
  usage?: number;
}

interface HidInputReportEventLike {
  reportId: number;
  data: DataView;
}

interface HidCollectionLike {
  usagePage?: number;
  usage?: number;
}

interface HidDeviceLike {
  vendorId: number;
  productId: number;
  productName: string;
  opened: boolean;
  collections?: HidCollectionLike[];
  open: () => Promise<void>;
  close: () => Promise<void>;
  forget?: () => Promise<void>;
  sendReport: (reportId: number, data: Uint8Array) => Promise<void>;
  addEventListener?: (type: "inputreport", listener: (event: HidInputReportEventLike) => void) => void;
  removeEventListener?: (type: "inputreport", listener: (event: HidInputReportEventLike) => void) => void;
  oninputreport?: ((event: HidInputReportEventLike) => void) | null;
}

interface HidApi {
  getDevices: () => Promise<HidDeviceLike[]>;
  requestDevice: (options: { filters: HidFilter[] }) => Promise<HidDeviceLike[]>;
  addEventListener: (type: "connect" | "disconnect", listener: () => void) => void;
  removeEventListener: (type: "connect" | "disconnect", listener: () => void) => void;
}

let current: HidDeviceLike | null = null;
let picker = false;
let tail: Promise<void> = Promise.resolve();

function hidApi(): HidApi | null {
  const nav = navigator as Navigator & { hid?: HidApi };
  return nav.hid ?? null;
}

function lock<T>(job: () => Promise<T>): Promise<T> {
  const run = tail.then(job, job);
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function webHidAvailable(): boolean {
  return hidApi() !== null;
}

export function localAppUrl(): string {
  if (typeof location === "undefined") return "http://127.0.0.1:1420";
  const host = location.hostname;
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if ((location.protocol === "http:" || location.protocol === "https:") && local) return location.origin;
  return "http://127.0.0.1:1420";
}

export function hidUnavailableDetail(): string {
  return `WebHID is missing (not Chrome or Edge, or not a secure context). Open this app in Chrome or Edge at ${localAppUrl()}. Embedded previews often have no WebHID.`;
}

export function formatHidId(value: number | undefined): string {
  if (value == null) return "—";
  return `0x${value.toString(16).padStart(4, "0")}`;
}

export function failureHeadline(reason?: HidFailReason): string {
  switch (reason) {
    case "no-hid":
      return "Open in Chrome or Edge";
    case "dismissed":
      return "Permission dismissed";
    case "choose-any":
      return "Choose any HID device";
    case "none-chosen":
      return "No device chosen";
    case "failed":
      return "Could not open DAC";
    default:
      return "No DAC connected";
  }
}

export function dacLabel(identity?: { productName?: string; vendorId?: number; productId?: number } | null): string {
  const name = identity?.productName?.trim();
  if (name) return name;
  if (identity && typeof identity.vendorId === "number" && typeof identity.productId === "number") {
    return `HID ${formatHidId(identity.vendorId)}:${formatHidId(identity.productId)}`;
  }
  return "DAC";
}

function browserDetail(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "The browser refused the HID request.";
}

function openFailedDetail(error: unknown): string {
  return `Open failed. ${browserDetail(error)}`;
}

export function isExcludedHardware(device?: { vendorId?: number; productId?: number; productName?: string } | null): boolean {
  if (!device) return true;
  const name = (device.productName || "").trim().toLowerCase();
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
    return true;
  }
  if (device.vendorId === 0x04f3 || device.vendorId === 0x8087 || device.vendorId === 0x06cb || device.vendorId === 0x045e) {
    return true;
  }
  return false;
}

export function isHidi2cName(name?: string | null): boolean {
  return /^hidi2c\b/i.test((name ?? "").trim());
}

/** Vendor page from ja11-eq (`usagePage >= 0xFF00`) or this dongle's consumer PEQ collection. */
export function collectionIsPeq(usagePage?: number, usage?: number): boolean {
  if (typeof usagePage !== "number") return false;
  if (usagePage >= JA11_VENDOR_USAGE_PAGE) return true;
  return usagePage === JA11_PEQ_USAGE_PAGE && usage === JA11_PEQ_USAGE;
}

export function ja11ReportsTarget(
  device?: { vendorId?: number; productId?: number; productName?: string; collections?: HidCollectionLike[] } | null,
): boolean {
  if (!ja11EqOffTarget(device)) return false;
  if (isHidi2cName(device?.productName)) return false;
  if (!device?.collections || device.collections.length === 0) return true;
  return !!device.collections.some((collection) => collectionIsPeq(collection.usagePage, collection.usage));
}

function wrongInterfaceDetail(device: { productName?: string }): string {
  const name = device.productName?.trim() || "HID device";
  if (isHidi2cName(device.productName)) {
    return `Opened ${name}. Pick JadeAudio JA11. HIDI2C is the other interface on this dongle, not the equalizer. Nothing was written.`;
  }
  return `Opened ${name}. It has no equalizer collection. Pick JadeAudio JA11. Nothing was written.`;
}

function prefer(devices: HidDeviceLike[]): HidDeviceLike | undefined {
  const ready = devices.filter((device) => ja11ReportsTarget(device));
  return (
    ready.find((device) => /jadeaudio|ja11/i.test(device.productName ?? "")) ??
    ready[0]
  );
}

function identityOf(device: HidDeviceLike): DacIdentity {
  return {
    productName: device.productName?.trim() || "",
    vendorId: device.vendorId,
    productId: device.productId,
  };
}

async function closeUnlocked(): Promise<void> {
  if (!current) return;
  const device = current;
  current = null;
  await device.close().catch(() => undefined);
}

type ElectronHidBridge = {
  isElectron?: boolean;
  revokeHidDevice?: (vid: number, revokeAll: boolean) => Promise<{ ok?: boolean }>;
  allowJa11Hid?: () => Promise<{ ok?: boolean }>;
  pickHidDevice?: (deviceId: string) => Promise<{ ok?: boolean }>;
  cancelHidPick?: () => Promise<{ ok?: boolean }>;
  beginHidScan?: () => Promise<{ ok?: boolean }>;
};

let deferredHidRequest: Promise<HidDeviceLike[]> | null = null;

function electronHidBridge(): ElectronHidBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { electronAPI?: ElectronHidBridge }).electronAPI;
}

async function revokeElectronHidPermission(vendorId: number, revokeAllVendor: boolean): Promise<void> {
  const api = electronHidBridge();
  if (!api?.revokeHidDevice) return;
  await api.revokeHidDevice(vendorId, revokeAllVendor).catch(() => undefined);
}

export async function allowElectronJa11Hid(): Promise<void> {
  clearJa11Unpaired();
  const api = electronHidBridge();
  if (!api?.allowJa11Hid) return;
  await api.allowJa11Hid().catch(() => undefined);
}

/** Revoke WebHID permission and unpair the specified device from this computer. */
export async function unpairDevice(vendorId?: number, productId?: number): Promise<boolean> {
  const hid = hidApi();
  if (!hid) return false;
  return lock(async () => {
    try {
      const devices = await hid.getDevices();
      let unpaired = false;
      const ja11Vendor = vendorId === JA11_VENDOR_ID;
      for (const d of devices) {
        const matchesJa11 =
          d.vendorId === JA11_VENDOR_ID ||
          /ja11|jadeaudio/i.test((d.productName || "").trim());
        if (ja11Vendor && productId == null && !matchesJa11) continue;
        if (vendorId != null && d.vendorId !== vendorId && !(ja11Vendor && matchesJa11)) continue;
        if (!ja11Vendor && productId != null && d.productId !== productId) continue;
        if (current === d) {
          current = null;
          await d.close().catch(() => undefined);
        }
        if (typeof d.forget === "function") {
          await d.forget().catch(() => undefined);
          unpaired = true;
        }
      }
      if (ja11Vendor) {
        markJa11Unpaired();
        const after = await hid.getDevices();
        const ja11Left = after.some(
          (d) =>
            d.vendorId === JA11_VENDOR_ID ||
            /ja11|jadeaudio/i.test((d.productName || "").trim()),
        );
        return unpaired || !ja11Left;
      }
      if (vendorId != null) {
        await revokeElectronHidPermission(vendorId, productId == null);
      }
      return unpaired;
    } catch {
      return false;
    }
  });
}

class WrongInterfaceError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "WrongInterfaceError";
  }
}

async function closeDevice(device: HidDeviceLike): Promise<void> {
  if (current === device) current = null;
  if (device.opened) await device.close().catch(() => undefined);
}

async function adoptUnlocked(device: HidDeviceLike): Promise<DacIdentity> {
  if (current && current !== device) {
    const previous = current;
    current = null;
    await previous.close().catch(() => undefined);
  }
  if (!device.opened) await device.open();
  if (!ja11ReportsTarget(device)) {
    const detail = wrongInterfaceDetail(device);
    await closeDevice(device);
    throw new WrongInterfaceError(detail);
  }
  current = device;
  return identityOf(device);
}

export function closeCurrent(): Promise<void> {
  return lock(() => closeUnlocked());
}

async function readGranted(hid: HidApi): Promise<HidResult> {
  if (picker) return { ok: false, reason: "busy", detail: "" };
  if (isJa11Unpaired()) {
    return { ok: false, reason: "none", detail: NO_DAC_DETAIL };
  }
  try {
    const granted = await hid.getDevices();
    if (picker) return { ok: false, reason: "busy", detail: "" };
    const filtered = granted.filter((item) => !isExcludedHardware(item));
    const device = prefer(filtered);
    if (!device) {
      await closeUnlocked();
      return { ok: false, reason: "none", detail: NO_DAC_DETAIL };
    }
    return { ok: true, identity: await adoptUnlocked(device) };
  } catch (error) {
    if (error instanceof WrongInterfaceError) return { ok: false, reason: "failed", detail: error.message };
    return { ok: false, reason: "failed", detail: openFailedDetail(error) };
  }
}

/** Previously permitted devices only. Does not call requestDevice and does not write a report. */
export function openPermittedDevice(): Promise<HidResult> {
  if (picker) return Promise.resolve({ ok: false, reason: "busy", detail: "" });
  const hid = hidApi();
  if (!hid) return Promise.resolve({ ok: false, reason: "no-hid", detail: hidUnavailableDetail() });
  return lock(() => readGranted(hid));
}

function cancelResult(error: unknown): HidFailure {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "AbortError") return { ok: false, reason: "dismissed", detail: PERMISSION_DISMISSED };
  return { ok: false, reason: "none-chosen", detail: NO_DEVICE_CHOSEN };
}

async function prompt(filters: HidFilter[]): Promise<{ ok: true; devices: HidDeviceLike[] } | { ok: false; result: HidFailure }> {
  const hid = hidApi();
  if (!hid) return { ok: false, result: { ok: false, reason: "no-hid", detail: hidUnavailableDetail() } };
  try {
    const devices = await hid.requestDevice({ filters });
    return { ok: true, devices };
  } catch (error) {
    if (error instanceof DOMException && (error.name === "NotFoundError" || error.name === "AbortError")) {
      return { ok: false, result: cancelResult(error) };
    }
    return { ok: false, result: { ok: false, reason: "failed", detail: browserDetail(error) } };
  }
}

async function openPicked(devices: HidDeviceLike[]): Promise<HidResult> {
  const filtered = devices.filter((item) => !isExcludedHardware(item));
  const device = prefer(filtered);
  if (!device) {
    return { ok: false, reason: "none-chosen", detail: NO_DEVICE_CHOSEN };
  }
  try {
    const identity = await lock(() => adoptUnlocked(device));
    return { ok: true, identity };
  } catch (error) {
    if (error instanceof WrongInterfaceError) return { ok: false, reason: "failed", detail: error.message };
    return { ok: false, reason: "failed", detail: openFailedDetail(error) };
  }
}

export const RUNTIME_JA11_FILTERS: HidFilter[] = [
  {
    vendorId: JA11_VENDOR_ID,
    productId: JA11_PRODUCT_ID,
  },
  {
    vendorId: JA11_VENDOR_ID,
  },
];

/**
 * Call from a click. The chooser lists the JA11 PEQ collection only.
 * Does not write a report.
 */
export async function requestKnownDac(): Promise<HidResult> {
  await allowElectronJa11Hid();
  picker = true;
  try {
    const filtered = await prompt(RUNTIME_JA11_FILTERS);
    if (!filtered.ok) return filtered.result;
    return openPicked(filtered.devices);
  } finally {
    picker = false;
  }
}

/** Call from a click. filters: [] asks the browser to list every HID device. */
export async function requestAnyHid(): Promise<HidResult> {
  picker = true;
  try {
    const prompted = await prompt([]);
    if (!prompted.ok) return prompted.result;
    return openPicked(prompted.devices);
  } finally {
    picker = false;
  }
}

export function electronDefersHidPicker(): boolean {
  return Boolean(electronHidBridge()?.isElectron);
}

/** Start Electron deferred HID scan (lists USB devices in the connect modal). */
export async function beginDeferredHidScan(): Promise<boolean> {
  if (!electronDefersHidPicker()) return false;
  const hid = hidApi();
  if (!hid) return false;
  if (deferredHidRequest) return true;
  if (picker) {
    picker = false;
  }
  const api = electronHidBridge();
  if (api?.beginHidScan) await api.beginHidScan().catch(() => undefined);
  picker = true;
  deferredHidRequest = hid.requestDevice({ filters: [] }).catch((error) => {
    deferredHidRequest = null;
    picker = false;
    throw error;
  });
  void deferredHidRequest.catch(() => undefined);
  return true;
}

export async function cancelDeferredHidScan(): Promise<void> {
  const api = electronHidBridge();
  if (api?.cancelHidPick) await api.cancelHidPick().catch(() => undefined);
  deferredHidRequest = null;
  picker = false;
}

export async function completeDeferredHidScan(deviceId: string): Promise<HidResult> {
  const api = electronHidBridge();
  if (!api?.pickHidDevice) {
    return { ok: false, reason: "failed", detail: "HID picker is not available." };
  }
  if (!deferredHidRequest) {
    return { ok: false, reason: "failed", detail: "Scan USB devices first, then choose one." };
  }
  if (isJa11Unpaired()) {
    await allowElectronJa11Hid();
  }
  await api.pickHidDevice(deviceId);
  try {
    const devices = await deferredHidRequest;
    deferredHidRequest = null;
    picker = false;
    clearJa11Unpaired();
    return openPicked(devices);
  } catch (error) {
    deferredHidRequest = null;
    picker = false;
    const name = error instanceof DOMException ? error.name : "";
    if (name === "NotFoundError" || name === "AbortError") {
      return { ok: false, reason: "dismissed", detail: "No device chosen." };
    }
    return { ok: false, reason: "failed", detail: "Could not open the chosen device." };
  }
}

export async function connectGrantedHid(vendorId: number, productId?: number): Promise<HidResult> {
  if (picker) return { ok: false, reason: "busy", detail: "" };
  const hid = hidApi();
  if (!hid) return { ok: false, reason: "no-hid", detail: hidUnavailableDetail() };
  if (isJa11Unpaired() || vendorId === JA11_VENDOR_ID) {
    await allowElectronJa11Hid();
  }
  return lock(async () => {
    const granted = await hid.getDevices();
    const device =
      granted.find((d) => d.vendorId === vendorId && (productId == null || d.productId === productId)) ??
      granted.find((d) => d.vendorId === vendorId);
    if (!device) {
      return { ok: false, reason: "none", detail: NO_DAC_DETAIL };
    }
    clearJa11Unpaired();
    return openPicked([device]);
  });
}

/**
 * JA11 report layout from ja11-eq (0BSD):
 * `lib/ja11Config.js` (vendor 0x2972, product 0x0102, reportId 2, USER1 slot 3,
 * EQ-off slot 4, gain −12..+12, Q 0.1–10, 5 filters, manual global gain)
 * and `lib/fiioUsbHidHandler.js` (`setPresetPeq`, `setGlobalGain`, `setPeqCounter`,
 * `setPeqParams`, `saveToDevice`, `convertFromFilterType`, `getPresetPeq`,
 * `getPeqCounter`, `getGlobalGain`, `getPeqParams`, `handlePeqParams`, `handleGain`).
 * `index.html` `saveToDongle` calls `enablePEQ(true, 3)`, waits 120 ms, then `pushToDevice`.
 * JA11_MODEL_CONFIG has no qCompensation, so Q is sent as Math.round(q * 100).
 * Product 0x0101 is not a write target in that source.
 * Firmware is not flashed. The 0x1B reset command is not sent.
 */
const JA11_REPORT_ID = 2;
const JA11_USER_SLOT = 3;
const JA11_OFF_SLOT = 4;
const SET_HEADER1 = 0xaa;
const SET_HEADER2 = 0x0a;
const GET_HEADER1 = 0xbb;
const GET_HEADER2 = 0x0b;
const END_HEADER = 0xee;

/**
 * Wait after the last edit before a temporary USER1 flush.
 * That flush is enable/switch USER1, global gain, filter count, and filter
 * params. It does not send save (`0x19`) and does not close the HID handle.
 */
export const JA11_LIVE_FLUSH_MS = 100;

/** How long a flash save may drop the dongle. One save may reconnect once. */
let saveDropUntil = 0;
let saveReopens = 0;
let saveOpenAttempts = 0;
const SAVE_DROP_MS = 12000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** `fiioGainBytesFromValue`: tenths, then high byte, low byte. Negatives use the 16-bit invert. */
function fiioGainBytes(db: number): [number, number] {
  let tenths = Math.round(db * 10);
  if (tenths < 0) tenths = (Math.abs(tenths) ^ 0xffff) + 1;
  return [(tenths >> 8) & 0xff, tenths & 0xff];
}

/** `splitUnsignedValue`: high byte, then low byte. */
function splitUnsigned(value: number): [number, number] {
  const whole = Math.round(value) & 0xffff;
  return [(whole >> 8) & 0xff, whole & 0xff];
}

/** `convertFromFilterType`: PK 0, LSQ 1, HSQ 2. */
function filterTypeByte(type: string): number {
  if (type === "ls") return 1;
  if (type === "hs") return 2;
  return 0;
}

function report(bytes: number[]): Uint8Array<ArrayBuffer> {
  const data = new Uint8Array(bytes.length);
  data.set(bytes);
  return data;
}

function presetReport(slotId: number): Uint8Array {
  return report([SET_HEADER1, SET_HEADER2, 0, 0, 0x16, 1, slotId, 0, END_HEADER]);
}

function globalGainReport(db: number): Uint8Array {
  const [high, low] = fiioGainBytes(clampNumber(db, -12, 12));
  return report([SET_HEADER1, SET_HEADER2, 0, 0, 0x17, 2, high, low, 0, END_HEADER]);
}

function filterCountReport(count: number): Uint8Array {
  return report([SET_HEADER1, SET_HEADER2, 0, 0, 0x18, 1, count, 0, END_HEADER]);
}

function filterReport(index: number, freq: number, gain: number, q: number, type: number): Uint8Array {
  const [gainHigh, gainLow] = fiioGainBytes(gain);
  const [freqHigh, freqLow] = splitUnsigned(freq);
  const [qHigh, qLow] = splitUnsigned(Math.round(q * 100));
  return report([
    SET_HEADER1,
    SET_HEADER2,
    0,
    0,
    0x15,
    8,
    index,
    gainHigh,
    gainLow,
    freqHigh,
    freqLow,
    qHigh,
    qLow,
    type,
    0,
    END_HEADER,
  ]);
}

function saveReport(slotId: number): Uint8Array {
  return report([SET_HEADER1, SET_HEADER2, 0, 0, 0x19, 1, slotId, 0, END_HEADER]);
}

const EQ_OFF_SWITCH = presetReport(JA11_OFF_SLOT);
const EQ_OFF_SAVE = saveReport(JA11_OFF_SLOT);

export interface Ja11WriteBand {
  type: "pk" | "ls" | "hs";
  freq: number;
  gain: number;
  q: number;
  enabled: boolean;
}

export interface Ja11WriteEditor {
  bands: readonly Ja11WriteBand[];
  preamp: number;
}

export type Ja11WriteMode = "flush" | "save";

/**
 * Reports for the current editor.
 * Flush stops before `saveToDevice`. Save appends slot 3 (`0x19`).
 */
export function buildJa11User1Reports(editor: Ja11WriteEditor, mode: Ja11WriteMode): Uint8Array[] {
  const bands = editor.bands.slice(0, 5);
  while (bands.length < 5) {
    bands.push({ type: "pk", freq: 1000, gain: 0, q: 1, enabled: false });
  }
  const reports = [
    presetReport(JA11_USER_SLOT),
    globalGainReport(editor.preamp),
    filterCountReport(5),
  ];
  bands.forEach((band, index) => {
    const freq = Math.round(clampNumber(band.freq, 20, 20000));
    const gain = band.enabled ? clampNumber(band.gain, -12, 12) : 0;
    const q = clampNumber(band.q, 0.1, 10);
    reports.push(filterReport(index, freq, gain, q, filterTypeByte(band.type)));
  });
  if (mode === "save") reports.push(saveReport(JA11_USER_SLOT));
  return reports;
}

export type Ja11WriteResult =
  | { ok: true; mode: Ja11WriteMode }
  | { ok: false; reason: "no-device" | "not-ja11" | "failed"; detail: string };

export function ja11SaveDropPending(now = Date.now()): boolean {
  return now < saveDropUntil;
}

/** Arm the post-save window. A new save clears any earlier reconnect count. */
export function beginJa11SaveDrop(now = Date.now(), windowMs = SAVE_DROP_MS): void {
  saveDropUntil = now + windowMs;
  saveReopens = 0;
  saveOpenAttempts = 0;
}

export function clearJa11SaveDrop(): void {
  saveDropUntil = 0;
  saveReopens = 0;
  saveOpenAttempts = 0;
}

export type Ja11SaveReconnectPermit = "normal" | "open" | "settled" | "stopped";

/**
 * During the save-drop window: one successful reopen, and at most three open
 * attempts. After that, further automatic opens are refused so a reset cannot loop.
 */
export function ja11SaveReconnectPermit(now = Date.now()): Ja11SaveReconnectPermit {
  if (!ja11SaveDropPending(now)) return "normal";
  if (saveReopens >= 1) return "settled";
  if (saveOpenAttempts >= 3) return "stopped";
  return "open";
}

export function noteJa11SaveReconnectAttempt(): void {
  saveOpenAttempts += 1;
}

export function noteJa11SaveReconnectSuccess(): void {
  saveReopens += 1;
}

export function ja11SaveReconnects(): number {
  return saveReopens;
}

/** The flash write drops the dongle, so a disconnect during the save report is expected. */
function saveDropError(error: unknown): boolean {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NetworkError") return true;
  const message = error instanceof Error ? error.message : "";
  return /disconnect/i.test(message);
}

/**
 * Flush writes the live USER1 editor and does not call `saveToDevice`.
 * Save follows `pushToDevice` for slot 3, waits 1 s, then closes the handle
 * because `disconnectOnSave` is true. The dongle may reconnect on its own.
 */
export function sendJa11Editor(editor: Ja11WriteEditor, mode: Ja11WriteMode): Promise<Ja11WriteResult> {
  return lock(async () => {
    const device = current;
    if (!device?.opened || typeof device.sendReport !== "function") {
      return { ok: false, reason: "no-device", detail: "No DAC is open. Nothing was written." };
    }
    if (!ja11ReportsTarget(device)) {
      if (ja11EqOffTarget(device)) {
        const detail = wrongInterfaceDetail(device);
        await closeDevice(device);
        return { ok: false, reason: "not-ja11", detail };
      }
      const name = device.productName?.trim() || "HID device";
      return {
        ok: false,
        reason: "not-ja11",
        detail: `Opened ${name} (${formatHidId(device.vendorId)} / ${formatHidId(device.productId)}). JA11 reports are not sent to this device.`,
      };
    }
    const reports = buildJa11User1Reports(editor, mode);
    try {
      await device.sendReport(JA11_REPORT_ID, reports[0]);
      await delay(120);
      await device.sendReport(JA11_REPORT_ID, reports[1]);
      await device.sendReport(JA11_REPORT_ID, reports[2]);
      await delay(100);
      for (let index = 3; index < 8; index += 1) {
        await device.sendReport(JA11_REPORT_ID, reports[index]);
      }
      await delay(100);
      if (mode === "save") {
        beginJa11SaveDrop();
        try {
          await device.sendReport(JA11_REPORT_ID, reports[8]);
        } catch (error) {
          if (!saveDropError(error)) {
            clearJa11SaveDrop();
            throw error;
          }
        }
        await delay(1000);
        if (current === device) {
          current = null;
          await device.close().catch(() => undefined);
        }
      }
      return { ok: true, mode };
    } catch (error) {
      return { ok: false, reason: "failed", detail: browserDetail(error) };
    }
  });
}

/**
 * Read queries from `fiioUsbHidHandler.js`: `getPresetPeq`, `getPeqCounter`,
 * `getGlobalGain`, and `getPeqParams`. Same command bytes as the writes, with
 * the GET header `BB 0B`. JA11 has no qCompensation, so Q is the stored value / 100.
 */
export function ja11ReadPresetPacket(): Uint8Array {
  return report([GET_HEADER1, GET_HEADER2, 0, 0, 0x16, 0, 0, END_HEADER]);
}

export function ja11ReadGainPacket(): Uint8Array {
  return report([GET_HEADER1, GET_HEADER2, 0, 0, 0x17, 0, 0, END_HEADER]);
}

export function ja11ReadCountPacket(): Uint8Array {
  return report([GET_HEADER1, GET_HEADER2, 0, 0, 0x18, 0, 0, END_HEADER]);
}

export function ja11ReadFilterPacket(index: number): Uint8Array {
  return report([GET_HEADER1, GET_HEADER2, 0, 0, 0x15, 1, index & 0xff, 0, END_HEADER]);
}

/** `handleGain`: first byte is the high byte, matching the write order. */
export function decodeFiioGain(first: number, second: number): number {
  let value = ((first & 0xff) << 8) | (second & 0xff);
  const negative = (value & 0x8000) !== 0;
  if (negative) value = (value ^ 0xffff) + 1;
  const db = (negative ? -value : value) / 10;
  return Math.round(db * 10) / 10;
}

function filterTypeFromByte(byte: number): "pk" | "ls" | "hs" {
  if (byte === 1) return "ls";
  if (byte === 2) return "hs";
  return "pk";
}

export type Ja11InputReport =
  | { kind: "slot"; slot: number }
  | { kind: "count"; count: number }
  | { kind: "preamp"; preamp: number }
  | { kind: "band"; index: number; type: "pk" | "ls" | "hs"; freq: number; gain: number; q: number }
  | { kind: "other" };

/** `handleEqPreset` / `handlePeqCounter` / `handleGain` / `handlePeqParams`. */
export function parseJa11InputReport(data: Uint8Array): Ja11InputReport | null {
  if (data.length < 7 || data[0] !== GET_HEADER1 || data[1] !== GET_HEADER2) return null;
  switch (data[4]) {
    case 0x16:
      return { kind: "slot", slot: data[6] };
    case 0x18:
      return { kind: "count", count: data[6] };
    case 0x17:
      if (data.length < 8) return null;
      return { kind: "preamp", preamp: decodeFiioGain(data[6], data[7]) };
    case 0x15: {
      if (data.length < 14) return null;
      const freq = ((data[9] & 0xff) << 8) | (data[10] & 0xff);
      let q = (((data[11] & 0xff) << 8) | (data[12] & 0xff)) / 100;
      if (!q) q = 1;
      return {
        kind: "band",
        index: data[6],
        gain: decodeFiioGain(data[7], data[8]),
        freq,
        q: Math.round(q * 100) / 100,
        type: filterTypeFromByte(data[13]),
      };
    }
    default:
      return { kind: "other" };
  }
}

export function ja11SlotName(slot: number): string {
  switch (slot) {
    case 0:
      return "Vocal";
    case 1:
      return "Classic";
    case 2:
      return "Bass";
    case 3:
      return "USER1";
    case 4:
      return "Off";
    default:
      return String(slot);
  }
}

/** Plain name for the readout. USER1 is the curve the listener edited. */
export function ja11SlotPlainName(slot: number): string {
  if (slot === 3) return "Your curve";
  return ja11SlotName(slot);
}

export interface Ja11ReadBand {
  type: "pk" | "ls" | "hs";
  freq: number;
  gain: number;
  q: number;
}

export interface Ja11ReadEq {
  slot: number | null;
  preamp: number | null;
  bands: Ja11ReadBand[];
  expected: number;
  reportedCount: number;
}

export type Ja11ReadResult =
  | { ok: true; eq: Ja11ReadEq }
  | { ok: false; reason: "no-device" | "not-ja11" | "failed" | "timeout"; detail: string };

function inputBytes(event: HidInputReportEventLike): Uint8Array | null {
  const data = event.data;
  if (!data || typeof data.byteLength !== "number") return null;
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

function hexBytes(data: Uint8Array): string {
  return Array.from(data, (byte) => byte.toString(16).padStart(2, "0")).join(" ");
}

function listenForInput(device: HidDeviceLike, listener: (event: HidInputReportEventLike) => void): (() => void) | null {
  if (typeof device.addEventListener === "function") {
    device.addEventListener("inputreport", listener);
    return () => device.removeEventListener?.("inputreport", listener);
  }
  if (!("oninputreport" in device)) return null;
  const previous = device.oninputreport ?? null;
  device.oninputreport = listener;
  return () => {
    if (device.oninputreport === listener) device.oninputreport = previous;
  };
}

/**
 * `pullFromDevice`: ask for the active slot, filter count, and global gain,
 * then one `getPeqParams` per band. Does not write filters and does not save.
 */
export function readJa11Eq(): Promise<Ja11ReadResult> {
  return lock(async () => {
    const device = current;
    if (!device?.opened || typeof device.sendReport !== "function") {
      return { ok: false, reason: "no-device", detail: "No DAC is open. Nothing was read." };
    }
    if (!ja11ReportsTarget(device)) {
      if (ja11EqOffTarget(device)) {
        const detail = wrongInterfaceDetail(device);
        await closeDevice(device);
        return { ok: false, reason: "not-ja11", detail };
      }
      const name = device.productName?.trim() || "HID device";
      return {
        ok: false,
        reason: "not-ja11",
        detail: `Opened ${name} (${formatHidId(device.vendorId)} / ${formatHidId(device.productId)}). JA11 reports are not sent to this device.`,
      };
    }
    let slot: number | null = null;
    let preamp: number | null = null;
    let count: number | null = null;
    const bands: Array<Ja11ReadBand | undefined> = [];
    const raw: string[] = [];
    let filtersRequested = false;

    const onReport = (event: HidInputReportEventLike) => {
      const data = inputBytes(event);
      if (!data) return;
      if (raw.length < 6) raw.push(`id ${event.reportId}: ${hexBytes(data)}`);
      const parsed = parseJa11InputReport(data);
      if (!parsed || parsed.kind === "other") return;
      if (parsed.kind === "slot") slot = parsed.slot;
      if (parsed.kind === "preamp") preamp = parsed.preamp;
      if (parsed.kind === "count") count = parsed.count;
      if (parsed.kind === "band" && parsed.index >= 0 && parsed.index < 5) {
        bands[parsed.index] = { type: parsed.type, freq: parsed.freq, gain: parsed.gain, q: parsed.q };
      }
    };

    const stop = listenForInput(device, onReport);
    if (!stop) {
      return { ok: false, reason: "failed", detail: "This browser cannot receive HID input reports. Nothing was read." };
    }
    const hint = () => (raw.length === 0 ? " No input report arrived." : ` Last input: ${raw[raw.length - 1]}.`);
    try {
      await device.sendReport(JA11_REPORT_ID, ja11ReadPresetPacket());
      await device.sendReport(JA11_REPORT_ID, ja11ReadCountPacket());
      await device.sendReport(JA11_REPORT_ID, ja11ReadGainPacket());
      const started = Date.now();
      const deadline = started + 4000;
      while (Date.now() < deadline) {
        if (count !== null && !filtersRequested) {
          filtersRequested = true;
          const total = Math.min(5, Math.max(0, count));
          for (let index = 0; index < total; index += 1) {
            await device.sendReport(JA11_REPORT_ID, ja11ReadFilterPacket(index));
          }
        }
        const expected = count === null ? -1 : Math.min(5, Math.max(0, count));
        let filled = 0;
        if (expected >= 0) {
          for (let index = 0; index < expected; index += 1) if (bands[index]) filled += 1;
        }
        const bandsReady = expected >= 0 && filled >= expected;
        if (bandsReady && slot !== null && preamp !== null) break;
        if (bandsReady && Date.now() - started > 1200) break;
        await delay(40);
      }
      if (count === null) {
        return {
          ok: false,
          reason: "timeout",
          detail: `The DAC did not return the filter count. Nothing was written.${hint()}`,
        };
      }
      const expected = Math.min(5, Math.max(0, count));
      const received: Ja11ReadBand[] = [];
      for (let index = 0; index < expected; index += 1) {
        const band = bands[index];
        if (band) received.push(band);
      }
      if (expected > 0 && received.length === 0) {
        return {
          ok: false,
          reason: "timeout",
          detail: `The DAC did not return EQ bands. Nothing was written.${hint()}`,
        };
      }
      return { ok: true, eq: { slot, preamp, bands: received, expected, reportedCount: count } };
    } catch (error) {
      return { ok: false, reason: "failed", detail: `${browserDetail(error)} Nothing was written.${hint()}` };
    } finally {
      stop();
    }
  });
}

/** Previously permitted JA11, without opening it. */
export function permittedJa11Present(): Promise<boolean> {
  const hid = hidApi();
  if (!hid) return Promise.resolve(false);
  return lock(async () => {
    try {
      const granted = await hid.getDevices();
      return granted.some((device) => ja11ReportsTarget(device));
    } catch {
      return false;
    }
  });
}

export type EqOffResult = "sent" | "skipped" | "failed";

export function ja11EqOffTarget(identity?: { vendorId?: number; productId?: number } | null): boolean {
  return identity?.vendorId === JA11_VENDOR_ID && identity?.productId === JA11_PRODUCT_ID;
}

/** Sends only the documented EQ-off switch and save. Skips any other device. */
export function sendDocumentedEqOff(): Promise<EqOffResult> {
  return lock(async () => {
    const device = current;
    if (!device?.opened || !ja11ReportsTarget(device) || typeof device.sendReport !== "function") return "skipped";
    try {
      await device.sendReport(JA11_REPORT_ID, EQ_OFF_SWITCH);
      await new Promise((resolve) => setTimeout(resolve, 100));
      await device.sendReport(JA11_REPORT_ID, EQ_OFF_SAVE);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return "sent";
    } catch {
      return "failed";
    }
  });
}

export function watchHid(onEvent: (kind: "connect" | "disconnect") => void): () => void {
  const hid = hidApi();
  if (!hid) return () => undefined;
  const onConnect = () => onEvent("connect");
  const onDisconnect = () => onEvent("disconnect");
  hid.addEventListener("connect", onConnect);
  hid.addEventListener("disconnect", onDisconnect);
  return () => {
    hid.removeEventListener("connect", onConnect);
    hid.removeEventListener("disconnect", onDisconnect);
  };
}

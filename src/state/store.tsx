import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { builtInPresets, FACTORY_PREVIEW, type Preset } from "../data/presets";
import { writeDarkness } from "../lib/displayAdjustments";
import { dacCurveSentence, dacEditorName, matchCurveToPresets } from "../eq/match";
import { effectivePreamp, eqSignature, factoryResetModel, flatModel, normalizeEq, type Band, type EqModel } from "../eq/types";
import {
  closeCurrent,
  dacLabel,
  formatHidId,
  hidUnavailableDetail,
  JA11_LIVE_FLUSH_MS,
  ja11EqOffTarget,
  ja11SaveDropPending,
  ja11SaveReconnectPermit,
  ja11SaveReconnects,
  ja11SlotPlainName,
  NO_DAC_DETAIL,
  noteJa11SaveReconnectAttempt,
  noteJa11SaveReconnectSuccess,
  beginDeferredHidScan,
  cancelDeferredHidScan,
  completeDeferredHidScan,
  connectGrantedHid,
  openPermittedDevice,
  permittedJa11Present,
  readJa11Eq,
  requestAnyHid,
  requestKnownDac,
  sendDocumentedEqOff,
  sendJa11Editor,
  unpairDevice,
  watchHid,
  webHidAvailable,
  type DacIdentity,
  type HidFailReason,
  type HidResult,
  type Ja11ReadBand,
  type Ja11WriteEditor,
  type Ja11WriteMode,
} from "../lib/hid";
import { loadState, saveState, themeColorScheme, userPresetFromEq, type Look, type Settings } from "../lib/storage";
import { readWorkSlots, writeWorkSlots, type SlotId as WorkSlotId, type WorkSlot } from "../lib/workSlots";

export type ScreenId = "studio" | "presets" | "transfer" | "device" | "settings";
export type SlotId = "off" | "vocal" | "classic" | "bass" | "user1";
export type DacMode = "static" | "live";
export type AbSide = "A" | "B";

export interface DeviceState {
  phase: "idle" | "opening" | "connected" | "unsupported" | "error";
  identity?: DacIdentity;
  detail: string;
  reason?: HidFailReason;
}

export type DacReading =
  | {
      ok: true;
      slotName: string | null;
      preamp: number | null;
      bands: Ja11ReadBand[];
      expected: number;
      summary: string;
      exact: boolean;
    }
  | { ok: false; detail: string };

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

interface StoreValue {
  screen: ScreenId;
  setScreen: (screen: ScreenId) => void;
  slot: SlotId;
  setSlot: (slot: SlotId) => void;
  /** Static edits stay on this computer. Live edits flush to an open JA11. */
  dacMode: DacMode;
  setDacMode: (mode: DacMode) => void;
  activeSlot: "1" | "2" | "3" | "4";
  selectSlot: (id: "1" | "2" | "3" | "4") => void;
  copyEq: () => void;
  pasteEq: () => void;
  canPaste: boolean;
  undoEdit: () => void;
  canUndo: boolean;
  redoEdit: () => void;
  canRedo: boolean;
  /** Blocks graph and band edits in the current mode. */
  editLocked: boolean;
  setEditLocked: (locked: boolean) => void;
  /** Side the editor matches, or the last side stored or loaded. */
  ab: AbSide;
  /** Write the current editor into that stored curve. */
  storeSide: (side: AbSide) => void;
  /** Load a specific stored curve. Flushes a live JA11 when one is open. */
  hearSide: (side: AbSide) => Promise<void>;
  /** Load the other stored curve. Flushes a live JA11 when one is open. */
  toggleAb: () => Promise<void>;
  active: EqModel;
  preview: EqModel;
  previewLocked: boolean;
  selectedBand: number;
  setSelectedBand: (index: number) => void;
  updateBand: (index: number, patch: Partial<Band>) => void;
  setAutoPreamp: (enabled: boolean) => void;
  setPreamp: (preamp: number) => void;
  matchFactory: () => Promise<void>;
  setName: (name: string) => void;
  dirty: boolean;
  requestSave: () => void;
  confirmOpen: boolean;
  cancelSave: () => void;
  confirmSave: () => void;
  loadFactoryIntoUser: () => void;
  applyPreset: (preset: Preset) => void;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  theme: Look;
  setTheme: (theme: Look) => void;
  dark: boolean;
  setDark: (dark: boolean) => void;
  themeIntensity: number;
  setThemeIntensity: (intensity: number) => void;
  resetUser1: () => void;
  factoryReset: () => Promise<void>;
  userPresets: Preset[];
  saveToLibrary: (name: string) => void;
  deleteUserPreset: (id: string) => void;
  renameUserPreset: (id: string, name: string) => void;
  device: DeviceState;
  connectKnown: () => Promise<void>;
  connectAny: () => Promise<void>;
  pairNewDac: () => void;
  pairAnyDac: () => void;
  connectFromPicker: (
    pick:
      | { mode: "paired"; vendorId: number; productId?: number }
      | { mode: "deferred"; deviceId: string },
  ) => Promise<void>;
  disconnect: () => Promise<void>;
  unpairCurrent: () => Promise<void>;
  unpairTarget: (vendorId?: number, productId?: number) => Promise<boolean>;
  canWriteDac: boolean;
  dacBusy: boolean;
  dacActionReason: string;
  flushToDac: () => Promise<void>;
  saveToDac: () => Promise<void>;
  readFromDac: () => Promise<void>;
  clearDacReading: () => void;
  setDacReading: (reading: DacReading | null) => void;
  dacReading: DacReading | null;
  devicePickerOpen: boolean;
  setDevicePickerOpen: (open: boolean) => void;
  importText: string;
  setImportText: (text: string) => void;
  openImport: (text: string) => void;
  status: string;
  notify: (message: string) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function connectedStatus(identity: DacIdentity): string {
  return `${dacLabel(identity)} connected. The editor was not changed.`;
}

function connectedDetail(identity: DacIdentity): string {
  return `Opened ${dacLabel(identity)} (${formatHidId(identity.vendorId)} / ${formatHidId(identity.productId)}).`;
}

const DAC_MODE_KEY = "ja11-dac-mode";
const EDIT_LOCK_KEY = "ja11-edit-lock";

function writeDacMode(mode: DacMode): void {
  try {
    localStorage.setItem(DAC_MODE_KEY, mode);
  } catch {
    /* storage blocked */
  }
}

function readEditLocked(): boolean {
  try {
    return localStorage.getItem(EDIT_LOCK_KEY) === "1";
  } catch {
    return false;
  }
}

function writeEditLocked(locked: boolean): void {
  try {
    localStorage.setItem(EDIT_LOCK_KEY, locked ? "1" : "0");
  } catch {
    /* storage blocked */
  }
}

const LIVE_STATUS = "Live. Edits reach the DAC. Flash is not written until you press Save to DAC.";
const LIVE_SENDING = "Live. Sending the curve now. Flash is not written.";
const LIVE_SENT = "Live. Sent to the DAC now. Flash was not written.";
const DAC_READY =
  "Live. Dragging, band controls, and level match reach the DAC shortly after you stop. Save to DAC writes flash and may disconnect the dongle once.";

function editorPayload(eq: EqModel): Ja11WriteEditor {
  const model = normalizeEq(eq);
  return {
    preamp: effectivePreamp(model),
    bands: model.bands.map((band) => ({
      type: band.type,
      freq: band.freq,
      gain: band.gain,
      q: band.q,
      enabled: band.enabled,
    })),
  };
}

/** What a temporary flush would send. The preset name stays on this computer. */
function liveSignature(eq: EqModel): string {
  const model = normalizeEq(eq);
  return JSON.stringify({
    preamp: effectivePreamp(model),
    bands: model.bands.map((band) => [band.type, band.freq, band.enabled ? band.gain : 0, band.q, band.enabled ? 1 : 0]),
  });
}

function dacBlockReason(device: DeviceState): string | null {
  if (device.phase === "connected" && device.identity) {
    if (ja11EqOffTarget(device.identity)) return null;
    return `Opened ${dacLabel(device.identity)} (${formatHidId(device.identity.vendorId)} / ${formatHidId(device.identity.productId)}). JA11 reports are not sent to this device.`;
  }
  if (device.phase === "opening") return "Waiting for a DAC. Edits stay on this computer.";
  if (device.phase === "unsupported" || device.phase === "error") return device.detail || "No DAC is open. Edits stay on this computer.";
  return "No DAC is open. Edits stay on this computer.";
}

function patchEq(eq: EqModel, recipe: (current: EqModel) => EqModel): EqModel {
  return normalizeEq(recipe(eq));
}

function otherSide(side: AbSide): AbSide {
  return side === "A" ? "B" : "A";
}

/** A when the editor is stored A, B when it is stored B, otherwise the last chosen side. */
function sideForEditor(editor: EqModel, curveA: EqModel, curveB: EqModel, remembered: AbSide): AbSide {
  const signature = eqSignature(editor);
  const matchA = signature === eqSignature(curveA);
  const matchB = signature === eqSignature(curveB);
  if (matchA && !matchB) return "A";
  if (matchB && !matchA) return "B";
  return remembered;
}

function systemAppearance(): { look: Look; dark: boolean } {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return dark ? { look: "cyan", dark: true } : { look: "cyan-light", dark: false };
}

function applyTheme(look: Look, dark: boolean, intensity: number) {
  const root = document.documentElement;
  root.dataset.theme = look;
  root.dataset.mode = dark ? "dark" : "light";
  root.style.colorScheme = themeColorScheme(dark);
  if (dark) {
    root.style.setProperty("--darkness", String(intensity / 100));
    root.style.setProperty("--papein-darkness-level", String(intensity));
    root.style.setProperty("--papein-darkness", `${intensity}%`);
  } else {
    root.style.removeProperty("--darkness");
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(() => loadState(), []);
  const [screen, setScreen] = useState<ScreenId>("studio");
  const [slot, setSlot] = useState<SlotId>("user1");
  const seededSlots = readWorkSlots(initial.editor);
  const [workSlots, setWorkSlots] = useState<WorkSlot[]>(seededSlots.slots);
  const [activeSlot, setActiveSlot] = useState<WorkSlotId>(seededSlots.active);
  const [dacMode, setDacModeState] = useState<DacMode>(
    () => seededSlots.slots.find((slot) => slot.id === seededSlots.active)?.mode ?? "static",
  );
  const [editLocked, setEditLockedState] = useState(() => readEditLocked());
  const [canPaste, setCanPaste] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const undoStack = useRef<EqModel[]>([]);
  const [canRedo, setCanRedo] = useState(false);
  const redoStack = useRef<EqModel[]>([]);
  const eqClipboard = useRef<EqModel | null>(null);
  const [ab, setAb] = useState<AbSide>(initial.ab);
  const [draftA, setDraftA] = useState<EqModel>(initial.draftA);
  const [draftB, setDraftB] = useState<EqModel>(initial.draftB);
  const [editor, setEditor] = useState<EqModel>(initial.editor);
  const [saved, setSaved] = useState<EqModel>(initial.saved);
  const [selectedBand, setSelectedBand] = useState(0);
  const [settings, setSettings] = useState<Settings>(initial.settings);
  const [systemTheme, setSystemTheme] = useState(systemAppearance);
  const theme = settings.theme ?? systemTheme.look;
  const dark = typeof settings.dark === "boolean" ? settings.dark : systemTheme.dark;
  applyTheme(theme, dark, settings.themeIntensity);
  const [userPresets, setUserPresets] = useState<Preset[]>(initial.userPresets);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const hidReady = webHidAvailable();
  const initialDetail = hidReady ? NO_DAC_DETAIL : hidUnavailableDetail();
  const [status, setStatus] = useState(initialDetail);
  const [dacBusy, setDacBusy] = useState(false);
  const [dacNote, setDacNote] = useState("");
  const [dacReading, setDacReading] = useState<DacReading | null>(null);
  const [devicePickerOpen, setDevicePickerOpen] = useState(false);
  const dacBusyRef = useRef(false);
  const [device, setDevice] = useState<DeviceState>(
    hidReady ? { phase: "idle", detail: initialDetail } : { phase: "unsupported", detail: initialDetail, reason: "no-hid" },
  );
  const deviceRef = useRef(device);
  deviceRef.current = device;
  const slotRef = useRef(slot);
  slotRef.current = slot;
  const dacModeRef = useRef(dacMode);
  dacModeRef.current = dacMode;
  const editLockedRef = useRef(editLocked);
  editLockedRef.current = editLocked;
  const epoch = useRef(0);
  const resumeLiveRef = useRef(false);
  const liveTimer = useRef<number | null>(null);
  const liveGen = useRef(0);
  const liveBase = useRef<string | null>(null);
  const liveChain = useRef<Promise<void>>(Promise.resolve());
  const liveQueued = useRef(false);

  useEffect(() => {
    if (settings.theme || typeof settings.dark === "boolean") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => setSystemTheme(media.matches ? { look: "cyan", dark: true } : { look: "cyan-light", dark: false });
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [settings.theme, settings.dark]);

  useEffect(() => {
    applyTheme(theme, dark, settings.themeIntensity);
  }, [theme, dark, settings.themeIntensity]);

  function showConnected(identity: DacIdentity) {
    setDevice({ phase: "connected", identity, detail: connectedDetail(identity) });
    if (ja11SaveDropPending()) return;
    if (ja11EqOffTarget(identity)) {
      setDacNote(LIVE_STATUS);
      setStatus(LIVE_STATUS);
      return;
    }
    setStatus(connectedStatus(identity));
  }

  function showHidResult(result: HidResult, keepCurrentOnCancel: boolean) {
    if (!result.ok && result.reason === "busy") {
      if (deviceRef.current.phase === "opening") {
        setDevice({ phase: "idle", detail: "DAC is busy. Press Connect again." });
        setStatus("DAC is busy. Press Connect again.");
      }
      return;
    }
    if (result.ok) {
      showConnected(result.identity);
      return;
    }
    const previous = deviceRef.current;
    const cancelled = result.reason === "dismissed" || result.reason === "none-chosen" || result.reason === "choose-any";
    if (keepCurrentOnCancel && cancelled && previous.phase === "connected" && previous.identity) {
      setStatus(connectedStatus(previous.identity));
      return;
    }
    if (result.reason === "none" || result.reason === "none-chosen" || result.reason === "dismissed") {
      setDevice({ phase: "idle", detail: result.detail });
      setStatus(result.detail);
      return;
    }
    const phase = result.reason === "no-hid" ? "unsupported" : "error";
    setDevice({ phase, detail: result.detail, reason: result.reason });
    setStatus(result.detail);
  }

  const applyRef = useRef(showHidResult);
  applyRef.current = showHidResult;

  useEffect(() => {
    if (!webHidAvailable()) return;
    let alive = true;
    let reconnectTimer: number | null = null;
    let reconnectDue = 0;
    let saveReopenRunning = false;
    let quietUntil = 0;
    const seen = epoch.current;
    void openPermittedDevice().then((result) => {
      if (!alive || epoch.current !== seen) return;
      applyRef.current(result, false);
    });

    const stop = watchHid((kind) => {
      const eventEpoch = epoch.current;

      function scheduleReopen(delayMs: number) {
        if (saveReopenRunning || ja11SaveReconnectPermit() !== "open") return;
        const due = Date.now() + delayMs;
        if (reconnectTimer != null && due >= reconnectDue) return;
        if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
        reconnectDue = due;
        const scheduledEpoch = epoch.current;
        reconnectTimer = window.setTimeout(() => {
          reconnectTimer = null;
          void reopenAfterSave(scheduledEpoch);
        }, delayMs);
      }

      async function reopenAfterSave(scheduledEpoch: number) {
        if (saveReopenRunning) return;
        saveReopenRunning = true;
        try {
          while (ja11SaveReconnectPermit() === "open") {
            if (!alive || epoch.current !== scheduledEpoch) return;
            noteJa11SaveReconnectAttempt();
            const result = await openPermittedDevice();
            if (!alive || epoch.current !== scheduledEpoch) {
              if (result.ok) await closeCurrent();
              return;
            }
            if (!result.ok && result.reason === "busy") return;
            if (result.ok) {
              noteJa11SaveReconnectSuccess();
              resumeLiveRef.current = true;
              quietUntil = Date.now() + 10000;
              applyRef.current(result, false);
              const detail = "Live. Reconnected once after save. Edits reach the DAC again.";
              setDacNote(detail);
              setStatus(detail);
              setDevice((current) => ({
                ...current,
                detail: current.detail.includes(detail) ? current.detail : `${current.detail} ${detail}`,
              }));
              return;
            }
            if (ja11SaveReconnectPermit() !== "open") break;
            await wait(700);
          }
          if (!alive || epoch.current !== scheduledEpoch || ja11SaveReconnects() > 0) return;
          const detail = "The DAC did not reopen after save. Auto-reconnect stopped so it does not loop.";
          setDacNote(detail);
          setDevice({ phase: "idle", detail });
          setStatus(detail);
        } finally {
          saveReopenRunning = false;
        }
      }

      if (ja11SaveDropPending() && ja11SaveReconnectPermit() === "stopped") return;

      if (ja11SaveDropPending() && ja11SaveReconnects() === 0 && ja11SaveReconnectPermit() === "open") {
        if (kind === "disconnect") {
          const detail = "Saved to USER1 on the DAC. The dongle disconnected and may reconnect.";
          setDacNote(detail);
          setDevice({ phase: "idle", detail });
          setStatus(detail);
          scheduleReopen(1500);
          return;
        }
        scheduleReopen(800);
        return;
      }

      if (Date.now() < quietUntil || (ja11SaveDropPending() && ja11SaveReconnects() >= 1)) {
        if (kind === "disconnect") {
          void permittedJa11Present().then((present) => {
            if (!alive || epoch.current !== eventEpoch || present) return;
            const detail = "The DAC dropped again after reconnecting. Auto-reconnect stopped so it does not loop.";
            setDacNote(detail);
            setDevice({ phase: "idle", detail });
            setStatus(detail);
          });
        }
        return;
      }

      void openPermittedDevice().then((result) => {
        if (!alive || epoch.current !== eventEpoch || (!result.ok && result.reason === "busy")) return;
        if (kind === "disconnect" && !result.ok && result.reason === "none") {
          setDacNote("");
          setDevice({ phase: "idle", detail: "The DAC disconnected. The editor on this computer was not changed." });
          setStatus("DAC disconnected. The editor on this computer was not changed.");
          return;
        }
        applyRef.current(result, false);
      });
    });
    return () => {
      alive = false;
      if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
      stop();
    };
  }, []);

  const active = editor;
  const activeRef = useRef(active);
  activeRef.current = active;
  const draftARef = useRef(draftA);
  draftARef.current = draftA;
  const draftBRef = useRef(draftB);
  draftBRef.current = draftB;
  const abRef = useRef(ab);
  abRef.current = ab;
  const shownAb = sideForEditor(editor, draftA, draftB, ab);
  const heard = liveSignature(active);
  const ja11Open = device.phase === "connected" && ja11EqOffTarget(device.identity);

  function cancelLive() {
    liveGen.current += 1;
    liveQueued.current = false;
    resumeLiveRef.current = false;
    if (liveTimer.current != null) {
      window.clearTimeout(liveTimer.current);
      liveTimer.current = null;
    }
  }

  function enqueueLive(gen: number, manual: boolean): Promise<void> {
    if (!manual && liveQueued.current) return liveChain.current;
    if (!manual) liveQueued.current = true;
    const job = liveChain.current.then(() => {
      if (!manual) liveQueued.current = false;
      return deliverLive(gen, manual);
    });
    liveChain.current = job.then(
      () => undefined,
      () => undefined,
    );
    return job;
  }

  async function deliverLive(gen: number, manual: boolean) {
    if (gen !== liveGen.current) return;
    if (ja11SaveDropPending() && !manual) return;
    const blocked = dacBlockReason(deviceRef.current);
    if (blocked || dacModeRef.current !== "live" || editLockedRef.current) {
      if (manual && blocked) {
        setDacNote("");
        setStatus(blocked);
      }
      return;
    }
    const signature = liveSignature(activeRef.current);
    const payload = editorPayload(activeRef.current);
    liveBase.current = signature;
    if (manual) setStatus(LIVE_SENDING);
    const result = await sendJa11Editor(payload, "flush");
    if (gen !== liveGen.current) return;
    if (liveSignature(activeRef.current) === signature) liveBase.current = signature;
    resumeLiveRef.current = false;
    if (!result.ok) {
      if (result.reason === "no-device" || ja11SaveDropPending()) return;
      const message = `Live update failed. ${result.detail}`;
      setDacNote(message);
      setStatus(message);
      return;
    }
    if (manual) {
      setDacNote(LIVE_SENT);
      setStatus(LIVE_SENT);
    }
  }

  const enqueueRef = useRef(enqueueLive);
  enqueueRef.current = enqueueLive;

  useEffect(() => {
    if (!ja11Open) {
      liveBase.current = null;
      return;
    }
    if (dacMode !== "live" || editLocked) {
      liveBase.current = heard;
      return;
    }
    if (liveBase.current === heard && !resumeLiveRef.current) return;
    const firstSight = liveBase.current === null;
    if (firstSight && !resumeLiveRef.current) {
      liveBase.current = heard;
      return;
    }
    const gen = liveGen.current;
    const id = window.setTimeout(() => {
      if (liveTimer.current === id) liveTimer.current = null;
      if (gen !== liveGen.current) return;
      void enqueueRef.current(gen, false);
    }, JA11_LIVE_FLUSH_MS);
    liveTimer.current = id;
    return () => {
      window.clearTimeout(id);
      if (liveTimer.current === id) liveTimer.current = null;
    };
  }, [heard, ja11Open, dacMode, editLocked]);

  useEffect(() => {
    saveState({ settings, saved, draftA, draftB, editor, ab, userPresets });
  }, [settings, saved, draftA, draftB, editor, ab, userPresets]);

  useEffect(() => {
    setWorkSlots((current) => {
      const next = current.map((slot) =>
        slot.id === activeSlot ? { ...slot, eq: editor, mode: dacMode } : slot,
      );
      writeWorkSlots(activeSlot, next);
      return next;
    });
  }, [editor, dacMode, activeSlot]);

  function writeEditor(next: EqModel) {
    const model = normalizeEq(next);
    activeRef.current = model;
    setEditor(model);
    return model;
  }

  function rememberUndo() {
    undoStack.current = [...undoStack.current.slice(-29), normalizeEq(activeRef.current)];
    setCanUndo(true);
    redoStack.current = [];
    setCanRedo(false);
  }

  function undoEdit() {
    if (editLockedRef.current) return;
    const previous = undoStack.current.pop();
    setCanUndo(undoStack.current.length > 0);
    if (!previous) return;
    redoStack.current.push(normalizeEq(activeRef.current));
    setCanRedo(true);
    writeEditor(previous);
    setStatus("Undid the last edit.");
  }

  function redoEdit() {
    if (editLockedRef.current) return;
    const next = redoStack.current.pop();
    setCanRedo(redoStack.current.length > 0);
    if (!next) return;
    undoStack.current.push(normalizeEq(activeRef.current));
    setCanUndo(true);
    writeEditor(next);
    setStatus("Redid the last edit.");
  }

  function selectSlot(id: WorkSlotId) {
    if (editLockedRef.current) {
      setStatus("Unlock the editor to switch slots.");
      return;
    }
    if (id === activeSlot) return;
    const target = workSlots.find((slot) => slot.id === id);
    if (!target) return;
    const savedBank = workSlots.map((slot) =>
      slot.id === activeSlot ? { ...slot, eq: normalizeEq(activeRef.current), mode: dacModeRef.current } : slot,
    );
    setWorkSlots(savedBank);
    setActiveSlot(id);
    dacModeRef.current = target.mode;
    setDacModeState(target.mode);
    writeDacMode(target.mode);
    writeWorkSlots(id, savedBank);
    undoStack.current = [];
    setCanUndo(false);
    redoStack.current = [];
    setCanRedo(false);
    writeEditor(target.eq);
    liveBase.current = liveSignature(target.eq);
    setStatus(
      target.mode === "live"
        ? `Slot ${id} is live. The next edit is sent to an open DAC.`
        : `Slot ${id} is static. The DAC was not written.`,
    );
  }

  function copyEq() {
    eqClipboard.current = normalizeEq(activeRef.current);
    setCanPaste(true);
    setStatus(`Copied “${eqClipboard.current.name}”. Paste it into another slot.`);
  }

  function pasteEq() {
    if (editLockedRef.current) {
      setStatus("Unlock the editor before pasting.");
      return;
    }
    if (!eqClipboard.current) return;
    rememberUndo();
    writeEditor(eqClipboard.current);
    setStatus(
      dacModeRef.current === "live"
        ? `Pasted “${eqClipboard.current.name}” into live slot ${activeSlot}.`
        : `Pasted “${eqClipboard.current.name}” into static slot ${activeSlot}. The DAC was not written.`,
    );
  }

  function rememberSide(side: AbSide) {
    abRef.current = side;
    setAb(side);
  }

  function writeSnapshot(side: AbSide, next: EqModel) {
    const model = normalizeEq(next);
    if (side === "A") {
      draftARef.current = model;
      setDraftA(model);
    } else {
      draftBRef.current = model;
      setDraftB(model);
    }
    return model;
  }

  function replaceActive(recipe: (current: EqModel) => EqModel) {
    writeEditor(patchEq(activeRef.current, recipe));
  }

  function storeSide(side: AbSide) {
    if (editLockedRef.current) {
      setStatus("Unlock the editor to store a side.");
      return;
    }
    writeSnapshot(side, activeRef.current);
    rememberSide(side);
    setStatus(side === "A" ? "Stored this curve as A." : "Stored this curve as B.");
  }

  function hearSide(side: AbSide): Promise<void> {
    const snapshot = side === "A" ? draftARef.current : draftBRef.current;
    writeEditor(snapshot);
    rememberSide(side);
    const live = deviceRef.current;
    if (dacModeRef.current !== "live" || editLockedRef.current || live.phase !== "connected" || !ja11EqOffTarget(live.identity)) {
      setStatus(`Hearing ${side}. The DAC was not written.`);
      return Promise.resolve();
    }
    if (dacBusyRef.current) {
      setStatus(`Hearing ${side}. The DAC is busy, so it was not written.`);
      return Promise.resolve();
    }
    if (liveTimer.current != null) {
      window.clearTimeout(liveTimer.current);
      liveTimer.current = null;
    }
    liveBase.current = liveSignature(activeRef.current);
    return enqueueLive(liveGen.current, true);
  }

  const previewLocked = editLocked;
  const preview = active;
  const dirty = eqSignature(active) !== eqSignature(saved);

  function setDacMode(mode: DacMode) {
    dacModeRef.current = mode;
    setDacModeState(mode);
    writeDacMode(mode);
    setWorkSlots((current) => {
      const next = current.map((slot) => (slot.id === activeSlot ? { ...slot, mode, eq: normalizeEq(activeRef.current) } : slot));
      writeWorkSlots(activeSlot, next);
      return next;
    });
    liveBase.current = liveSignature(activeRef.current);
    setStatus(
      mode === "live"
        ? "Live slot. The next edit is sent to an open DAC. Flash is not written until Save to DAC."
        : "Static slot. Edits stay on this computer until you switch to Live.",
    );
  }

  function setEditLocked(locked: boolean) {
    editLockedRef.current = locked;
    setEditLockedState(locked);
    writeEditLocked(locked);
    if (locked) cancelLive();
    setStatus(locked ? "Editor locked." : "Editor unlocked.");
  }

  function commitSave() {
    const next = writeEditor(activeRef.current);
    setSaved(next);
    setConfirmOpen(false);
    setStatus("Saved on this computer. The DAC was not written.");
  }

  const dacBlock = dacBlockReason(device);
  const canWriteDac = dacBlock === null && !dacBusy;
  const dacActionReason = dacBusy
    ? status
    : ja11SaveDropPending() && dacNote
      ? dacNote
      : (dacBlock ?? (dacNote || DAC_READY));

  async function writeDac(mode: Ja11WriteMode) {
    if (dacBusyRef.current) return;
    const live = deviceRef.current;
    const blocked = dacBlockReason(live);
    if (blocked) {
      setDacNote("");
      setStatus(blocked);
      return;
    }
    const editor = editorPayload(activeRef.current);
    dacBusyRef.current = true;
    setDacBusy(true);
    setStatus(mode === "flush" ? "Live. Sending the curve now. Flash is not written." : "Saving the USER1 editor to DAC flash…");
    const result = await sendJa11Editor(editor, mode);
    dacBusyRef.current = false;
    setDacBusy(false);
    if (!result.ok) {
      const message = mode === "flush" ? `Live update failed. ${result.detail}` : `Save to DAC failed. ${result.detail}`;
      setDacNote(message);
      setStatus(message);
      return;
    }
    const message = mode === "flush" ? LIVE_SENT : "Saved the USER1 editor to JA11 USER1 flash. This is permanent. The dongle may disconnect and reconnect.";
    setDacNote(message);
    setStatus(message);
  }

  const value: StoreValue = {
    screen,
    setScreen,
    slot,
    setSlot,
    dacMode,
    setDacMode,
    activeSlot,
    selectSlot,
    copyEq,
    pasteEq,
    canPaste,
    undoEdit,
    canUndo,
    redoEdit,
    canRedo,
    editLocked,
    setEditLocked,
    ab: shownAb,
    storeSide,
    hearSide,
    toggleAb: () => hearSide(otherSide(sideForEditor(activeRef.current, draftARef.current, draftBRef.current, abRef.current))),
    active,
    preview,
    previewLocked,
    selectedBand,
    setSelectedBand,
    updateBand: (index, patch) => {
      if (editLockedRef.current) return;
      rememberUndo();
      replaceActive((eq) => ({
        ...eq,
        bands: eq.bands.map((band, bandIndex) => (bandIndex === index ? { ...band, ...patch } : band)),
      }));
    },
    setAutoPreamp: (enabled) => {
      if (editLockedRef.current) return;
      rememberUndo();
      replaceActive((eq) => ({ ...eq, autoPreamp: enabled }));
    },
    setPreamp: (preamp) => {
      if (editLockedRef.current) return;
      rememberUndo();
      replaceActive((eq) => ({ ...eq, autoPreamp: false, preamp }));
    },
    matchFactory: () => {
      if (editLockedRef.current) return Promise.resolve();
      const next = writeEditor({ ...activeRef.current, autoPreamp: true });
      const live = deviceRef.current;
      if (dacModeRef.current !== "live" || live.phase !== "connected" || !ja11EqOffTarget(live.identity)) {
        setStatus("Auto level match is on. The DAC was not written.");
        return Promise.resolve();
      }
      if (liveTimer.current != null) {
        window.clearTimeout(liveTimer.current);
        liveTimer.current = null;
      }
      liveBase.current = liveSignature(next);
      return enqueueLive(liveGen.current, true);
    },
    setName: (name) => {
      if (editLockedRef.current) return;
      replaceActive((eq) => ({ ...eq, name }));
    },
    dirty,
    requestSave: () => {
      if (slot !== "user1") {
        setStatus("Switch to USER1 to save. Factory slots are not writable from this app.");
        return;
      }
      if (settings.confirmBeforeSave) setConfirmOpen(true);
      else commitSave();
    },
    confirmOpen,
    cancelSave: () => setConfirmOpen(false),
    confirmSave: commitSave,
    loadFactoryIntoUser: () => {
      if (slot === "off" || slot === "user1") return;
      const preset = FACTORY_PREVIEW[slot];
      writeEditor({ ...preset.eq, name: preset.name });
      setSlot("user1");
      setScreen("studio");
      setStatus(`Loaded “${preset.name}” into USER1. It is an original approximation, not firmware.`);
    },
    applyPreset: (preset) => {
      if (editLockedRef.current) {
        setStatus("Unlock the editor before loading a preset.");
        return;
      }
      writeEditor({ ...preset.eq, name: preset.name });
      setSlot("user1");
      setScreen("studio");
      setSelectedBand(0);
      setStatus(
        dacModeRef.current === "live"
          ? `Loaded “${preset.name}” into the live slot. The next send updates the DAC. Flash is not written.`
          : `Loaded “${preset.name}” into the static slot. The DAC was not written.`,
      );
    },
    settings,
    updateSettings: (patch) => setSettings((current) => ({ ...current, ...patch })),
    theme,
    setTheme: (next) => {
      applyTheme(next, dark, settings.themeIntensity);
      setSettings((current) => ({ ...current, theme: next, dark }));
    },
    dark,
    setDark: (next) => {
      applyTheme(theme, next, settings.themeIntensity);
      setSettings((current) => ({ ...current, theme, dark: next }));
    },
    themeIntensity: settings.themeIntensity,
    setThemeIntensity: (intensity) => {
      const themeIntensity = Math.round(Math.min(100, Math.max(0, intensity)));
      if (dark) document.documentElement.style.setProperty("--darkness", String(themeIntensity / 100));
      writeDarkness(themeIntensity);
      setSettings((current) => ({ ...current, themeIntensity }));
    },
    resetUser1: () => {
      const next = normalizeEq({ ...flatModel("Flat"), autoPreamp: settings.autoPreampDefault });
      const side = sideForEditor(activeRef.current, draftARef.current, draftBRef.current, abRef.current);
      writeEditor(next);
      writeSnapshot(side, next);
      rememberSide(side);
      setSlot("user1");
      setScreen("studio");
      setStatus("USER1 was reset to flat on this computer. It is unsaved until you press Save.");
    },
    factoryReset: async () => {
      if (liveTimer.current != null) {
        window.clearTimeout(liveTimer.current);
        liveTimer.current = null;
      }
      const next = factoryResetModel();
      liveBase.current = liveSignature(next);
      const side = sideForEditor(activeRef.current, draftARef.current, draftBRef.current, abRef.current);
      writeEditor(next);
      writeSnapshot(side, next);
      rememberSide(side);
      setSlot("user1");
      setSelectedBand(0);
      const live = deviceRef.current;
      if (live.phase !== "connected" || !ja11EqOffTarget(live.identity)) {
        setStatus("Editor reset to a flat five-band curve. It is unsaved. The DAC was not written.");
        return;
      }
      setStatus("Sending EQ off to the DAC…");
      const result = await sendDocumentedEqOff();
      setStatus(
        result === "sent"
          ? "Editor reset to a flat five-band curve. It is unsaved. EQ off was sent to the DAC."
          : "Editor reset to a flat five-band curve. It is unsaved. The DAC was not written.",
      );
    },
    userPresets,
    saveToLibrary: (name) => {
      const id = `user-${Date.now()}`;
      const preset = userPresetFromEq({ ...active, name }, id);
      setUserPresets((current) => [preset, ...current]);
      setStatus(`“${preset.name}” is in My presets on this computer.`);
    },
    deleteUserPreset: (id) => {
      setUserPresets((current) => current.filter((preset) => preset.id !== id));
      setStatus("Removed that preset from this computer.");
    },
    renameUserPreset: (id, name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setUserPresets((current) =>
        current.map((preset) =>
          preset.id === id
            ? {
                ...preset,
                name: trimmed,
                eq: { ...preset.eq, name: trimmed },
              }
            : preset,
        ),
      );
      setStatus(`Renamed preset to “${trimmed}”.`);
    },
    device,
    canWriteDac,
    dacBusy,
    dacActionReason,
    flushToDac: () => {
      if (liveTimer.current != null) {
        window.clearTimeout(liveTimer.current);
        liveTimer.current = null;
      }
      const blocked = dacBlockReason(deviceRef.current);
      if (blocked) {
        setDacNote("");
        setStatus(blocked);
        return Promise.resolve();
      }
      return enqueueLive(liveGen.current, true);
    },
    saveToDac: () => {
      if (dacModeRef.current !== "live") {
        setStatus("Static slot does not write the DAC. Switch to Live, then Save to DAC.");
        return Promise.resolve();
      }
      cancelLive();
      return writeDac("save");
    },
    dacReading,
    readFromDac: async () => {
      if (dacBusyRef.current) return;
      const blocked = dacBlockReason(deviceRef.current);
      if (blocked) {
        setDacNote("");
        setStatus(blocked);
        return;
      }
      if (liveTimer.current != null) {
        window.clearTimeout(liveTimer.current);
        liveTimer.current = null;
      }
      dacBusyRef.current = true;
      setDacBusy(true);
      setStatus("Reading the EQ from the DAC…");
      const result = await readJa11Eq();
      dacBusyRef.current = false;
      setDacBusy(false);
      if (!result.ok) {
        setDacReading({ ok: false, detail: result.detail });
        setDacNote(result.detail);
        setStatus(`Read failed. ${result.detail}`);
        return;
      }
      const slotName = result.eq.slot == null ? null : ja11SlotPlainName(result.eq.slot);
      const presets = [...userPresets, ...builtInPresets];
      let summary = "The DAC reported no EQ bands.";
      let exact = false;
      if (result.eq.expected > 0 && result.eq.bands.length > 0) {
        const match = matchCurveToPresets(result.eq.bands, presets);
        exact = match.exactNames.length > 0;
        const partial =
          result.eq.bands.length < result.eq.expected
            ? `The DAC returned ${result.eq.bands.length} of ${result.eq.expected} bands. `
            : "";
        summary = `${partial}${dacCurveSentence(result.eq.bands, match, presets)}`;
        const readBands = result.eq.bands.slice(0, 5).map((band) => ({
          type: band.type,
          freq: band.freq,
          gain: band.gain,
          q: band.q,
          enabled: true,
        }));
        while (readBands.length < 5) {
          readBands.push({ type: "pk", freq: 1000, gain: 0, q: 1, enabled: true });
        }
        const preamp = result.eq.preamp;
        const nextEq = normalizeEq({
          name: dacEditorName(match),
          bands: readBands,
          preamp: preamp ?? activeRef.current.preamp,
          autoPreamp: preamp == null ? activeRef.current.autoPreamp : false,
        });
        liveBase.current = liveSignature(nextEq);
        replaceActive(() => nextEq);
        setSlot("user1");
      }
      setDacReading({
        ok: true,
        slotName,
        preamp: result.eq.preamp,
        bands: result.eq.bands,
        expected: result.eq.expected,
        summary,
        exact,
      });
      setDacNote(summary);
      const slotText = slotName ? ` ${slotName}.` : " Slot not reported.";
      const landing =
        dacModeRef.current === "live"
          ? " Loaded into this live slot."
          : " Loaded into this static slot. The DAC was not changed. Copy it, open a live slot, and Paste to hear it.";
      setStatus(`Read the EQ on the DAC.${slotText} ${summary}${landing}`);
    },
    clearDacReading: () => setDacReading(null),
    setDacReading: (r: DacReading | null) => setDacReading(r),
    devicePickerOpen,
    setDevicePickerOpen: (open: boolean) => {
      setDevicePickerOpen(open);
      if (open) {
        void beginDeferredHidScan();
      } else {
        void cancelDeferredHidScan();
      }
    },
    connectKnown: async () => {
      epoch.current += 1;
      const seen = epoch.current;
      if (!webHidAvailable()) {
        const detail = hidUnavailableDetail();
        setDevice({ phase: "unsupported", detail, reason: "no-hid" });
        setStatus(detail);
        return;
      }
      if (deviceRef.current.phase !== "connected") {
        setDevice((current) => ({ ...current, phase: "opening", detail: "Waiting for a DAC…" }));
        setStatus("Waiting for a DAC…");
      }
      const permitted = await openPermittedDevice();
      if (permitted.ok) {
        if (epoch.current !== seen) return;
        showHidResult(permitted, true);
        return;
      }
      const result = await requestKnownDac();
      if (epoch.current !== seen) return;
      showHidResult(result, true);
    },
    connectAny: async () => {
      epoch.current += 1;
      const seen = epoch.current;
      if (!webHidAvailable()) {
        const detail = hidUnavailableDetail();
        setDevice({ phase: "unsupported", detail, reason: "no-hid" });
        setStatus(detail);
        return;
      }
      if (deviceRef.current.phase !== "connected") {
        setDevice((current) => ({ ...current, phase: "opening", detail: "Waiting for a DAC…" }));
        setStatus("Waiting for a DAC…");
      }
      const result = await requestAnyHid();
      if (epoch.current !== seen) return;
      showHidResult(result, true);
    },
    pairNewDac: () => {
      epoch.current += 1;
      const seen = epoch.current;
      if (!webHidAvailable()) {
        const detail = hidUnavailableDetail();
        setDevice({ phase: "unsupported", detail, reason: "no-hid" });
        setStatus(detail);
        return;
      }
      setDevice((current) => ({ ...current, phase: "opening", detail: "Waiting for a DAC…" }));
      setStatus("Waiting for a DAC…");
      // Execute requestKnownDac synchronously without awaiting prior promises to retain user gesture
      void requestKnownDac().then((result) => {
        if (epoch.current !== seen) return;
        showHidResult(result, true);
      });
    },
    connectFromPicker: async (pick) => {
      epoch.current += 1;
      const seen = epoch.current;
      if (!webHidAvailable()) {
        const detail = hidUnavailableDetail();
        setDevice({ phase: "unsupported", detail, reason: "no-hid" });
        setStatus(detail);
        return;
      }
      setDevice((current) => ({ ...current, phase: "opening", detail: "Waiting for a DAC…" }));
      setStatus("Waiting for a DAC…");
      let result: HidResult;
      if (pick.mode === "paired") {
        await cancelDeferredHidScan();
        result = await connectGrantedHid(pick.vendorId, pick.productId);
      } else {
        result = await completeDeferredHidScan(pick.deviceId);
        await cancelDeferredHidScan();
      }
      if (epoch.current !== seen) return;
      showHidResult(result, true);
    },
    pairAnyDac: () => {
      epoch.current += 1;
      const seen = epoch.current;
      if (!webHidAvailable()) {
        const detail = hidUnavailableDetail();
        setDevice({ phase: "unsupported", detail, reason: "no-hid" });
        setStatus(detail);
        return;
      }
      setDevice((current) => ({ ...current, phase: "opening", detail: "Waiting for a DAC…" }));
      setStatus("Waiting for a DAC…");
      // Execute requestAnyHid synchronously without awaiting prior promises to retain user gesture
      void requestAnyHid().then((result) => {
        if (epoch.current !== seen) return;
        showHidResult(result, true);
      });
    },
    disconnect: async () => {
      cancelLive();
      liveBase.current = null;
      epoch.current += 1;
      await closeCurrent();
      setDacNote("");
      setDevice({ phase: "idle", detail: NO_DAC_DETAIL });
      setStatus(NO_DAC_DETAIL);
    },
    unpairCurrent: async () => {
      cancelLive();
      liveBase.current = null;
      epoch.current += 1;
      await cancelDeferredHidScan();
      const identity = deviceRef.current.identity;
      await unpairDevice(identity?.vendorId, identity?.productId);
      await closeCurrent();
      setDacNote("");
      setDevice({ phase: "idle", detail: NO_DAC_DETAIL });
      setStatus("Device unpaired and removed from computer.");
    },
    unpairTarget: async (vendorId?: number, productId?: number) => {
      epoch.current += 1;
      await cancelDeferredHidScan();
      if (deviceRef.current.phase === "connected" || deviceRef.current.phase === "opening") {
        await closeCurrent();
      }
      const res = await unpairDevice(vendorId, productId);
      setDevice({ phase: "idle", detail: NO_DAC_DETAIL });
      setStatus(res ? "Device unpaired." : "Unpair did not complete. Try again.");
      return res;
    },
    importText,
    setImportText,
    openImport: (text) => {
      setImportText(text);
      setScreen("transfer");
    },
    status,
    notify: setStatus,
  };

  if (typeof window !== "undefined") {
    (window as any).__store = value;
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("Store missing");
  return value;
}

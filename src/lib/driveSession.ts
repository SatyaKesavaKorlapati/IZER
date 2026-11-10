import type { DriveStatus } from "./driveClient";

const KEY = "ja11-drive-ui";

export type DriveCheckVisual = "idle" | "checking" | "ok" | "fail";

export type DriveUiSnapshot = {
  status: DriveStatus | null;
  note: string;
  checkVisual: DriveCheckVisual;
  uploadProgress: number | null;
  uploadPhase: string;
  pending: string | null;
  updatedAt: number;
};

const defaultSnapshot: DriveUiSnapshot = {
  status: null,
  note: "",
  checkVisual: "idle",
  uploadProgress: null,
  uploadPhase: "",
  pending: null,
  updatedAt: 0,
};

export function readDriveUi(): DriveUiSnapshot {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return { ...defaultSnapshot };
    const data = JSON.parse(raw) as Partial<DriveUiSnapshot>;
    return {
      ...defaultSnapshot,
      ...data,
      status: data.status ?? null,
    };
  } catch {
    return { ...defaultSnapshot };
  }
}

export function writeDriveUi(patch: Partial<DriveUiSnapshot>): DriveUiSnapshot {
  const next = { ...readDriveUi(), ...patch, updatedAt: Date.now() };
  sessionStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearDriveUploadUi(): void {
  writeDriveUi({ uploadProgress: null, uploadPhase: "", pending: null });
}

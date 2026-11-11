import { builtInPresets, type Preset } from "../data/presets";

export type DriveStatus = {
  rclone: boolean;
  connected: boolean;
  verified: boolean;
  linking: boolean;
  remote: string;
  detail: string;
  checkedAt: string;
  linkError?: string;
  adoptFrom?: string | null;
  accountLabel?: string | null;
  storageUsed?: string | null;
  storageTotal?: string | null;
};

export type DriveExportFile = {
  relativePath: string;
  body: unknown;
};

export type DriveUploadItem = {
  id: string;
  label: string;
  status: "queued" | "active" | "done" | "error" | "cancelled";
  active?: boolean;
  percent: number;
  phase: string;
  detail: string;
  fileCount?: number;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
};

export type DriveUploadProgress = {
  current: DriveUploadItem | null;
  queued: Array<{ id: string; label: string; status: "queued"; fileCount: number; detail: string }>;
  history: DriveUploadItem[];
  active: boolean;
  percent: number;
  phase: string;
  detail: string;
};

const DRIVE_CACHE_KEY = "ja11-drive-verified";

type DriveElectronBridge = {
  driveApiBase?: string;
};

function driveApiUrl(apiPath: string): string {
  const bridge = (window as Window & { electronAPI?: DriveElectronBridge }).electronAPI;
  const base = bridge?.driveApiBase?.replace(/\/$/, "");
  if (base) return `${base}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;
  return apiPath;
}

async function driveFetch(apiPath: string, init?: RequestInit): Promise<Response> {
  return fetch(driveApiUrl(apiPath), init);
}

export function readCachedDriveVerified(): boolean {
  try {
    return localStorage.getItem(DRIVE_CACHE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeCachedDriveVerified(verified: boolean): void {
  try {
    if (verified) localStorage.setItem(DRIVE_CACHE_KEY, "1");
    else localStorage.removeItem(DRIVE_CACHE_KEY);
  } catch {
    /* storage blocked */
  }
}

export type SortPresetMode = "name-asc" | "name-desc" | "category" | "favorites-first";

export function sortPresets(
  presets: Preset[],
  mode: SortPresetMode,
  favoriteIds: Set<string>,
): Preset[] {
  const list = [...presets];
  const byName = (a: Preset, b: Preset) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  if (mode === "name-desc") list.sort((a, b) => byName(b, a));
  else if (mode === "name-asc") list.sort(byName);
  else if (mode === "category") {
    list.sort((a, b) => {
      const cat = a.category.localeCompare(b.category, undefined, { sensitivity: "base" });
      return cat !== 0 ? cat : byName(a, b);
    });
  } else if (mode === "favorites-first") {
    list.sort((a, b) => {
      const af = favoriteIds.has(a.id) ? 0 : 1;
      const bf = favoriteIds.has(b.id) ? 0 : 1;
      if (af !== bf) return af - bf;
      return byName(a, b);
    });
  }
  return list;
}

function slimPreset(preset: Preset): Omit<Preset, "sourceText"> & { sourceText?: undefined } {
  const { sourceText: _drop, ...rest } = preset;
  return rest;
}

function presetFileName(preset: Preset): string {
  const slug =
    preset.name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "preset";
  const idPart = preset.id.replace(/[^a-z0-9_-]+/gi, "").slice(0, 16);
  return `${slug}__${idPart}.json`;
}

export function buildDriveExportFiles(userPresets: Preset[], favorites: string[]): DriveExportFile[] {
  const exportedAt = new Date().toISOString();
  const builtIn = builtInPresets.map(slimPreset);
  const user = userPresets.map(slimPreset);
  const files: DriveExportFile[] = [
    {
      relativePath: "library-index.json",
      body: {
        version: 1,
        app: "izer",
        exportedAt,
        counts: { builtIn: builtIn.length, mySaves: user.length, favorites: favorites.length },
        folders: { builtIn: "built-in", mySaves: "my-saves" },
      },
    },
    { relativePath: "favorites.json", body: { updatedAt: exportedAt, presetIds: favorites } },
    {
      relativePath: "README.txt",
      body:
        "izer preset library export\n" +
        `Exported: ${exportedAt}\n` +
        "Folders:\n" +
        "  built-in/   Factory and measured curves (read-only in app)\n" +
        "  my-saves/   Curves you saved from Studio\n" +
        "Files are named like: basetrumental-enhanced__original-id.json\n",
    },
  ];
  for (const preset of builtIn) {
    files.push({ relativePath: `built-in/${presetFileName(preset)}`, body: preset });
  }
  for (const preset of user) {
    files.push({ relativePath: `my-saves/${presetFileName(preset)}`, body: preset });
  }
  return files;
}

export async function fetchDriveStatus(): Promise<DriveStatus> {
  const response = await driveFetch("/api/drive/status");
  if (!response.ok) throw new Error("Could not reach the sync service. Restart IZER on this computer.");
  return (await response.json()) as DriveStatus;
}

export async function connectGoogleDrive(): Promise<{ ok: boolean; detail: string; pending?: boolean }> {
  const response = await driveFetch("/api/drive/connect", { method: "POST" });
  return (await response.json()) as { ok: boolean; detail: string; pending?: boolean };
}

export async function disconnectGoogleDrive(): Promise<{ ok: boolean; detail: string }> {
  const response = await driveFetch("/api/drive/disconnect", { method: "POST" });
  return (await response.json()) as { ok: boolean; detail: string };
}

export async function adoptExistingGoogleDrive(): Promise<{ ok: boolean; detail: string }> {
  const response = await driveFetch("/api/drive/adopt", { method: "POST" });
  return (await response.json()) as { ok: boolean; detail: string };
}

export async function fetchUploadProgress(): Promise<DriveUploadProgress> {
  const response = await driveFetch("/api/drive/progress");
  return (await response.json()) as DriveUploadProgress;
}

export async function startLibraryUpload(
  userPresets: Preset[],
  favorites: string[],
): Promise<{ ok: boolean; detail: string; started?: boolean; queued?: boolean; id?: string }> {
  const files = buildDriveExportFiles(userPresets, favorites);
  const label = `Preset library · ${new Date().toLocaleString()}`;
  const response = await driveFetch("/api/drive/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files, label }),
  });
  return (await response.json()) as { ok: boolean; detail: string; started?: boolean; queued?: boolean; id?: string };
}

export async function cancelDriveUpload(id?: string): Promise<{ ok: boolean; detail: string }> {
  const response = await driveFetch("/api/drive/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(id ? { id } : {}),
  });
  return (await response.json()) as { ok: boolean; detail: string };
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function syncLibraryToDrive(
  userPresets: Preset[],
  favorites: string[],
  onProgress?: (progress: DriveUploadProgress) => void,
): Promise<{ ok: boolean; detail: string }> {
  const started = await startLibraryUpload(userPresets, favorites);
  if (!started.ok) return { ok: false, detail: started.detail };

  for (let attempt = 0; attempt < 1200; attempt += 1) {
    await waitMs(500);
    const progress = await fetchUploadProgress();
    onProgress?.(progress);
    if (!progress.active) {
      const current = progress.current;
      if (current?.status === "done" || progress.percent >= 100) {
        return { ok: true, detail: current?.detail ?? progress.detail };
      }
      if (current?.status === "cancelled") {
        return { ok: false, detail: current.detail ?? "Upload cancelled." };
      }
      return { ok: false, detail: current?.error ?? current?.detail ?? progress.detail ?? "Upload failed." };
    }
  }
  return { ok: false, detail: "Upload timed out. Check Google Drive and try again." };
}

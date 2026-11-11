import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import type { Plugin, PreviewServer, ViteDevServer } from "vite";

const REMOTE = "izer_gdrive";
const DRIVE_PATH = "izer/Presets";

type DriveStatus = {
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

type DriveExportFile = {
  relativePath: string;
  body: unknown;
};

type UploadStatus = "queued" | "active" | "done" | "error" | "cancelled";

type UploadRecord = {
  id: string;
  label: string;
  status: UploadStatus;
  active: boolean;
  percent: number;
  phase: string;
  detail: string;
  fileCount: number;
  startedAt: string;
  finishedAt?: string;
  error?: string;
};

type PendingUpload = {
  id: string;
  label: string;
  files: DriveExportFile[];
};

type UploadProgressPayload = {
  current: UploadRecord | null;
  queued: Array<{ id: string; label: string; status: "queued"; fileCount: number; detail: string }>;
  history: UploadRecord[];
  active: boolean;
  percent: number;
  phase: string;
  detail: string;
};

type LinkState = {
  busy: boolean;
  error?: string;
};

let linkState: LinkState = { busy: false };
let linkJob: Promise<void> | null = null;
let uploadCurrent: UploadRecord | null = null;
let uploadPending: PendingUpload[] = [];
let uploadHistory: UploadRecord[] = [];
let activeRcloneProc: ChildProcess | null = null;
let cancelRequested = false;
const UPLOAD_HISTORY_MAX = 8;

function uploadProgressPayload(): UploadProgressPayload {
  const current = uploadCurrent;
  return {
    current,
    queued: uploadPending.map((item) => ({
      id: item.id,
      label: item.label,
      status: "queued" as const,
      fileCount: item.files.length,
      detail: "Waiting in queue…",
    })),
    history: uploadHistory,
    active: current?.status === "active",
    percent: current?.percent ?? 0,
    phase: current?.phase ?? "idle",
    detail: current?.detail ?? (uploadPending.length ? "Upload queued." : "No upload running."),
  };
}

function pushUploadHistory(record: UploadRecord): void {
  uploadHistory.unshift(record);
  if (uploadHistory.length > UPLOAD_HISTORY_MAX) uploadHistory.length = UPLOAD_HISTORY_MAX;
}

function startNextUpload(): void {
  if (uploadCurrent?.status === "active") return;
  const next = uploadPending.shift();
  if (!next) return;
  void runUploadJob(next.files, next.id, next.label);
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size < 10 ? size.toFixed(1) : Math.round(size)} ${units[unit]}`;
}

async function readDriveQuota(): Promise<{ used?: string; total?: string } | null> {
  const probe = await run("rclone", ["about", `${REMOTE}:`, "--json"], 35_000);
  if (probe.code !== 0) return null;
  try {
    const data = JSON.parse(probe.out) as { used?: number; total?: number };
    return {
      used: data.used != null ? formatBytes(data.used) : undefined,
      total: data.total != null ? formatBytes(data.total) : undefined,
    };
  } catch {
    return null;
  }
}

function accountLabelFromQuota(quota: { used?: string; total?: string } | null): string {
  if (quota?.used && quota?.total) return `Google Drive · ${quota.used} of ${quota.total} used`;
  return "Google Drive · signed in on this PC";
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function run(cmd: string, args: string[], timeoutMs = 120_000): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { shell: false, windowsHide: true });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      proc.kill();
      resolve({ code: -1, out, err: `${err}\nTimed out after ${timeoutMs}ms`.trim() });
    }, timeoutMs);
    proc.stdout?.on("data", (d: Buffer | string) => {
      out += String(d);
    });
    proc.stderr?.on("data", (d: Buffer | string) => {
      err += String(d);
    });
    proc.on("close", (code: number | null) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, out, err });
    });
    proc.on("error", (e: Error) => {
      clearTimeout(timer);
      resolve({ code: -1, out, err: e.message });
    });
  });
}

function friendlyRcloneError(raw: string): string {
  const text = raw.trim();
  if (!text) return "Could not reach Google Drive.";
  if (/empty token/i.test(text)) {
    return "Google sign-in did not finish on this PC. Press Remove link, then Connect again.";
  }
  if (/failed to create oauth client/i.test(text)) {
    return "No Google token saved. Press Remove link, then Connect again.";
  }
  if (/shared Google Drive client_id/i.test(text) && !/CRITICAL/i.test(text)) {
    return "Google Drive is linked. The shared-app notice from rclone is safe to ignore.";
  }
  const critical = text.match(/CRITICAL:\s*(.+)/i)?.[1];
  if (critical) {
    return critical.replace(/^Failed to create file system for "[^"]+":\s*/i, "").slice(0, 240);
  }
  const line =
    text.split(/\r?\n/).find((entry) => /CRITICAL|ERROR:/i.test(entry)) ??
    text.split(/\r?\n/).find((entry) => entry.trim() && !/NOTICE:/i.test(entry)) ??
    text.split(/\r?\n/)[0];
  return line.replace(/^\d{4}\/\d{2}\/\d{2}[^:]*:\s*/, "").slice(0, 240);
}

function extractTokenJson(output: string): string | null {
  const text = output.trim();
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

async function rclonePresent(): Promise<boolean> {
  const probe = await run("rclone", ["version"], 15_000);
  return probe.code === 0;
}

async function readRemoteConfig(): Promise<{ type?: string; token?: string } | null> {
  const dump = await run("rclone", ["config", "dump"], 20_000);
  if (dump.code !== 0) return null;
  try {
    const cfg = JSON.parse(dump.out) as Record<string, { type?: string; token?: string }>;
    return cfg[REMOTE] ?? null;
  } catch {
    return null;
  }
}

async function remoteListed(): Promise<boolean> {
  const list = await run("rclone", ["listremotes"], 20_000);
  if (list.code !== 0) return false;
  return list.out.split(/\r?\n/).some((line) => line.trim() === `${REMOTE}:`);
}

async function purgeBrokenRemote(): Promise<void> {
  const entry = await readRemoteConfig();
  if (entry?.type === "drive" && !entry.token?.trim()) {
    await removeRemote();
  }
}

async function remoteConfigured(): Promise<boolean> {
  await purgeBrokenRemote();
  const entry = await readRemoteConfig();
  if (!entry || entry.type !== "drive") return false;
  if (!entry.token?.trim()) return false;
  return remoteListed();
}

async function readConfigDump(): Promise<Record<string, { type?: string; token?: string; scope?: string; team_drive?: string }>> {
  const dump = await run("rclone", ["config", "dump"], 20_000);
  if (dump.code !== 0) return {};
  try {
    return JSON.parse(dump.out) as Record<string, { type?: string; token?: string; scope?: string; team_drive?: string }>;
  } catch {
    return {};
  }
}

async function findAdoptableRemote(): Promise<string | null> {
  const cfg = await readConfigDump();
  for (const name of Object.keys(cfg)) {
    if (name === REMOTE) continue;
    const entry = cfg[name];
    if (entry.type !== "drive" || !entry.token?.trim()) continue;
    const probe = await run("rclone", ["lsd", `${name}:`, "--max-depth", "1"], 25_000);
    if (probe.code === 0) return name;
  }
  return null;
}

async function verifyDriveAccess(): Promise<{ ok: boolean; detail: string }> {
  const probe = await run("rclone", ["lsd", `${REMOTE}:`, "--max-depth", "1"], 35_000);
  if (probe.code === 0) {
    return { ok: true, detail: `Google Drive is linked. Uploads go to ${REMOTE}:${DRIVE_PATH}/` };
  }
  return { ok: false, detail: friendlyRcloneError(probe.err || probe.out) };
}

async function removeRemote(): Promise<void> {
  await run("rclone", ["config", "delete", REMOTE], 20_000);
}

function tokenLooksValid(tokenJson: string): boolean {
  try {
    const parsed = JSON.parse(tokenJson) as { access_token?: string; refresh_token?: string };
    return Boolean(parsed.access_token?.trim() || parsed.refresh_token?.trim());
  } catch {
    return false;
  }
}

async function writeRemoteFromToken(tokenJson: string, scope = "drive", teamDrive = ""): Promise<{ ok: boolean; detail: string }> {
  await removeRemote();
  const create = await run(
    "rclone",
    [
      "config",
      "create",
      REMOTE,
      "drive",
      `token=${tokenJson}`,
      `scope=${scope}`,
      `team_drive=${teamDrive}`,
      "--non-interactive",
    ],
    60_000,
  );
  if (create.code !== 0) {
    return { ok: false, detail: friendlyRcloneError(create.err || create.out) || "Could not save the Google link." };
  }

  const saved = await readRemoteConfig();
  if (!saved?.token?.trim()) {
    await removeRemote();
    return { ok: false, detail: "Google token was not saved. Press Remove link, then Connect again." };
  }

  const verify = await verifyDriveAccess();
  return verify.ok ? { ok: true, detail: verify.detail } : { ok: false, detail: verify.detail };
}

async function writeRemoteConfig(tokenJson: string): Promise<{ ok: boolean; detail: string }> {
  const trimmed = extractTokenJson(tokenJson);
  if (!trimmed || !tokenLooksValid(trimmed)) {
    return { ok: false, detail: "No token returned from Google sign-in." };
  }
  return writeRemoteFromToken(trimmed);
}

async function adoptExistingRemote(sourceName: string): Promise<{ ok: boolean; detail: string }> {
  const cfg = await readConfigDump();
  const source = cfg[sourceName];
  if (!source || source.type !== "drive" || !source.token?.trim()) {
    return { ok: false, detail: `Remote ${sourceName} is not available.` };
  }
  return writeRemoteFromToken(source.token, source.scope ?? "drive", source.team_drive ?? "");
}

function normalizeLinkState(): void {
  if (linkState.busy && !linkJob) {
    linkState = { busy: false, error: linkState.error };
  }
}

async function driveStatus(): Promise<DriveStatus> {
  normalizeLinkState();
  const checkedAt = new Date().toISOString();
  const rclone = await rclonePresent();
  const adoptFrom = rclone ? await findAdoptableRemote() : null;
  if (!rclone) {
    return {
      rclone: false,
      connected: false,
      verified: false,
      linking: linkState.busy,
      remote: REMOTE,
      detail: "Install rclone from rclone.org and restart IZER.",
      checkedAt,
      linkError: linkState.error,
      adoptFrom,
    };
  }

  const configured = await remoteConfigured();
  if (!configured) {
    return {
      rclone: true,
      connected: false,
      verified: false,
      linking: linkState.busy,
      remote: REMOTE,
      detail: linkState.busy
        ? "Finish Google sign-in in the browser window, then press Check connection."
        : adoptFrom
          ? `izer is not linked yet. You can connect with Google or reuse your existing ${adoptFrom} account.`
          : "Not linked yet. Connect Google Drive once — it stays linked until you remove it.",
      checkedAt,
      linkError: linkState.error,
      adoptFrom,
    };
  }

  const verify = await verifyDriveAccess();
  const quota = verify.ok ? await readDriveQuota() : null;
  const accountLabel = verify.ok ? accountLabelFromQuota(quota) : null;
  return {
    rclone: true,
    connected: true,
    verified: verify.ok,
    linking: linkState.busy,
    remote: REMOTE,
    detail: verify.ok
      ? `${accountLabel}. Uploads go to ${REMOTE}:${DRIVE_PATH}/`
      : verify.detail,
    checkedAt,
    linkError: verify.ok ? linkState.error : verify.detail,
    adoptFrom: verify.ok ? null : adoptFrom,
    accountLabel,
    storageUsed: quota?.used ?? null,
    storageTotal: quota?.total ?? null,
  };
}

async function writeExportTree(root: string, files: DriveExportFile[]): Promise<void> {
  for (const file of files) {
    const filePath = path.join(root, file.relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const text =
      typeof file.body === "string"
        ? file.body
        : JSON.stringify(file.body, null, 2);
    await fs.writeFile(filePath, text, "utf8");
  }
}

function patchCurrent(patch: Partial<UploadRecord>): void {
  if (!uploadCurrent) return;
  uploadCurrent = { ...uploadCurrent, ...patch, active: patch.status ? patch.status === "active" : uploadCurrent.active };
}

function runCopyWithProgress(
  localRoot: string,
  target: string,
  onProgress: (percent: number, detail: string) => void,
): Promise<{ code: number; out: string; err: string; cancelled: boolean }> {
  return new Promise((resolve) => {
    const proc = spawn(
      "rclone",
      ["copy", localRoot, target, "--create-empty-src-dirs", "-P", "--stats-one-line", "--stats", "1s"],
      { shell: false, windowsHide: true },
    );
    activeRcloneProc = proc;
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      proc.kill();
      activeRcloneProc = null;
      resolve({ code: -1, out, err: `${err}\nTimed out`.trim(), cancelled: false });
    }, 600_000);
    const handleChunk = (chunk: Buffer | string) => {
      if (cancelRequested) return;
      const text = String(chunk);
      err += text;
      const pct = text.match(/(\d{1,3})%/);
      if (pct) {
        const value = Math.min(98, Math.max(25, Number(pct[1])));
        onProgress(value, "Uploading to Google Drive…");
      }
      const line = text
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .find((entry) => entry.includes("Transferred:") || entry.includes("%"));
      if (line) onProgress(uploadCurrent?.percent ?? 30, line.slice(0, 120));
    };
    proc.stdout?.on("data", (d: Buffer | string) => {
      out += String(d);
      handleChunk(d);
    });
    proc.stderr?.on("data", handleChunk);
    proc.on("close", (code: number | null) => {
      clearTimeout(timer);
      activeRcloneProc = null;
      const cancelled = cancelRequested;
      resolve({ code: code ?? -1, out, err, cancelled });
    });
    proc.on("error", (e: Error) => {
      clearTimeout(timer);
      activeRcloneProc = null;
      resolve({ code: -1, out, err: e.message, cancelled: cancelRequested });
    });
  });
}

async function runUploadJob(files: DriveExportFile[], id: string, label: string): Promise<void> {
  cancelRequested = false;
  const startedAt = new Date().toISOString();
  const fileCount = files.length;
  uploadCurrent = {
    id,
    label,
    status: "active",
    active: true,
    percent: 3,
    phase: "prepare",
    detail: "Preparing preset files…",
    fileCount,
    startedAt,
  };
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "izer-drive-"));
  const localRoot = path.join(tmp, "izer", "Presets");
  try {
    patchCurrent({ percent: 12, phase: "write", detail: "Writing local export…" });
    await writeExportTree(localRoot, files);
    if (cancelRequested) throw new Error("cancelled");
    patchCurrent({
      percent: 22,
      phase: "upload",
      detail: `Uploading ${fileCount} files to Google Drive…`,
    });
    const target = `${REMOTE}:${DRIVE_PATH}`;
    const copy = await runCopyWithProgress(localRoot, target, (percent, detail) => {
      patchCurrent({ percent, phase: "upload", detail });
    });
    const finishedAt = new Date().toISOString();
    if (copy.cancelled || cancelRequested) {
      const record: UploadRecord = {
        ...(uploadCurrent as UploadRecord),
        status: "cancelled",
        active: false,
        percent: uploadCurrent?.percent ?? 0,
        phase: "cancelled",
        detail: "Upload cancelled.",
        finishedAt,
      };
      pushUploadHistory(record);
      return;
    }
    if (copy.code !== 0) {
      const message = friendlyRcloneError(copy.err || copy.out);
      const record: UploadRecord = {
        ...(uploadCurrent as UploadRecord),
        status: "error",
        active: false,
        phase: "error",
        detail: message,
        error: message,
        finishedAt,
      };
      pushUploadHistory(record);
      return;
    }
    const record: UploadRecord = {
      ...(uploadCurrent as UploadRecord),
      status: "done",
      active: false,
      percent: 100,
      phase: "done",
      detail: `Uploaded to ${target}/ (${fileCount} files)`,
      finishedAt,
    };
    pushUploadHistory(record);
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const message = error instanceof Error && error.message === "cancelled" ? "Upload cancelled." : error instanceof Error ? error.message : "Upload failed.";
    const record: UploadRecord = {
      ...(uploadCurrent as UploadRecord),
      status: cancelRequested ? "cancelled" : "error",
      active: false,
      phase: cancelRequested ? "cancelled" : "error",
      detail: message,
      error: cancelRequested ? undefined : message,
      finishedAt,
    };
    pushUploadHistory(record);
  } finally {
    uploadCurrent = null;
    cancelRequested = false;
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined);
    startNextUpload();
  }
}

function enqueueUpload(files: DriveExportFile[], label: string): { id: string; queued: boolean } {
  const id = `up-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const job: PendingUpload = { id, label, files };
  const busy = uploadCurrent?.status === "active";
  if (busy) {
    uploadPending.push(job);
    return { id, queued: true };
  }
  void runUploadJob(job.files, job.id, job.label);
  return { id, queued: false };
}

function cancelUpload(jobId?: string): { ok: boolean; detail: string } {
  if (jobId) {
    const index = uploadPending.findIndex((item) => item.id === jobId);
    if (index === -1) {
      if (uploadCurrent?.id === jobId && uploadCurrent.status === "active") {
        cancelRequested = true;
        activeRcloneProc?.kill("SIGTERM");
        return { ok: true, detail: "Cancelling active upload…" };
      }
      return { ok: false, detail: "Upload not found in queue." };
    }
    const job = uploadPending[index];
    uploadPending.splice(index, 1);
    pushUploadHistory({
      id: jobId,
      label: job.label,
      status: "cancelled",
      active: false,
      percent: 0,
      phase: "cancelled",
      detail: "Removed from queue.",
      fileCount: job.files.length,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    });
    return { ok: true, detail: "Removed queued upload." };
  }
  if (uploadCurrent?.status === "active") {
    cancelRequested = true;
    activeRcloneProc?.kill("SIGTERM");
    return { ok: true, detail: "Cancelling active upload…" };
  }
  if (uploadPending.length) {
    const removed = uploadPending.length;
    uploadPending = [];
    return { ok: true, detail: `Cleared ${removed} queued upload(s).` };
  }
  return { ok: false, detail: "No upload to cancel." };
}

async function runConnectJob(): Promise<void> {
  linkState = { busy: true };
  try {
    const existing = await remoteConfigured();
    if (existing) {
      const verify = await verifyDriveAccess();
      if (verify.ok) {
        linkState = { busy: false };
        return;
      }
      await removeRemote();
    }

    const auth = await run("rclone", ["authorize", "drive"], 300_000);
    const combined = `${auth.out}\n${auth.err}`;
    if (auth.code !== 0 && !extractTokenJson(combined)) {
      linkState = { busy: false, error: auth.err || auth.out || "Google sign-in was cancelled." };
      return;
    }

    const result = await writeRemoteConfig(combined);
    if (!result.ok) {
      linkState = { busy: false, error: result.detail };
      console.warn("[drive-api] link failed:", result.detail);
      return;
    }

    linkState = { busy: false };
    console.log("[drive-api]", result.detail);
  } catch (error) {
    linkState = {
      busy: false,
      error: error instanceof Error ? error.message : "Connect failed.",
    };
  } finally {
    linkJob = null;
  }
}

async function handleDriveApiRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (!url.pathname.startsWith("/api/drive")) return false;
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return true;
  }
  const route = url.pathname;

  try {
    if (route === "/api/drive/status" && req.method === "GET") {
      sendJson(res, 200, await driveStatus());
      return true;
    }

    if (route === "/api/drive/connect" && req.method === "POST") {
      const rclone = await rclonePresent();
      if (!rclone) {
        sendJson(res, 503, { ok: false, detail: "rclone is not installed." });
        return true;
      }

      const status = await driveStatus();
      if (status.verified) {
        sendJson(res, 200, { ok: true, detail: status.detail, alreadyLinked: true });
        return true;
      }

      if (linkState.busy || linkJob) {
        sendJson(res, 200, {
          ok: true,
          pending: true,
          detail: "Sign-in already in progress. Finish Google login, then press Check connection.",
        });
        return true;
      }

      sendJson(res, 200, {
        ok: true,
        pending: true,
        detail: "A Google sign-in window should open. Finish sign-in, then press Check connection.",
      });

      linkJob = runConnectJob();
      return true;
    }

    if (route === "/api/drive/adopt" && req.method === "POST") {
      const rclone = await rclonePresent();
      if (!rclone) {
        sendJson(res, 503, { ok: false, detail: "rclone is not installed." });
        return true;
      }
      const adoptFrom = await findAdoptableRemote();
      if (!adoptFrom) {
        sendJson(res, 400, { ok: false, detail: "No working Google Drive remote found in rclone." });
        return true;
      }
      const result = await adoptExistingRemote(adoptFrom);
      sendJson(res, result.ok ? 200 : 500, { ok: result.ok, detail: result.detail });
      return true;
    }

    if (route === "/api/drive/disconnect" && req.method === "POST") {
      const rclone = await rclonePresent();
      if (!rclone) {
        sendJson(res, 503, { ok: false, detail: "rclone is not installed." });
        return true;
      }
      await removeRemote();
      linkState = { busy: false };
      sendJson(res, 200, { ok: true, detail: "Google Drive removed from this computer. Connect again anytime." });
      return true;
    }

    if (route === "/api/drive/progress" && req.method === "GET") {
      sendJson(res, 200, uploadProgressPayload());
      return true;
    }

    if (route === "/api/drive/cancel" && req.method === "POST") {
      const raw = await readBody(req);
      let jobId: string | undefined;
      if (raw.trim()) {
        const body = JSON.parse(raw) as { id?: string };
        jobId = body.id;
      }
      const result = cancelUpload(jobId);
      sendJson(res, result.ok ? 200 : 400, result);
      return true;
    }

    if (route === "/api/drive/sync" && req.method === "POST") {
      const status = await driveStatus();
      if (!status.rclone) {
        sendJson(res, 503, { ok: false, detail: status.detail });
        return true;
      }
      if (!status.verified) {
        sendJson(res, 400, { ok: false, detail: status.connected ? status.detail : "Connect Google Drive first." });
        return true;
      }
      const raw = await readBody(req);
      const payload = JSON.parse(raw) as { files?: DriveExportFile[]; label?: string };
      if (!payload.files?.length) {
        sendJson(res, 400, { ok: false, detail: "Missing export files." });
        return true;
      }
      const label = payload.label?.trim() || `Preset library · ${payload.files.length} files`;
      const { id, queued } = enqueueUpload(payload.files, label);
      sendJson(res, 202, {
        ok: true,
        id,
        queued,
        started: !queued,
        detail: queued ? "Added to upload queue." : "Upload started.",
      });
      return true;
    }

    sendJson(res, 404, { ok: false, detail: "Not found." });
    return true;
  } catch (error) {
    sendJson(res, 500, { ok: false, detail: error instanceof Error ? error.message : "Server error." });
    return true;
  }
}

function mountDriveApi(server: Pick<ViteDevServer, "middlewares"> | PreviewServer): void {
  server.middlewares.use(async (req, res, next) => {
    if (await handleDriveApiRequest(req, res)) return;
    next();
  });
}

export const DRIVE_API_PORT = 1423;

export function startStandaloneDriveServer(port = DRIVE_API_PORT, host = "127.0.0.1"): http.Server {
  const server = http.createServer((req, res) => {
    void handleDriveApiRequest(req, res).then((handled) => {
      if (!handled) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
      }
    });
  });
  server.listen(port, host);
  return server;
}

export function driveApiPlugin(): Plugin {
  return {
    name: "drive-api",
    configureServer(server) {
      mountDriveApi(server);
    },
    configurePreviewServer(server) {
      mountDriveApi(server);
    },
  };
}

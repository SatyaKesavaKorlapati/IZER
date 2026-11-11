var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// vite-plugins/drive-api.ts
var drive_api_exports = {};
__export(drive_api_exports, {
  DRIVE_API_PORT: () => DRIVE_API_PORT,
  driveApiPlugin: () => driveApiPlugin,
  startStandaloneDriveServer: () => startStandaloneDriveServer
});
module.exports = __toCommonJS(drive_api_exports);
var import_node_child_process = require("node:child_process");
var import_promises = __toESM(require("node:fs/promises"), 1);
var import_node_http = __toESM(require("node:http"), 1);
var import_node_os = __toESM(require("node:os"), 1);
var import_node_path = __toESM(require("node:path"), 1);
var REMOTE = "izer_gdrive";
var DRIVE_PATH = "izer/Presets";
var linkState = { busy: false };
var linkJob = null;
var uploadCurrent = null;
var uploadPending = [];
var uploadHistory = [];
var activeRcloneProc = null;
var cancelRequested = false;
var UPLOAD_HISTORY_MAX = 8;
function uploadProgressPayload() {
  const current = uploadCurrent;
  return {
    current,
    queued: uploadPending.map((item) => ({
      id: item.id,
      label: item.label,
      status: "queued",
      fileCount: item.files.length,
      detail: "Waiting in queue\u2026"
    })),
    history: uploadHistory,
    active: current?.status === "active",
    percent: current?.percent ?? 0,
    phase: current?.phase ?? "idle",
    detail: current?.detail ?? (uploadPending.length ? "Upload queued." : "No upload running.")
  };
}
function pushUploadHistory(record) {
  uploadHistory.unshift(record);
  if (uploadHistory.length > UPLOAD_HISTORY_MAX) uploadHistory.length = UPLOAD_HISTORY_MAX;
}
function startNextUpload() {
  if (uploadCurrent?.status === "active") return;
  const next = uploadPending.shift();
  if (!next) return;
  void runUploadJob(next.files, next.id, next.label);
}
function formatBytes(value) {
  if (!Number.isFinite(value)) return "\u2014";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size < 10 ? size.toFixed(1) : Math.round(size)} ${units[unit]}`;
}
async function readDriveQuota() {
  const probe = await run("rclone", ["about", `${REMOTE}:`, "--json"], 35e3);
  if (probe.code !== 0) return null;
  try {
    const data = JSON.parse(probe.out);
    return {
      used: data.used != null ? formatBytes(data.used) : void 0,
      total: data.total != null ? formatBytes(data.total) : void 0
    };
  } catch {
    return null;
  }
}
function accountLabelFromQuota(quota) {
  if (quota?.used && quota?.total) return `Google Drive \xB7 ${quota.used} of ${quota.total} used`;
  return "Google Drive \xB7 signed in on this PC";
}
function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(body));
}
async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
function run(cmd, args, timeoutMs = 12e4) {
  return new Promise((resolve) => {
    const proc = (0, import_node_child_process.spawn)(cmd, args, { shell: false, windowsHide: true });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      proc.kill();
      resolve({ code: -1, out, err: `${err}
Timed out after ${timeoutMs}ms`.trim() });
    }, timeoutMs);
    proc.stdout?.on("data", (d) => {
      out += String(d);
    });
    proc.stderr?.on("data", (d) => {
      err += String(d);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, out, err });
    });
    proc.on("error", (e) => {
      clearTimeout(timer);
      resolve({ code: -1, out, err: e.message });
    });
  });
}
function friendlyRcloneError(raw) {
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
  const line = text.split(/\r?\n/).find((entry) => /CRITICAL|ERROR:/i.test(entry)) ?? text.split(/\r?\n/).find((entry) => entry.trim() && !/NOTICE:/i.test(entry)) ?? text.split(/\r?\n/)[0];
  return line.replace(/^\d{4}\/\d{2}\/\d{2}[^:]*:\s*/, "").slice(0, 240);
}
function extractTokenJson(output) {
  const text = output.trim();
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}
async function rclonePresent() {
  const probe = await run("rclone", ["version"], 15e3);
  return probe.code === 0;
}
async function readRemoteConfig() {
  const dump = await run("rclone", ["config", "dump"], 2e4);
  if (dump.code !== 0) return null;
  try {
    const cfg = JSON.parse(dump.out);
    return cfg[REMOTE] ?? null;
  } catch {
    return null;
  }
}
async function remoteListed() {
  const list = await run("rclone", ["listremotes"], 2e4);
  if (list.code !== 0) return false;
  return list.out.split(/\r?\n/).some((line) => line.trim() === `${REMOTE}:`);
}
async function purgeBrokenRemote() {
  const entry = await readRemoteConfig();
  if (entry?.type === "drive" && !entry.token?.trim()) {
    await removeRemote();
  }
}
async function remoteConfigured() {
  await purgeBrokenRemote();
  const entry = await readRemoteConfig();
  if (!entry || entry.type !== "drive") return false;
  if (!entry.token?.trim()) return false;
  return remoteListed();
}
async function readConfigDump() {
  const dump = await run("rclone", ["config", "dump"], 2e4);
  if (dump.code !== 0) return {};
  try {
    return JSON.parse(dump.out);
  } catch {
    return {};
  }
}
async function findAdoptableRemote() {
  const cfg = await readConfigDump();
  for (const name of Object.keys(cfg)) {
    if (name === REMOTE) continue;
    const entry = cfg[name];
    if (entry.type !== "drive" || !entry.token?.trim()) continue;
    const probe = await run("rclone", ["lsd", `${name}:`, "--max-depth", "1"], 25e3);
    if (probe.code === 0) return name;
  }
  return null;
}
async function verifyDriveAccess() {
  const probe = await run("rclone", ["lsd", `${REMOTE}:`, "--max-depth", "1"], 35e3);
  if (probe.code === 0) {
    return { ok: true, detail: `Google Drive is linked. Uploads go to ${REMOTE}:${DRIVE_PATH}/` };
  }
  return { ok: false, detail: friendlyRcloneError(probe.err || probe.out) };
}
async function removeRemote() {
  await run("rclone", ["config", "delete", REMOTE], 2e4);
}
function tokenLooksValid(tokenJson) {
  try {
    const parsed = JSON.parse(tokenJson);
    return Boolean(parsed.access_token?.trim() || parsed.refresh_token?.trim());
  } catch {
    return false;
  }
}
async function writeRemoteFromToken(tokenJson, scope = "drive", teamDrive = "") {
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
      "--non-interactive"
    ],
    6e4
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
async function writeRemoteConfig(tokenJson) {
  const trimmed = extractTokenJson(tokenJson);
  if (!trimmed || !tokenLooksValid(trimmed)) {
    return { ok: false, detail: "No token returned from Google sign-in." };
  }
  return writeRemoteFromToken(trimmed);
}
async function adoptExistingRemote(sourceName) {
  const cfg = await readConfigDump();
  const source = cfg[sourceName];
  if (!source || source.type !== "drive" || !source.token?.trim()) {
    return { ok: false, detail: `Remote ${sourceName} is not available.` };
  }
  return writeRemoteFromToken(source.token, source.scope ?? "drive", source.team_drive ?? "");
}
function normalizeLinkState() {
  if (linkState.busy && !linkJob) {
    linkState = { busy: false, error: linkState.error };
  }
}
async function driveStatus() {
  normalizeLinkState();
  const checkedAt = (/* @__PURE__ */ new Date()).toISOString();
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
      adoptFrom
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
      detail: linkState.busy ? "Finish Google sign-in in the browser window, then press Check connection." : adoptFrom ? `izer is not linked yet. You can connect with Google or reuse your existing ${adoptFrom} account.` : "Not linked yet. Connect Google Drive once \u2014 it stays linked until you remove it.",
      checkedAt,
      linkError: linkState.error,
      adoptFrom
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
    detail: verify.ok ? `${accountLabel}. Uploads go to ${REMOTE}:${DRIVE_PATH}/` : verify.detail,
    checkedAt,
    linkError: verify.ok ? linkState.error : verify.detail,
    adoptFrom: verify.ok ? null : adoptFrom,
    accountLabel,
    storageUsed: quota?.used ?? null,
    storageTotal: quota?.total ?? null
  };
}
async function writeExportTree(root, files) {
  for (const file of files) {
    const filePath = import_node_path.default.join(root, file.relativePath);
    await import_promises.default.mkdir(import_node_path.default.dirname(filePath), { recursive: true });
    const text = typeof file.body === "string" ? file.body : JSON.stringify(file.body, null, 2);
    await import_promises.default.writeFile(filePath, text, "utf8");
  }
}
function patchCurrent(patch) {
  if (!uploadCurrent) return;
  uploadCurrent = { ...uploadCurrent, ...patch, active: patch.status ? patch.status === "active" : uploadCurrent.active };
}
function runCopyWithProgress(localRoot, target, onProgress) {
  return new Promise((resolve) => {
    const proc = (0, import_node_child_process.spawn)(
      "rclone",
      ["copy", localRoot, target, "--create-empty-src-dirs", "-P", "--stats-one-line", "--stats", "1s"],
      { shell: false, windowsHide: true }
    );
    activeRcloneProc = proc;
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      proc.kill();
      activeRcloneProc = null;
      resolve({ code: -1, out, err: `${err}
Timed out`.trim(), cancelled: false });
    }, 6e5);
    const handleChunk = (chunk) => {
      if (cancelRequested) return;
      const text = String(chunk);
      err += text;
      const pct = text.match(/(\d{1,3})%/);
      if (pct) {
        const value = Math.min(98, Math.max(25, Number(pct[1])));
        onProgress(value, "Uploading to Google Drive\u2026");
      }
      const line = text.split(/\r?\n/).map((entry) => entry.trim()).find((entry) => entry.includes("Transferred:") || entry.includes("%"));
      if (line) onProgress(uploadCurrent?.percent ?? 30, line.slice(0, 120));
    };
    proc.stdout?.on("data", (d) => {
      out += String(d);
      handleChunk(d);
    });
    proc.stderr?.on("data", handleChunk);
    proc.on("close", (code) => {
      clearTimeout(timer);
      activeRcloneProc = null;
      const cancelled = cancelRequested;
      resolve({ code: code ?? -1, out, err, cancelled });
    });
    proc.on("error", (e) => {
      clearTimeout(timer);
      activeRcloneProc = null;
      resolve({ code: -1, out, err: e.message, cancelled: cancelRequested });
    });
  });
}
async function runUploadJob(files, id, label) {
  cancelRequested = false;
  const startedAt = (/* @__PURE__ */ new Date()).toISOString();
  const fileCount = files.length;
  uploadCurrent = {
    id,
    label,
    status: "active",
    active: true,
    percent: 3,
    phase: "prepare",
    detail: "Preparing preset files\u2026",
    fileCount,
    startedAt
  };
  const tmp = await import_promises.default.mkdtemp(import_node_path.default.join(import_node_os.default.tmpdir(), "izer-drive-"));
  const localRoot = import_node_path.default.join(tmp, "izer", "Presets");
  try {
    patchCurrent({ percent: 12, phase: "write", detail: "Writing local export\u2026" });
    await writeExportTree(localRoot, files);
    if (cancelRequested) throw new Error("cancelled");
    patchCurrent({
      percent: 22,
      phase: "upload",
      detail: `Uploading ${fileCount} files to Google Drive\u2026`
    });
    const target = `${REMOTE}:${DRIVE_PATH}`;
    const copy = await runCopyWithProgress(localRoot, target, (percent, detail) => {
      patchCurrent({ percent, phase: "upload", detail });
    });
    const finishedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (copy.cancelled || cancelRequested) {
      const record2 = {
        ...uploadCurrent,
        status: "cancelled",
        active: false,
        percent: uploadCurrent?.percent ?? 0,
        phase: "cancelled",
        detail: "Upload cancelled.",
        finishedAt
      };
      pushUploadHistory(record2);
      return;
    }
    if (copy.code !== 0) {
      const message = friendlyRcloneError(copy.err || copy.out);
      const record2 = {
        ...uploadCurrent,
        status: "error",
        active: false,
        phase: "error",
        detail: message,
        error: message,
        finishedAt
      };
      pushUploadHistory(record2);
      return;
    }
    const record = {
      ...uploadCurrent,
      status: "done",
      active: false,
      percent: 100,
      phase: "done",
      detail: `Uploaded to ${target}/ (${fileCount} files)`,
      finishedAt
    };
    pushUploadHistory(record);
  } catch (error) {
    const finishedAt = (/* @__PURE__ */ new Date()).toISOString();
    const message = error instanceof Error && error.message === "cancelled" ? "Upload cancelled." : error instanceof Error ? error.message : "Upload failed.";
    const record = {
      ...uploadCurrent,
      status: cancelRequested ? "cancelled" : "error",
      active: false,
      phase: cancelRequested ? "cancelled" : "error",
      detail: message,
      error: cancelRequested ? void 0 : message,
      finishedAt
    };
    pushUploadHistory(record);
  } finally {
    uploadCurrent = null;
    cancelRequested = false;
    await import_promises.default.rm(tmp, { recursive: true, force: true }).catch(() => void 0);
    startNextUpload();
  }
}
function enqueueUpload(files, label) {
  const id = `up-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const job = { id, label, files };
  const busy = uploadCurrent?.status === "active";
  if (busy) {
    uploadPending.push(job);
    return { id, queued: true };
  }
  void runUploadJob(job.files, job.id, job.label);
  return { id, queued: false };
}
function cancelUpload(jobId) {
  if (jobId) {
    const index = uploadPending.findIndex((item) => item.id === jobId);
    if (index === -1) {
      if (uploadCurrent?.id === jobId && uploadCurrent.status === "active") {
        cancelRequested = true;
        activeRcloneProc?.kill("SIGTERM");
        return { ok: true, detail: "Cancelling active upload\u2026" };
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
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      finishedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return { ok: true, detail: "Removed queued upload." };
  }
  if (uploadCurrent?.status === "active") {
    cancelRequested = true;
    activeRcloneProc?.kill("SIGTERM");
    return { ok: true, detail: "Cancelling active upload\u2026" };
  }
  if (uploadPending.length) {
    const removed = uploadPending.length;
    uploadPending = [];
    return { ok: true, detail: `Cleared ${removed} queued upload(s).` };
  }
  return { ok: false, detail: "No upload to cancel." };
}
async function runConnectJob() {
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
    const auth = await run("rclone", ["authorize", "drive"], 3e5);
    const combined = `${auth.out}
${auth.err}`;
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
      error: error instanceof Error ? error.message : "Connect failed."
    };
  } finally {
    linkJob = null;
  }
}
async function handleDriveApiRequest(req, res) {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (!url.pathname.startsWith("/api/drive")) return false;
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
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
          detail: "Sign-in already in progress. Finish Google login, then press Check connection."
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        pending: true,
        detail: "A Google sign-in window should open. Finish sign-in, then press Check connection."
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
      let jobId;
      if (raw.trim()) {
        const body = JSON.parse(raw);
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
      const payload = JSON.parse(raw);
      if (!payload.files?.length) {
        sendJson(res, 400, { ok: false, detail: "Missing export files." });
        return true;
      }
      const label = payload.label?.trim() || `Preset library \xB7 ${payload.files.length} files`;
      const { id, queued } = enqueueUpload(payload.files, label);
      sendJson(res, 202, {
        ok: true,
        id,
        queued,
        started: !queued,
        detail: queued ? "Added to upload queue." : "Upload started."
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
function mountDriveApi(server) {
  server.middlewares.use(async (req, res, next) => {
    if (await handleDriveApiRequest(req, res)) return;
    next();
  });
}
var DRIVE_API_PORT = 1423;
function startStandaloneDriveServer(port = DRIVE_API_PORT, host = "127.0.0.1") {
  const server = import_node_http.default.createServer((req, res) => {
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
function driveApiPlugin() {
  return {
    name: "drive-api",
    configureServer(server) {
      mountDriveApi(server);
    },
    configurePreviewServer(server) {
      mountDriveApi(server);
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DRIVE_API_PORT,
  driveApiPlugin,
  startStandaloneDriveServer
});

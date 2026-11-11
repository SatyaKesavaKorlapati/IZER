const { app, BrowserWindow, session, ipcMain, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

// High-efficiency lightweight resource controls to minimize RAM footprint
app.commandLine.appendSwitch("js-flags", "--max-old-space-size=96 --expose-gc");
app.commandLine.appendSwitch("renderer-process-limit", "1");
app.commandLine.appendSwitch("disable-site-isolation-trials");
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion,SpareRendererForSitePerProcess");
app.commandLine.appendSwitch("disable-breakpad");
app.commandLine.appendSwitch("disable-component-update");
app.commandLine.appendSwitch("disable-domain-reliability");
app.commandLine.appendSwitch("disable-sync");

const logFile = path.join(process.env.APPDATA || os.tmpdir(), "izer-app.log");
function log(...args) {
  try {
    fs.appendFileSync(logFile, args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ") + "\n");
  } catch {}
}

log("Main process starting...", process.versions.electron);

process.on("uncaughtException", (err) => {
  log("uncaughtException:", err.stack || err);
});
process.on("unhandledRejection", (reason) => {
  log("unhandledRejection:", reason);
});

// Register Application User Model ID for Windows Task Manager & Taskbar grouping
if (process.platform === "win32") {
  app.setAppUserModelId("com.izer.app");
}

let mainWindow = null;
let driveApiServer = null;
let pendingHidPickCallback = null;
let hidSessionListenersAttached = false;
let hidPickerActive = false;

const JA11_VENDOR_ID = 0x2972;
const revokedJa11All = { value: false };

function hidListRowOk(device) {
  const name = String(device.productName || device.name || "").toLowerCase();
  if (/hidi2c|touchpad|trackpad|elan|synaptics|keyboard|mouse|bluetooth/.test(name)) {
    return false;
  }
  if ([0x8087, 0x04f3, 0x06cb].includes(device.vendorId)) {
    return false;
  }
  return true;
}

function attachHidDevicePickerSession() {
  if (hidSessionListenersAttached) return;
  hidSessionListenersAttached = true;

  session.defaultSession.on("select-hid-device", (event, details, callback) => {
    event.preventDefault();
    const raw = details.deviceList || [];
    const list = raw.filter(hidListRowOk).map((d) => ({
      deviceId: String(d.deviceId),
      vendorId: d.vendorId,
      productId: d.productId,
      productName: d.productName || d.name || "HID device",
    }));
    if (list.length === 0) {
      hidPickerActive = false;
      callback("");
      pendingHidPickCallback = null;
      return;
    }
    hidPickerActive = true;
    pendingHidPickCallback = callback;
    const win =
      mainWindow && !mainWindow.isDestroyed()
        ? mainWindow
        : BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
    if (win) {
      win.webContents.send("hid-device-list", list);
    } else {
      hidPickerActive = false;
      pendingHidPickCallback("");
      pendingHidPickCallback = null;
    }
  });
}

function attachHidPermissionHandlers() {
  session.defaultSession.setPermissionCheckHandler(() => true);

  session.defaultSession.setDevicePermissionHandler((details) => {
    if (details.deviceType === "hid" && details.device) {
      if (hidPickerActive) {
        return true;
      }
      if (ja11PermissionDenied(details.device.vendorId, details.device.productId)) {
        return false;
      }
      return true;
    }
    return true;
  });
}

function ja11RevokeFile() {
  return path.join(app.getPath("userData"), "ja11-hid-revoked");
}

function loadJa11Revoked() {
  try {
    return fs.readFileSync(ja11RevokeFile(), "utf8").trim() === "1";
  } catch {
    return false;
  }
}

function saveJa11Revoked(on) {
  try {
    fs.mkdirSync(path.dirname(ja11RevokeFile()), { recursive: true });
    fs.writeFileSync(ja11RevokeFile(), on ? "1" : "0", "utf8");
  } catch (err) {
    log("saveJa11Revoked failed:", err);
  }
}

function ja11PermissionDenied(vendorId, productId) {
  if (vendorId !== JA11_VENDOR_ID) return false;
  return revokedJa11All.value;
}

function createWindow() {
  log("Inside createWindow function");
  const appIcon = process.platform === "win32"
    ? path.join(__dirname, "icon.ico")
    : path.join(__dirname, "icon.png");

  const customWindowChrome = process.platform === "win32";

  mainWindow = new BrowserWindow({
    width: 1340,
    height: 880,
    minWidth: 1080,
    minHeight: 720,
    title: "IZER - Indian Papercraft Parametric EQ",
    backgroundColor: "#0f1115",
    icon: appIcon,
    autoHideMenuBar: true,
    frame: !customWindowChrome,
    thickFrame: false,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      enableWebSQL: false,
      spellcheck: false,
      devTools: process.env.NODE_ENV === "development",
      backgroundThrottling: true,
    },
  });

  mainWindow.on("blur", () => {
    if (global.gc) {
      try {
        global.gc();
      } catch {}
    }
  });

  // Configure WebHID Permissions for seamless in-app hardware DAC connection
  // External links opened in external system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http:") || url.startsWith("https:")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // Load from local build in production or dev server if running
  const devUrl = process.env.VITE_DEV_SERVER_URL || "http://127.0.0.1:1420";
  const distHtml = path.join(__dirname, "../dist/index.html");

  log("Checking HTML file:", distHtml, "exists:", fs.existsSync(distHtml));
  if (process.env.NODE_ENV === "development" && process.env.VITE_DEV_SERVER_URL) {
    log("Loading devUrl:", devUrl);
    mainWindow.loadURL(devUrl);
  } else if (fs.existsSync(distHtml)) {
    log("Loading file:", distHtml);
    mainWindow.loadFile(distHtml);
  } else {
    log("Fallback loading devUrl:", devUrl);
    mainWindow.loadURL(devUrl);
  }

  mainWindow.webContents.on("did-finish-load", () => {
    log("Page finished loading!");
  });
  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    log("Page failed to load:", errorCode, errorDescription);
  });
  mainWindow.webContents.on("console-message", (event, level, message, line, sourceId) => {
    log(`[Renderer] (${level}): ${message} (${sourceId}:${line})`);
  });
  mainWindow.webContents.on("render-process-gone", (event, details) => {
    log("render-process-gone:", JSON.stringify(details));
  });

  mainWindow.show();
  mainWindow.focus();

  mainWindow.on("maximize", () => sendMaximizedState());
  mainWindow.on("unmaximize", () => sendMaximizedState());

  mainWindow.on("close", (e) => {
    log("mainWindow close event fired!");
  });

  mainWindow.on("closed", () => {
    log("mainWindow closed event fired!");
    mainWindow = null;
  });

  // Local automation bridge for testing and screen inspection (only when explicitly requested)
  if (process.env.IZER_AUTOMATION === "1") {
    const http = require("node:http");
    const server = http.createServer(async (req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
      }
      try {
        if (req.url === "/screenshot") {
          if (!mainWindow) throw new Error("No window");
          const image = await mainWindow.capturePage();
          const png = image.toPNG();
          res.writeHead(200, { "Content-Type": "image/png" });
          res.end(png);
          return;
        }
        if (req.url === "/bounds") {
          if (!mainWindow) throw new Error("No window");
          const bounds = mainWindow.getBounds();
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(bounds));
          return;
        }
        if (req.url === "/click" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => { body += chunk; });
          req.on("end", async () => {
            try {
              const { x, y } = JSON.parse(body);
              mainWindow.webContents.focus();
              mainWindow.webContents.sendInputEvent({ type: "mouseMove", x, y });
              mainWindow.webContents.sendInputEvent({ type: "mouseDown", x, y, button: "left", clickCount: 1 });
              mainWindow.webContents.sendInputEvent({ type: "mouseUp", x, y, button: "left", clickCount: 1 });
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ ok: true }));
            } catch (err) {
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ ok: false, error: err.message }));
            }
          });
          return;
        }
        if (req.url === "/eval" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => { body += chunk; });
          req.on("end", async () => {
            try {
              const { script } = JSON.parse(body);
              const result = await mainWindow.webContents.executeJavaScript(script);
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ ok: true, result }));
            } catch (err) {
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ ok: false, error: err.message }));
            }
          });
          return;
        }
        res.writeHead(404);
        res.end("Not found");
      } catch (e) {
        res.writeHead(500);
        res.end(String(e));
      }
    });
    server.on("error", (err) => {
      log("Automation server non-fatal error:", err.message);
    });
    server.listen(1422, "127.0.0.1", () => {
      log("Automation bridge listening on 127.0.0.1:1422");
    });
  }
}

ipcMain.handle("hid-revoke", (_event, payload) => {
  const vendorId = payload?.vendorId;
  const revokeAll = Boolean(payload?.revokeAll);
  if (vendorId === JA11_VENDOR_ID && revokeAll) {
    revokedJa11All.value = true;
    saveJa11Revoked(true);
    log("Revoked JA11 HID auto-grant");
    return { ok: true };
  }
  return { ok: false };
});

ipcMain.handle("hid-allow-ja11", () => {
  revokedJa11All.value = false;
  saveJa11Revoked(false);
  return { ok: true };
});

ipcMain.handle("hid-pick-device", (_event, payload) => {
  const deviceId = payload?.deviceId;
  if (typeof pendingHidPickCallback === "function" && deviceId) {
    const cb = pendingHidPickCallback;
    pendingHidPickCallback = null;
    hidPickerActive = false;
    cb(deviceId);
    return { ok: true };
  }
  return { ok: false };
});

ipcMain.handle("hid-begin-scan", () => {
  hidPickerActive = true;
  return { ok: true };
});

function sendMaximizedState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("window-maximized-changed", mainWindow.isMaximized());
}

ipcMain.handle("window-minimize", () => {
  mainWindow?.minimize();
});

ipcMain.handle("window-maximize-toggle", () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
  const maximized = mainWindow.isMaximized();
  sendMaximizedState();
  return maximized;
});

ipcMain.handle("window-close", () => {
  mainWindow?.close();
});

ipcMain.handle("window-is-maximized", () => mainWindow?.isMaximized() ?? false);

ipcMain.handle("hid-pick-cancel", () => {
  if (typeof pendingHidPickCallback === "function") {
    const cb = pendingHidPickCallback;
    pendingHidPickCallback = null;
    hidPickerActive = false;
    cb("");
  }
  return { ok: true };
});

function startDriveApiServer() {
  const bundlePath = path.join(__dirname, "drive-api.bundle.cjs");
  if (!fs.existsSync(bundlePath)) {
    log("Drive API bundle missing at", bundlePath, "- run npm run bundle:drive-api");
    return;
  }
  try {
    const driveApi = require(bundlePath);
    const port = driveApi.DRIVE_API_PORT ?? 1423;
    driveApiServer = driveApi.startStandaloneDriveServer(port);
    driveApiServer.on("error", (err) => {
      log("Drive API server error:", err);
    });
    log("Drive API listening on 127.0.0.1:" + port);
  } catch (err) {
    log("Drive API failed to start:", err);
  }
}

app.whenReady().then(() => {
  log("app.whenReady fired!");
  startDriveApiServer();
  revokedJa11All.value = false;
  saveJa11Revoked(false);
  attachHidPermissionHandlers();
  attachHidDevicePickerSession();
  try {
    createWindow();
    log("createWindow completed successfully");
  } catch (err) {
    log("Error in createWindow:", err);
  }

  app.on("activate", () => {
    log("app activate event");
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch((err) => {
  log("Error in whenReady:", err);
});

app.on("before-quit", () => {
  log("app before-quit event");
});

app.on("will-quit", () => {
  log("app will-quit event");
  if (driveApiServer) {
    try {
      driveApiServer.close();
    } catch {}
    driveApiServer = null;
  }
});

app.on("quit", (event, exitCode) => {
  log("app quit event with code:", exitCode);
});

app.on("window-all-closed", () => {
  log("app window-all-closed event");
  if (process.platform !== "darwin") {
    app.quit();
  }
});

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

function createWindow() {
  log("Inside createWindow function");
  const appIcon = process.platform === "win32"
    ? path.join(__dirname, "icon.ico")
    : path.join(__dirname, "icon.png");

  mainWindow = new BrowserWindow({
    width: 1340,
    height: 880,
    minWidth: 1080,
    minHeight: 720,
    title: "IZER - Indian Papercraft Parametric EQ",
    backgroundColor: "#e8c99b",
    icon: appIcon,
    autoHideMenuBar: true,
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
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    if (permission === "hid") {
      return true;
    }
    return true;
  });

  session.defaultSession.setDevicePermissionHandler((details) => {
    if (details.deviceType === "hid") {
      return true;
    }
    return true;
  });

  // When navigator.hid.requestDevice() is triggered, intercept and automatically pair
  session.defaultSession.on("select-hid-device", (event, details, callback) => {
    event.preventDefault();
    if (details.deviceList && details.deviceList.length > 0) {
      // Prioritize JadeAudio JA11 (Vendor 0x2972) and exclude system HIDI2C/Elan chips
      const ja11 = details.deviceList.find(
        (d) =>
          d.vendorId === 0x2972 ||
          /ja11|jadeaudio|fiio|dongle/i.test(d.productName || "") ||
          (!/hidi2c|elan|synaptics|touchpad/i.test(d.productName || "") && d.vendorId !== 0x04f3 && d.vendorId !== 0x8087)
      );
      callback(ja11 ? ja11.deviceId : "");
    } else {
      callback("");
    }
  });

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

  mainWindow.on("close", (e) => {
    log("mainWindow close event fired!");
  });

  mainWindow.on("closed", () => {
    log("mainWindow closed event fired!");
    mainWindow = null;
  });

  // Local automation bridge for testing and screen inspection
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
  server.listen(1422, "127.0.0.1", () => {
    log("Automation bridge listening on 127.0.0.1:1422");
  });
}

app.whenReady().then(() => {
  log("app.whenReady fired!");
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

const { contextBridge, ipcRenderer } = require("electron");

const DRIVE_API_BASE = "http://127.0.0.1:1423";
const CUSTOM_WINDOW_CHROME = process.platform === "win32";

ipcRenderer.on("hid-device-list", (_event, list) => {
  window.dispatchEvent(new CustomEvent("izer-hid-device-list", { detail: list }));
});

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,
  driveApiBase: DRIVE_API_BASE,
  revokeHidDevice: (vendorId, revokeAll) => ipcRenderer.invoke("hid-revoke", { vendorId, revokeAll }),
  allowJa11Hid: () => ipcRenderer.invoke("hid-allow-ja11"),
  pickHidDevice: (deviceId) => ipcRenderer.invoke("hid-pick-device", { deviceId }),
  cancelHidPick: () => ipcRenderer.invoke("hid-pick-cancel"),
  beginHidScan: () => ipcRenderer.invoke("hid-begin-scan"),
  customWindowChrome: CUSTOM_WINDOW_CHROME,
  windowMinimize: () => ipcRenderer.invoke("window-minimize"),
  windowMaximizeToggle: () => ipcRenderer.invoke("window-maximize-toggle"),
  windowClose: () => ipcRenderer.invoke("window-close"),
  windowIsMaximized: () => ipcRenderer.invoke("window-is-maximized"),
  onWindowMaximizedChanged: (cb) => {
    const handler = (_event, maximized) => cb(Boolean(maximized));
    ipcRenderer.on("window-maximized-changed", handler);
    return () => ipcRenderer.removeListener("window-maximized-changed", handler);
  },
});

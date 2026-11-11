const { execSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const stagingDir = path.join(projectRoot, "build-staging", "app");
const unpackedAsar = path.join(projectRoot, "release", "win-unpacked", "resources", "app.asar");
const installedAsar = path.join(
  process.env.LOCALAPPDATA || "C:\\Users\\korla\\AppData\\Local",
  "Programs",
  "IZER",
  "resources",
  "app.asar"
);
const installedExe = path.join(
  process.env.LOCALAPPDATA || "C:\\Users\\korla\\AppData\\Local",
  "Programs",
  "IZER",
  "IZER.exe"
);

console.log("[1/5] Running TypeScript check and Vite build...");
execSync("npm run build", { cwd: projectRoot, stdio: "inherit" });

console.log("[2/5] Preparing staging app folder...");
if (!fs.existsSync(path.join(stagingDir, "node_modules"))) {
  console.log("Extracting base asar to retain node_modules...");
  fs.rmSync(path.join(projectRoot, "build-staging"), { recursive: true, force: true });
  fs.mkdirSync(stagingDir, { recursive: true });
  execSync(`npx asar extract "${unpackedAsar}" "${stagingDir}"`, { cwd: projectRoot, stdio: "inherit" });
}

// Copy dist into staging
const distSrc = path.join(projectRoot, "dist");
const distDest = path.join(stagingDir, "dist");
fs.cpSync(distSrc, distDest, { recursive: true, force: true });

// Copy electron into staging
const electronSrc = path.join(projectRoot, "electron");
const electronDest = path.join(stagingDir, "electron");
fs.cpSync(electronSrc, electronDest, { recursive: true, force: true });

// Copy package.json
fs.copyFileSync(path.join(projectRoot, "package.json"), path.join(stagingDir, "package.json"));

console.log("[3/5] Packing app.asar...");
execSync(`npx asar pack "${stagingDir}" "${unpackedAsar}"`, { cwd: projectRoot, stdio: "inherit" });

console.log("[4/5] Closing running IZER instances if any...");
try {
  execSync("powershell -Command \"Stop-Process -Name IZER, electron -Force -ErrorAction SilentlyContinue\"", { stdio: "ignore" });
} catch {}

if (fs.existsSync(installedAsar)) {
  console.log("Updating installed app.asar at:", installedAsar);
  fs.copyFileSync(unpackedAsar, installedAsar);
}

console.log("[5/5] Launching updated IZER executable...");
if (fs.existsSync(installedExe)) {
  execSync(`powershell -Command "Start-Process '${installedExe}'"`);
  console.log("Successfully launched installed IZER!");
} else {
  console.log("Installed IZER.exe not found at path; launching unpacked version...");
  const unpackedExe = path.join(projectRoot, "release", "win-unpacked", "IZER.exe");
  execSync(`powershell -Command "Start-Process '${unpackedExe}'"`);
}

console.log("Fast build & reload complete!");

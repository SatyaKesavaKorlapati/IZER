const esbuild = require("esbuild");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const entry = path.join(projectRoot, "vite-plugins", "drive-api.ts");
const outfile = path.join(projectRoot, "electron", "drive-api.bundle.cjs");

esbuild.buildSync({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile,
  packages: "external",
  target: "node18",
  logLevel: "info",
});

console.log("Wrote", outfile);

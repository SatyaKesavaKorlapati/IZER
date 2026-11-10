import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { driveApiPlugin } from "./vite-plugins/drive-api";

export default defineConfig({
  base: "./",
  plugins: [react(), driveApiPlugin()],
  server: {
    port: 1420,
    host: true,
    strictPort: false,
    watch: {
      ignored: ["**/release/**", "**/dist/**", "**/.git/**"],
    },
  },
  preview: {
    port: 1420,
  },
  clearScreen: false,
});

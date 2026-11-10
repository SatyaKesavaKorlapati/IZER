# JA11 Glass EQ

Audiophile parametric EQ studio for the FiiO / JadeAudio JA11. The editor, presets, and import tools run without a dongle.

## Launch

In this folder:

```
npm install
npm run dev
```

Vite serves the app, preferring port 1420. Use the URL printed in the terminal.

```
npm run build
npm run preview
```

`npm run check` verifies the biquad preview and the preset limits.

## Tauri

`src-tauri` is a scaffold for a later Tauri 2 window. This PC does not have `rustc` or the MSVC linker (`cl` / `link`), so the desktop shell was not compiled. Use `npm run dev`.

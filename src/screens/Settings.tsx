import { useState } from "react";
import { DriveSyncPanel } from "../components/DriveSync";
import { Dropdown } from "../components/Dropdown";
import { ThemeSwitch } from "../components/ThemeSwitch";
import { Toggle } from "../components/Toggle";
import { GRAPH_PALETTES, readGraphPalette, writeGraphPalette, type GraphPaletteId } from "../eq/palettes";
import { readWhitePoint, writeWhitePoint } from "../lib/displayAdjustments";
import { TILE_MAX, TILE_MIN, readTileWidth, writeTileWidth } from "../lib/tiles";
import { useStore } from "../state/store";

const PALETTE_OPTIONS = (Object.keys(GRAPH_PALETTES) as GraphPaletteId[]).map((id) => ({
  value: id,
  label: GRAPH_PALETTES[id].label,
}));

export function Settings() {
  const store = useStore();
  const [paletteId, setPaletteId] = useState<GraphPaletteId>(() => readGraphPalette().id);
  const [tileWidth, setTileWidth] = useState(readTileWidth);
  const [whitePoint, setWhitePoint] = useState(readWhitePoint);

  return (
    <section className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>This computer</h1>
        </div>
      </header>

      <div className="card settings-list">
        <div className="setting-row">
          <div>
            <h2>Auto preamp by default</h2>
            <p>
              Reset curve uses this choice. Measurement presets keep the preamp stored with the file. The current draft is
              left alone until you reset it.
            </p>
          </div>
          <Toggle
            label="Auto preamp by default"
            checked={store.settings.autoPreampDefault}
            onChange={(autoPreampDefault) => store.updateSettings({ autoPreampDefault })}
          />
        </div>
        <div className="setting-row">
          <div>
            <h2>Confirm before save</h2>
            <p>Ask before saving active curve locally. The confirm dialog also confirms the DAC is not written.</p>
          </div>
          <Toggle
            label="Confirm before save"
            checked={store.settings.confirmBeforeSave}
            onChange={(confirmBeforeSave) => store.updateSettings({ confirmBeforeSave })}
          />
        </div>
        <div className="setting-row appearance-row">
          <div>
            <h2>Appearance</h2>
            <p>Each look has a light sheet and a dark one. Dark switches the selected look. The choice stays in this browser.</p>
          </div>
          <ThemeSwitch />
        </div>
        {!store.dark ? (
          <div className="setting-row">
            <div>
              <h2>Reduce white point</h2>
              <p>Softens parchment brightness and glare in light mode with antique warmth.</p>
            </div>
            <label className="tile-width" title="Drag to reduce paper white point and soften glare">
              <input
                type="range"
                min={0}
                max={100}
                step={2}
                value={whitePoint}
                aria-label="Reduce white point"
                aria-valuenow={whitePoint}
                aria-valuetext={`${whitePoint}%`}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setWhitePoint(next);
                  writeWhitePoint(next);
                }}
              />
              <em>{whitePoint}%</em>
            </label>
          </div>
        ) : (
          <div className="setting-row">
            <div>
              <h2>Darkness level</h2>
              <p>Controls background obsidian depth in dark mode from matte charcoal (0%) to pitch black (100%).</p>
            </div>
            <label className="tile-width" title="Drag to deepen background darkness">
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={store.themeIntensity}
                aria-label="Darkness level"
                aria-valuenow={store.themeIntensity}
                aria-valuetext={`${store.themeIntensity}%`}
                onChange={(event) => store.setThemeIntensity(Number(event.target.value))}
              />
              <em>{store.themeIntensity}%</em>
            </label>
          </div>
        )}
        <div className="setting-row">
          <div>
            <h2>Graph colors</h2>
            <p>Recolors the curve and the band tiles inside whichever appearance is active.</p>
          </div>
          <div className="setting-palette">
            <Dropdown
              label="Graph colors"
              value={paletteId}
              options={PALETTE_OPTIONS}
              onChange={(id) => {
                setPaletteId(id);
                writeGraphPalette(id);
              }}
            />
          </div>
        </div>
        <div className="setting-row">
          <div>
            <h2>Band tile width</h2>
            <p>How wide each of the five studio tiles is. They shrink together if the row does not fit.</p>
          </div>
          <label className="tile-width" title="Drag to resize band tiles. They shrink if the row does not fit.">
            <input
              type="range"
              min={TILE_MIN}
              max={TILE_MAX}
              step={2}
              value={tileWidth}
              aria-label="Band tile width"
              aria-valuemin={TILE_MIN}
              aria-valuemax={TILE_MAX}
              aria-valuenow={tileWidth}
              aria-valuetext={`${tileWidth} pixels`}
              onChange={(event) => {
                const next = Number(event.target.value);
                setTileWidth(next);
                writeTileWidth(next);
              }}
            />
            <em>{tileWidth}</em>
          </label>
        </div>
        <div className="setting-row drive-row">
          <div className="drive-setting-block">
            <div className="drive-setting-head">
              <h2>Google Drive</h2>
              <p>Back up the full preset library and your saved curves. rclone runs only on this computer.</p>
            </div>
            <DriveSyncPanel />
          </div>
        </div>
        <div className="setting-row">
          <div>
            <h2>Reset active curve</h2>
            <p>Replace the editor and the active A/B side with a flat five-band curve. The other stored side and the DAC are left alone.</p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={store.resetUser1}>
            Reset
          </button>
        </div>
      </div>
    </section>
  );
}

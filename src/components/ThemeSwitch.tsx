import { Dropdown } from "./Dropdown";
import { Toggle } from "./Toggle";
import { useStore } from "../state/store";
import type { Look } from "../lib/storage";

const LOOKS: Array<{ value: Look; label: string; hint: string }> = [
  { value: "papein", label: "PAPEIN", hint: "Indian papercraft, Himalayan peaks, Godavari waves" },
  { value: "cyan", label: "Cyan glass", hint: "Liquid glass" },
  { value: "cyan-light", label: "Cyan light", hint: "Airy and cyan-tinted" },
  { value: "earth", label: "Earth", hint: "Mint field, color washes" },
  { value: "paper", label: "IOA", hint: "Indian heritage paper, Himalayan peaks, cyan ink" },
];

export function ThemeSwitch() {
  const store = useStore();
  return (
    <div className="theme-switch">
      <div className="look-picker">
        <Dropdown label="Look" value={store.theme} options={LOOKS} onChange={store.setTheme} />
      </div>
      <div className="switch-row dark-toggle">
        <Toggle label="Dark mode" checked={store.dark} onChange={store.setDark} />
        <span>Dark</span>
      </div>
      {store.dark ? (
        <label className="darkness-slider">
          <span>Darkness</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={store.themeIntensity}
            aria-label="Dark intensity"
            onChange={(event) => store.setThemeIntensity(Number(event.target.value))}
          />
          <em>{store.themeIntensity}</em>
        </label>
      ) : null}
    </div>
  );
}

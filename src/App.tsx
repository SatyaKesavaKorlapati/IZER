import { useEffect, useRef, type ReactNode } from "react";
import { TopQuickSearch } from "./components/TopQuickSearch";
import { PapeinEnvironment, PapeinBrandBadge } from "./components/PaperArtwork";
import { DevicePickerModal } from "./components/DevicePickerModal";
import { dacLabel, failureHeadline, ja11EqOffTarget } from "./lib/hid";
import { Device } from "./screens/Device";
import { Presets } from "./screens/Presets";
import { Settings } from "./screens/Settings";
import { Studio } from "./screens/Studio";
import { Transfer } from "./screens/Transfer";
import { useStore, type DeviceState, type ScreenId } from "./state/store";

const NAV: Array<{ id: ScreenId; label: string; hint: string; icon: ReactNode }> = [
  { id: "studio", label: "Studio", hint: "Graph and bands", icon: <IconStudio /> },
  { id: "presets", label: "Presets", hint: "Library", icon: <IconPresets /> },
  { id: "transfer", label: "Import", hint: "APO and JSON", icon: <IconTransfer /> },
  { id: "device", label: "Device", hint: "DAC", icon: <IconDevice /> },
  { id: "settings", label: "Settings", hint: "This computer", icon: <IconSettings /> },
];

function connectionLabel(device: DeviceState): string {
  if (device.phase === "connected") return dacLabel(device.identity);
  if (device.phase === "opening") return "Waiting for a DAC…";
  return failureHeadline(device.reason);
}

function chipLabel(device: DeviceState): string {
  if (device.phase === "connected") return dacLabel(device.identity);
  if (device.phase === "opening") return "Linking…";
  if (device.phase === "error" || device.phase === "unsupported") return "DAC error";
  return "No DAC";
}

export function App() {
  const store = useStore();
  const navRef = useRef<HTMLElement>(null);
  const linked = store.device.phase === "connected";
  const live = linked && ja11EqOffTarget(store.device.identity) && store.dacMode === "live";
  const label = connectionLabel(store.device);
  const chip = chipLabel(store.device);
  const pillTitle = store.device.detail;

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const apply = () => {
      const width = Math.ceil(nav.getBoundingClientRect().width);
      document.documentElement.style.setProperty("--nav-pill-width", `${width}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div className="atmosphere" aria-hidden="true">
        {store.theme === "papein" ? (
          <PapeinEnvironment />
        ) : (
          <>
            <span className="well well-a" />
            <span className="well well-b" />
            <span className="well well-c" />
            <svg className="earth-sheet" width="100%" height="100%">
              <filter id="earth-tooth" x="-5%" y="-5%" width="110%" height="110%" primitiveUnits="userSpaceOnUse">
                <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="4" seed="4" stitchTiles="stitch" result="grain" />
                <feColorMatrix
                  in="grain"
                  type="matrix"
                  values="0 0 0 0 0.16  0 0 0 0 0.36  0 0 0 0 0.48  0.32 0.32 0.32 0 -0.3"
                />
              </filter>
              <filter id="earth-tooth-night" x="-5%" y="-5%" width="110%" height="110%" primitiveUnits="userSpaceOnUse">
                <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="4" seed="4" stitchTiles="stitch" result="grain" />
                <feColorMatrix
                  in="grain"
                  type="matrix"
                  values="0 0 0 0 0.62  0 0 0 0 0.82  0 0 0 0 0.94  0.34 0.34 0.34 0 -0.32"
                />
              </filter>
              <rect className="earth-fiber-day" width="100%" height="100%" filter="url(#earth-tooth)" />
              <rect className="earth-fiber-night" width="100%" height="100%" filter="url(#earth-tooth-night)" />
            </svg>
            <span className="earth-sheen" />
            <div className="copy-stage">
              <div className="copy-sheet">
                <span className="copy-hatch copy-hatch-left" />
                <span className="copy-hatch copy-hatch-right" />
                <span className="copy-corner copy-corner-tl" />
                <span className="copy-corner copy-corner-tr" />
                <span className="copy-corner copy-corner-bl" />
                <span className="copy-corner copy-corner-br" />
              </div>
              {/* Himalayan Ridge Peaks Doodle */}
              <svg className="doodle doodle-himalaya" viewBox="0 0 160 64" aria-hidden="true">
                <circle cx="80" cy="22" r="14" className="himalaya-sun" />
                <path d="M4 56 L34 26 L58 44 L90 14 L122 42 L138 28 L156 56 Z" />
                <path className="fold" d="M90 14 L90 56" />
                <path className="fold" d="M34 26 L42 56" />
                <path className="fold" d="M138 28 L130 56" />
              </svg>
              {/* Royal Indian Peacock Doodle */}
              <svg className="doodle doodle-peacock" viewBox="0 0 84 76" aria-hidden="true">
                <path d="M38 18 C38 13 34 9 29 9 C26 9 24 11 24 14 C24 20 31 25 31 31 C31 38 25 44 19 48 C15 51 11 54 8 55 M27 9 L23 4 M29 9 L29 3 M31 9 L35 4" />
                <path className="plumage" d="M34 32 C45 25 58 27 68 35 C59 41 48 41 35 37" />
                <path className="plumage" d="M32 36 C45 35 60 41 65 52 C54 53 44 49 31 43" />
                <path className="plumage" d="M28 42 C39 46 51 54 53 65 C43 65 35 58 26 47" />
                <circle cx="59" cy="33" r="3.2" className="eyelet" />
                <circle cx="57" cy="47" r="3.2" className="eyelet" />
                <circle cx="47" cy="58" r="3.2" className="eyelet" />
              </svg>
              {/* Blooming Sacred Lotus Doodle */}
              <svg className="doodle doodle-lotus" viewBox="0 0 76 56" aria-hidden="true">
                <path d="M38 8 C33 22 31 33 38 45 C45 33 43 22 38 8 Z" />
                <path d="M35 22 C21 24 14 33 19 42 C26 44 33 40 36 35" />
                <path d="M41 22 C55 24 62 33 57 42 C50 44 43 40 40 35" />
                <path d="M20 36 C9 38 7 46 12 49 C21 50 28 46 33 43" />
                <path d="M56 36 C67 38 69 46 64 49 C55 50 48 46 43 43" />
                <path className="water-wave" d="M10 52 Q38 56 66 52" />
              </svg>
              {/* Sacred Peepal Leaf Doodle */}
              <svg className="doodle doodle-peepal" viewBox="0 0 64 68" aria-hidden="true">
                <path d="M32 6 C29 17 12 25 12 40 C12 53 23 60 32 62 C41 60 52 53 52 40 C52 25 35 17 32 6 Z" />
                <path className="vein" d="M32 10 L32 61" />
                <path className="vein" d="M32 28 Q21 32 19 39" />
                <path className="vein" d="M32 28 Q43 32 45 39" />
                <path className="vein" d="M32 41 Q23 45 21 50" />
                <path className="vein" d="M32 41 Q41 45 43 50" />
              </svg>
              {/* Indian Elephant Doodle */}
              <svg className="doodle doodle-elephant" viewBox="0 0 88 68" aria-hidden="true">
                <path d="M22 60 L22 44 C22 37 25 32 32 30 C39 28 46 28 52 30 C59 32 63 37 63 44 L63 60 M34 60 L34 48 M52 60 L52 48" />
                <path d="M52 30 C59 25 68 25 74 32 C78 37 80 46 75 51 C71 54 67 50 68 45 C69 39 65 36 61 37 C57 38 56 42 56 46 L56 60" />
                <path className="blanket" d="M31 33 Q42 38 53 33 L51 46 Q42 50 33 46 Z" />
                <path className="ear" d="M53 31 C60 31 62 40 58 46 C53 50 49 48 49 42 C49 35 50 31 53 31 Z" />
              </svg>
              {/* Playful Indian Paper Boat on River Doodle */}
              <svg className="doodle doodle-boat" viewBox="0 0 76 52" aria-hidden="true">
                <path d="M8 34 L22 45 L54 45 L68 34 Z" />
                <path d="M22 34 L38 12 L54 34 Z" />
                <path className="fold" d="M38 12 L38 45" />
                <path className="water-wave" d="M4 47 Q20 42 38 47 T72 45" />
              </svg>
              {/* Konaseema Coconut Palm Tree Doodle (Andhra Pradesh) */}
              <svg className="doodle doodle-palm" viewBox="0 0 68 76" aria-hidden="true">
                <path d="M22 72 Q30 52 32 30" strokeWidth="2.2" />
                <path d="M26 72 Q33 52 35 30" strokeWidth="1.2" strokeDasharray="3 3" />
                <path d="M33 30 Q18 20 6 26" />
                <path d="M33 30 Q22 10 14 4" />
                <path d="M33 30 Q35 6 36 2" />
                <path d="M33 30 Q46 10 54 6" />
                <path d="M33 30 Q50 20 62 25" />
                <path d="M33 30 Q48 34 58 44" />
                <circle cx="31" cy="32" r="2.8" className="coconut" />
                <circle cx="36" cy="33" r="2.8" className="coconut" />
                <circle cx="33" cy="36" r="2.8" className="coconut" />
              </svg>
              {/* Kashmir Chinar Leaf Doodle (Kashmir Valley) */}
              <svg className="doodle doodle-chinar" viewBox="0 0 68 68" aria-hidden="true">
                <path d="M34 62 L34 46" strokeWidth="2" />
                <path d="M34 46 C30 44 20 46 14 38 C18 36 22 36 24 34 C16 28 10 24 16 16 C22 20 25 24 28 24 C24 16 24 8 34 4 C44 8 44 16 40 24 C43 24 46 20 52 16 C58 24 52 28 44 34 C46 36 50 36 54 38 C48 46 38 44 34 46 Z" />
                <path className="vein" d="M34 46 L34 10" />
                <path className="vein" d="M34 38 L20 24" />
                <path className="vein" d="M34 38 L48 24" />
                <path className="vein" d="M34 26 L24 14" />
                <path className="vein" d="M34 26 L44 14" />
              </svg>
              {/* Godavari Sacred River Ripples Doodle (Andhra Pradesh) */}
              <svg className="doodle doodle-godavari" viewBox="0 0 110 40" aria-hidden="true">
                <path d="M4 18 Q28 6 54 18 T106 18" strokeWidth="1.8" />
                <path d="M10 26 Q32 14 58 26 T102 26" strokeWidth="1.4" strokeDasharray="4 3" />
                <path d="M20 34 Q40 24 64 34 T96 34" strokeWidth="1.2" strokeDasharray="3 3" />
              </svg>
              {/* Coastal Ocean Waves Swell Doodle (Bay of Bengal / Indian Ocean) */}
              <svg className="doodle doodle-ocean" viewBox="0 0 120 42" aria-hidden="true">
                <path d="M6 30 C16 30 20 18 32 18 C44 18 48 30 60 30 C72 30 76 18 88 18 C100 18 104 30 116 30" strokeWidth="1.8" />
                <path d="M14 36 C22 36 26 26 36 26 C46 26 50 36 60 36 C70 36 74 26 84 26 C94 26 98 36 108 36" strokeWidth="1.2" strokeDasharray="3 2" />
              </svg>
              {/* Playful Marigold Bloom Doodle */}
              <svg className="doodle doodle-marigold" viewBox="0 0 56 56" aria-hidden="true">
                <circle cx="28" cy="28" r="23" className="marigold-outer" />
                <circle cx="28" cy="28" r="16" className="marigold-mid" />
                <circle cx="28" cy="28" r="8" className="marigold-center" />
              </svg>
            </div>
            <svg className="motif" viewBox="0 0 640 640" fill="none">
              <path d="M156 268c0-92 68-164 164-164s164 72 164 164" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <rect x="132" y="248" width="46" height="84" rx="23" stroke="currentColor" strokeWidth="1.6" />
              <rect x="462" y="248" width="46" height="84" rx="23" stroke="currentColor" strokeWidth="1.6" />
              <path
                d="M36 500c42-52 68-52 102 0s66 52 104 0 62-52 100 0 66 46 104 0 58-42 96 6"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
              />
            </svg>
          </>
        )}
      </div>
      <div className="shell">
        <header className="chrome">
          <div className="chrome-slot-search">
            <TopQuickSearch />
          </div>
          <nav className="nav-pill" aria-label="Primary" ref={navRef}>
            {store.theme === "papein" ? (
              <PapeinBrandBadge />
            ) : (
              <span className="pill-brand">
                <span className="mark" aria-hidden="true">
                  <WaveMark />
                </span>
                <strong className="wordmark">
                  <span>IZER</span>
                </strong>
              </span>
            )}
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                className={store.screen === item.id ? "pill-link on" : "pill-link"}
                aria-current={store.screen === item.id ? "page" : undefined}
                title={item.hint}
                onClick={() => store.setScreen(item.id)}
              >
                <span className="nav-ico">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
            <div className={linked ? "pill-dac on" : "pill-dac"}>
              <button
                type="button"
                className="pill-dac-main"
                title={pillTitle}
                aria-label={linked ? `${label}. Show device details` : `${pillTitle.replace(/\.\s*$/, "")}. Choose a DAC`}
                aria-busy={store.device.phase === "opening"}
                disabled={store.device.phase === "opening"}
                onClick={() => {
                  if (linked) {
                    store.setScreen("device");
                    return;
                  }
                  store.setDevicePickerOpen(true);
                }}
              >
                <span className="dot" />
                <span className="pill-dac-label">{chip}</span>
                {linked ? <span className={live ? "pill-live" : "pill-static"}>{live ? "Live" : "Static"}</span> : null}
              </button>
              {linked ? (
                <button type="button" className="pill-dac-x" aria-label="Disconnect DAC" title="Disconnect DAC" onClick={() => void store.disconnect()}>
                  <span aria-hidden="true">×</span>
                </button>
              ) : null}
            </div>
          </nav>
          <div className="chrome-slot-end" aria-hidden="true" />
        </header>
        <main className="main">
          <div className="main-pane">
            <div className={store.screen === "studio" ? "screen-pane" : "screen-pane hidden"}>
              <Studio />
            </div>
            <div className={store.screen === "presets" ? "screen-pane" : "screen-pane hidden"}>
              <Presets />
            </div>
            <div className={store.screen === "transfer" ? "screen-pane" : "screen-pane hidden"}>
              <Transfer />
            </div>
            <div className={store.screen === "device" ? "screen-pane" : "screen-pane hidden"}>
              <Device />
            </div>
            <div className={store.screen === "settings" ? "screen-pane" : "screen-pane hidden"}>
              <Settings />
            </div>
          </div>
        </main>
        <p className="sr-only" role="status">
          {store.status}
        </p>
      </div>
      <DevicePickerModal
        open={store.devicePickerOpen}
        onClose={() => store.setDevicePickerOpen(false)}
      />
    </>
  );
}

function WaveMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M3 18c1.6 0 2.4-8.2 4.6-8.2 2.1 0 2.3 12.6 4.8 12.6s2.7-16.2 5.4-16.2 2.6 11.2 5 11.2 2.4-4.2 4.6 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconStudio() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M2.5 12.5c1.2-2.6 2.3-2.6 3.5 0s2.3 2.6 3.5 0 2.3-2.6 3.5 0 2 2.2 3.2.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconPresets() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="3" y="3.5" width="6" height="6" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="3.5" width="6" height="6" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="11.5" width="6" height="5" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11.5" width="6" height="5" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconTransfer() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M6 4.5v8M6 12.5 3.8 10.3M6 12.5l2.2-2.2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 15.5v-8M14 7.5l-2.2 2.2M14 7.5l2.2 2.2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconDevice() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="6" y="3" width="8" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8.5 6.5h3M9 14.5h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 3.2v1.6M10 15.2v1.6M3.2 10h1.6M15.2 10h1.6M5.2 5.2l1.1 1.1M13.7 13.7l1.1 1.1M14.8 5.2l-1.1 1.1M6.3 13.7l-1.1 1.1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

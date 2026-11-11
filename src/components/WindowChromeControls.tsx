import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";

type WindowChromeBridge = {
  customWindowChrome?: boolean;
  windowMinimize?: () => Promise<void>;
  windowMaximizeToggle?: () => Promise<boolean>;
  windowClose?: () => Promise<void>;
  windowIsMaximized?: () => Promise<boolean>;
  onWindowMaximizedChanged?: (cb: (maximized: boolean) => void) => () => void;
};

function chromeBridge(): WindowChromeBridge | undefined {
  return (window as Window & { electronAPI?: WindowChromeBridge }).electronAPI;
}

export function WindowChromeControls() {
  const bridge = chromeBridge();
  const enabled = Boolean(bridge?.customWindowChrome);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    document.documentElement.classList.add("electron-custom-chrome");
    let dispose: (() => void) | undefined;
    void bridge?.windowIsMaximized?.().then((value) => setMaximized(Boolean(value)));
    dispose = bridge?.onWindowMaximizedChanged?.((next) => setMaximized(next));
    return () => {
      document.documentElement.classList.remove("electron-custom-chrome");
      dispose?.();
    };
  }, [enabled]);

  const stopDrag = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const onMinimize = useCallback(() => {
    void bridge?.windowMinimize?.();
  }, [bridge]);

  const onMaximize = useCallback(() => {
    void bridge?.windowMaximizeToggle?.().then((next) => setMaximized(Boolean(next)));
  }, [bridge]);

  const onClose = useCallback(() => {
    void bridge?.windowClose?.();
  }, [bridge]);

  if (!enabled) return null;

  const chrome = (
    <>
      <div className="window-chrome-controls" role="toolbar" aria-label="Window">
      <button
        type="button"
        className="window-chrome-btn"
        aria-label="Minimize"
        title="Minimize"
        onMouseDown={stopDrag}
        onClick={onMinimize}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M0 5h10" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
      <button
        type="button"
        className="window-chrome-btn"
        aria-label={maximized ? "Restore" : "Maximize"}
        title={maximized ? "Restore down" : "Maximize"}
        onMouseDown={stopDrag}
        onClick={onMaximize}
      >
        {maximized ? (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M2.5 2.5h5v5h-5z" fill="none" stroke="currentColor" strokeWidth="1.1" />
            <path d="M4.5 4.5h5v5h-5z" fill="none" stroke="currentColor" strokeWidth="1.1" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1.2" rx="0.5" />
          </svg>
        )}
      </button>
      <button
        type="button"
        className="window-chrome-btn close"
        aria-label="Close"
        title="Close"
        onMouseDown={stopDrag}
        onClick={onClose}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
    </>
  );

  return createPortal(chrome, document.body);
}

export function useCustomWindowChrome(): boolean {
  return Boolean(chromeBridge()?.customWindowChrome);
}

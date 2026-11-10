import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
  disabled?: boolean;
}

interface DropdownProps<T extends string> {
  label: string;
  value: T;
  options: Array<DropdownOption<T>>;
  onChange: (value: T) => void;
  disabled?: boolean;
}

interface MenuBox {
  top: number;
  left: number;
  width: number;
  up: boolean;
}

export function Dropdown<T extends string>({ label, value, options, onChange, disabled = false }: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [menuStyle, setMenuStyle] = useState<MenuBox | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelectorAll<HTMLButtonElement>(".dropdown-option")[highlight]?.focus();
  }, [open, highlight]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onScroll() {
      setOpen(false);
    }
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("scroll", onScroll);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("scroll", onScroll);
    };
  }, [open]);

  function placeMenu() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.max(rect.width, 210);
    const up = window.innerHeight - rect.bottom < 260 && rect.top > 220;
    let left = rect.left;
    if (left + width > window.innerWidth - 12) left = Math.max(12, window.innerWidth - 12 - width);
    setMenuStyle({
      top: up ? rect.top - 8 : rect.bottom + 8,
      left,
      width,
      up,
    });
  }

  function choose(next: T) {
    onChange(next);
    setOpen(false);
    buttonRef.current?.focus();
  }

  const menu =
    open && menuStyle
      ? createPortal(
          <ul
            ref={menuRef}
            id={listId}
            className={menuStyle.up ? "dropdown-menu up" : "dropdown-menu"}
            role="listbox"
            aria-label={label}
            style={{ top: menuStyle.top, left: menuStyle.left, width: menuStyle.width }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                buttonRef.current?.focus();
              } else if (event.key === "ArrowDown") {
                event.preventDefault();
                setHighlight((index) => Math.min(options.length - 1, index + 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setHighlight((index) => Math.max(0, index - 1));
              } else if (event.key === "Enter") {
                event.preventDefault();
                const option = options[highlight];
                if (option && !option.disabled) choose(option.value);
              }
            }}
          >
            <li className="menu-close-row" role="presentation">
              <button
                type="button"
                className="menu-close"
                aria-label={`Close ${label}`}
                title="Close"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => {
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
              >
                <span aria-hidden="true">×</span>
                Close
              </button>
            </li>
            {options.map((option, index) => (
              <li key={option.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  className={option.value === value ? "dropdown-option selected" : "dropdown-option"}
                  disabled={option.disabled}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => {
                    if (!option.disabled) choose(option.value);
                  }}
                >
                  <span className="option-copy">
                    <span>{option.label}</span>
                    {option.hint ? <small>{option.hint}</small> : null}
                  </span>
                  {option.value === value ? (
                    <span className="menu-check" aria-hidden="true">
                      ✓
                    </span>
                  ) : (
                    <span className="check-gap" aria-hidden="true" />
                  )}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div className="dropdown" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={open ? "dropdown-button open" : "dropdown-button"}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (open) {
            setOpen(false);
            return;
          }
          placeMenu();
          setHighlight(Math.max(0, options.findIndex((option) => option.value === value)));
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            placeMenu();
            setOpen(true);
            setHighlight(Math.max(0, options.findIndex((option) => option.value === value)));
          }
        }}
      >
        <span>{selected?.label}</span>
        <span className="chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {menu}
    </div>
  );
}

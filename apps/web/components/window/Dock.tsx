"use client";
// Dock: the window launcher along the top centre of the farm screen. One pill with a chip per window that is
// currently minimised or hidden (click to restore), and a "Windows" menu that lists every window that exists
// with a checkbox for whether it is visible, plus "Reset layout". Styling lives in DOCK_CSS (rendered by the master).
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useShallow } from "zustand/react/shallow";

import { WINDOW_CONFIG, WINDOW_IDS, type WindowId } from "@/lib/window/config";
import { useWindowManager, Z_DOCK } from "@/lib/window/store";

export const DOCK_CSS = `
.fw-dock{position:absolute;top:8px;left:50%;transform:translateX(-50%);height:36px;max-width:calc(100% - 32px);box-sizing:border-box;
  display:flex;align-items:center;gap:4px;padding:3px;border-radius:999px;background:rgba(25,23,19,.92);
  border:1px solid rgba(242,235,221,.15);color:#f2ebdd;font-size:12px;pointer-events:auto;box-shadow:0 8px 24px rgba(0,0,0,.3)}
.fw-dock-chips{display:flex;align-items:center;gap:4px;min-width:0;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;-ms-overflow-style:none}
.fw-dock-chips::-webkit-scrollbar{display:none}
.fw-dock button{font:inherit;font-size:12px;color:#f2ebdd;cursor:pointer;white-space:nowrap;min-height:30px;box-sizing:border-box}
.fw-dock button:focus-visible{outline:2px solid #a3bfe9;outline-offset:2px}
.fw-dock-chip{flex:none;display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border:0;border-radius:999px;background:rgba(242,235,221,.08)}
.fw-dock-chip:hover{background:rgba(242,235,221,.16)}
.fw-dock-dot{width:6px;height:6px;border-radius:50%;background:#a3bfe9;flex:none}
.fw-dock-launch-wrap{position:relative;flex:none;display:flex}
.fw-dock-launch{height:30px;padding:0 12px;border:0;border-radius:999px;background:transparent}
.fw-dock-launch:hover,.fw-dock-launch[aria-expanded="true"]{background:rgba(242,235,221,.12)}
.fw-dock-menu{position:absolute;top:40px;right:0;z-index:1;min-width:220px;box-sizing:border-box;padding:6px;border-radius:12px;
  background:rgba(25,23,19,.92);border:1px solid rgba(242,235,221,.15);box-shadow:0 12px 32px rgba(0,0,0,.38);
  display:flex;flex-direction:column;gap:2px;animation:fw-dock-in .12s ease-out both}
@keyframes fw-dock-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.fw-dock-item{display:flex;align-items:center;gap:8px;width:100%;height:30px;padding:0 10px;border:0;border-radius:8px;background:transparent;text-align:left}
.fw-dock-item:hover{background:rgba(242,235,221,.08)}
.fw-dock-check{width:14px;flex:none;display:grid;place-items:center;color:#a3bfe9}
.fw-dock-sep{height:1px;margin:4px 6px;background:rgba(242,235,221,.12)}
.fw-dock-item-reset{color:#c9bfae}
@media (pointer:coarse){
  .fw-dock{top:4px;height:44px;padding:2px}
  .fw-dock-chip,.fw-dock-launch,.fw-dock-item{height:40px;min-height:40px}
}
@media (prefers-reduced-motion:reduce){.fw-dock-menu{animation:none}}
`;

export function Dock() {
  const { ready, wins, active, restore, setOpen, focus, reset } = useWindowManager(
    useShallow((s) => ({ ready: s.ready, wins: s.wins, active: s.active, restore: s.restore, setOpen: s.setOpen, focus: s.focus, reset: s.reset })),
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const launchRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // Focus the first menu item when the menu opens.
  useEffect(() => {
    if (menuOpen) menuRef.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();
  }, [menuOpen]);

  // Clicking anywhere outside the dock closes the menu.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [menuOpen]);

  if (!ready) return null;

  const present = WINDOW_IDS.filter((id) => active[id]);
  const isHidden = (id: WindowId) => !wins[id].open && WINDOW_CONFIG[id].kind === "hide";
  const chips = present.filter((id) => wins[id].minimized || isHidden(id));
  const isVisible = (id: WindowId) => !wins[id].minimized && (WINDOW_CONFIG[id].kind === "context" || wins[id].open);

  const onSelect = (id: WindowId) => {
    if (!isVisible(id)) restore(id);
    else if (WINDOW_CONFIG[id].kind === "hide") setOpen(id, false);
    else focus(id);
  };

  const closeMenu = () => {
    setMenuOpen(false);
    launchRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (!menuOpen) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      closeMenu();
      return;
    }
    if (e.key === "Tab") {
      setMenuOpen(false);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);
      if (items.length === 0) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i <= 0 ? items.length - 1 : i - 1);
      items[next]?.focus();
    }
  };

  return (
    <nav ref={navRef} className="fw-dock" aria-label="Windows" style={{ zIndex: Z_DOCK }} onKeyDown={onKeyDown}>
      {chips.length > 0 && (
        <div className="fw-dock-chips">
          {chips.map((id) => {
            const title = WINDOW_CONFIG[id].title;
            return (
              <button key={id} id={`fw-chip-${id}`} type="button" className="fw-dock-chip" aria-label={`Restore ${title} window`} onClick={() => restore(id)}>
                <span className="fw-dock-dot" aria-hidden />
                {title}
              </button>
            );
          })}
        </div>
      )}
      <div className="fw-dock-launch-wrap">
        <button
          ref={launchRef}
          id="fw-dock-launch"
          type="button"
          className="fw-dock-launch"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? menuId : undefined}
          onClick={() => setMenuOpen((o) => !o)}
        >
          Windows
        </button>
        {menuOpen && (
          <div ref={menuRef} id={menuId} role="menu" aria-label="Windows" className="fw-dock-menu">
            {present.map((id) => {
              const checked = isVisible(id);
              return (
                <button key={id} type="button" role="menuitemcheckbox" aria-checked={checked} className="fw-dock-item" onClick={() => onSelect(id)}>
                  <span className="fw-dock-check" aria-hidden>
                    {checked && (
                      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 8.5l3 3 7-7" />
                      </svg>
                    )}
                  </span>
                  {WINDOW_CONFIG[id].title}
                </button>
              );
            })}
            {present.length > 0 && <div className="fw-dock-sep" role="separator" />}
            <button
              type="button"
              role="menuitem"
              className="fw-dock-item fw-dock-item-reset"
              data-testid="reset-layout"
              onClick={() => {
                reset();
                closeMenu();
              }}
            >
              Reset layout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

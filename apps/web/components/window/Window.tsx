"use client";
// A desktop-style window around one farm-screen panel: title bar (drag, double-click maximise, min / max / close),
// 8 resize handles, rubber-band past the edges with an ease-out-back recoil, keyboard move/resize. Geometry and
// z-order live in useWindowManager; while a pointer is down the frame is moved directly (transform + rAF, no
// React renders) and committed on release.
import { useReducedMotion } from "framer-motion";
import { useEffect, useId, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { useShallow } from "zustand/react/shallow";

import { WINDOW_CONFIG, type WindowId } from "@/lib/window/config";
import { dragRect, easeOutBack, lerpRect, resizeRect, sameRect, type Dir, type Rect } from "@/lib/window/geometry";
import { flushLayout, regionForWindow, windowLimits, useWindowManager, zIndexOf } from "@/lib/window/store";

const HANDLES: { dir: Dir; name: string }[] = [
  { dir: { x: 0, y: -1 }, name: "n" },
  { dir: { x: 0, y: 1 }, name: "s" },
  { dir: { x: -1, y: 0 }, name: "w" },
  { dir: { x: 1, y: 0 }, name: "e" },
  { dir: { x: -1, y: -1 }, name: "nw" },
  { dir: { x: 1, y: -1 }, name: "ne" },
  { dir: { x: -1, y: 1 }, name: "sw" },
  { dir: { x: 1, y: 1 }, name: "se" },
];
const NUDGE = 10;
const RECOIL_MS = 320;

const applyRect = (el: HTMLElement, r: Rect) => {
  el.style.transform = `translate3d(${r.x}px,${r.y}px,0)`;
  el.style.width = `${r.w}px`;
  el.style.height = `${r.h}px`;
};

export type WindowProps = {
  id: WindowId;
  /** Whether the window exists right now (context windows: the app has content open; hide windows: the mode shows it). */
  present?: boolean;
  /** Context windows: the app's own close. Hide windows hide themselves instead. */
  onClose?(): void;
  /** Title bar text; defaults to WINDOW_CONFIG[id].title. */
  title?: string;
  className?: string;
  /** Restore/raise when a different section opens in an existing context window. */
  activationKey?: string;
  children: ReactNode;
};

export function Window({ id, present = true, onClose, title, className = "", activationKey, children }: WindowProps) {
  const spec = WINDOW_CONFIG[id];
  const reduced = !!useReducedMotion();
  const { win, z, ready } = useWindowManager(useShallow((s) => ({ win: s.wins[id], z: zIndexOf(s.order, id), ready: s.ready })));
  const frame = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const hintId = useId();
  const label = title ?? spec.title;

  // Tell the dock which windows exist now (and raise a context window when its content is opened elsewhere).
  useEffect(() => {
    const manager = useWindowManager.getState();
    manager.setActive(id, present);
    if (present && spec.kind === "context") manager.restore(id);
  }, [id, present, activationKey, spec.kind]);
  useEffect(() => () => useWindowManager.getState().setActive(id, false), [id]);

  const visible = present && !win.minimized && (spec.kind === "context" || win.open);
  const gesture = useGesture(id, frame, reduced);

  // Keep focus somewhere sensible when the window this focus was in is minimised or hidden.
  const wasVisible = useRef(visible);
  useLayoutEffect(() => {
    if (wasVisible.current && !visible && present && frame.current?.contains(document.activeElement)) {
      requestAnimationFrame(() => (document.getElementById(`fw-chip-${id}`) ?? document.getElementById("fw-dock-launch"))?.focus());
    }
    wasVisible.current = visible;
  }, [visible, present, id]);

  if (!present) {
    // No frame: content renders exactly as before (e.g. Compare mode's full-screen view, closed drawers).
    return (
      <div className="fw-off" data-window={id}>
        {false}
        <div className="fw-body">{children}</div>
        {false}
      </div>
    );
  }

  const close = () => {
    if (spec.kind === "context") onClose?.();
    else useWindowManager.getState().setOpen(id, false);
  };
  const r = win.rect;
  return (
    <div
      ref={frame}
      className={`fw-win ${visible ? "" : "fw-hidden"} ${win.maximized ? "fw-max" : ""} ${className}`}
      data-window={id}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      hidden={!visible}
      style={{
        transform: `translate3d(${r.x}px,${r.y}px,0)`,
        width: r.w,
        height: r.h,
        zIndex: z,
        visibility: ready ? undefined : "hidden",
      }}
      onPointerDownCapture={() => useWindowManager.getState().focus(id)}
      onFocusCapture={() => useWindowManager.getState().focus(id)}
    >
      {visible && (
        <div
          className="fw-titlebar"
          tabIndex={0}
          aria-label={`${label} window`}
          title="Drag to move. Arrow keys move; Shift + arrows resize."
          aria-describedby={hintId}
          onPointerDown={gesture.startDrag}
          onDoubleClick={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            gesture.animateNext();
            useWindowManager.getState().toggleMaximize(id);
          }}
          onKeyDown={gesture.onKey}
        >
          <span className="fw-grip" aria-hidden>
            <svg viewBox="0 0 10 16" width="8" height="14" fill="currentColor"><circle cx="2" cy="3" r="1.2" /><circle cx="8" cy="3" r="1.2" /><circle cx="2" cy="8" r="1.2" /><circle cx="8" cy="8" r="1.2" /><circle cx="2" cy="13" r="1.2" /><circle cx="8" cy="13" r="1.2" /></svg>
          </span>
          <h2 className="fw-title" id={titleId} title={label}>{label}</h2>
          <span id={hintId} className="sr-only">Arrow keys move the window, Shift and arrow keys resize it, Enter maximises or restores.</span>
          <div className="fw-btns">
            <button type="button" className="fw-btn" aria-label={`Minimise ${label}`} title="Minimise" data-testid={`window-min-${id}`} onClick={() => useWindowManager.getState().minimize(id)}>
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden><path d="M3 12h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
            <button
              type="button"
              className="fw-btn"
              aria-label={win.maximized ? `Restore ${label}` : `Maximise ${label}`}
              aria-pressed={win.maximized}
              title={win.maximized ? "Restore" : "Maximise"}
              data-testid={`window-max-${id}`}
              onClick={() => {
                gesture.animateNext();
                useWindowManager.getState().toggleMaximize(id);
              }}
            >
              {win.maximized ? (
                <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden><rect x="2.5" y="5.5" width="8" height="8" rx="1" /><path d="M5.5 5.5V3.5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2" /></svg>
              ) : (
                <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden><rect x="2.5" y="2.5" width="11" height="11" rx="1.5" /></svg>
              )}
            </button>
            <button type="button" className="fw-btn" aria-label={`Close ${label}`} title="Close" data-testid={`window-close-${id}`} onClick={close}>
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
          </div>
        </div>
      )}
      <div className="fw-body">{children}</div>
      {visible && !win.maximized && HANDLES.map((h) => <div key={h.name} className={`fw-h fw-h-${h.name}`} aria-hidden onPointerDown={(e) => gesture.startResize(e, h.dir)} />)}
    </div>
  );
}

/** Pointer drag/resize with live rubber-band, Esc to cancel, recoil on release; keyboard nudge/resize. */
function useGesture(id: WindowId, frame: RefObject<HTMLDivElement | null>, reduced: boolean) {
  const anim = useRef(0);
  const animTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => {
    cancelAnimationFrame(anim.current);
    clearTimeout(animTimer.current);
  }, []);

  /** Briefly enable the CSS transition so maximise / restore glides (skipped under reduced motion). */
  const animateNext = () => {
    const el = frame.current;
    if (!el || reduced) return;
    el.classList.add("fw-anim");
    clearTimeout(animTimer.current);
    animTimer.current = setTimeout(() => el.classList.remove("fw-anim"), 260);
  };

  /** Spring the frame from where it is drawn to where it settles, then commit. */
  const settle = (from: Rect, to: Rect) => {
    const el = frame.current;
    const commit = () => {
      useWindowManager.getState().setRect(id, to);
      flushLayout();
    };
    if (!el || reduced || sameRect(from, to)) {
      if (el) applyRect(el, to);
      commit();
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / RECOIL_MS);
      applyRect(el, lerpRect(from, to, easeOutBack(k)));
      if (k < 1) anim.current = requestAnimationFrame(step);
      else commit();
    };
    anim.current = requestAnimationFrame(step);
  };

  const track = (e: React.PointerEvent, compute: (dx: number, dy: number) => { show: Rect; target: Rect }) => {
    const el = frame.current;
    const s = useWindowManager.getState();
    if (!el || !s.bounds || e.button !== 0) return;
    e.preventDefault();
    cancelAnimationFrame(anim.current);
    const startRect = s.wins[id].rect;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    el.classList.add("fw-live");
    let last = { show: startRect, target: startRect };
    let raf = 0;
    let pending: PointerEvent | null = null;
    const draw = () => {
      raf = 0;
      if (!pending) return;
      last = compute(pending.clientX - x0, pending.clientY - y0);
      applyRect(el, last.show);
    };
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      pending = ev;
      if (!raf) raf = requestAnimationFrame(draw);
    };
    const end = (cancel: boolean) => {
      cancelAnimationFrame(raf);
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
      window.removeEventListener("keydown", esc, true);
      el.classList.remove("fw-live");
      if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
      if (cancel) settle(last.show, startRect);
      else {
        if (pending) draw();
        settle(last.show, last.target);
      }
    };
    const up = (ev: PointerEvent) => ev.pointerId === e.pointerId && end(false);
    const esc = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      end(true);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
    window.addEventListener("keydown", esc, true);
  };

  const startDrag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const s = useWindowManager.getState();
    if (s.wins[id].maximized || !s.bounds) return;
    const b = s.bounds;
    const start = s.wins[id].rect;
    track(e, (dx, dy) => { const { target } = dragRect(start, dx, dy, regionForWindow(id, b), windowLimits(id, b)); return { show: target, target }; });
  };

  const startResize = (e: React.PointerEvent, dir: Dir) => {
    const s = useWindowManager.getState();
    if (!s.bounds) return;
    const b = s.bounds;
    const start = s.wins[id].rect;
    track(e, (dx, dy) => { const { target } = resizeRect(start, dir, dx, dy, regionForWindow(id, b), windowLimits(id, b)); return { show: target, target }; });
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    const s = useWindowManager.getState();
    if (e.key === "Enter") {
      e.preventDefault();
      animateNext();
      s.toggleMaximize(id);
      return;
    }
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d || !s.bounds) return;
    e.preventDefault();
    const r = s.wins[id].rect;
    const next = e.shiftKey ? { ...r, w: r.w + d[0] * NUDGE, h: r.h + d[1] * NUDGE } : { ...r, x: r.x + d[0] * NUDGE, y: r.y + d[1] * NUDGE };
    s.setRect(id, next);
  };

  return { startDrag, startResize, onKey, animateNext };
}

/**
 * Measure the farm screen and keep the window layout fitted to it. Runs before paint, so the saved layout (or the
 * defaults) is applied before windows become visible: no flash of the default layout.
 */
export function useWindowHost(root: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => ({ w: el.clientWidth, h: el.clientHeight });
    const b = measure();
    if (b.w && b.h) {
      const s = useWindowManager.getState();
      if (s.ready) s.setBounds(b);
      else s.init(b);
    }
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const next = measure();
        if (!next.w || !next.h) return;
        const s = useWindowManager.getState();
        if (s.ready) s.setBounds(next);
        else s.init(next);
      });
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [root]);
}

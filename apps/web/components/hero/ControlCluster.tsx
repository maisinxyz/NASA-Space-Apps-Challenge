"use client";
// The icon controls at the edge of the visor: Maps, Layers, Scan, Settings. Small dashboard-light icons, labels only on
// hover or focus. Maps, Layers and Settings open one shared popover that morphs between panels (same place, same
// frame, content crossfades); it grows out of its trigger with a mask reveal and goes back into it on close.
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";

import type { Farm } from "@/components/globe/types";

import { heroMonoFont } from "./fonts";
import { CloseIcon, LayersIcon, MapsIcon, ScanIcon, SettingsIcon } from "./icons";
import { Pressable } from "./Pressable";
import { color, ease, iconSwap, popover, uiSpring } from "./tokens";
import { Toggle } from "./Toggle";

export type HeroSettings = { showPins: boolean; atmosphere: boolean; autoRotate: boolean };
type Panel = "maps" | "layers" | "settings";

const BTN = 40; // hit target, px
const GAP = 6;

const fmtCoord = (f: Farm) => `${Math.abs(f.lat).toFixed(2)}°${f.lat >= 0 ? "N" : "S"} ${Math.abs(f.lon).toFixed(2)}°${f.lon >= 0 ? "E" : "W"}`;

/** Icon that crossfades (with a slight blur) when it changes. */
function SwapIcon({ id, children }: { id: string; children: ReactNode }) {
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span
        key={id}
        className="grid place-items-center"
        initial={{ opacity: 0, filter: `blur(${iconSwap.blurPx}px)` }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, filter: `blur(${iconSwap.blurPx}px)`, transition: { duration: (iconSwap.ms * 0.8) / 1000 } }}
        transition={{ duration: iconSwap.ms / 1000, ease: ease.inOut }}
      >
        {children}
      </motion.span>
    </AnimatePresence>
  );
}

function IconButton({ label, active, onClick, children, ...aria }: { label: string; active?: boolean; onClick(): void; children: ReactNode; "aria-expanded"?: boolean; "aria-controls"?: string }) {
  const [tip, setTip] = useState(false);
  return (
    <div className="relative" onPointerEnter={() => setTip(true)} onPointerLeave={() => setTip(false)}>
      <Pressable
        aria-label={label}
        {...aria}
        onClick={onClick}
        onFocus={() => setTip(true)}
        onBlur={() => setTip(false)}
        className="grid place-items-center rounded-[10px] transition-[color,background-color,box-shadow] duration-150 hover:bg-white/[0.04] focus-visible:ring-1 focus-visible:ring-white/70 data-[held]:bg-white/[0.08] data-[held]:shadow-[inset_0_1px_5px_rgba(0,0,0,0.7)]"
        style={{ width: BTN, height: BTN, color: active ? color.accent : "rgba(236,238,241,0.72)" }}
      >
        <span className="grid h-10 w-10 place-items-center">{children}</span>
      </Pressable>
      <AnimatePresence>
        {tip && !active && (
          <motion.span
            role="tooltip"
            className="pointer-events-none absolute top-1/2 right-[calc(100%+8px)] -translate-y-1/2 text-[12px] whitespace-nowrap text-white/[0.7]"
            initial={{ opacity: 0, x: 4 }}
            animate={{ opacity: 1, x: 0, transition: { duration: 0.14, ease: ease.inOut } }}
            exit={{ opacity: 0, x: 4, transition: { duration: 0.11, ease: ease.out } }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

function FarmRows({ farms, ready, selectedId, onPick }: { farms: Farm[]; ready: boolean; selectedId: string | null; onPick(id: string): void }) {
  if (!ready)
    return (
      <ul aria-label="Loading farms" className="grid gap-1 p-1">
        {Array.from({ length: 5 }, (_, i) => (
          <li key={i} className="flex h-10 flex-col justify-center gap-1.5 px-2">
            <span className="h-2 w-40 animate-pulse rounded-full bg-white/[0.08]" />
            <span className="h-1.5 w-24 animate-pulse rounded-full bg-white/[0.05]" />
          </li>
        ))}
      </ul>
    );
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] p-1">
      {farms.map((f, i) => {
        const on = f.id === selectedId;
        return (
          <motion.li key={f.id} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (i * popover.rowStaggerMs) / 1000, duration: 0.16, ease: ease.inOut }}>
            <Pressable
              aria-pressed={on}
              onClick={() => onPick(f.id)}
              className="w-full rounded-[8px] px-2 py-1.5 text-left transition-colors hover:bg-white/[0.05] focus-visible:ring-1 focus-visible:ring-white/70 data-[held]:bg-white/[0.08] data-[held]:shadow-[inset_0_1px_5px_rgba(0,0,0,0.7)]"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[13px] font-medium" style={{ color: on ? color.accent : "rgba(236,238,241,0.9)" }}>
                  {f.name}
                </span>
                <motion.span
                  className={`${heroMonoFont.className} shrink-0 text-[10.5px] text-white/[0.5] tabular-nums`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: (i * popover.rowStaggerMs + popover.detailDelayMs) / 1000, duration: 0.16 }}
                >
                  {fmtCoord(f)}
                </motion.span>
              </span>
              <motion.span
                className="mt-0.5 block text-[12px] text-white/[0.58]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: (i * popover.rowStaggerMs + popover.detailDelayMs) / 1000, duration: 0.16 }}
              >
                {f.country}
              </motion.span>
            </Pressable>
          </motion.li>
        );
      })}
    </ul>
  );
}

const TITLES: Record<Panel, string> = { maps: "Farms", layers: "Layers", settings: "Settings" };
const ORDER: (Panel | "scan")[] = ["maps", "layers", "scan", "settings"];

export function ControlCluster({
  farms,
  ready,
  selectedId,
  onPickFarm,
  settings,
  onSettings,
}: {
  farms: Farm[];
  ready: boolean;
  selectedId: string | null;
  onPickFarm(id: string): void;
  settings: HeroSettings;
  onSettings(next: HeroSettings): void;
}) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState<Panel | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const triggers = useRef<Partial<Record<Panel, HTMLElement | null>>>({});

  // Escape and outside clicks close; Escape returns focus to the trigger.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      triggers.current[open]?.querySelector("button")?.focus();
      setOpen(null);
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (p: Panel) => setOpen((o) => (o === p ? null : p));
  // The popover grows out of the trigger: its transform origin sits at the trigger's centre height.
  const originY = open ? ORDER.indexOf(open) * (BTN + GAP) + BTN / 2 : 0;
  const set = (patch: Partial<HeroSettings>) => onSettings({ ...settings, ...patch });

  return (
    <div ref={root} className="relative flex flex-col" style={{ gap: GAP }}>
      {ORDER.map((p) =>
        p === "scan" ? (
          <IconButton key={p} label="Scan a farm" onClick={() => router.push("/scan")}>
            <ScanIcon />
          </IconButton>
        ) : (
          <div key={p} ref={(el) => void (triggers.current[p] = el)}>
            <IconButton label={TITLES[p]} active={open === p} aria-expanded={open === p} aria-controls="hero-popover" onClick={() => toggle(p)}>
              <SwapIcon id={open === p ? "close" : p}>{open === p ? <CloseIcon /> : p === "maps" ? <MapsIcon /> : p === "layers" ? <LayersIcon /> : <SettingsIcon />}</SwapIcon>
            </IconButton>
          </div>
        ),
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            id="hero-popover"
            role="dialog"
            aria-label={TITLES[open]}
            layout={!reduced}
            className="absolute top-0 right-[calc(100%+10px)] w-[19rem] overflow-hidden rounded-[14px] border border-white/[0.1] bg-[#05060a]/90"
            style={{ transformOrigin: `100% ${originY}px` }}
            initial={{ opacity: 0, scale: popover.fromScale, clipPath: "inset(0 0 0 100% round 14px)" }}
            animate={{ opacity: 1, scale: 1, clipPath: "inset(0 0 0 0% round 14px)", transition: { duration: popover.openMs / 1000, ease: ease.inOut } }}
            exit={{ opacity: 0, scale: popover.fromScale, clipPath: "inset(0 0 0 100% round 14px)", transition: { duration: popover.closeMs / 1000, ease: ease.out } }}
            transition={{ layout: uiSpring }}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={open}
                initial={{ opacity: 0, filter: "blur(2px)" }}
                animate={{ opacity: 1, filter: "blur(0px)", transition: { duration: 0.16, ease: ease.inOut } }}
                exit={{ opacity: 0, filter: "blur(2px)", transition: { duration: 0.12, ease: ease.out } }}
              >
                <p className="px-4 pt-3 pb-1 text-[12px] text-white/[0.55]">{TITLES[open]}</p>
                {open === "maps" && (
                  <FarmRows
                    farms={farms}
                    ready={ready}
                    selectedId={selectedId}
                    onPick={(id) => {
                      onPickFarm(id);
                      setOpen(null);
                    }}
                  />
                )}
                {open === "layers" && (
                  <div className="grid gap-3 px-4 pt-2 pb-4">
                    <Toggle label="Farm markers" checked={settings.showPins} onChange={(v) => set({ showPins: v })} />
                    <Toggle label="Atmosphere" checked={settings.atmosphere} onChange={(v) => set({ atmosphere: v })} />
                  </div>
                )}
                {open === "settings" && (
                  <div className="grid gap-3 px-4 pt-2 pb-4">
                    <Toggle label="Spin the Earth at rest" checked={settings.autoRotate} onChange={(v) => set({ autoRotate: v })} />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

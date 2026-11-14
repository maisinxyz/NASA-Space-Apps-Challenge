"use client";
// Earth loading state: a thin progress ring with the percentage while the imagery streams in.
import { AnimatePresence, motion } from "framer-motion";
import { useRef, useSyncExternalStore } from "react";

import { loadBus } from "./buses";
import { heroMonoFont } from "./fonts";
import { ease } from "./tokens";

const R = 26;
const C = 2 * Math.PI * R;

/** Reads progress from loadBus so streaming tiles never re-render the page. */
export function EarthLoading({ ready }: { ready: boolean }) {
  const fraction = useSyncExternalStore(loadBus.subscribe, loadBus.get, () => 0);
  // First load only: once the Earth has loaded, later tile streaming (zooming, the dive) never brings the ring back.
  const loaded = useRef(false);
  if (ready && fraction >= 0.999) loaded.current = true;
  const done = loaded.current;
  const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          role="progressbar"
          aria-label="Loading Earth imagery"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.32, ease: ease.out } }}
          transition={{ duration: 0.4, ease: ease.inOut }}
        >
          <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
            <circle cx="32" cy="32" r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
            <circle cx="32" cy="32" r={R} fill="none" stroke="rgba(236,238,241,0.85)" strokeWidth="1" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} style={{ transition: "stroke-dashoffset 240ms ease-out" }} />
          </svg>
          <span className={`${heroMonoFont.className} absolute inset-0 grid place-items-center text-[11px] text-white/[0.62] tabular-nums`}>{pct}%</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

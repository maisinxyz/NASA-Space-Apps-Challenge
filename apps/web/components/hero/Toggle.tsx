"use client";
// A switch for the Layers and Settings panels. The knob stretches 12% along its travel while it moves, then settles;
// "on" is the one place the accent colour marks a live state.
import { motion } from "framer-motion";
import { useEffect, useId, useRef } from "react";

import { Pressable } from "./Pressable";
import { color, knob, uiSpring } from "./tokens";

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange(next: boolean): void }) {
  const id = useId();
  // The stretch plays on changes only, not on first render.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  return (
    <div className="flex items-center justify-between gap-6">
      <span id={id} className="text-[13px] text-white/[0.86]">
        {label}
      </span>
      <Pressable
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        onClick={() => onChange(!checked)}
        className="-m-2 rounded-full p-2 focus-visible:ring-1 focus-visible:ring-white/70"
      >
        <span className="relative block h-[18px] w-8 rounded-full border border-white/20 transition-colors duration-200" style={{ backgroundColor: checked ? color.accent : "rgba(255,255,255,0.06)", borderColor: checked ? color.accent : undefined }}>
          <motion.span className="absolute top-[2px] left-[2px] block h-3 w-3" initial={false} animate={{ x: checked ? 14 : 0 }} transition={uiSpring}>
            <motion.span
              key={String(checked)}
              className="block h-3 w-3 rounded-full bg-white"
              initial={{ scaleX: mounted.current ? knob.stretch : 1 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              style={{ originX: checked ? 1 : 0 }}
            />
          </motion.span>
        </span>
      </Pressable>
    </div>
  );
}

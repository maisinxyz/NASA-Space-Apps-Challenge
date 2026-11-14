"use client";
// Arrival sequence after a dive: the atmospheric-entry veil, then the title (country, locality, farm name) top right.
// The title sweeps in from the right edge toward the left (country letter by letter, then the lines below word by
// word, each piece drifting slightly left into place) and sweeps out from the left toward the right. Timing lives in
// tokens.arrivalTitle. The exit is driven by the parent's AnimatePresence, so the parent knows exactly when it ends.
import { motion, type Variants } from "framer-motion";
import { useEffect } from "react";

import type { Farm } from "@/components/globe/types";

import { heroWordFont } from "./fonts";
import { arrivalTitle as T, dive } from "./tokens";

/** Dive veil length: the swing to centre plus the fall (tokens dive). */
export const DIVE_VEIL_S = dive.centreSeconds + dive.fallSeconds;

/** Atmospheric entry during the dive: edges darken and fine radial streaks rush outward, then everything clears. */
export function DiveVeil({ reducedMotion }: { reducedMotion: boolean }) {
  if (reducedMotion) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute inset-[-30%]"
        style={{
          background: "repeating-conic-gradient(from 0deg at 50% 50%, rgba(242,244,247,0.09) 0deg 0.35deg, transparent 0.35deg 5deg)",
          maskImage: "radial-gradient(circle at 50% 50%, transparent 18%, #000 62%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 50%, transparent 18%, #000 62%)",
        }}
        initial={{ opacity: 0, scale: 1 }}
        animate={{ opacity: [0, 0.35, 1, 0], scale: [1, 1.15, 1.6, 1.9] }}
        transition={{ duration: DIVE_VEIL_S, times: [0, 0.3, 0.58, 1], ease: "easeIn" }}
      />
      <motion.div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 50%, transparent 35%, rgba(0,0,0,0.85) 100%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.9, 0.9, 0] }}
        transition={{ duration: DIVE_VEIL_S, times: [0, 0.4, 0.62, 1] }}
      />
      {/* Atmosphere: a soft pale haze at the hand-over from the dive to the brake. */}
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(220,232,245,0.35),transparent_70%)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 0.8, 0] }}
        transition={{ duration: DIVE_VEIL_S, times: [0, 0.5, 0.6, 0.85] }}
      />
    </div>
  );
}

/** One piece of the sweep (a letter or a word). `inDelay` / `outDelay` are seconds. */
type Piece = { inDelay: number; outDelay: number };
const piece: Variants = {
  hidden: { opacity: 0, x: `${T.driftEm}em` },
  in: ({ inDelay }: Piece) => ({ opacity: 1, x: "0em", transition: { delay: inDelay, duration: T.inS, ease: T.ease } }),
  out: ({ outDelay }: Piece) => ({ opacity: 0, x: `${T.driftEm}em`, transition: { delay: outDelay, duration: T.outS, ease: T.easeOut } }),
};
const fade: Variants = {
  hidden: { opacity: 0 },
  in: { opacity: 1, transition: { duration: T.fadeS } },
  out: { opacity: 0, transition: { duration: T.fadeS } },
};

/** Total entrance time for a country of `n` letters and `w` words below it, seconds. */
export function titleInSeconds(n: number, w: number) {
  return (n - 1) * T.letterStagger + T.linesDelayS + Math.max(0, w - 1) * T.wordStagger + T.inS;
}

/**
 * Arrival title, top right: country in wide bold capitals, then locality and farm name. Mount it inside
 * <AnimatePresence> with initial="hidden" handled here: it enters, holds, then calls `onHoldEnd`; the parent unmounts
 * it, which plays the exit, and AnimatePresence's onExitComplete tells the parent the title is gone.
 */
export function ArrivalTitle({ farm, reducedMotion, onHoldEnd }: { farm: Farm; reducedMotion: boolean; onHoldEnd(): void }) {
  const letters = [...farm.country.toUpperCase()];
  const n = letters.length;
  const lines = [farm.locality, farm.name].filter((l): l is string => !!l).map((l) => l.split(" "));
  const wordCount = lines.reduce((a, l) => a + l.length, 0);
  const countryIn = (n - 1) * T.letterStagger;
  const inTotal = reducedMotion ? T.fadeS : titleInSeconds(n, wordCount);
  useEffect(() => {
    const t = setTimeout(onHoldEnd, (inTotal + T.hold) * 1000);
    return () => clearTimeout(t);
  }, [inTotal, onHoldEnd]);

  // Entrance right -> left: the last letter / word first. Exit left -> right: the first letter / word first.
  const letterP = (i: number): Piece => ({ inDelay: (n - 1 - i) * T.letterStagger, outDelay: i * T.outStagger });
  const v = reducedMotion ? fade : piece;
  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-label={[farm.country, farm.locality, farm.name].filter(Boolean).join(", ")}
      className="pointer-events-none absolute top-[7vh] right-[5vw] max-w-[80vw] text-right"
      initial="hidden"
      animate="in"
      exit="out"
    >
      <p
        aria-hidden
        className={`${heroWordFont.className} text-[#f2f4f7] text-[clamp(2.6rem,6.4vw,6rem)] leading-[0.95] tracking-[0.035em] whitespace-nowrap [-webkit-text-stroke:0.03em_#f2f4f7] [text-shadow:0_2px_24px_rgba(0,0,0,0.6)]`}
      >
        {letters.map((ch, i) => (
          <motion.span key={i} className="inline-block" variants={v} custom={letterP(i)}>
            {ch === " " ? "\u00a0" : ch}
          </motion.span>
        ))}
      </p>
      {lines.map((words, li) => {
        const before = lines.slice(0, li).reduce((a, l) => a + l.length, 0);
        return (
          <p
            key={li}
            aria-hidden
            className={
              li === 0
                ? "mt-4 text-[clamp(1rem,1.6vw,1.35rem)] font-medium tracking-[0.02em] text-[#f2f4f7] [text-shadow:0_1px_12px_#000]"
                : "mt-1 text-[clamp(0.9rem,1.2vw,1.05rem)] font-medium text-white/[0.75] [text-shadow:0_1px_12px_#000]"
            }
          >
            {words.map((w, wi) => {
              // Words sweep right -> left across all lines in reading order reversed; exit left -> right.
              const k = before + wi;
              const p: Piece = { inDelay: countryIn + T.linesDelayS + (wordCount - 1 - k) * T.wordStagger, outDelay: wi * T.outStagger * 2 };
              return (
                <motion.span key={wi} className="inline-block" variants={v} custom={p}>
                  {w}
                  {wi < words.length - 1 ? "\u00a0" : ""}
                </motion.span>
              );
            })}
          </p>
        );
      })}
    </motion.div>
  );
}

"use client";
// Every button and clickable in the farm view: scales to 0.95 on press (100 ms ease-out), springs back (600/30),
// and plays the tap sound on pointerdown, including buttons that do nothing yet. Reduced motion: no scale.
import { motion, useReducedMotion } from "framer-motion";
import { type ComponentPropsWithoutRef, forwardRef } from "react";

import { motion as m } from "@/lib/farm-view/tokens";
import { sound } from "@/lib/ui/sound";

type Props = ComponentPropsWithoutRef<typeof motion.button> & {
  /** Sound on press; default tap. "none" for controls that make their own sound (disabled send). */
  tapSound?: "tap" | "none";
  /** transform-origin for the press scale (the collapsed report tab uses "left center"). */
  origin?: string;
};

export const FvButton = forwardRef<HTMLButtonElement, Props>(function FvButton({ tapSound = "tap", origin, onPointerDown, style, disabled, ...rest }, ref) {
  const reduced = useReducedMotion();
  return (
    <motion.button
      ref={ref}
      type="button"
      disabled={disabled}
      {...rest}
      style={{ ...style, transformOrigin: origin }}
      whileTap={reduced || disabled ? undefined : { scale: m.pressScale, transition: { duration: m.pressMs / 1000, ease: "easeOut" } }}
      transition={{ type: "spring", ...m.pressSpring }}
      onPointerDown={(e) => {
        if (!disabled && tapSound === "tap") sound.tap();
        onPointerDown?.(e);
      }}
    />
  );
});

"use client";
// The press feel shared by every interactive element in the hero: on pointer-down the element snaps to 0.97 (no
// tween while held), its fill brightens with a soft inset shadow, and it gives one 120 ms micro-vibration (plus an
// 8 ms haptic tick on touch). On release it springs back, critically damped, so it never overshoots.
import { motion, useAnimate, useReducedMotion } from "framer-motion";
import { type ComponentPropsWithoutRef, forwardRef, type ReactNode, useState } from "react";

import { press } from "./tokens";

type Props = Omit<ComponentPropsWithoutRef<typeof motion.button>, "children"> & { children: ReactNode };

export const Pressable = forwardRef<HTMLButtonElement, Props>(function Pressable({ children, className = "", onPointerDown, onPointerUp, onPointerCancel, onPointerLeave, ...rest }, ref) {
  const reduced = useReducedMotion();
  const [held, setHeld] = useState(false);
  const [inner, animateInner] = useAnimate<HTMLSpanElement>();
  const release = () => setHeld(false);
  return (
    <motion.button
      ref={ref}
      type="button"
      {...rest}
      data-held={held || undefined}
      className={`relative outline-none ${className}`}
      animate={{ scale: held ? press.scale : 1 }}
      transition={held ? { duration: 0 } : press.release}
      onPointerDown={(e) => {
        setHeld(true);
        if (!reduced) void animateInner(inner.current, { x: press.vibrateX }, { duration: press.vibrateMs / 1000, ease: "linear" });
        if (e.pointerType === "touch") navigator.vibrate?.(press.haptic);
        onPointerDown?.(e);
      }}
      onPointerUp={(e) => {
        release();
        onPointerUp?.(e);
      }}
      onPointerCancel={(e) => {
        release();
        onPointerCancel?.(e);
      }}
      onPointerLeave={(e) => {
        release();
        onPointerLeave?.(e);
      }}
    >
      <span ref={inner} className="relative block">
        {children}
      </span>
    </motion.button>
  );
});

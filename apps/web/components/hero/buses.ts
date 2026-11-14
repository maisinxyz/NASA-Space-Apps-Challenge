// Tiny external stores for values that change every frame (camera, head, marker positions). Components subscribe and
// write straight to the DOM, so the page never re-renders per frame.
import type { CameraTelemetry, PinHover } from "@/components/globe/types";

export type Bus<T> = { get(): T; set(v: T): void; subscribe(f: () => void): () => void };

export function createBus<T>(initial: T): Bus<T> {
  let value = initial;
  const subs = new Set<() => void>();
  return {
    get: () => value,
    set(v) {
      value = v;
      subs.forEach((f) => f());
    },
    subscribe(f) {
      subs.add(f);
      return () => {
        subs.delete(f);
      };
    },
  };
}

export const cameraBus = createBus<CameraTelemetry | null>(null);
/** Head position in units of the look limit (x right, y up). */
export const gazeBus = createBus<{ x: number; y: number }>({ x: 0, y: 0 });
/** Hovered waypoint and its screen position. */
export const hoverBus = createBus<PinHover | null>(null);
/** Selected waypoint's screen position (for the farm card and pulse). */
export const trackBus = createBus<PinHover | null>(null);
/** Earth imagery loading progress, 0..1. */
export const loadBus = createBus(0);

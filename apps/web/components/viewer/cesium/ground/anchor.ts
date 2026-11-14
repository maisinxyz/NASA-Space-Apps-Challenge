// Screen anchor of the NASA imagery layer (a point above the sim square). The renderer writes it each frame; a UI panel reads it.
export type ScreenAnchor = { x: number; y: number; visible: boolean };

let current: ScreenAnchor | null = null;
const listeners = new Set<() => void>();

export function getAnchor(): ScreenAnchor | null {
  return current;
}

export function subscribeAnchor(cb: () => void): () => void {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}

/** Notifies only when the anchor appears/disappears, visibility flips, or it moves by more than 0.5 px. */
export function setAnchor(a: ScreenAnchor | null): void {
  const p = current;
  const same = p === a || (!!p && !!a && p.visible === a.visible && Math.abs(p.x - a.x) <= 0.5 && Math.abs(p.y - a.y) <= 0.5);
  if (same) return;
  current = a ? { ...a } : null;
  listeners.forEach((cb) => cb());
}

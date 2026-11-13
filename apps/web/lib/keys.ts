// Global keyboard shortcuts must not fire while the user types or operates a control.

const el = (t: EventTarget | null) => (t instanceof HTMLElement ? t : null);

/** Text entry: R (reset) is ignored here. */
export function isTextEntry(t: EventTarget | null): boolean {
  const e = el(t);
  if (!e) return false;
  if (e.isContentEditable || e.tagName === "TEXTAREA" || e.tagName === "SELECT") return true;
  return e.tagName === "INPUT" && !["checkbox", "radio", "button", "range", "submit", "reset"].includes((e as HTMLInputElement).type);
}

/** Controls that use Space themselves (buttons, inputs, links): the page's play/pause is ignored here. */
export const usesSpace = (t: EventTarget | null) => !!el(t)?.closest("input, textarea, select, button, a[href], [contenteditable], [role=tab], [role=slider], [role=radio]");

/** Controls that use the arrow keys themselves: the page's scrub is ignored here. */
export const usesArrows = (t: EventTarget | null) => !!el(t)?.closest("input, textarea, select, [contenteditable], [role=tab], [role=tablist], [role=slider], [role=radio]");

export const hasModifier = (e: KeyboardEvent) => e.metaKey || e.ctrlKey || e.altKey;

/** Fired by the global Reset key; pages holding a viewer call its replay(). */
export const RESET_EVENT = "fieldtwin:reset";

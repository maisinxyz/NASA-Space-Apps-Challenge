import type { Page } from "@playwright/test";

/** Route to the farm view. TODO(Oscar): confirm; today it is the globe dive (#farm=…). */
export const FARM_URL = process.env.FARM_VIEW_URL ?? "/#farm=agroscope-reckenholz";

/**
 * data-testid contract the tester needs from the coder (not yet agreed):
 *  layer-satellite|layer-vigor|layer-moisture, reset-view, condition-pill-{rainfall|moisture|vigor|heat},
 *  card-{rainfall|moisture|vigor|heat}, card-fold-{…}, field-popover, field-report, field-report-toggle,
 *  field-report-row-{slug}, twin-button, twin-pill, twin-input, twin-send, twin-answer, twin-close,
 *  twin-chip-show-on-map, twin-chip-why-main, timeline, timeline-handle, timeline-track, date-label,
 *  success-ring, legend.
 */
export const tid = (page: Page, id: string) => page.getByTestId(id);

/** Dev-only sound call log. Needs Oscar to push {name, t} to window.__soundLog inside lib/ui/sound.ts when NEXT_PUBLIC_E2E=1. */
export async function soundLog(page: Page): Promise<{ name: string; t: number }[]> {
  return page.evaluate(() => (window as any).__soundLog ?? []);
}
export const clearSoundLog = (page: Page) => page.evaluate(() => { (window as any).__soundLog = []; });

export async function openFarm(page: Page) {
  await page.addInitScript(() => { (window as any).__soundLog = []; });
  await page.goto(FARM_URL);
  await tid(page, "timeline").waitFor();
}

/** Count visible pop-ups: condition cards + field popover + Twin answer. Rule: never more than 1. */
export async function openPopupCount(page: Page) {
  return page.evaluate(() =>
    ["card-rainfall", "card-moisture", "card-vigor", "card-heat", "field-popover", "twin-answer", "twin-pill"].filter((id) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      return !!el && getComputedStyle(el).visibility !== "hidden" && (el as HTMLElement).offsetParent !== null;
    }).length,
  );
}

export const handleX = async (page: Page) => (await tid(page, "timeline-handle").boundingBox())!.x;

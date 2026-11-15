import { test, expect, type Page } from "@playwright/test";
import { openFarm, tid, soundLog, clearSoundLog } from "./helpers";

// Spy: lib/ui/sound.ts must append {name,t} to window.__soundLog when NEXT_PUBLIC_E2E=1 (request to Oscar).
// Names expected: tick | tap | pop | close | success. Unit tests (vitest, lib/ui/sound.test.ts) cover synth params:
// noise 2 ms, band-pass 3–4 kHz, gain 0.06 week / 0.12 month + pitch drop, min 35 ms between ticks, AudioContext unlocked on first pointerdown, mute in localStorage try/catch.
test.describe("sound calls (spec: Sound module)", () => {
  test.beforeEach(({ page }) => openFarm(page));
  const names = async (page: Page) => (await soundLog(page)).map((s) => s.name);

  test.fixme("single AudioContext, created/unlocked on first pointerdown (none before)", async ({ page }) => {});
  test.fixme("every button plays tap (incl. dead buttons: reset-view, fold, send)", async ({ page }) => {
    for (const id of ["reset-view", "field-report-toggle"]) { await clearSoundLog(page); await tid(page, id).click(); expect(await names(page)).toContain("tap"); }
  });
  test.fixme("layer switch plays tick", async ({ page }) => { await clearSoundLog(page); await tid(page, "layer-vigor").click(); expect(await names(page)).toContain("tick"); });
  test.fixme("pill click plays tick", async ({ page }) => { await clearSoundLog(page); await tid(page, "condition-pill-heat").click(); expect(await names(page)).toContain("tick"); });
  test.fixme("success plays on message sent, layer loaded, 'Show on map' done", async ({ page }) => {});
  test.fixme("timeline: week tick per week crossed, heavier month tick per month boundary, ≤1 tick / 35 ms", async ({ page }) => {
    await clearSoundLog(page);
    await tid(page, "timeline-handle").focus(); await page.keyboard.press("PageDown");
    const l = await soundLog(page);
    expect(l.some((s) => s.name === "tick-month" || s.name === "tick")).toBe(true);
    for (let i = 1; i < l.length; i++) expect(l[i].t - l[i - 1].t).toBeGreaterThanOrEqual(35);
  });
  test.fixme("mute toggle silences all sounds and persists across reload (localStorage)", async ({ page }) => {});
  test.fixme("localStorage throwing does not break the page", async ({ page }) => {});
});

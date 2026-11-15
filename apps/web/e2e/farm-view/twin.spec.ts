// @ts-nocheck — see playwright.config.ts
import { test, expect } from "@playwright/test";
import { openFarm, tid, openPopupCount } from "./helpers";

test.describe("Twin (spec: TWIN)", () => {
  test.beforeEach(({ page }) => openFarm(page));
  const ask = async (page, q = "Which field needs me first?") => { await tid(page, "twin-button").click(); await tid(page, "twin-input").fill(q); await tid(page, "twin-send").click(); };

  test.fixme("round button is 60 px, shows logo only (no sparkle, aria-label)", async ({ page }) => {
    const b = (await tid(page, "twin-button").boundingBox())!; expect([Math.round(b.width), Math.round(b.height)]).toEqual([60, 60]);
    await expect(tid(page, "twin-button")).toHaveAttribute("aria-label", /.+/);
    expect(await tid(page, "twin-button").locator('[fill="#E2B866"]').count()).toBe(0);
  });
  test.fixme("opens into 460 px pill centred horizontally, placeholder 'Ask about this farm', input focused, gold send", async ({ page }) => {
    await tid(page, "twin-button").click();
    const b = (await tid(page, "twin-pill").boundingBox())!;
    expect(Math.round(b.width)).toBe(460); expect(Math.abs(b.x + b.width / 2 - 720)).toBeLessThanOrEqual(1);
    await expect(tid(page, "twin-input")).toHaveAttribute("placeholder", "Ask about this farm");
    await expect(tid(page, "twin-input")).toBeFocused();
  });
  test.fixme("answer card: same width, centred, directly above pill; question bubble, streamed answer, chips", async ({ page }) => {
    await ask(page);
    const a = (await tid(page, "twin-answer").boundingBox())!, p = (await tid(page, "twin-pill").boundingBox())!;
    expect(Math.round(a.width)).toBe(Math.round(p.width)); expect(a.y + a.height).toBeLessThanOrEqual(p.y + 1);
    await expect(tid(page, "twin-answer")).toContainText("Trial plots. Soil at 36%, lowest on the farm, and they’re browning six days before harvest. Water them first.", { timeout: 10_000 });
    await expect(tid(page, "twin-chip-show-on-map")).toBeVisible(); await expect(tid(page, "twin-chip-why-main")).toBeVisible();
  });
  test.fixme("thinking state: sparkle spins, status 'Reading soil moisture for 5 fields…'", async ({ page }) => {});
  test.fixme("answer streams word by word with a caret (text length grows monotonic over >1 sample)", async ({ page }) => {});
  test.fixme("'Show on map' switches to Soil moisture and flies camera to Trial plots; success ring + success sound", async ({ page }) => {
    await ask(page); await tid(page, "twin-chip-show-on-map").click();
    await expect(tid(page, "layer-moisture")).toHaveAttribute("aria-pressed", "true");
    await expect(tid(page, "success-ring")).toBeAttached();
  });
  test.fixme("'Why not the main block?' sends that as the next mocked question", async ({ page }) => {});
  test.fixme("close via ✕, Esc and logo click all reverse morph to the round button", async ({ page }) => {
    for (const how of ["x", "esc", "logo"]) {
      await tid(page, "twin-button").click();
      if (how === "x") await tid(page, "twin-close").click(); else if (how === "esc") await page.keyboard.press("Escape"); else await tid(page, "twin-button").click();
      await expect(tid(page, "twin-pill")).toBeHidden(); expect(await openPopupCount(page)).toBe(0);
    }
  });
  test.fixme("copy rules: answer starts with the answer, has a number, no 'Great question', no emoji", async ({ page }) => {
    await ask(page); const t = await tid(page, "twin-answer").innerText();
    expect(t).not.toMatch(/great question/i); expect(t).not.toMatch(/\p{Extended_Pictographic}/u); expect(t).toMatch(/\d/);
  });
  test.fixme("mocked answers carry TODO for real API (grep lib/farm-view/twin-mock.ts) — checked in vitest not e2e", async () => {});
});

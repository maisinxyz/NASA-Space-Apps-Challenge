// @ts-nocheck — see playwright.config.ts
import { test, expect } from "@playwright/test";
import { openFarm, tid, soundLog, clearSoundLog, handleX } from "./helpers";

test.describe("timeline (spec: TIMELINE)", () => {
  test.beforeEach(({ page }) => openFarm(page));

  test.fixme("looks right: 12 month ticks + labels Jan..Dec, handle 16 px, role=slider with aria-valuetext '14 July'", async ({ page }) => {
    const h = tid(page, "timeline-handle");
    await expect(h).toHaveAttribute("role", "slider");
    await expect(h).toHaveAttribute("aria-valuetext", "14 July");
    const b = (await h.boundingBox())!;
    expect(Math.round(b.width)).toBe(16);
    await expect(tid(page, "date-label")).toContainText(/July/);
    await expect(tid(page, "date-label")).toContainText(/14 · Summer · week 28/);
  });
  test.fixme("drag follows pointer 1:1, grab->grabbing cursor, scale 1.15 while held", async ({ page }) => {
    const h = tid(page, "timeline-handle");
    const b = (await h.boundingBox())!;
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    await page.mouse.move(cx, cy);
    expect(await h.evaluate((e) => getComputedStyle(e).cursor)).toBe("grab");
    await page.mouse.down();
    expect(await h.evaluate((e) => getComputedStyle(e).cursor)).toBe("grabbing");
    await page.mouse.move(cx - 120, cy, { steps: 12 });
    const nb = (await h.boundingBox())!;
    expect(Math.abs(nb.x + nb.width / 2 - (cx - 120))).toBeLessThanOrEqual(2);
    expect(await h.evaluate((e) => getComputedStyle(e).transform)).toContain("1.15");
    await page.mouse.up();
  });
  test.fixme("drag keeps tracking when pointer leaves the track (setPointerCapture)", async ({ page }) => {
    const b = (await tid(page, "timeline-handle").boundingBox())!;
    await page.mouse.move(b.x + 8, b.y + 8); await page.mouse.down();
    await page.mouse.move(b.x - 100, b.y - 200, { steps: 10 });
    expect(await handleX(page)).toBeLessThan(b.x - 90);
    await page.mouse.up();
  });
  test.fixme("release between positions snaps to the nearest day (aria-valuenow integer day-of-year)", async ({ page }) => {
    const b = (await tid(page, "timeline-handle").boundingBox())!;
    await page.mouse.move(b.x + 8, b.y + 8); await page.mouse.down();
    await page.mouse.move(b.x + 8 + 37.3, b.y + 8, { steps: 6 }); await page.mouse.up();
    await page.waitForTimeout(600);
    const v = await tid(page, "timeline-handle").getAttribute("aria-valuenow");
    expect(Number.isInteger(Number(v))).toBe(true);
  });
  test.fixme("fast flick coasts then snaps to the nearest week", async ({ page }) => {
    const b = (await tid(page, "timeline-handle").boundingBox())!;
    await page.mouse.move(b.x + 8, b.y + 8); await page.mouse.down();
    await page.mouse.move(b.x + 200, b.y + 8, { steps: 3 }); await page.mouse.up();
    await page.waitForTimeout(1500);
    const v = Number(await tid(page, "timeline-handle").getAttribute("aria-valuenow"));
    expect(v % 7).toBe(0); // TODO(verify): week boundary definition from Oscar's hook (day-of-year % 7 vs ISO week start)
  });
  test.fixme("month lines pull the handle in from ±6 px", async ({ page }) => {
    // Drop the handle 5 px off the Jul 1 tick -> lands exactly on Jul 1 (aria-valuetext '1 July').
  });
  test.fixme("keyboard: ←/→ day, Shift+←/→ week, PageUp/PageDown month, Home/End; each step ticks", async ({ page }) => {
    const h = tid(page, "timeline-handle"); await h.focus();
    const txt = () => h.getAttribute("aria-valuetext");
    await clearSoundLog(page);
    await page.keyboard.press("ArrowRight"); expect(await txt()).toBe("15 July");
    await page.keyboard.press("ArrowLeft"); expect(await txt()).toBe("14 July");
    await page.keyboard.press("Shift+ArrowRight"); expect(await txt()).toBe("21 July");
    await page.keyboard.press("Shift+ArrowLeft"); expect(await txt()).toBe("14 July");
    await page.keyboard.press("PageDown"); expect(await txt()).toMatch(/August/);
    await page.keyboard.press("PageUp"); expect(await txt()).toMatch(/July/);
    await page.keyboard.press("Home"); expect(await txt()).toBe("1 January");
    await page.keyboard.press("End"); expect(await txt()).toBe("31 December");
    expect((await soundLog(page)).filter((s) => /tick/.test(s.name)).length).toBeGreaterThanOrEqual(8);
  });
  test.fixme("clicking the track glides the handle there in ~250 ms, ticking along the way", async ({ page }) => {
    const tr = (await tid(page, "timeline-track").boundingBox())!;
    await clearSoundLog(page);
    await page.mouse.click(tr.x + tr.width * 0.15, tr.y + tr.height / 2);
    await page.waitForTimeout(100);
    const mid = await handleX(page);
    await page.waitForTimeout(400);
    const end = await handleX(page);
    expect(mid).not.toBe(end);
    expect((await soundLog(page)).length).toBeGreaterThan(1);
  });
  test.fixme("date change updates label, card crosshair and layer colours", async ({ page }) => {
    await tid(page, "layer-moisture").click(); await tid(page, "condition-pill-moisture").click();
    const before = await tid(page, "date-label").innerText();
    await tid(page, "timeline-handle").focus(); await page.keyboard.press("PageDown");
    expect(await tid(page, "date-label").innerText()).not.toBe(before);
    // TODO: assert crosshair x via data-date attr on card; layer colour via test hook (Cesium entity material).
  });
  test.fixme("haptics: navigator.vibrate(8) per week, 16 per month, [10,30,10] on season change; feature-detected", async ({ page }) => {
    // addInitScript spy on navigator.vibrate, then Shift+→, PageDown, and cross Aug31->Sep1; also run with vibrate deleted -> no throw.
  });
  test.fixme("data loads debounced 150 ms; label updates rAF-throttled (one network/data call per burst)", async ({ page }) => {});
});

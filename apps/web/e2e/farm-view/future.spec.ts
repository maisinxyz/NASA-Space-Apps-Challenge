import { expect, test } from "@playwright/test";

import { openFarm, tid } from "./helpers";

// Future / Compare modes (components/farm-future). Fixture-driven: every view shows "Synthetic demo data".
test.describe("farm view: future features", () => {
  test.beforeEach(async ({ page }) => {
    await openFarm(page);
  });

  test("Now mode is unchanged; Future adds only the four new doors", async ({ page }) => {
    await expect(tid(page, "mode-now")).toHaveAttribute("aria-checked", "true");
    await expect(tid(page, "lens-button")).toHaveCount(0);
    await expect(tid(page, "whatif-pill")).toHaveCount(0);
    await tid(page, "mode-future").click();
    await expect(tid(page, "lens-button")).toBeVisible();
    await expect(tid(page, "whatif-pill")).toBeVisible();
    await expect(tid(page, "future-timeline")).toBeVisible();
    await expect(tid(page, "future-pills")).toBeVisible();
    await expect(tid(page, "synthetic-badge").first()).toBeVisible();
    await expect(tid(page, "lens-card")).toHaveCount(0);
  });

  test("one lens at a time; a panel replaces the lens card", async ({ page }) => {
    await tid(page, "mode-future").click();
    await tid(page, "lens-button").click();
    await tid(page, "lens-water").click();
    await expect(tid(page, "lens-chip")).toContainText("Water");
    await expect(tid(page, "lens-card")).toBeVisible();
    await tid(page, "whatif-pill").click();
    await expect(tid(page, "whatif-card")).toBeVisible();
    await expect(tid(page, "lens-card")).toHaveCount(0);
    await tid(page, "lens-off").click();
    await expect(tid(page, "lens-button")).toBeVisible();
  });

  test("what-if changes propagate to the pills", async ({ page }) => {
    await tid(page, "mode-future").click();
    const before = await tid(page, "future-pill-rain").innerText();
    await tid(page, "whatif-pill").click();
    await tid(page, "whatif-rainfall").focus();
    for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowLeft");
    await expect(tid(page, "whatif-pill")).toHaveAttribute("data-active", "true");
    await expect.poll(async () => tid(page, "future-pill-rain").innerText()).not.toBe(before);
  });

  test("timeline: keyboard steps by year and Home goes to 2026", async ({ page }) => {
    await tid(page, "mode-future").click();
    await expect(tid(page, "future-date")).toHaveText("2034");
    await tid(page, "future-handle").focus();
    await page.keyboard.press("Shift+ArrowRight");
    await expect(tid(page, "future-date")).toHaveText("2035");
    await page.keyboard.press("Home");
    await expect(tid(page, "future-date")).toHaveText("2026");
  });

  test("compare: leaderboard, review drawer with the expertise line, deep link back", async ({ page }) => {
    await tid(page, "mode-compare").click();
    await expect(tid(page, "leaderboard")).toBeVisible();
    await tid(page, "flags-current").click();
    await expect(tid(page, "review-drawer")).toContainText("does not replace, local agronomic expertise");
    await tid(page, "review-goto").first().click();
    await expect(tid(page, "mode-future")).toHaveAttribute("aria-checked", "true");
    await expect(tid(page, "future-date")).toHaveText("2031");
  });
});

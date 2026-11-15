import { test, expect } from "@playwright/test";
import { openFarm, tid, openPopupCount } from "./helpers";

test.describe("one pop-up at a time (spec: POP-UPS)", () => {
  test.beforeEach(({ page }) => openFarm(page));
  const pills = ["rainfall", "moisture", "vigor", "heat"];

  test.fixme("clicking a pill opens its card under the pill row, 332 px wide", async ({ page }) => {
    for (const p of pills) {
      await tid(page, `condition-pill-${p}`).click();
      const box = (await tid(page, `card-${p}`).boundingBox())!;
      expect(Math.round(box.width)).toBe(332);
      expect(box.y).toBeGreaterThan((await tid(page, `condition-pill-${pills.find((x) => x !== p)!}`).boundingBox())!.y);
      await tid(page, `card-fold-${p}`).click();
    }
  });
  test.fixme("opening another pill closes the current card first (never 2 open)", async ({ page }) => {
    for (const [a, b] of [["rainfall", "moisture"], ["moisture", "vigor"], ["vigor", "heat"], ["heat", "rainfall"]]) {
      await tid(page, `condition-pill-${a}`).click();
      await tid(page, `condition-pill-${b}`).click();
      expect(await openPopupCount(page)).toBe(1);
      await expect(tid(page, `card-${a}`)).toBeHidden();
    }
  });
  test.fixme("open card's pill is hidden; '–' folds card back into its pill", async ({ page }) => {
    await tid(page, "condition-pill-rainfall").click();
    await expect(tid(page, "condition-pill-rainfall")).toBeHidden();
    await tid(page, "card-fold-rainfall").click();
    await expect(tid(page, "card-rainfall")).toBeHidden();
    await expect(tid(page, "condition-pill-rainfall")).toBeVisible();
  });
  test.fixme("Esc closes the open card", async ({ page }) => {
    await tid(page, "condition-pill-heat").click();
    await page.keyboard.press("Escape");
    expect(await openPopupCount(page)).toBe(0);
  });
  test.fixme("clicking empty map closes the open card", async ({ page }) => {
    await tid(page, "condition-pill-heat").click();
    await page.mouse.click(700, 300); // empty map area at 1440x900
    expect(await openPopupCount(page)).toBe(0);
  });
  test.fixme("with a layer on, clicking a field opens a popover with name/crop/moisture/NDVI/status", async ({ page }) => {
    await tid(page, "layer-moisture").click();
    await page.mouse.click(300, 380); // Trial plots, approx; TODO use fields.ts centroid via test hook
    const pop = tid(page, "field-popover");
    await expect(pop).toContainText(/Trial plots/);
    await expect(pop).toContainText(/36\s?%/);
    await expect(pop).toContainText(/0\.48/);
    await expect(pop).toContainText(/Stressed/);
  });
  test.fixme("field popover closes an open card, and a card closes the popover", async ({ page }) => {
    await tid(page, "layer-vigor").click();
    await tid(page, "condition-pill-heat").click();
    await page.mouse.click(300, 380);
    expect(await openPopupCount(page)).toBe(1);
    await expect(tid(page, "field-popover")).toBeVisible();
    await tid(page, "condition-pill-rainfall").click();
    expect(await openPopupCount(page)).toBe(1);
    await expect(tid(page, "field-popover")).toBeHidden();
  });
  test.fixme("popover never covers the clicked point", async ({ page }) => {
    await tid(page, "layer-vigor").click();
    await page.mouse.click(300, 380);
    const b = (await tid(page, "field-popover").boundingBox())!;
    expect(300 < b.x || 300 > b.x + b.width || 380 < b.y || 380 > b.y + b.height).toBe(true);
  });
  test.fixme("every card shows 'Sample data'", async ({ page }) => {
    for (const p of pills) {
      await tid(page, `condition-pill-${p}`).click();
      await expect(tid(page, `card-${p}`)).toContainText("Sample data");
      await tid(page, `card-fold-${p}`).click();
    }
  });
  test.fixme("card contents match spec numbers (Heat & frost 2x2)", async ({ page }) => {
    await tid(page, "condition-pill-heat").click();
    const c = tid(page, "card-heat");
    for (const t of [/9/, /normal 4/, /1,412/, /\+6\s?%/, /Oct 14/, /92 days/, /11\s?°C/]) await expect(c).toContainText(t);
  });
  test.fixme("opens from the cursor: transform-origin is the click point, 200 ms open / 160 ms close, never scale(0)", async ({ page }) => {
    await tid(page, "condition-pill-vigor").click();
    const o = await tid(page, "card-vigor").evaluate((e) => getComputedStyle(e).transformOrigin);
    expect(o).not.toBe("50% 50%");
    const d = await tid(page, "card-vigor").evaluate((e) => getComputedStyle(e).transitionDuration + "|" + getComputedStyle(e).animationDuration);
    expect(d).toMatch(/0\.2s|200ms/);
  });
});

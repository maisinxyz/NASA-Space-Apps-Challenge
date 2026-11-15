import { test, expect } from "@playwright/test";
import { openFarm, tid } from "./helpers";

test.describe("prefers-reduced-motion (spec: FEEDBACK, SOUND AND MOTION)", () => {
  test.use({ reducedMotion: "reduce" });
  test.beforeEach(({ page }) => openFarm(page));

  test.fixme("timeline release snaps instantly (no spring: value final within 1 frame)", async ({ page }) => {
    const h = tid(page, "timeline-handle"); const b = (await h.boundingBox())!;
    await page.mouse.move(b.x + 8, b.y + 8); await page.mouse.down();
    await page.mouse.move(b.x + 50.4, b.y + 8, { steps: 4 }); await page.mouse.up();
    const v1 = await h.getAttribute("aria-valuenow"); await page.waitForTimeout(32);
    expect(await h.getAttribute("aria-valuenow")).toBe(v1);
  });
  test.fixme("cards/popovers animate opacity only: no transform scale/translate during enter", async ({ page }) => {
    await tid(page, "condition-pill-rainfall").click();
    const t = await tid(page, "card-rainfall").evaluate((e) => getComputedStyle(e).transform);
    expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(t);
  });
  test.fixme("press feedback has no scale(0.95)", async ({ page }) => {
    const b = tid(page, "layer-vigor"); const bb = (await b.boundingBox())!;
    await page.mouse.move(bb.x + 5, bb.y + 5); await page.mouse.down();
    expect(await b.evaluate((e) => getComputedStyle(e).transform)).not.toContain("0.95");
    await page.mouse.up();
  });
  test.fixme("Twin morph is a cross-fade (no layout spring); success ring does not scale", async ({ page }) => {});
  test.fixme("sounds still play and still follow the mute toggle", async ({ page }) => {});
});

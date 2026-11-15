import { test } from "@playwright/test";
import { openFarm, tid } from "./helpers";

// DONE-WHEN: screenshots at 1440x900 and 1280x720 of three states -> docs/farm-view/shots/
const OUT = "../../../../docs/farm-view/shots";
for (const [w, h] of [[1440, 900], [1280, 720]]) {
  test.describe(`${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h } });
    test.fixme(`everything minimized`, async ({ page }) => {
      await openFarm(page); await page.screenshot({ path: `${OUT}/${w}-minimized.png` });
    });
    test.fixme(`crop vigor on`, async ({ page }) => {
      await openFarm(page); await tid(page, "layer-vigor").click(); await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}/${w}-vigor.png` });
    });
  });
}

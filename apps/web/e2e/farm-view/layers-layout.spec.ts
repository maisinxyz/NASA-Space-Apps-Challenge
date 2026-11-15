// @ts-nocheck — see playwright.config.ts
import { test, expect } from "@playwright/test";
import { openFarm, tid } from "./helpers";

test.describe("layout, report, layers, tokens (spec: LAYOUT, MAP LAYERS, STYLE TOKENS)", () => {
  test.beforeEach(({ page }) => openFarm(page));

  test.fixme("top-left: '‹ Globe' link, farm name (Newsreader 36 px), subtitle text exact", async ({ page }) => {
    await expect(page.getByText("Zürich, Switzerland · Explore only: simulation not available for this farm yet.")).toBeVisible();
    const f = await page.getByRole("heading", { level: 1 }).evaluate((e) => { const s = getComputedStyle(e); return [s.fontFamily, s.fontSize]; });
    expect(f[0]).toMatch(/Newsreader/); expect(f[1]).toBe("36px");
  });
  test.fixme("top-right bar: Satellite | Crop vigor | Soil moisture + reset icon (aria-label); active has light fill", async ({ page }) => {});
  test.fixme("condition pills row right-aligned under bar: Rainfall 64 mm · Soil moisture 41% · Crop vigor 0.48 · Heat & frost 9 days", async ({ page }) => {});
  test.fixme("Field report: 380 px wide, rows/values/status exactly per spec, summary '4 of 5 fields are under the 50% stress line.'", async ({ page }) => {
    const rows = [["Trial plots","36%","0.48","Stressed"],["North strips","47%","0.57","Watch"],["Variety strips","49%","0.63","Watch"],["Main block","41%","0.52","Dry"],["East field","55%","0.71","OK"]];
    const w = (await tid(page, "field-report").boundingBox())!.width; expect(Math.round(w)).toBe(380);
    for (const r of rows) for (const c of r) await expect(tid(page, "field-report")).toContainText(c);
  });
  test.fixme("status = shape + text: amber diamond for Dry/Stressed, grey dot otherwise (never colour alone)", async ({ page }) => {});
  test.fixme("Field report collapse: 40 px vertical tab on left edge reading 'Field report' + chevron; re-expands; panels do not resize", async ({ page }) => {});
  test.fixme("fixed layout: at 1280x720 and 1440x900 panel sizes unchanged (380 / 332 / 60 / 460)", async ({ page }) => {});
  test.fixme("map draggable/zoomable wherever no panel covers it (drag changes camera; drag over panel does not)", async ({ page }) => {});
  test.fixme("no dark gradient scrims; text-shadow on title '0 1px 2px rgba(0,0,0,.55), 0 0 18px rgba(0,0,0,.45)'", async ({ page }) => {});
  test.fixme("Satellite: no field entities; Crop vigor: 5 polygons fill-opacity .5 + tag swatch/name/value + legend '0.4 thin → 0.8 lush'", async ({ page }) => {});
  test.fixme("Soil moisture: <50% fields (4) dashed #BE8426 outline, East field not; legend tick at 50% + 'Dashed outline: under the 50% stress line'", async ({ page }) => {});
  test.fixme("colour scales: vigor #F2E8A6→#2C6A38 (0.4–0.8), moisture #E1ECF7→#1C5AA3 (30–60%) — unit test on lut fn in vitest", async () => {});
  test.fixme("layer switch cross-fades overlays 200 ms, plays tick", async ({ page }) => {});
  test.fixme("placeholder polygons are marked APPROXIMATE in lib/farm-view/fields.ts and not labelled surveyed (grep)", async () => {});
  test.fixme("honesty: 'Sample data' on every card; no yield/profit numbers; 'Pre-built'/'Synthetic' labels per CLAUDE.md", async ({ page }) => {});
  test.fixme("press feedback: every button scale .95 on press, 100 ms, plus tap sound; success ring 350 ms", async ({ page }) => {});
  test.fixme("a11y: every icon-only button has aria-label; tab order logical; focus rings visible; contrast ≥4.5:1 (axe)", async ({ page }) => {});
  test.fixme("tokens: ink #F2EBDD, glass rgba(27,22,18,.80)+blur16+border; accent #E2B866 only on handle, send, sparkle; tabular-nums on numbers; card radius 16", async ({ page }) => {});
});

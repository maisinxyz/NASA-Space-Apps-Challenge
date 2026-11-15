# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: slice-a.spec.ts >> Slice A >> title block: Globe link, name 36px Newsreader, subtitle text
- Location: e2e/farm-view/slice-a.spec.ts:12:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Zürich, Switzerland · Explore only: simulation not available for this farm yet.')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText('Zürich, Switzerland · Explore only: simulation not available for this farm yet.') with timeout 5000ms
  - waiting for getByText('Zürich, Switzerland · Explore only: simulation not available for this farm yet.')

```

```yaml
- link "Skip to content":
  - /url: "#main"
- banner:
  - link "Stardew Earth":
    - /url: /
  - navigation "Main":
    - link "Methods & data":
      - /url: /methods
    - link "Learn":
      - /url: /learn
  - text: mock
  - button "About"
  - button "Presenter mode"
- note: This tool supports, and does not replace, local agronomic expertise.
- main:
  - application "Interactive 3D globe with research farm pins"
  - link "Cesium ion":
    - /url: https://cesium.com/
    - img "Cesium ion"
  - button "Data attribution"
  - status "Switzerland, Zurich-Affoltern, Agroscope Reckenholz research station"
  - button "Back to the globe": Globe
  - heading "Agroscope Reckenholz research station" [level=1]
  - paragraph: "Zurich-Affoltern, Switzerland · Explore only: simulation not available for this farm yet."
  - radiogroup "Map layer":
    - radio "Satellite" [checked]
    - radio "Crop vigor"
    - radio "Soil moisture"
    - button "Reset view"
    - button "Mute sounds"
  - button "Rainfall 64 mm"
  - button "Soil moisture 41%"
  - button "Crop vigor 0.48"
  - button "Heat & frost 9 days"
  - button "Expand field report": Field report
  - text: July 14 · Summer · week 28
  - slider "Date"
  - button "Ask Twin"
  - paragraph: This tool supports, and does not replace, local agronomic expertise.
  - 'heading "Stardew Earth: See how the same storm moves across real farmland under different crop rotations." [level=1]'
  - paragraph: 3D globe ready.
- alert
```

# Test source

```ts
  1   | // Slice A (layout, layer bar, pills, report, timeline, Twin button, press, sound). Live tests; headless Chrome has no Cesium tiles (map black), UI is clickable.
  2   | // Needs: NEXT_PUBLIC_E2E=1 next dev -p 3000
  3   | import { test, expect, type Page } from "@playwright/test";
  4   | import { openFarm, tid, soundLog, clearSoundLog } from "./helpers";
  5   | 
  6   | const names = async (p: Page) => (await soundLog(p)).map((s) => s.name);
  7   | const box = async (p: Page, id: string) => (await tid(p, id).boundingBox())!;
  8   | 
  9   | test.describe("Slice A", () => {
  10  |   test.beforeEach(({ page }) => openFarm(page));
  11  | 
  12  |   test("title block: Globe link, name 36px Newsreader, subtitle text", async ({ page }) => {
> 13  |     await expect(page.getByText("Zürich, Switzerland · Explore only: simulation not available for this farm yet.")).toBeVisible();
      |                                                                                                                     ^ Error: expect(locator).toBeVisible() failed
  14  |     const f = await page.getByRole("heading", { level: 1 }).evaluate((e) => { const s = getComputedStyle(e); return [s.fontFamily, s.fontSize, s.textShadow]; });
  15  |     expect(f[0]).toMatch(/Newsreader/); expect(f[1]).toBe("36px");
  16  |     expect(f[2]).toContain("rgba(0, 0, 0, 0.55)");
  17  |     await expect(tid(page, "back-to-globe")).toBeVisible();
  18  |   });
  19  |   test("layer bar: 3 options, Satellite active, reset + mute have aria-labels", async ({ page }) => {
  20  |     await expect(tid(page, "layer-satellite")).toHaveAttribute("aria-checked", "true");
  21  |     for (const id of ["layer-vigor", "layer-moisture"]) await expect(tid(page, id)).toBeVisible();
  22  |     for (const id of ["reset-view", "mute-toggle", "twin-button"]) await expect(tid(page, id)).toHaveAttribute("aria-label", /.+/);
  23  |     await tid(page, "layer-moisture").click();
  24  |     await expect(tid(page, "layer-moisture")).toHaveAttribute("aria-checked", "true");
  25  |     await expect(tid(page, "layer-satellite")).toHaveAttribute("aria-checked", "false");
  26  |   });
  27  |   test("condition pills: 4 values, right-aligned under the bar", async ({ page }) => {
  28  |     for (const [id, t] of [["rainfall", "64 mm"], ["moisture", "41%"], ["vigor", "0.48"], ["heat", "9 days"]]) await expect(tid(page, `condition-pill-${id}`)).toContainText(t);
  29  |     const bar = await box(page, "layer-vigor"), pill = await box(page, "condition-pill-heat");
  30  |     expect(pill.y).toBeGreaterThan(bar.y + bar.height);
  31  |     expect(Math.abs(pill.x + pill.width - 1440 + 48)).toBeLessThanOrEqual(40); // right gutter ~ layout.pillRow.right
  32  |   });
  33  |   test("field report starts collapsed as a 40px tab; expands to 380px with 5 exact rows; collapses back", async ({ page }) => {
  34  |     const tab = await box(page, "field-report-toggle");
  35  |     expect(Math.round(tab.width)).toBe(40);
  36  |     await expect(tid(page, "field-report-toggle")).toContainText("Field report");
  37  |     await tid(page, "field-report-toggle").click();
  38  |     const r = tid(page, "field-report"); await expect(r).toBeVisible();
  39  |     await page.waitForTimeout(400);
  40  |     expect(Math.round((await box(page, "field-report")).width)).toBe(380);
  41  |     await expect(r).toContainText("4 of 5 fields are under the 50% stress line.");
  42  |     await expect(r).toContainText("Sample data");
  43  |     const rows = [["Trial plots","36%","0.48","Stressed"],["North strips","47%","0.57","Watch"],["Variety strips","49%","0.63","Watch"],["Main block","41%","0.52","Dry"],["East field","55%","0.71","OK"]];
  44  |     for (const [i, row] of rows.entries()) {
  45  |       const tr = r.locator("tbody tr").nth(i);
  46  |       for (const c of row) await expect(tr).toContainText(c);
  47  |     }
  48  |     await expect(r.locator(".fv-diamond")).toHaveCount(2);
  49  |     await expect(r.locator(".fv-dot")).toHaveCount(3);
  50  |     await tid(page, "field-report-toggle").click();
  51  |     await expect(r).toBeHidden();
  52  |   });
  53  |   test("panel sizes unchanged at 1280x720", async ({ page }) => {
  54  |     await page.setViewportSize({ width: 1280, height: 720 });
  55  |     await tid(page, "field-report-toggle").click(); await page.waitForTimeout(400);
  56  |     expect(Math.round((await box(page, "field-report")).width)).toBe(380);
  57  |     expect(Math.round((await box(page, "twin-button")).width)).toBe(60);
  58  |   });
  59  |   test("Twin button: 60px round, logo only (no gold sparkle), centred", async ({ page }) => {
  60  |     const b = await box(page, "twin-button");
  61  |     expect([Math.round(b.width), Math.round(b.height)]).toEqual([60, 60]);
  62  |     expect(Math.abs(b.x + b.width / 2 - 720)).toBeLessThanOrEqual(1);
  63  |     expect(await tid(page, "twin-button").locator('[fill="#E2B866"]').count()).toBe(0);
  64  |   });
  65  |   test("timeline: July / 14 · Summer · week 28; slider role + aria-valuetext '14 July'; handle 16px, ink not gold (A1)", async ({ page }) => {
  66  |     await expect(tid(page, "date-label")).toContainText("July");
  67  |     await expect(tid(page, "date-label")).toContainText("14 · Summer · week 28");
  68  |     const h = tid(page, "timeline-handle");
  69  |     await expect(h).toHaveAttribute("role", "slider");
  70  |     await expect(h).toHaveAttribute("aria-valuetext", "14 July");
  71  |     const dot = await h.locator("span").first().evaluate((e) => { const s = getComputedStyle(e); return [s.width, s.backgroundColor]; });
  72  |     expect(dot[0]).toBe("16px");
  73  |     expect(dot[1]).not.toBe("rgb(226, 184, 102)");
  74  |   });
  75  |   test("timeline keyboard: ←/→ day, Shift week, PageUp/Down month, Home/End; each step ticks", async ({ page }) => {
  76  |     const h = tid(page, "timeline-handle"); await h.focus();
  77  |     const txt = () => h.getAttribute("aria-valuetext");
  78  |     await clearSoundLog(page);
  79  |     await page.keyboard.press("ArrowRight"); expect(await txt()).toBe("15 July");
  80  |     await page.keyboard.press("ArrowLeft"); expect(await txt()).toBe("14 July");
  81  |     await page.keyboard.press("Shift+ArrowRight"); expect(await txt()).toBe("21 July");
  82  |     await page.keyboard.press("Shift+ArrowLeft"); expect(await txt()).toBe("14 July");
  83  |     await page.keyboard.press("PageDown"); expect(await txt()).toMatch(/August/);
  84  |     await page.keyboard.press("PageUp"); expect(await txt()).toMatch(/July/);
  85  |     await page.keyboard.press("Home"); expect(await txt()).toBe("1 January");
  86  |     await page.keyboard.press("End"); expect(await txt()).toBe("31 December");
  87  |     expect((await names(page)).filter((n) => /^tick/.test(n)).length).toBeGreaterThanOrEqual(6);
  88  |   });
  89  |   test("timeline drag: handle follows pointer 1:1, cursor grab→grabbing, label updates, release snaps to a whole day", async ({ page }) => {
  90  |     const h = tid(page, "timeline-handle"); const b = await box(page, "timeline-handle");
  91  |     const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  92  |     await page.mouse.move(cx, cy);
  93  |     expect(await h.evaluate((e) => getComputedStyle(e).cursor)).toBe("grab");
  94  |     await page.mouse.down();
  95  |     expect(await h.evaluate((e) => getComputedStyle(e).cursor)).toBe("grabbing");
  96  |     await page.mouse.move(cx - 150, cy, { steps: 15 });
  97  |     const nb = await box(page, "timeline-handle");
  98  |     expect(Math.abs(nb.x + nb.width / 2 - (cx - 150))).toBeLessThanOrEqual(3);
  99  |     await page.mouse.move(cx - 150, cy - 250, { steps: 5 }); // leaves track: pointer capture
  100 |     await page.mouse.up(); await page.waitForTimeout(800);
  101 |     expect(Number.isInteger(Number(await h.getAttribute("aria-valuenow")))).toBe(true);
  102 |     await expect(tid(page, "date-label")).not.toContainText("14 · Summer");
  103 |   });
  104 |   test("timeline track click glides to the target with ticks", async ({ page }) => {
  105 |     const tr = await box(page, "timeline-track"); await clearSoundLog(page);
  106 |     await page.mouse.click(tr.x + tr.width * 0.15, tr.y + tr.height / 2);
  107 |     await page.waitForTimeout(600);
  108 |     await expect(tid(page, "date-label")).toContainText("February");
  109 |     expect((await soundLog(page)).length).toBeGreaterThan(1);
  110 |   });
  111 |   test("sound: button press taps (incl. inert pill/Twin), layer switch ticks, mute toggle silences", async ({ page }) => {
  112 |     await clearSoundLog(page); await tid(page, "twin-button").click();
  113 |     expect(await names(page)).toContain("tap");
```
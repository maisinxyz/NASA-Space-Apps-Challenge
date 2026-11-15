// Slice A (layout, layer bar, pills, report, timeline, Twin button, press, sound). Live tests; headless Chrome has no Cesium tiles (map black), UI is clickable.
// Needs: NEXT_PUBLIC_E2E=1 next dev -p 3000
import { test, expect, type Page } from "@playwright/test";
import { openFarm, tid, soundLog, clearSoundLog } from "./helpers";

const names = async (p: Page) => (await soundLog(p)).map((s) => s.name);
const box = async (p: Page, id: string) => (await tid(p, id).boundingBox())!;

test.describe("Slice A", () => {
  test.beforeEach(({ page }) => openFarm(page));

  test("title block: Globe link, name 36px Newsreader, subtitle text", async ({ page }) => {
    await expect(page.getByText("Zürich, Switzerland · Explore only: simulation not available for this farm yet.")).toBeVisible();
    const f = await page.getByRole("heading", { level: 1 }).evaluate((e) => { const s = getComputedStyle(e); return [s.fontFamily, s.fontSize, s.textShadow]; });
    expect(f[0]).toMatch(/Newsreader/); expect(f[1]).toBe("36px");
    expect(f[2]).toContain("rgba(0, 0, 0, 0.55)");
    await expect(tid(page, "back-to-globe")).toBeVisible();
  });
  test("layer bar: 3 options, Satellite active, reset + mute have aria-labels", async ({ page }) => {
    await expect(tid(page, "layer-satellite")).toHaveAttribute("aria-checked", "true");
    for (const id of ["layer-vigor", "layer-moisture"]) await expect(tid(page, id)).toBeVisible();
    for (const id of ["reset-view", "mute-toggle", "twin-button"]) await expect(tid(page, id)).toHaveAttribute("aria-label", /.+/);
    await tid(page, "layer-moisture").click();
    await expect(tid(page, "layer-moisture")).toHaveAttribute("aria-checked", "true");
    await expect(tid(page, "layer-satellite")).toHaveAttribute("aria-checked", "false");
  });
  test("condition pills: 4 values, right-aligned under the bar", async ({ page }) => {
    for (const [id, t] of [["rainfall", "64 mm"], ["moisture", "41%"], ["vigor", "0.48"], ["heat", "9 days"]]) await expect(tid(page, `condition-pill-${id}`)).toContainText(t);
    const bar = await box(page, "layer-vigor"), pill = await box(page, "condition-pill-heat");
    expect(pill.y).toBeGreaterThan(bar.y + bar.height);
    expect(Math.abs(pill.x + pill.width - 1440 + 48)).toBeLessThanOrEqual(40); // right gutter ~ layout.pillRow.right
  });
  test("field report starts collapsed as a 40px tab; expands to 380px with 5 exact rows; collapses back", async ({ page }) => {
    const tab = await box(page, "field-report-toggle");
    expect(Math.round(tab.width)).toBe(40);
    await expect(tid(page, "field-report-toggle")).toContainText("Field report");
    await tid(page, "field-report-toggle").click();
    const r = tid(page, "field-report"); await expect(r).toBeVisible();
    await page.waitForTimeout(400);
    expect(Math.round((await box(page, "field-report")).width)).toBe(380);
    await expect(r).toContainText("4 of 5 fields are under the 50% stress line.");
    await expect(r).toContainText("Sample data");
    const rows = [["Trial plots","36%","0.48","Stressed"],["North strips","47%","0.57","Watch"],["Variety strips","49%","0.63","Watch"],["Main block","41%","0.52","Dry"],["East field","55%","0.71","OK"]];
    for (const [i, row] of rows.entries()) {
      const tr = r.locator("tbody tr").nth(i);
      for (const c of row) await expect(tr).toContainText(c);
    }
    await expect(r.locator(".fv-diamond")).toHaveCount(2);
    await expect(r.locator(".fv-dot")).toHaveCount(3);
    await tid(page, "field-report-toggle").click();
    await expect(r).toBeHidden();
  });
  test("panel sizes unchanged at 1280x720", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await tid(page, "field-report-toggle").click(); await page.waitForTimeout(400);
    expect(Math.round((await box(page, "field-report")).width)).toBe(380);
    expect(Math.round((await box(page, "twin-button")).width)).toBe(60);
  });
  test("Twin button: 60px round, logo only (no gold sparkle), centred", async ({ page }) => {
    const b = await box(page, "twin-button");
    expect([Math.round(b.width), Math.round(b.height)]).toEqual([60, 60]);
    expect(Math.abs(b.x + b.width / 2 - 720)).toBeLessThanOrEqual(1);
    expect(await tid(page, "twin-button").locator('[fill="#E2B866"]').count()).toBe(0);
  });
  test("timeline: July / 14 · Summer · week 28; slider role + aria-valuetext '14 July'; handle 16px, ink not gold (A1)", async ({ page }) => {
    await expect(tid(page, "date-label")).toContainText("July");
    await expect(tid(page, "date-label")).toContainText("14 · Summer · week 28");
    const h = tid(page, "timeline-handle");
    await expect(h).toHaveAttribute("role", "slider");
    await expect(h).toHaveAttribute("aria-valuetext", "14 July");
    const dot = await h.locator("span").first().evaluate((e) => { const s = getComputedStyle(e); return [s.width, s.backgroundColor]; });
    expect(dot[0]).toBe("16px");
    expect(dot[1]).not.toBe("rgb(226, 184, 102)");
  });
  test("timeline keyboard: ←/→ day, Shift week, PageUp/Down month, Home/End; each step ticks", async ({ page }) => {
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
    expect((await names(page)).filter((n) => /^tick/.test(n)).length).toBeGreaterThanOrEqual(6);
  });
  test("timeline drag: handle follows pointer 1:1, cursor grab→grabbing, label updates, release snaps to a whole day", async ({ page }) => {
    const h = tid(page, "timeline-handle"); const b = await box(page, "timeline-handle");
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    await page.mouse.move(cx, cy);
    expect(await h.evaluate((e) => getComputedStyle(e).cursor)).toBe("grab");
    await page.mouse.down();
    expect(await h.evaluate((e) => getComputedStyle(e).cursor)).toBe("grabbing");
    await page.mouse.move(cx - 150, cy, { steps: 15 });
    const nb = await box(page, "timeline-handle");
    expect(Math.abs(nb.x + nb.width / 2 - (cx - 150))).toBeLessThanOrEqual(3);
    await page.mouse.move(cx - 150, cy - 250, { steps: 5 }); // leaves track: pointer capture
    await page.mouse.up(); await page.waitForTimeout(800);
    expect(Number.isInteger(Number(await h.getAttribute("aria-valuenow")))).toBe(true);
    await expect(tid(page, "date-label")).not.toContainText("14 · Summer");
  });
  test("timeline track click glides to the target with ticks", async ({ page }) => {
    const tr = await box(page, "timeline-track"); await clearSoundLog(page);
    await page.mouse.click(tr.x + tr.width * 0.15, tr.y + tr.height / 2);
    await page.waitForTimeout(600);
    await expect(tid(page, "date-label")).toContainText("February");
    expect((await soundLog(page)).length).toBeGreaterThan(1);
  });
  test("sound: button press taps (incl. inert pill/Twin), layer switch ticks, mute toggle silences", async ({ page }) => {
    await clearSoundLog(page); await tid(page, "twin-button").click();
    expect(await names(page)).toContain("tap");
    await clearSoundLog(page); await tid(page, "layer-vigor").click();
    expect(await names(page)).toContain("tickWeek");
    await tid(page, "mute-toggle").click();
    await expect(tid(page, "mute-toggle")).toHaveAttribute("aria-label", "Unmute sounds");
    await clearSoundLog(page); await tid(page, "reset-view").click();
    expect(await names(page)).toEqual([]);
    await page.reload(); await tid(page, "timeline").waitFor();
    await expect(tid(page, "mute-toggle")).toHaveAttribute("aria-label", "Unmute sounds"); // persisted
  });
  test("press: scale 0.95 while held, back on release", async ({ page }) => {
    const b = await box(page, "layer-vigor"); const el = tid(page, "layer-vigor");
    await page.mouse.move(b.x + 5, b.y + 5); await page.mouse.down(); await page.waitForTimeout(200);
    const m = (await el.evaluate((e) => getComputedStyle(e).transform)).match(/matrix\(([\d.]+)/);
    expect(Number(m![1])).toBeCloseTo(0.95, 1);
    await page.mouse.up(); await page.waitForTimeout(500);
    expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(await el.evaluate((e) => getComputedStyle(e).transform));
  });
  test("honesty line shown", async ({ page }) => {
    await expect(page.getByText("This tool supports, and does not replace, local agronomic expertise.")).toBeVisible();
  });
});

test.describe("Slice A reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("press does not scale", async ({ page }) => {
    await openFarm(page);
    const b = await box(page, "layer-vigor");
    await page.mouse.move(b.x + 5, b.y + 5); await page.mouse.down(); await page.waitForTimeout(200);
    expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(await tid(page, "layer-vigor").evaluate((e) => getComputedStyle(e).transform));
    await page.mouse.up();
  });
});

test.describe("Slice A screenshots", () => {
  for (const [w, h] of [[1440, 900], [1280, 720]]) {
    test(`minimized ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await openFarm(page);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `../../docs/farm-view/shots/sliceA-${w}-minimized.png` });
      await tid(page, "field-report-toggle").click(); await page.waitForTimeout(500);
      await page.screenshot({ path: `../../docs/farm-view/shots/sliceA-${w}-report.png` });
    });
  }
});

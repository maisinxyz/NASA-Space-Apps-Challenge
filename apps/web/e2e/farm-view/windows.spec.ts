import { expect, test, type Page } from "@playwright/test";

import { tid } from "./helpers";
import { BOTTOM_STRIP } from "../../lib/window/config";

// Window manager on the farm screen (components/window): shift-free readout, drag / resize / recoil, min / max,
// persistence. UBC Farm has every window (horizon tabs, Gus, planner).
const URL = "/#farm=ubc-farm";
const KEY = "app.windowLayout.v1";

const win = (page: Page, id: string) => page.locator(`[data-window="${id}"].fw-win`);
const bar = (page: Page, id: string) => win(page, id).locator(".fw-titlebar");
const box = async (page: Page, id: string) => (await win(page, id).boundingBox())!;

async function open(page: Page) {
  await page.goto(URL);
  await tid(page, "farm-view").waitFor({ timeout: 45_000 });
  await expect(win(page, "nav")).toBeVisible({ timeout: 15_000 });
}

async function dragBy(page: Page, from: { x: number; y: number }, dx: number, dy: number) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx / 2, from.y + dy / 2, { steps: 4 });
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(450); // recoil (320 ms) + commit
}

const inside = (b: { x: number; y: number; width: number; height: number }, vw: number, vh: number) =>
  b.x >= -0.5 && b.y >= -0.5 && b.x + b.width <= vw + 0.5 && b.y + b.height <= vh + 0.5;

test.describe("farm windows", () => {
  const errors: string[] = [];
  test.beforeEach(async ({ page }) => {
    errors.length = 0;
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.addInitScript((k) => { if (!sessionStorage.getItem("kept")) { localStorage.removeItem(k); sessionStorage.setItem("kept", "1"); } }, KEY);
    await open(page);
  });

  test("time readout and its neighbours do not move while scrubbing", async ({ page }) => {
    await tid(page, "mode-future").click();
    await tid(page, "tab-years").click();
    const ids = ["future-play", "future-date", "zoom-10y", "zoom-1y", "timeline-no-data"];
    const rects = () => page.evaluate((ids) => ids.map((id) => {
      const r = document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
      return [r.x, r.y, r.width, r.height].join(",");
    }).concat((() => { const r = document.querySelector(".ff-tl-metabox")!.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].join(","); })()), ids);
    for (const zoom of ["10y", "1y"]) {
      await tid(page, `zoom-${zoom}`).click();
      await tid(page, "future-handle").focus();
      await page.keyboard.press("Home");
      const base = await rects();
      const steps = zoom === "10y" ? 120 : 60; // every month of 10 years; every week-ish of a year
      for (let i = 0; i < steps; i++) {
        await page.keyboard.press(zoom === "10y" ? "ArrowRight" : "PageUp");
        if (zoom === "1y") await page.keyboard.press("ArrowRight");
        expect(await rects(), `${zoom} step ${i}`).toEqual(base);
      }
    }
  });

  test("drag, rubber-band recoil, resize limits, min / max / restore, front", async ({ page }) => {
    const vw = 1440, vh = 900;
    const start = await box(page, "nav");
    const t = await bar(page, "nav").boundingBox();
    await dragBy(page, { x: t!.x + 60, y: t!.y + 17 }, 120, 40);
    const moved = await box(page, "nav");
    expect(moved.x + moved.width).toBeLessThanOrEqual(280);
    expect(Math.round(moved.y - start.y)).toBe(Math.round(Math.min(40, vh - BOTTOM_STRIP - start.y - start.height)));
    expect(moved.y + moved.height).toBeLessThanOrEqual(vh - BOTTOM_STRIP + 0.5);

    // Far past the right and bottom edges: settles fully on screen.
    const t2 = await bar(page, "nav").boundingBox();
    await dragBy(page, { x: t2!.x + 60, y: t2!.y + 17 }, 3000, 3000);
    expect(inside(await box(page, "nav"), vw, vh)).toBe(true);

    // Resize from the south-east corner: tiny clamps to min, huge clamps inside the screen.
    const se = await win(page, "nav").locator(".fw-h-se").boundingBox();
    await dragBy(page, { x: se!.x + 7, y: se!.y + 7 }, -2000, -2000);
    let b = await box(page, "nav");
    expect(Math.round(b.width)).toBe(220);
    expect(Math.round(b.height)).toBe(260);
    for (const h of ["n", "s", "e", "w", "ne", "nw", "sw", "se"]) await expect(win(page, "nav").locator(`.fw-h-${h}`)).toHaveCount(1);

    // Minimise to a dock chip, restore to the same rect.
    const before = await box(page, "nav");
    await tid(page, "window-min-nav").click();
    await expect(win(page, "nav")).toBeHidden();
    await page.locator("#fw-chip-nav").click();
    b = await box(page, "nav");
    expect([b.x, b.y, b.width, b.height].map(Math.round)).toEqual([before.x, before.y, before.width, before.height].map(Math.round));

    // Maximise fills the dashboard column; double-click the title bar restores.
    await tid(page, "window-max-nav").click();
    await page.waitForTimeout(300);
    b = await box(page, "nav");
    expect(b.width).toBeLessThanOrEqual(280);
    await bar(page, "nav").dblclick({ position: { x: 60, y: 17 } });
    await page.waitForTimeout(300);
    b = await box(page, "nav");
    expect(Math.round(b.width)).toBe(Math.round(before.width));

    // Opening a drawer raises it; clicking nav brings nav back to front.
    await tid(page, "rail-conditions").click();
    await expect(win(page, "inspector")).toBeVisible();
    const z = (id: string) => win(page, id).evaluate((el) => Number(getComputedStyle(el).zIndex));
    expect(await z("inspector")).toBeGreaterThan(await z("nav"));
    await bar(page, "nav").focus(); // focus (or a click) raises; the inspector may cover nav's title bar here
    expect(await z("nav")).toBeGreaterThan(await z("inspector"));
    expect(errors).toEqual([]);
  });

  test("keyboard: arrows move, shift+arrows resize, Enter maximises", async ({ page }) => {
    const a = await box(page, "nav");
    await bar(page, "nav").focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Shift+ArrowDown");
    const b = await box(page, "nav");
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.x + b.width).toBeLessThanOrEqual(280);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    expect((await box(page, "nav")).width).toBeLessThanOrEqual(280);
  });

  test("layout persists across reload; cleared storage gives defaults; shrinking never strands a window", async ({ page }) => {
    test.setTimeout(180_000); // three full loads of the globe dive
    const def = await box(page, "nav");
    const t = await bar(page, "nav").boundingBox();
    await dragBy(page, { x: t!.x + 60, y: t!.y + 17 }, 200, 30);
    const moved = await box(page, "nav");
    await page.reload();
    await tid(page, "farm-view").waitFor({ timeout: 45_000 });
    await expect(win(page, "nav")).toBeVisible({ timeout: 15_000 });
    const after = await box(page, "nav");
    expect([after.x, after.y].map(Math.round)).toEqual([moved.x, moved.y].map(Math.round));

    // Corrupt the saved layout at document start (the beforeunload save would overwrite an earlier write).
    await page.evaluate(() => sessionStorage.setItem("corrupt", "1"));
    await page.addInitScript((k) => { if (sessionStorage.getItem("corrupt")) { localStorage.setItem(k, "{corrupt"); sessionStorage.removeItem("corrupt"); } }, KEY);
    await page.reload();
    await tid(page, "farm-view").waitFor({ timeout: 45_000 });
    await expect(win(page, "nav")).toBeVisible({ timeout: 15_000 });
    const fresh = await box(page, "nav");
    expect([fresh.x, fresh.y].map(Math.round)).toEqual([def.x, def.y].map(Math.round));

    await page.setViewportSize({ width: 1024, height: 600 });
    await page.waitForTimeout(300);
    for (const id of ["nav"]) expect(inside(await box(page, id), 1024, 600 - BOTTOM_STRIP)).toBe(true);
    expect(errors).toEqual([]);
  });
});

test("ordinary entry shows only the dashboard; Ask opens Gus without covering it", async ({ page }) => {
  await page.addInitScript((key) => localStorage.removeItem(key), KEY);
  await open(page);
  await expect(win(page, "nav")).toBeVisible();
  for (const id of ["time", "simulation", "inspector", "future", "planner", "copilot"]) await expect(win(page, id)).toBeHidden();
  await page.getByRole("button", { name: "Ask Gus", exact: true }).click();
  await expect(win(page, "copilot")).toBeVisible();
  await expect(win(page, "copilot")).toHaveCSS("background-color", "rgb(25, 23, 19)");
  await expect(tid(page, "copilot-panel")).toHaveCSS("background-image", "none");
  const nav = await box(page, "nav");
  await bar(page, "copilot").focus();
  for (let i = 0; i < 120; i++) await page.keyboard.press("ArrowLeft");
  expect((await box(page, "copilot")).x).toBeGreaterThanOrEqual(nav.x + nav.width);
  await tid(page, "window-max-copilot").click();
  await page.waitForTimeout(300);
  expect((await box(page, "copilot")).x).toBeGreaterThanOrEqual(nav.x + nav.width);
  await page.reload();
  await expect(win(page, "nav")).toBeVisible({ timeout: 45_000 });
  await expect(win(page, "copilot")).toBeHidden();
});

test("reentering a farm restores its dashboard after it was closed", async ({ page }) => {
  await page.addInitScript((key) => { if (!sessionStorage.getItem("started")) { localStorage.removeItem(key); sessionStorage.setItem("started", "1"); } }, KEY);
  await open(page);
  await tid(page, "window-close-nav").click();
  await expect(win(page, "nav")).toBeHidden();
  await page.waitForTimeout(250);
  await page.reload();
  await expect(win(page, "nav")).toBeVisible({ timeout: 45_000 });
  await expect(win(page, "copilot")).toBeHidden();
});

test("selecting and revisiting UBC from Farms starts with only its dashboard", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript((key) => localStorage.removeItem(key), KEY);
  await page.goto("/");
  const enter = async () => {
    await page.getByRole("button", { name: "Farms", exact: true }).click();
    await page.getByRole("dialog", { name: "Farms" }).getByRole("button", { name: /UBC Farm, University of British Columbia/ }).click();
    await expect(win(page, "nav")).toBeVisible({ timeout: 45_000 });
    for (const id of ["time", "simulation", "inspector", "future", "planner", "copilot"]) await expect(win(page, id)).toBeHidden();
  };
  await enter();
  await tid(page, "mode-future").click();
  await expect(win(page, "time")).toBeVisible();
  await page.getByRole("button", { name: "Back to the globe" }).click();
  await enter();
});

test("a legacy overlapping Gus layout is recovered on reload", async ({ page }) => {
  await open(page);
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), KEY)).not.toBeNull();
  await page.evaluate((key) => {
    const layout = JSON.parse(localStorage.getItem(key)!);
    layout.wins.copilot.r = [0, 0.1, 0.3, 0.5];
    sessionStorage.setItem("legacyLayout", JSON.stringify(layout));
  }, KEY);
  await page.addInitScript((key) => { const legacy = sessionStorage.getItem("legacyLayout"); if (legacy) { localStorage.setItem(key, legacy); sessionStorage.removeItem("legacyLayout"); } }, KEY);
  await page.reload();
  await expect(win(page, "nav")).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: "Ask Gus", exact: true }).click();
  const nav = await box(page, "nav");
  expect((await box(page, "copilot")).x).toBeGreaterThanOrEqual(nav.x + nav.width);
});

test("Escape recoil never moves Gus over the dashboard", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await open(page);
  await page.getByRole("button", { name: "Ask Gus", exact: true }).click();
  await bar(page, "copilot").focus();
  for (let i = 0; i < 120; i++) await page.keyboard.press("ArrowLeft");
  const start = await box(page, "copilot");
  const title = (await bar(page, "copilot").boundingBox())!;
  await page.mouse.move(title.x + 60, title.y + 17);
  await page.mouse.down();
  await page.mouse.move(title.x + 260, title.y + 17, { steps: 5 });
  await expect.poll(async () => (await box(page, "copilot")).x).toBeGreaterThan(start.x + 100);
  await page.evaluate(() => {
    const el = document.querySelector('[data-window="copilot"].fw-win')!;
    const samples: number[] = [];
    (window as unknown as { recoilSamples: number[] }).recoilSamples = samples;
    new MutationObserver(() => samples.push(el.getBoundingClientRect().x)).observe(el, { attributes: true, attributeFilter: ["style"] });
  });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.waitForTimeout(600);
  const samples = await page.evaluate(() => (window as unknown as { recoilSamples: number[] }).recoilSamples);
  expect(samples.length).toBeGreaterThan(0);
  expect(Math.min(...samples)).toBeGreaterThanOrEqual(start.x - 0.5);
});

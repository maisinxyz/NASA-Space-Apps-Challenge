import { expect, test, type Page } from "@playwright/test";

const win = (page: Page, id: string) => page.locator(`.fw-win[data-window="${id}"]`);
const bar = (page: Page, id: string) => win(page, id).locator(".fw-titlebar");
const contentIds = ["simulation", "inspector", "planner", "copilot", "future"];

async function openFarm(page: Page, width: number, height: number, hash = "#farm=ubc-farm") {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.clear());
  await page.goto(`/${hash}`);
  await expect(page.getByTestId("farm-view")).toBeVisible({ timeout: 45_000 });
  await expect(win(page, "nav")).toBeVisible();
}

async function frame(page: Page, id: string) {
  const rect = await win(page, id).boundingBox();
  expect(rect).not.toBeNull();
  return rect!;
}

async function withinWorkArea(page: Page, id: string, width: number, height: number) {
  const r = await frame(page, id);
  expect(r.x).toBeGreaterThanOrEqual(-1);
  expect(r.y).toBeGreaterThanOrEqual(47);
  expect(r.x + r.width).toBeLessThanOrEqual(width + 1);
  expect(r.y + r.height).toBeLessThanOrEqual(height - 39);
}

async function move(page: Page, x: number, y: number, dx: number, dy: number) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 8 });
  await page.mouse.up();
}

async function onlyContent(page: Page, expected: string) {
  for (const id of contentIds) {
    if (id === expected) await expect(win(page, id)).toBeVisible();
    else await expect(win(page, id)).toBeHidden();
  }
}

for (const { width, height } of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 1024, height: 600 }]) {
  test(`simulation is independent, draggable and bounded at ${width}x${height}`, async ({ page }) => {
    await openFarm(page, width, height);
    await page.getByTestId("sim-tab").click();
    await onlyContent(page, "simulation");
    await expect(page.getByTestId("sim-panel")).toBeVisible();
    await withinWorkArea(page, "simulation", width, height);
    const before = await frame(page, "simulation");
    const title = (await bar(page, "simulation").boundingBox())!;
    await move(page, title.x + 60, title.y + 17, 80, 40);
    const moved = await frame(page, "simulation");
    expect(moved.x).toBeGreaterThan(before.x + 30);
    expect(moved.y).toBeGreaterThanOrEqual(before.y);
    const corner = (await win(page, "simulation").locator(".fw-h-se").boundingBox())!;
    await move(page, corner.x + corner.width / 2, corner.y + corner.height / 2, -60, -60);
    const resized = await frame(page, "simulation");
    expect(resized.width).toBeLessThan(moved.width - 30);
    expect(resized.height).toBeLessThan(moved.height - 30);
    const title2 = (await bar(page, "simulation").boundingBox())!;
    await move(page, title2.x + 60, title2.y + 17, 3000, 3000);
    await withinWorkArea(page, "simulation", width, height);
    await page.getByTestId("window-max-simulation").click();
    await withinWorkArea(page, "simulation", width, height);
    await expect(page.getByTestId("window-close-simulation")).toBeVisible();
  });
}

test("simulation sections, keyboard shortcuts and shared state remain usable", async ({ page }) => {
  await openFarm(page, 1280, 720);
  await page.keyboard.press("2");
  await onlyContent(page, "simulation");
  for (const name of ["Compare", "Evidence", "Map", "Scenarios"]) {
    await page.getByRole("tab", { name, exact: true }).click();
    await expect(page.getByRole("tab", { name, exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toBeVisible();
  }
  await page.keyboard.press("3");
  await expect(page.getByRole("tab", { name: "Compare", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByTestId("sim-share").click();
  const shared = page.url();
  expect(shared).toContain("po=1");
  await page.goto(shared);
  await expect(win(page, "simulation")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("tab", { name: "Compare", exact: true })).toHaveAttribute("aria-selected", "true");
});

test("content tools replace one another and inspector reopens after minimising", async ({ page }) => {
  await openFarm(page, 1440, 900);
  await page.getByTestId("sim-tab").click();
  await onlyContent(page, "simulation");
  await page.getByTestId("rail-conditions").click();
  await onlyContent(page, "inspector");
  await page.getByTestId("window-min-inspector").click();
  await page.getByTestId("field-report-toggle").click();
  await onlyContent(page, "inspector");
  await expect(page.getByTestId("field-report")).toBeVisible();
  await page.locator('[data-testid^="field-report-row-"] button').first().click();
  await onlyContent(page, "simulation");
  await expect(page.getByRole("tab", { name: "Field", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByTestId("action-plan-rotations").click();
  await onlyContent(page, "planner");
  await page.getByTestId("copilot-open").click();
  await onlyContent(page, "copilot");
  await page.keyboard.press("2");
  await onlyContent(page, "simulation");
});

test("compact timeline keeps its labels inside the frame", async ({ page }) => {
  await openFarm(page, 1280, 720);
  await page.getByTestId("mode-future").click();
  await page.getByTestId("tab-years").click();
  await expect(win(page, "time")).toBeVisible();
  const corner = (await win(page, "time").locator(".fw-h-se").boundingBox())!;
  await move(page, corner.x + corner.width / 2, corner.y + corner.height / 2, -2000, -2000);
  const bounds = await frame(page, "time");
  const labels = win(page, "time").locator(".ff-tl-lab:visible");
  expect(await labels.count()).toBeGreaterThan(0);
  for (const label of await labels.all()) {
    const r = (await label.boundingBox())!;
    expect(r.y + r.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
  }
  for (const id of ["future-date", "timeline-no-data", "future-handle"]) {
    const r = await page.getByTestId(id).boundingBox();
    expect(r, id).not.toBeNull();
    expect(r!.x, id).toBeGreaterThanOrEqual(bounds.x - 1);
    expect(r!.y, id).toBeGreaterThanOrEqual(bounds.y - 1);
    expect(r!.x + r!.width, id).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
    expect(r!.y + r!.height, id).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
  }
});


test("launchers restore their minimised content windows", async ({ page }) => {
  await openFarm(page, 1440, 900);
  for (const [launcher, id] of [
    ["sim-tab", "simulation"],
    ["action-plan-rotations", "planner"],
    ["copilot-open", "copilot"],
  ]) {
    await page.getByTestId(launcher).click();
    await onlyContent(page, id);
    await page.getByTestId(`window-min-${id}`).click();
    await expect(win(page, id)).toBeHidden();
    await page.getByTestId(launcher).click();
    await onlyContent(page, id);
  }
});

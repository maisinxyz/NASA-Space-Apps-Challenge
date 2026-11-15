import { mkdir } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";
import { openFarm, tid } from "./helpers";

const cornell = "/#farm=cornell-ruminant";

async function openCompare(page: Page) {
  await page.goto(`${cornell}&m=compare&po=1&ps=compare`);
  await expect(tid(page, "farm-view")).toBeVisible({ timeout: 30_000 });
}

test.describe("Farm view controls", () => {
  test.beforeEach(async ({ page }) => {
    await openFarm(page);
  });

  test("shows the selected farm and returns to the globe", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Cornell University Ruminant Center", exact: true })).toBeVisible();
    await expect(page.getByText(/Harford, New York.*Simulation available/)).toBeVisible();
    await tid(page, "back-to-globe").click();
    await expect(tid(page, "farm-view")).toBeHidden();
    await expect(page.getByRole("heading", { name: "fieldtwin/2026" })).toBeVisible();
  });

  test("reports missing observations and disables unavailable map layers", async ({ page }) => {
    await expect(tid(page, "layer-satellite")).toHaveAttribute("aria-checked", "true");
    for (const id of ["vigor", "moisture"]) {
      await expect(tid(page, `layer-${id}`)).toBeDisabled();
      await expect(tid(page, `layer-${id}`)).toHaveAttribute("aria-checked", "false");
    }
    await expect(page.getByText("Analytical layers unavailable: no observations connected.")).toBeVisible();
    await page.getByText("Farm observations: Not available", { exact: true }).click();
    for (const id of ["rainfall", "moisture", "vigor", "heat"]) {
      await expect(tid(page, `condition-value-${id}`)).toHaveText("Not available");
    }
  });

  test("condition cards and legends show No data", async ({ page }) => {
    await expect(page.getByText(/synthetic/i)).toHaveCount(0);
    for (const id of ["rainfall", "moisture", "vigor", "heat"]) {
      await expect(tid(page, `condition-pill-${id}`)).toBeVisible();
    }
    await tid(page, "condition-pill-moisture").click();
    await expect(tid(page, "condition-pill-moisture")).toHaveAttribute("aria-expanded", "true");
    await expect(tid(page, "card-moisture")).toContainText("No data");
    await expect(tid(page, "layer-legend")).toContainText("No data");
    await tid(page, "condition-pill-rainfall").click();
    await expect(tid(page, "card-rainfall")).toBeVisible();
    await expect(tid(page, "card-moisture")).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(tid(page, "card-rainfall")).toBeHidden();
  });

  test("field report shows Cornell's fields without invented measurements and supports keyboard selection", async ({ page }) => {
    await tid(page, "field-report-toggle").click();
    const report = tid(page, "field-report");
    await expect(report).toBeVisible();
    await expect(report).toContainText("No field measurements for this farm yet.");
    for (const name of ["North hay field", "Barn field", "South field"]) {
      await expect(report.getByRole("button", { name, exact: true })).toBeVisible();
    }
    await expect(report.locator("tbody tr")).toHaveCount(3);
    await expect(report.locator("tbody tr").first()).toContainText("Not available");
    await expect(report).not.toContainText("36%");
    await report.getByRole("button", { name: "North hay field" }).press("Enter");
    await expect(page.getByRole("tab", { name: "Field", exact: true })).toHaveAttribute("aria-selected", "true");
    await tid(page, "reset-view").click();
    await expect(page.getByRole("tab", { name: "Field", exact: true })).toHaveAttribute("aria-selected", "true");
  });

  test("mute setting persists across reload", async ({ page }) => {
    const toggle = tid(page, "mute-toggle");
    await expect(toggle).toHaveText("Mute sounds");
    await toggle.click();
    await expect(toggle).toHaveText("Unmute sounds");
    expect(await page.evaluate(() => localStorage.getItem("fieldtwin:sound-muted"))).toBe("1");
    await page.reload();
    await expect(tid(page, "farm-view")).toBeVisible({ timeout: 30_000 });
    await expect(toggle).toHaveText("Unmute sounds");
    await toggle.click();
    expect(await page.evaluate(() => localStorage.getItem("fieldtwin:sound-muted"))).toBe("0");
  });

  test("keyboard camera controls work without blocking the farm controls", async ({ page }) => {
    await page.getByText("Camera controls", { exact: true }).click();
    const controls = page.getByRole("group", { name: "Camera controls" });
    await controls.focus();
    await controls.press("ArrowRight");
    await controls.press("Shift+ArrowLeft");
    await controls.press("+");
    await expect(tid(page, "reset-view")).toBeEnabled();
    await tid(page, "reset-view").click();
    await expect(page.getByRole("heading", { name: "Cornell University Ruminant Center", exact: true })).toBeVisible();
  });
});

test("comparison calendar controls the same month as the comparison tray", async ({ page }) => {
  await openCompare(page);
  const month = page.getByRole("slider", { name: "Comparison crop month" });
  await expect(month).toBeVisible();
  await month.fill("0");
  await expect(page.getByText(/Crop calendar · Year \d+ · January/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Show Jan on the fields", exact: true }).first()).toHaveAttribute("aria-pressed", "true");
  await month.fill("6");
  await expect(page.getByText(/Crop calendar · Year \d+ · July/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Show Jul on the fields", exact: true }).first()).toHaveAttribute("aria-pressed", "true");
});

test("comparison calendar is absent outside compare mode", async ({ page }) => {
  await openFarm(page);
  await expect(page.getByRole("slider", { name: "Comparison crop month" })).toHaveCount(0);
  await expect(tid(page, "timeline")).toHaveCount(0);
});

for (const reduced of [false, true]) {
  test(`button press feedback respects reduced motion: ${reduced}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
    await openFarm(page);
    const button = tid(page, "condition-pill-rainfall");
    const b = (await button.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(200);
    const scale = await button.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).a);
    if (reduced) expect(scale).toBeCloseTo(1, 2);
    else expect(scale).toBeCloseTo(0.95, 1);
    await page.mouse.up();
    await expect(tid(page, "card-rainfall")).toBeVisible();
  });
}

for (const [width, height] of [[1440, 900], [1280, 720]]) {
  test(`farm controls fit at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openFarm(page);
    const title = (await page.locator(".fv-title-block").boundingBox())!;
    const toolbar = (await page.locator(".fv-toolbar").boundingBox())!;
    expect(title.x + title.width).toBeLessThanOrEqual(toolbar.x);
    expect(toolbar.x + toolbar.width).toBeLessThanOrEqual(width);
    await mkdir("/tmp/fieldtwin-merge-shots", { recursive: true });
    await page.screenshot({ path: `/tmp/fieldtwin-merge-shots/farm-${width}x${height}.png` });
  });
}

for (const compare of [false, true]) {
test(`expanded preview stays above bottom tools in compare mode: ${compare}`, async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  if (compare) {
    await page.goto(`${cornell}&m=compare&po=0&ps=compare`);
    await expect(tid(page, "farm-view")).toBeVisible({ timeout: 30_000 });
  } else await openFarm(page);
  await tid(page, "condition-pill-moisture").click();
  await expect(tid(page, "layer-legend")).toBeVisible();
  const toolbar = page.locator(".fv-toolbar");
  const tools = page.locator(".fv-bottom-tools");
  const toolbarBox = (await toolbar.boundingBox())!;
  const toolsBox = (await tools.boundingBox())!;
  expect(toolbarBox.y + toolbarBox.height).toBeLessThanOrEqual(toolsBox.y);
  await page.getByText("Vulnerability zones", { exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByText("Vulnerability zones", { exact: true })).toBeVisible();
  await mkdir("/tmp/fieldtwin-merge-shots", { recursive: true });
  await page.screenshot({ path: `/tmp/fieldtwin-merge-shots/farm-expanded-1280x720-${compare}.png` });
});
}


test("hidden farm controls and panels restore their open state", async ({ page }) => {
  await openFarm(page);
  await tid(page, "condition-pill-rainfall").click();
  await expect(tid(page, "card-rainfall")).toBeVisible();
  await page.getByRole("button", { name: "Hide farm controls", exact: true }).click();
  await expect(tid(page, "card-rainfall")).toBeHidden();
  await page.getByRole("button", { name: "Show farm controls", exact: true }).click();
  await expect(tid(page, "card-rainfall")).toBeVisible();
  await page.getByRole("button", { name: "Hide panels", exact: true }).click();
  await expect(page.getByRole("button", { name: "Show panels", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Show panels", exact: true }).click();
  await expect(tid(page, "card-rainfall")).toBeVisible();
});

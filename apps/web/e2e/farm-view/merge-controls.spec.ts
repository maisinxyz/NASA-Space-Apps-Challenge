import { test, expect, type Page } from "@playwright/test";

const cornell = "cornell-ruminant";

async function openGlobe(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.getByTestId("copilot-input")).toBeVisible({ timeout: 30_000 });
}

async function openFarm(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/#farm=${cornell}`);
  await expect(page.getByTestId("farm-view")).toBeVisible({ timeout: 30_000 });
}

async function openMobileFarm(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/#farm=${cornell}&m=simulate`);
  await expect(page.getByTestId("non3d-workspace")).toBeVisible({ timeout: 30_000 });
}

test.describe("merged globe and farm controls", () => {
  test("assistant search opens both demo farms without a separate confirmation step", async ({ page }) => {
    await openGlobe(page);
    const input = page.getByTestId("copilot-input");
    await page.keyboard.press("Control+k");
    await expect(input).toBeFocused();
    await input.fill("UBC");
    await expect(page.getByRole("option", { name: /UBC Farm/ })).toBeVisible();
    await input.press("Escape");
    await expect(input).toBeFocused();
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await input.fill("UBC Farm");
    await input.press("Enter");
    await expect(page.getByTestId("farm-view").getByRole("heading", { name: /UBC Farm/ }).first()).toBeVisible();
    await input.fill("KPU");
    await input.press("Enter");
    await expect(page.getByTestId("farm-view").getByRole("heading", { name: /KPU/ }).first()).toBeVisible();
  });

  test("the globe menu groups controls and the assistant has no share button", async ({ page }) => {
    await openGlobe(page);
    const menu = page.getByLabel("Globe menu");
    await expect(page.getByRole("button", { name: "Share this view" })).toHaveCount(0);
    const farms = page.getByRole("button", { name: "Farms", exact: true });
    await expect(farms).toBeHidden();
    await menu.click();
    await expect(farms).toBeVisible();
  });

  test("short unnamed questions ask which demo farm to use", async ({ page }) => {
    await openGlobe(page);
    const input = page.getByTestId("copilot-input");
    await input.fill("Can I use less water?");
    await input.press("Enter");
    await expect(page.getByText(/Which farm should I use/)).toBeVisible();
    await expect(page.getByRole("button", { name: "UBC Farm", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "KPU Langley", exact: true })).toBeVisible();
  });

  test("condition preview cards are mutually exclusive and can be closed", async ({ page }) => {
    await openFarm(page);
    await expect(page.getByText(/synthetic/i)).toHaveCount(0);

    await page.getByTestId("condition-pill-rainfall").click();
    const rainfall = page.getByTestId("card-rainfall");
    await expect(rainfall).toBeVisible();
    await expect(rainfall).toContainText("No data");

    await page.getByTestId("condition-pill-moisture").click();
    await expect(page.getByTestId("card-moisture")).toBeVisible();
    await expect(rainfall).toBeHidden();
    await page.getByRole("button", { name: "Minimize Soil moisture" }).click();
    await expect(page.getByTestId("card-moisture")).toBeHidden();
  });

  test("field report collapses and reopens from its persistent control", async ({ page }) => {
    await openFarm(page);
    await page.getByLabel("Farm menu").click();
    const toggle = page.getByRole("button", { name: "Expand field report" });
    await toggle.click();
    await expect(page.getByTestId("field-report")).toBeVisible();
    await page.getByTestId("drawer-close").click();
    await expect(page.getByTestId("field-report")).toBeHidden();
    await page.getByLabel("Farm menu").click();
    await expect(toggle).toBeVisible();
  });

  test("mobile Hide panels and Show panels preserve the scenario input and section", async ({ page }) => {
    await openMobileFarm(page);
    await page.getByRole("button", { name: /^Storm Replay/ }).click();
    await expect(page.getByRole("heading", { name: "Readouts", exact: true })).toBeVisible();
    const rain = page.getByRole("spinbutton", { name: "Peak rain rate value" });
    await rain.fill("55");
    await rain.press("Enter");
    await expect(page.getByRole("slider", { name: "Peak rain rate", exact: true })).toHaveValue("55");

    const compare = page.getByRole("tab", { name: "Compare", exact: true });
    await compare.click();
    await expect(compare).toHaveAttribute("aria-selected", "true");
    await page.getByRole("button", { name: "Hide panels", exact: true }).click();
    await expect(page.getByRole("button", { name: "Show panels", exact: true })).toBeVisible();
    await expect(page.getByTestId("sim-panel")).toBeHidden();
    await page.getByRole("button", { name: "Show panels", exact: true }).click();
    await expect(page.getByTestId("sim-panel")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Compare", exact: true })).toHaveAttribute("aria-selected", "true");

    await page.getByRole("tab", { name: "Scenarios", exact: true }).click();
    await expect(page.getByRole("spinbutton", { name: "Peak rain rate value" })).toHaveValue("55");
  });

  test("sound toggle switches its accessible action label", async ({ page }) => {
    await openFarm(page);
    await page.getByLabel("Farm menu").click();
    await page.getByTestId("rail-more").click();
    const mute = page.getByTestId("mute-toggle");
    const initial = (await mute.textContent())?.trim();
    expect(["Mute sounds", "Unmute sounds"]).toContain(initial);
    await mute.click();
    await expect(mute).toHaveText(initial === "Mute sounds" ? "Unmute sounds" : "Mute sounds");
  });
});

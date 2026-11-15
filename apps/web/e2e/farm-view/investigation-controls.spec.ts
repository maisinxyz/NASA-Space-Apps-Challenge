import { expect, test, type Page } from "@playwright/test";

async function openSection(page: Page, section: "map" | "compare" | "evidence" | "scenarios", extra = "") {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/#farm=cornell-ruminant&m=${section === "map" ? "simulate" : section === "scenarios" ? "simulate" : section}&po=1&ps=${section}${extra}`);
  await expect(page.getByTestId("farm-view")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("tab", { name: section === "scenarios" ? "Scenarios" : section[0].toUpperCase() + section.slice(1), exact: true })).toHaveAttribute("aria-selected", "true");
}

test("map surface, height, detail and look controls retain their selections", async ({ page }) => {
  await openSection(page, "map");
  const panel = page.getByRole("tabpanel");
  for (const name of ["Terrain only", "Photoreal 3D"]) {
    const radio = panel.getByRole("radio", { name, exact: true });
    await panel.getByText(name, { exact: true }).click();
    await expect(radio).toBeChecked();
  }
  const height = panel.getByRole("slider", { name: "Height exaggeration" });
  await height.fill("2");
  await expect(height).toHaveValue("2");
  for (const name of ["Low", "Medium", "High"]) {
    const radio = panel.getByRole("radio", { name, exact: true });
    await panel.getByText(name, { exact: true }).click();
    await expect(radio).toBeChecked();
  }
  const look = panel.getByRole("combobox", { name: "Look" });
  await expect(panel.getByText("Map styling only.")).toBeVisible();
  for (const value of ["none", "thermal", "vegetation", "night"]) {
    await look.selectOption(value);
    await expect(look).toHaveValue(value);
  }
  await page.getByRole("button", { name: "Copy share link" }).click();
  const hash = new URL(page.url()).hash;
  const state = new URLSearchParams(hash.slice(1));
  expect(state.get("s")).toBe("google");
  expect(state.get("l")).toBe("night");
  expect(state.get("dt")).toBe("high");
  await page.goto(page.url());
  await expect(page.getByRole("combobox", { name: "Look" })).toHaveValue("night");
  await expect(page.getByRole("radio", { name: "High", exact: true })).toBeChecked();
});

test("vulnerability zones expose their derived-data legend only when enabled", async ({ page }) => {
  await openSection(page, "map");
  const toggle = page.getByRole("checkbox", { name: "Vulnerability zones" });
  await expect(toggle).not.toBeChecked();
  await expect(page.getByText("derived from terrain and soil data, not field-measured")).toBeVisible();
  await toggle.check();
  await expect(toggle).toBeChecked();
  await expect(page.getByText("higher terrain factor (relative)")).toBeVisible();
  await toggle.uncheck();
  await expect(page.getByText("higher terrain factor (relative)")).toBeHidden();
});

test("comparison rotations swap and the split position responds to keyboard", async ({ page }) => {
  await openSection(page, "compare");
  const a = page.getByRole("combobox", { name: "Rotation A, left of the split" });
  const b = page.getByRole("combobox", { name: "Rotation B, right of the split" });
  const initialA = await a.inputValue();
  const initialB = await b.inputValue();
  expect(initialA).not.toBe(initialB);
  await a.selectOption(initialB);
  await expect(a).toHaveValue(initialB);
  await expect(b).toHaveValue(initialA);
  await page.getByRole("button", { name: "Swap A and B" }).click();
  await expect(a).toHaveValue(initialA);
  await expect(b).toHaveValue(initialB);
  const split = page.getByRole("slider", { name: "A/B split position" });
  await split.focus();
  await split.press("Home");
  await expect(split).toHaveAttribute("aria-valuenow", "0");
  await split.press("ArrowRight");
  await expect(split).toHaveAttribute("aria-valuenow", "5");
  await split.press("End");
  await expect(split).toHaveAttribute("aria-valuenow", "100");
  await page.getByRole("button", { name: "50 / 50", exact: true }).click();
  await expect(split).toHaveAttribute("aria-valuenow", "50");
});

test("evidence details expose benefits and gaps for the selected option", async ({ page }) => {
  await openSection(page, "evidence");
  const panel = page.getByRole("tabpanel");
  const selected = panel.locator("section").filter({ has: page.getByRole("heading", { name: /^Selected option/ }) }).first();
  await expect(selected).toBeVisible();
  await expect(selected.getByText("Main tradeoff:")).toBeVisible();
  await selected.getByText("Evidence, benefits and information gaps", { exact: true }).click();
  for (const name of ["Evidence", "Benefits", "Information gaps", "Risks to review locally"]) {
    await expect(selected.getByRole("heading", { name, exact: true })).toBeVisible();
  }
});

test("scenario input clamps bounds and clock responds to keyboard steps", async ({ page }) => {
  await openSection(page, "scenarios", "&sc=storm");
  const number = page.getByRole("spinbutton", { name: "Peak rain rate value" });
  const slider = page.getByRole("slider", { name: "Peak rain rate", exact: true });
  await number.fill("999");
  await number.press("Enter");
  await expect(number).toHaveValue("100");
  await expect(slider).toHaveValue("100");
  await number.fill("-10");
  await number.press("Enter");
  await expect(number).toHaveValue("5");
  await expect(slider).toHaveValue("5");
  const clock = page.getByRole("group", { name: "Scenario clock: Storm" });
  const time = clock.getByRole("slider", { name: "Scenario time" });
  await time.fill("1");
  await clock.focus();
  await clock.press("ArrowRight");
  await expect(time).toHaveValue("2");
  await clock.press("ArrowLeft");
  await expect(time).toHaveValue("1");
});

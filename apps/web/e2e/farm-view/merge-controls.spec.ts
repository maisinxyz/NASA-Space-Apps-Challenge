import { test, expect, type Page } from "@playwright/test";

const cornell = "cornell-ruminant";

async function openGlobe(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Find a place" })).toBeVisible({ timeout: 30_000 });
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
  test("search shortcut opens focused search, finds a farm, and Escape restores focus", async ({ page }) => {
    await openGlobe(page);

    await page.keyboard.press("Control+k");
    const search = page.getByRole("combobox", { name: "Find a farm, city or country" });
    await expect(search).toBeFocused();
    await search.fill("cornell");
    await expect(page.getByRole("listbox").getByRole("option").first()).toContainText(/Cornell/i);
    await search.press("Enter");
    await expect(page.getByRole("region", { name: /Cornell University Ruminant Center/i })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /^Open digital twin at Cornell University Ruminant Center/ }).click();
    await expect(page.getByTestId("farm-view")).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Back to the globe" }).click();
    const opener = page.getByRole("button", { name: "Find a place" });
    await expect(opener).toBeVisible();
    await opener.click();
    const reopened = page.getByRole("combobox", { name: "Find a farm, city or country" });
    await expect(reopened).toBeFocused();
    await reopened.press("Escape");
    await expect(opener).toBeFocused();
  });

  test("search keeps a no-results query active without exposing an empty listbox", async ({ page }) => {
    await openGlobe(page);
    await page.getByRole("button", { name: "Find a place" }).click();
    const search = page.getByRole("combobox", { name: "Find a farm, city or country" });
    await search.fill("no-place-could-match-7391");
    await expect(search).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(search).toHaveValue("no-place-could-match-7391");
  });

  test("farm picker selects a farm and reflects the selection in the farm view", async ({ page }) => {
    await openGlobe(page);
    const picker = page.getByRole("button", { name: "Choose a farm" });
    await picker.click();
    await expect(picker).toHaveAttribute("aria-expanded", "true");
    const cornellOption = page.getByRole("button", { name: /Cornell/i }).last();
    await cornellOption.click();
    await expect(page.getByRole("region", { name: /Cornell University Ruminant Center/i })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /^Open digital twin at Cornell University Ruminant Center/ }).click();
    await expect(page.getByTestId("farm-view")).toBeVisible({ timeout: 30_000 });
  });

  test("share reports clipboard failure accessibly", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error("clipboard unavailable")) },
      });
    });
    await openGlobe(page);
    await page.getByRole("button", { name: "Share this view" }).click();
    await expect(page.getByRole("status")).toHaveText("Copy failed: the link is in the address bar");
  });

  test("share copies the selected farm URL", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: (value: string) => {
            (window as Window & { __copiedShareUrl?: string }).__copiedShareUrl = value;
            return Promise.resolve();
          },
        },
      });
    });
    await openGlobe(page);
    await page.getByRole("button", { name: "Choose a farm" }).click();
    await page.getByRole("button", { name: /Cornell University Ruminant Center.*Digital twin/ }).last().click();
    await expect(page.getByRole("region", { name: /Cornell University Ruminant Center/i })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Share this view" }).click();
    await expect(page.getByRole("status")).toHaveText("Link copied");
    await expect.poll(() => page.evaluate(() => (window as Window & { __copiedShareUrl?: string }).__copiedShareUrl ?? "")).toMatch(/farm=cornell-ruminant/);
  });

  test("native share dismissal does not show an error", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: () => Promise.reject(Object.assign(new Error("dismissed"), { name: "AbortError" })),
      });
    });
    await openGlobe(page);
    await page.getByRole("button", { name: "Share this view" }).click();
    await expect(page.getByRole("status")).toHaveCount(0);
  });

  test("condition preview cards are mutually exclusive and can be closed", async ({ page }) => {
    await openFarm(page);
    await expect(page.getByText("Synthetic preview · not this farm’s measurements")).toBeVisible();

    await page.getByTestId("condition-pill-rainfall").click();
    const rainfall = page.getByTestId("condition-card-rainfall");
    await expect(rainfall).toBeVisible();
    await expect(rainfall).toContainText("Synthetic preview · not measurements for the selected farm");

    await page.getByTestId("condition-pill-moisture").click();
    await expect(page.getByTestId("condition-card-moisture")).toBeVisible();
    await expect(rainfall).toBeHidden();
    await page.getByRole("button", { name: "Minimize Soil moisture" }).click();
    await expect(page.getByTestId("condition-card-moisture")).toBeHidden();
  });

  test("Twin preview sends a question, supports a follow-up, and Escape returns focus", async ({ page }) => {
    await openFarm(page);
    const twin = page.getByRole("button", { name: "Ask Twin preview" });
    await twin.click();
    const input = page.getByRole("textbox", { name: "Ask the synthetic preview" });
    await expect(input).toBeFocused();
    await input.fill("Which field needs water first?");
    await page.getByRole("button", { name: "Send" }).click();

    const answer = page.getByTestId("twin-answer");
    await expect(answer).toContainText("Twin · Synthetic preview");
    await expect(answer).toContainText("Trial plots needs water first", { timeout: 30_000 });
    const followUp = page.getByRole("button", { name: "Why not the main block?" });
    await expect(followUp).toBeVisible();
    await followUp.click();
    await expect(answer).toContainText("Main block is dry too", { timeout: 30_000 });

    await page.keyboard.press("Escape");
    await expect(answer).toBeHidden();
    await expect(twin).toBeFocused();
  });

  test("field report collapses and reopens from its persistent control", async ({ page }) => {
    await openFarm(page);
    const toggle = page.getByRole("button", { name: "Expand field report" });
    await toggle.click();
    await expect(page.getByTestId("field-report")).toBeVisible();
    await page.getByRole("button", { name: "Collapse field report" }).click();
    await expect(page.getByTestId("field-report")).toBeHidden();
    await expect(page.getByRole("button", { name: "Expand field report" })).toBeVisible();
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
    const mute = page.getByTestId("mute-toggle");
    const initial = (await mute.textContent())?.trim();
    expect(["Mute sounds", "Unmute sounds"]).toContain(initial);
    await mute.click();
    await expect(mute).toHaveText(initial === "Mute sounds" ? "Unmute sounds" : "Mute sounds");
  });
});

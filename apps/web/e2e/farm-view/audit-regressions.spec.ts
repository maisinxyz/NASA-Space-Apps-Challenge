import { test, expect, type Page } from "@playwright/test";
import { FARMS } from "../../lib/farms";
import { SCENARIO_DEFS } from "../../lib/twin/scenarios/registry";

const cornell = "cornell-ruminant";
async function mobileFarm(page: Page, id = cornell, extra = "") {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/#farm=${id}&m=simulate${extra}`);
  await expect(page.getByTestId("non3d-workspace")).toBeVisible();
}
async function desktopFarm(page: Page, id = cornell, extra = "") {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/#farm=${id}${extra}`);
  await expect(page.getByTestId("farm-view")).toBeVisible({ timeout: 30000 });
}

for (const id of ["cornell-ruminant", "usda-barc"]) {
  test(`first scenario works in non-3D workspace: ${id}`, async ({ page }) => {
    await mobileFarm(page, id);
    await page.getByRole("button", { name: /^Storm Replay/ }).click();
    await expect(
      page.getByRole("heading", { name: "Readouts", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Synthetic demo data", { exact: true }).first(),
    ).toBeVisible();
    await page
      .getByRole("spinbutton", { name: "Peak rain rate value" })
      .fill("55");
    await page
      .getByRole("spinbutton", { name: "Peak rain rate value" })
      .press("Enter");
    await expect(
      page.getByRole("slider", { name: "Peak rain rate", exact: true }),
    ).toHaveValue("55");
  });
}

test("all registered scenarios provide readouts or an explicit output state", async ({
  page,
}) => {
  await mobileFarm(page);
  for (const scenario of SCENARIO_DEFS) {
    await page
      .getByRole("button", { name: new RegExp("^" + scenario.label + " ") })
      .click();
    await expect(
      page
        .getByRole("heading", { name: new RegExp(`^${scenario.label}`) })
        .first(),
    ).toBeVisible();
    await expect(page.getByRole("tabpanel")).toContainText(
      scenario.effectCaption,
    );
    await page.getByRole("button", { name: "← All scenarios" }).click();
  }
});

test("comparison month, share state, and tab keyboard navigation", async ({
  page,
}) => {
  await mobileFarm(page);
  await page.getByRole("tab", { name: "Compare", exact: true }).click();
  await page
    .getByRole("button", { name: "Show Jan on the fields", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Show crops on map", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Copy share link" }).click();
  const shared = page.url();
  expect(shared).toContain("mo=0");
  expect(shared).toContain("fills=0");
  await page.goto(shared);
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "Compare", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("button", { name: "Show Jan on the fields", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("tab", { name: "Compare", exact: true })
    .press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Evidence", exact: true }),
  ).toBeFocused();
  await page.getByRole("tab", { name: "Evidence", exact: true }).press("Home");
  await expect(
    page.getByRole("tab", { name: "Scenarios", exact: true }),
  ).toBeFocused();
});

test("scenario share restores rotation and paused clock position", async ({
  page,
}) => {
  await mobileFarm(
    page,
    cornell,
    "&sc=storm&sr=rot_forage&sp=.42&po=1&ps=scenarios",
  );
  await expect(
    page.getByRole("combobox", { name: "Rotation", exact: true }),
  ).toHaveValue("rot_forage");
  await expect(page.getByRole("button", { name: /^Play/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.getByRole("button", { name: "Copy share link" }).click();
  expect(page.url()).toContain("sp=0.42");
  expect(page.url()).toContain("sr=rot_forage");
});

test("reset requires confirmation; bare R and cancel preserve state", async ({
  page,
}) => {
  await mobileFarm(page, cornell, "&sc=storm&po=1");
  await page.keyboard.press("r");
  await expect(page.getByTestId("non3d-workspace")).toBeVisible();
  await page
    .getByRole("button", { name: "Reset investigation", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Reset investigation?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByTestId("non3d-workspace")).toBeVisible();
  await page
    .getByRole("button", { name: "Reset investigation", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Reset investigation", exact: true })
    .click();
  await expect(page.getByTestId("non3d-workspace")).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Research farms and farmland" }),
  ).toBeVisible();
});

test("hide panels retains a pointer recovery action", async ({ page }) => {
  await desktopFarm(page, cornell, "&m=simulate&po=1&ps=map");
  await page
    .getByRole("button", { name: "Hide panels (H)", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Show panels", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show panels", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Map", exact: true }),
  ).toBeVisible();
});

test("farm observations, unavailable layers, field keyboard selection and camera reset", async ({
  page,
}) => {
  await desktopFarm(page);
  await expect(page.getByTestId("layer-vigor")).toBeDisabled();
  await expect(page.getByTestId("layer-moisture")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Ask Twin" })).toHaveCount(0);
  await page
    .getByText("Farm observations: Not available", { exact: true })
    .click();
  await expect(page.getByTestId("condition-value-rainfall")).toHaveText(
    "Not available",
  );
  await page.getByRole("button", { name: "Expand field report" }).click();
  const firstField = page
    .getByTestId("field-report")
    .getByRole("button")
    .first();
  await firstField.press("Enter");
  await expect(
    page.getByRole("tab", { name: "Field", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Reset camera", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Field", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});

for (const size of [
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 720 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
]) {
  test(`farm header and controls do not overlap at ${size.width}x${size.height}`, async ({
    page,
  }) => {
    await desktopFarm(page);
    await page.setViewportSize(size);
    const title = await page.locator(".fv-title-block").boundingBox();
    const toolbar = await page.locator(".fv-toolbar").boundingBox();
    expect(title).not.toBeNull();
    expect(toolbar).not.toBeNull();
    expect(title!.x + title!.width).toBeLessThanOrEqual(toolbar!.x);
    expect(toolbar!.x + toolbar!.width).toBeLessThanOrEqual(size.width);
    await page.screenshot({
      path: `/tmp/fieldtwin-fixed-${size.width}x${size.height}.png`,
    });
  });
}

test("closed comparison separates field toggle from calendar", async ({
  page,
}) => {
  await desktopFarm(page, cornell, "&m=compare&po=0&ps=compare");
  const toggle = await page
    .getByRole("button", { name: "Expand field report" })
    .boundingBox();
  const calendar = await page.getByLabel("Comparison crop month").boundingBox();
  expect(toggle!.y + toggle!.height).toBeLessThan(calendar!.y);
});

test("failed WebGL still exposes the non-3D scenario workspace", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      ...args: unknown[]
    ) {
      if (/webgl/.test(kind)) return null;
      return Reflect.apply(original, this, [kind, ...args]);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto("/#farm=cornell-ruminant&m=simulate");
  await expect(page.getByTestId("non3d-workspace")).toBeVisible({
    timeout: 30000,
  });
  await expect(
    page.getByRole("button", { name: /^Storm Replay/ }),
  ).toBeVisible();
});

test("Methods identifies the chosen farm; Learn remains provisional", async ({
  page,
}) => {
  await mobileFarm(page, "usda-barc");
  await page.getByRole("link", { name: "Methods & data", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Farm context" }),
  ).toHaveValue("usda-barc");
  await expect(
    page.getByText(
      /No associated terrain provenance is available for Beltsville/,
    ),
  ).toBeVisible();
  await expect(page.getByText("terr_mock_hills", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("link", { name: "Learn", exact: true }).click();
  await expect(
    page.getByText("Provisional learning material", { exact: true }),
  ).toBeVisible();
});

for (const farm of FARMS) {
  test(`farm entry and return: ${farm.id}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await desktopFarm(page, farm.id);
    await expect(
      page.getByRole("heading", { name: farm.name, exact: true }).first(),
    ).toBeVisible();
    if (farm.tier === "explore") {
      await page.keyboard.press("h");
      await expect(page.getByRole("button",{name:"Show panels",exact:true})).toBeVisible();
      await page.getByRole("button",{name:"Show panels",exact:true}).click();
    }
    await page
      .getByRole("button", { name: "Back to the globe", exact: true })
      .click();
    await expect(page.getByTestId("farm-view")).toBeHidden();
    expect(errors).toEqual([]);
  });
}

test("Escape closes fallback controls without leaving the farm", async ({
  page,
}) => {
  await mobileFarm(page);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("non3d-workspace")).toBeVisible();
  await expect(page.getByRole("tabpanel")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Open simulation", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Scenarios", exact: true }),
  ).toBeVisible();
});

test("scenario clock plays, changes speed, pauses, and steps",async({page})=>{
  await mobileFarm(page,cornell,"&sc=storm&po=1");
  const clock=page.getByRole("group",{name:"Scenario clock: Storm",exact:true});
  await clock.getByRole("button",{name:/^Play/}).click();
  await clock.getByRole("button",{name:"4×",exact:true}).click();
  await expect.poll(async()=>Number(await clock.getByRole("slider",{name:"Scenario time"}).inputValue()),{timeout:5000}).toBeGreaterThan(1);
  await clock.getByRole("button",{name:/^Pause/}).click();
  const before=Number(await clock.getByRole("slider",{name:"Scenario time"}).inputValue());
  await clock.getByRole("button",{name:"Step forward"}).click();
  await expect(clock.getByRole("slider",{name:"Scenario time"})).toHaveValue(String(before+1));
});

test("collapsed playback is unavailable in Explore and reopening activates scenarios",async({page})=>{
  await mobileFarm(page,cornell,"&sc=storm&po=1");
  await page.keyboard.press("1");
  await expect(page.getByTestId("sim-play")).toHaveCount(0);
  await page.getByTestId("sim-tab").click();
  await expect(page.getByRole("heading",{name:"Readouts",exact:true})).toBeVisible();
  await page.getByTestId("sim-close").click();
  await expect(page.getByTestId("sim-tab")).toBeFocused();
});

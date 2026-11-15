// One-session QA driver (cheap: loads the globe once per farm). Usage: NEXT_PUBLIC_E2E=1 node e2e/farm-view/qa-session.mjs
import { chromium } from "@playwright/test";
const SH = "../../docs/farm-view/shots";
const out = [];
const log = (k, v) => { out.push([k, v]); console.log(k, "=>", v); };
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
const t = (id) => page.getByTestId(id);
const vis = async (id) => await t(id).isVisible().catch(() => false);
const step = async (name, fn) => { try { log(name, await fn()); } catch (e) { log(name, "ERROR " + e.message.split("\n")[0]); } };
const shot = (n) => page.screenshot({ path: `${SH}/d5-${n}.png` });
const box = async (id) => await t(id).boundingBox();

async function open(farm, ready) {
  await page.goto("http://localhost:3000/#farm=" + farm);
  await page.reload();
  await t(ready).waitFor({ timeout: 280000 });
  await page.waitForTimeout(2000);
}

// ---- sim farm
await open("cornell-ruminant", "sim-tab");
for (const [w, h] of [[1440, 900], [1280, 720]]) {
  await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(600);
  await step(`${w}: collapsed`, async () => { await shot(`${w}-collapsed`); return JSON.stringify({ tab: await box("sim-tab"), report: await vis("field-report"), rows: await page.locator('[data-testid^="field-report-row-"]').count() }); });
  await step(`${w}: open via button`, async () => { await t("sim-tab").click(); await page.waitForTimeout(700); await shot(`${w}-open`); return JSON.stringify({ panel: await box("sim-panel"), reportHidden: !(await vis("field-report")) }); });
  for (const s of ["scenarios", "compare", "evidence", "map"]) {
    await step(`${w}: section ${s}`, async () => {
      await t(`sim-section-${s}`).click(); await page.waitForTimeout(700); await shot(`${w}-${s}`);
      const p = await box("sim-panel");
      const over = await t("sim-panel").evaluate((e) => { const bad = []; e.querySelectorAll("*").forEach((n) => { const r = n.getBoundingClientRect(), pr = e.getBoundingClientRect(); if (r.width && r.right > pr.right + 1) bad.push((n.tagName + "." + String(n.className).slice(0, 30)) + " +" + Math.round(r.right - pr.right)); }); return bad.slice(0, 5); });
      return JSON.stringify({ panel: p, overflowX: over, scrollH: await t("sim-panel").evaluate((e) => [e.scrollHeight, e.clientHeight]) });
    });
  }
  await step(`${w}: Esc closes`, async () => { await page.keyboard.press("Escape"); await page.waitForTimeout(500); return String(!(await vis("sim-panel"))); });
  await step(`${w}: report returns`, async () => String(await vis("field-report") || await vis("field-report-toggle")));
  for (const k of ["2", "3", "4"]) await step(`${w}: key ${k} opens`, async () => { await page.mouse.click(700, 400); await page.keyboard.press(k); await page.waitForTimeout(600); const v = await vis("sim-panel"); return String(v); });
  await step(`${w}: key 1 closes`, async () => { await page.keyboard.press("1"); await page.waitForTimeout(500); return String(!(await vis("sim-panel"))); });
  await step(`${w}: key H hides`, async () => { await page.keyboard.press("h"); await page.waitForTimeout(500); await shot(`${w}-hidden`); const r = [await vis("timeline"), await vis("layer-vigor")]; await page.keyboard.press("h"); await page.waitForTimeout(500); return "chromeVisibleWhileHidden=" + r + " restored=" + (await vis("timeline")); });
  await step(`${w}: sim open then pill/twin exclusivity`, async () => { await t("sim-tab").click(); await page.waitForTimeout(500); await t("condition-pill-heat").click({ force: true }); await page.waitForTimeout(600); const both = (await vis("sim-panel")) && (await vis("card-heat")); await page.keyboard.press("Escape"); return "bothOpen=" + both; });
}
// scenarios run + clock
await page.setViewportSize({ width: 1440, height: 900 });
await step("scenario: open + pick first card + play", async () => {
  await page.keyboard.press("2"); await page.waitForTimeout(500);
  if (!(await vis("sim-panel"))) await t("sim-tab").click();
  await page.waitForTimeout(500);
  await t("sim-section-scenarios").click();
  const card = t("sim-panel").locator("button").filter({ hasText: /storm|rain|wet|dry|heat|frost|erosion|cover/i }).first();
  const n = await card.innerText().catch(() => "none"); await card.click(); await page.waitForTimeout(1000); await shot("1440-scenario-detail");
  const play = t("sim-play"); const pv = await play.isVisible().catch(() => false);
  let a1 = null, a2 = null; if (pv) { a1 = await play.getAttribute("aria-label"); await play.click(); await page.waitForTimeout(1500); a2 = await play.getAttribute("aria-label"); await shot("1440-scenario-playing"); await play.click(); }
  return JSON.stringify({ card: n.slice(0, 40), playVisible: pv, labelBefore: a1, labelAfter: a2, note: await t("sim-panel").innerText().then((x) => x.slice(0, 200)) });
});
await step("compare: tray + rank", async () => {
  await t("sim-section-compare").click(); await page.waitForTimeout(800);
  const txt = await t("sim-panel").innerText(); const rank = t("sim-panel").getByText(/Rank rotations/i).first();
  const rv = await rank.isVisible().catch(() => false); if (rv) { await rank.click(); await page.waitForTimeout(800); await shot("1440-compare-rank"); }
  const swap = t("sim-panel").getByRole("button", { name: /swap/i }).first(); const sv = await swap.isVisible().catch(() => false); if (sv) await swap.click();
  await page.waitForTimeout(500);
  return JSON.stringify({ hasRank: rv, hasSwap: sv, pillText: await t("sim-tab").innerText().catch(() => "?"), dividerOnMap: await page.locator('[data-testid*="divider"],[aria-label*="divider" i]').count(), len: txt.length });
});
await step("share link", async () => { await t("sim-section-map").click(); const s = t("sim-share"); const v = await s.isVisible().catch(() => false); if (v) { await s.click(); await page.waitForTimeout(700); } return JSON.stringify({ visible: v, status: await t("sim-panel").getByRole("status").innerText().catch(() => "none") }); });
await step("field popover / field card", async () => {
  await page.keyboard.press("Escape"); await page.waitForTimeout(400);
  if (!(await vis("field-report"))) await t("field-report-toggle").click(); await page.waitForTimeout(600);
  const row = page.locator('[data-testid^="field-report-row-"]').first(); const rn = await row.innerText(); await row.click(); await page.waitForTimeout(1500); await shot("1440-field-selected");
  return JSON.stringify({ row: rn.replace(/\s+/g, " "), popover: await vis("field-popover"), simPanel: await vis("sim-panel") });
});
await step("report fold/return", async () => { await t("field-report-toggle").click(); await page.waitForTimeout(500); const folded = !(await vis("field-report")); await t("field-report-toggle").click(); await page.waitForTimeout(600); return `folded=${folded} returned=${await vis("field-report")}`; });
log("pageerrors", JSON.stringify(errs.slice(0, 5)));

// ---- explore-only farm regression
await open("agroscope-reckenholz", "timeline");
for (const [w, h] of [[1440, 900], [1280, 720]]) {
  await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(600);
  await step(`explore ${w}`, async () => { await shot(`explore-${w}`); return JSON.stringify({ simTab: await vis("sim-tab"), twin: await box("twin-button"), report: await box("field-report-toggle") }); });
}
await step("explore: report open 380px + rows", async () => { await t("field-report-toggle").click(); await page.waitForTimeout(700); await shot("explore-1280-report"); return JSON.stringify([await box("field-report"), await t("field-report").innerText().then((x) => x.replace(/\s+/g, " ").slice(0, 200))]); });
log("pageerrors2", JSON.stringify(errs.slice(0, 5)));
await b.close();

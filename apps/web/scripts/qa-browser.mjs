// Run against a local mock build. Screenshots/report are written outside tracked source.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3000';
const out = process.env.QA_OUTPUT || '/tmp/fieldtwin-qa';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.QA_BROWSER || 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await context.newPage();
const errors = [], external = [], results = [];
page.on('pageerror', e => errors.push(e.message));
page.on('request', r => { if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== new URL(base).origin) external.push(r.url()); });
try {
  await page.goto(`${base}/simulate`);
  await page.getByRole('button', { name: 'Run the storm on these rotations' }).click();
  await page.getByRole('button', { name: 'Run again', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Side by side A | B' }).click();
  await page.getByLabel('Show difference (B minus A)').check();
  await page.locator('canvas').first().waitFor();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/simulation.png` });
  results.push('Simulation, A/B, and difference rendered');
  await page.getByRole('link', { name: 'See the evidence for each rotation' }).click();
  await page.getByText('Why it is suggested', { exact: false }).first().waitFor();
  results.push('Evidence page reached');
  await page.goto(`${base}/dev/viewer`);
  await page.getByRole('combobox').first().selectOption('terr_mock_hills');
  await page.getByLabel('water + risk').check();
  await page.getByLabel('A/B split').check();
  await page.waitForTimeout(4000);
  results.push(await page.getByTestId('stats').innerText());
  await page.locator('canvas').first().evaluate(c => c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await page.getByText('The 3D view stopped', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await page.locator('canvas').first().waitFor();
  await page.waitForTimeout(2500);
  assert.equal(await page.getByText('The 3D view stopped', { exact: true }).count(), 0);
  results.push('Real WebGL context loss and retry recovered');
  await page.screenshot({ path: `${out}/recovered-viewer.png` });
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
} finally {
  await writeFile(`${out}/report.json`, JSON.stringify({ viewport: '1920x1080', environment: 'local headless Chrome; not certified demo hardware', results, errors, external }, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ results, errors, external, out }, null, 2));

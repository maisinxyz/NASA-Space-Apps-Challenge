import { test, expect } from '@playwright/test';

test('globe controls stay bounded and the camera controls can be hidden', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const camera = page.getByText('Earth camera controls', { exact: true });
  await expect(camera).toBeVisible({ timeout: 45_000 });
  const rotate = page.getByRole('button', { name: 'Rotate left' });
  await expect(rotate).toBeHidden();
  await camera.click();
  await expect(rotate).toBeVisible();
  await camera.click();
  await expect(rotate).toBeHidden();
  await page.getByRole('button', { name: 'Farms', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Farms' });
  await expect(panel).toBeFocused();
  const bounds = await panel.evaluate((el) => ({ top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom, scroll: el.scrollHeight > el.clientHeight }));
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(800);
  expect(bounds.scroll).toBe(true);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Farms', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Scan a farm — coming soon' })).toBeDisabled();
});

test('opening a farm pin focuses its details and Escape returns to the pin', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const pin = page.getByRole('button', { name: /Oakville Grade area.*United States/ });
  await expect(pin).toBeVisible({ timeout: 45_000 });
  await expect(pin).toHaveCSS('pointer-events', 'auto', { timeout: 30_000 });
  await pin.click();
  const close = page.getByRole('button', { name: 'Close farm details' });
  await expect(close).toBeFocused({ timeout: 10_000 });
  await page.keyboard.press('Escape');
  await expect(pin).toBeFocused();
});

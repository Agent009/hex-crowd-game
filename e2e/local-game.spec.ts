import { expect, test } from '@playwright/test';
import { expectCanvasHasRichRendering } from './canvasQuality';

test('starts a local game and renders the hex canvas', async ({ page }) => {
  const consoleFailures: string[] = [];

  page.on('console', message => {
    if (message.type() === 'error') {
      consoleFailures.push(message.text());
    }
  });

  page.on('pageerror', error => {
    consoleFailures.push(error.message);
  });

  await page.goto('/');
  await page.getByTestId('local-game-button').click();

  async function addLocalPlayer(name: string) {
    await page.getByTestId('add-local-player-button').click();
    await page.getByTestId('local-player-name-input').fill(name);
    await page.getByTestId('confirm-local-player-button').click();
  }

  await addLocalPlayer('Ava');
  await addLocalPlayer('Ben');
  await page.getByTestId('start-game-button').click();

  await expect(page.getByText('Round 1', { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId('hero-command-button')).toBeVisible();
  await expect(page.getByTestId('game-canvas')).toBeVisible();

  const canvas = page.locator('canvas');
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  expect(box?.width).toBeGreaterThan(500);
  expect(box?.height).toBeGreaterThan(400);

  const renderedCanvas = await canvas.screenshot();
  expect(renderedCanvas.length).toBeGreaterThan(10_000);
  await expectCanvasHasRichRendering(page);
  expect(consoleFailures.filter(error => !error.includes('favicon'))).toEqual([]);
});

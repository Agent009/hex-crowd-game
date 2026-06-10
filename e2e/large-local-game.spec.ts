import { expect, test } from '@playwright/test';
import { expectCanvasHasRichRendering } from './canvasQuality';

test('starts a 30-player local game and keeps the hex scene responsive', async ({ page }) => {
  test.slow();

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

  for (let index = 1; index <= 30; index += 1) {
    const addButton = page.getByTestId('add-local-player-button');
    await addButton.scrollIntoViewIfNeeded();
    await addButton.click();
    await page.getByTestId('local-player-name-input').fill(`Player ${index}`);
    await page.getByTestId('confirm-local-player-button').click();
  }

  await expect(page.getByTestId('add-local-player-button')).toBeDisabled();
  await expect(page.getByText('30/30 Players')).toBeVisible();

  const startButton = page.getByTestId('start-game-button');
  await startButton.scrollIntoViewIfNeeded();
  const startedAt = performance.now();
  await startButton.click();

  await expect(page.getByTestId('game-canvas')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.getByTestId('hero-command-button')).toBeVisible();

  const startupMs = performance.now() - startedAt;
  expect(startupMs).toBeLessThan(8_000);

  async function sampleFrames(sampleCount: number) {
    return page.evaluate(async (count) => {
      const samples: number[] = [];
      let last = performance.now();

      await new Promise<void>(resolve => {
        const tick = (now: number) => {
          samples.push(now - last);
          last = now;

          if (samples.length >= count) {
            resolve();
            return;
          }

          requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
      });

      const sorted = [...samples].sort((a, b) => a - b);
      const average = samples.reduce((total, sample) => total + sample, 0) / samples.length;

      return {
        average,
        p95: sorted[Math.floor(sorted.length * 0.95)],
        max: sorted[sorted.length - 1],
      };
    }, sampleCount);
  }

  const startupFrameStats = await sampleFrames(90);

  expect(startupFrameStats.average).toBeLessThan(50);
  expect(startupFrameStats.p95).toBeLessThan(100);
  expect(startupFrameStats.max).toBeLessThan(500);

  await page.waitForTimeout(10_000);

  const sustainedFrameStats = await sampleFrames(180);

  expect(sustainedFrameStats.average).toBeLessThan(50);
  expect(sustainedFrameStats.p95).toBeLessThan(100);
  expect(sustainedFrameStats.max).toBeLessThan(500);

  const heapStats = await page.evaluate(() => {
    const maybePerformance = performance as Performance & {
      memory?: {
        usedJSHeapSize: number;
        totalJSHeapSize: number;
      };
    };

    return maybePerformance.memory
      ? {
        usedJSHeapSize: maybePerformance.memory.usedJSHeapSize,
        totalJSHeapSize: maybePerformance.memory.totalJSHeapSize,
      }
      : null;
  });

  if (heapStats) {
    expect(heapStats.usedJSHeapSize).toBeLessThan(150 * 1024 * 1024);
    expect(heapStats.usedJSHeapSize).toBeLessThanOrEqual(heapStats.totalJSHeapSize);
  }

  const renderedCanvas = await page.locator('canvas').screenshot();
  expect(renderedCanvas.length).toBeGreaterThan(10_000);
  await expectCanvasHasRichRendering(page);
  expect(consoleFailures.filter(error => !error.includes('favicon'))).toEqual([]);
});

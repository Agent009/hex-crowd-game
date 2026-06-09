import { expect, test, type Page } from '@playwright/test';

const soakEnabled = process.env.SOAK_E2E === '1';
const soakDurationMs = Math.max(
  15_000,
  Number.parseInt(process.env.SOAK_E2E_DURATION_MS ?? '60000', 10) || 60_000
);

async function addLocalPlayer(page: Page, name: string) {
  const addButton = page.getByTestId('add-local-player-button');
  await addButton.scrollIntoViewIfNeeded();
  await addButton.click();
  await page.getByTestId('local-player-name-input').fill(name);
  await page.getByTestId('confirm-local-player-button').click();
}

async function sampleFrames(page: Page, sampleCount: number) {
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

test.describe('30-player local game soak', () => {
  test.skip(!soakEnabled, 'Set SOAK_E2E=1 to run the opt-in 30-player long-soak browser profile.');

  test('keeps the hex scene responsive across a sustained run', async ({ page }) => {
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
      await addLocalPlayer(page, `Soak Player ${index}`);
    }

    const startButton = page.getByTestId('start-game-button');
    await startButton.scrollIntoViewIfNeeded();
    await startButton.click();

    await expect(page.getByTestId('game-canvas')).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(1);

    const startedAt = Date.now();
    const samples = [];

    while (Date.now() - startedAt < soakDurationMs) {
      await page.waitForTimeout(5_000);
      const stats = await sampleFrames(page, 180);
      samples.push(stats);

      expect(stats.average).toBeLessThan(50);
      expect(stats.p95).toBeLessThan(120);
      expect(stats.max).toBeLessThan(750);
    }

    expect(samples.length).toBeGreaterThan(0);

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
      expect(heapStats.usedJSHeapSize).toBeLessThan(200 * 1024 * 1024);
      expect(heapStats.usedJSHeapSize).toBeLessThanOrEqual(heapStats.totalJSHeapSize);
    }

    expect(consoleFailures.filter(error => !error.includes('favicon'))).toEqual([]);
  });
});

import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { expectCanvasHasRichRendering } from './canvasQuality';

const ENV_FILES = ['.env.local', '.env.test', '.env.development', '.env'];

function readEnvValue(name: string): string | undefined {
  if (process.env[name]) return process.env[name];

  for (const file of ENV_FILES) {
    if (!existsSync(file)) continue;

    const line = readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .find(candidate => candidate.startsWith(`${name}=`) || candidate.startsWith(`export ${name}=`));

    if (!line) continue;

    const rawValue = line.slice(line.indexOf('=') + 1).trim();
    return rawValue.replace(/^['"]|['"]$/g, '');
  }

  return undefined;
}

const liveSupabaseEnabled = readEnvValue('LIVE_SUPABASE_E2E') === '1';
const supabaseUrl = readEnvValue('VITE_SUPABASE_URL');
const supabaseAnonKey = readEnvValue('VITE_SUPABASE_ANON_KEY');
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

function attachBrowserFailureCapture(page: Page, label: string, failures: string[]) {
  page.on('console', message => {
    if (message.type() === 'error') {
      failures.push(`${label} console: ${message.text()}`);
    }
  });

  page.on('pageerror', error => {
    failures.push(`${label} pageerror: ${error.message}`);
  });
}

async function markSessionEnded(sessionCode: string) {
  if (!supabaseUrl || !supabaseAnonKey) return;

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    await supabase
      .from('game_sessions')
      .update({ game_mode: 'ended', updated_at: new Date().toISOString() })
      .eq('session_code', sessionCode);
  } catch {
    // Cleanup is best-effort because RLS policy differs between test projects.
  }
}

test.describe('live Supabase online multiplayer', () => {
  test.skip(
    !liveSupabaseEnabled || !hasSupabaseConfig,
    'Set LIVE_SUPABASE_E2E=1 with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to run the live Supabase E2E smoke.'
  );

  test('creates, joins, starts, and restores an online session', async ({ browser }) => {
    test.slow();

    const suffix = Date.now().toString(36).slice(-5);
    const hostName = `Host ${suffix}`;
    const guestName = `Guest ${suffix}`;
    const contexts: BrowserContext[] = [];
    const failures: string[] = [];
    let sessionCode = '';

    async function newPlayerPage(label: string) {
      const context = await browser.newContext();
      contexts.push(context);
      const page = await context.newPage();
      attachBrowserFailureCapture(page, label, failures);
      return page;
    }

    try {
      const hostPage = await newPlayerPage('host');
      await hostPage.goto('/');
      await hostPage.getByTestId('create-online-game-button').click();
      await hostPage.getByTestId('create-player-name-input').fill(hostName);
      await hostPage.getByTestId('create-session-button').click();

      await expect(hostPage.getByTestId('connection-status-value')).toHaveText(/connected/i, { timeout: 15_000 });
      await expect(hostPage.getByText(hostName, { exact: true })).toBeVisible();

      sessionCode = ((await hostPage.getByTestId('session-code-value').textContent()) ?? '').trim();
      expect(sessionCode).toMatch(/^[A-Z2-9]{6}$/);

      const guestPage = await newPlayerPage('guest');
      await guestPage.goto('/');
      await guestPage.getByTestId('join-online-game-button').click();
      await guestPage.getByTestId('join-player-name-input').fill(guestName);
      await guestPage.getByTestId('join-session-code-input').fill(sessionCode);
      await guestPage.getByTestId('join-session-button').click();

      await expect(guestPage.getByTestId('connection-status-value')).toHaveText(/connected/i, { timeout: 15_000 });
      await expect(guestPage.getByText(hostName, { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(guestPage.getByText(guestName, { exact: true })).toBeVisible();
      await expect(hostPage.getByText(guestName, { exact: true })).toBeVisible({ timeout: 15_000 });

      await hostPage.getByTestId('local-ready-button').click();
      await guestPage.getByTestId('local-ready-button').click();
      await expect(hostPage.getByText('2/2 players ready')).toBeVisible({ timeout: 15_000 });
      await expect(hostPage.getByTestId('start-game-button')).toBeEnabled();
      await hostPage.getByTestId('start-game-button').click();

      await expect(hostPage.getByText('Round 1', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
      await expect(guestPage.getByText('Round 1', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
      await expect(hostPage.getByTestId('game-canvas')).toBeVisible();
      await expect(guestPage.getByTestId('game-canvas')).toBeVisible();
      await expectCanvasHasRichRendering(hostPage);

      await hostPage.waitForTimeout(6_500);

      const reconnectPage = await newPlayerPage('reconnect');
      await reconnectPage.goto('/');
      await reconnectPage.getByTestId('reconnect-online-game-button').click();
      await reconnectPage.getByTestId('reconnect-session-code-input').fill(sessionCode);
      await reconnectPage.getByTestId('check-session-button').click();
      await expect(reconnectPage.getByText('In Progress')).toBeVisible({ timeout: 15_000 });
      await reconnectPage.getByTestId('reconnect-player-name-input').fill(guestName);
      await reconnectPage.getByTestId('reconnect-session-button').click();

      await expect(reconnectPage.getByText('Round 1', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
      await expect(reconnectPage.getByTestId('game-canvas')).toBeVisible();
      await expectCanvasHasRichRendering(reconnectPage);

      expect(failures.filter(error => !error.includes('favicon'))).toEqual([]);
    } finally {
      if (sessionCode) {
        await markSessionEnded(sessionCode);
      }

      await Promise.all(contexts.map(context => context.close()));
    }
  });
});

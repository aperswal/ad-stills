import { test, expect, type Page } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { batchDetailSchema } from '../shared/contracts';
const detail = batchDetailSchema.parse(
  JSON.parse(await readFile('evidence/proof-mock.json', 'utf8')),
);
const batchPath = `/b/${detail.batch.id}`;
const batchApi = `**/api/batches/${detail.batch.id}`;
const ok = (data: unknown) => JSON.stringify({ ok: true, data, error: null });
const error = JSON.stringify({
  ok: false,
  data: null,
  error: { code: 'TEST_ERROR', message: 'Test connection failed. Try again.', source: 'server' },
});
async function shot(page: Page, name: string) {
  await mkdir('evidence/browser', { recursive: true });
  await page.screenshot({
    path: `evidence/browser/${test.info().project.name}-${name}.png`,
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}
test.beforeEach(async ({ page }) => {
  await page.route('**/api/events', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: 'event: refresh\ndata: {}\n\n',
    }),
  );
});
test('home: done, empty, loading, error and keyboard', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'My batches' })).toBeVisible();
  await expect(page.getByText('2 of 2 done').first()).toBeVisible();
  await shot(page, 'home-done');
  await page.route('**/api/batches?*', (route) =>
    route.fulfill({ contentType: 'application/json', body: ok({ items: [], nextOffset: null }) }),
  );
  await page.reload();
  await expect(page.getByText('Your first batch starts')).toBeVisible();
  await shot(page, 'home-empty');
  await page.getByRole('link', { name: 'New batch' }).first().focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/new');
  await page.unroute('**/api/batches?*');
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/batches?*', async (route) => {
    await held;
    await route.fulfill({
      contentType: 'application/json',
      body: ok({ items: [], nextOffset: null }),
    });
  });
  await page.goto('/');
  await expect(page.getByText('Loading batches…')).toBeVisible();
  await shot(page, 'home-loading');
  release?.();
  await page.unroute('**/api/batches?*');
  await page.route('**/api/batches?*', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: error }),
  );
  await page.reload();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Test connection failed');
  await shot(page, 'home-error');
  expect(errors).toEqual([]);
});
test('new: empty, setup, selected images, validation and pending', async ({ page }) => {
  await page.route('**/api/status', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: ok({ connected: false, signedIn: false, runners: 0, command: 'pnpm dev' }),
    }),
  );
  await page.goto('/new');
  await expect(page.getByText('Runner not connected')).toBeVisible();
  await expect(page.getByText('codex login')).toBeVisible();
  await shot(page, 'new-empty');
  await page.getByRole('button', { name: 'Make the ads' }).click();
  await expect(page.getByLabel('Brand name')).toBeFocused();
  await page
    .locator('#originals')
    .setInputFiles(['evidence/fixtures/original-1.png', 'evidence/fixtures/original-2.png']);
  await page.locator('#products').setInputFiles('evidence/fixtures/product.png');
  await page.getByRole('button', { name: 'Remove ads that worked 2' }).click();
  await expect(page.getByText('1 of 10')).toHaveCount(2);
  await page.getByLabel('Brand name').fill('Demo Cup');
  await page.getByLabel('The problem your customer has').fill('Need a bottle for a bag.');
  await page.getByLabel('Who it is for').fill('Adults with a daily bag.');
  await page.getByLabel('How your product solves it').fill('A reusable bottle.');
  await page.getByLabel('Brand colours').fill('#216C52');
  await shot(page, 'new-filled');
  await page.route('**/api/batches', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: error }),
  );
  await page.getByRole('button', { name: 'Make the ads' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Test connection failed');
  await shot(page, 'new-error');
  await page.unroute('**/api/batches');
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/batches', async (route) => {
    await held;
    await route.fulfill({ status: 500, contentType: 'application/json', body: error });
  });
  await page.getByRole('button', { name: 'Make the ads' }).click();
  await expect(page.getByText('Creating batch…')).toBeVisible();
  await shot(page, 'new-loading');
  release?.();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Test connection failed');
  await page.unroute('**/api/batches');
  await page.route('**/api/batches', (route) =>
    route.fulfill({ status: 201, contentType: 'application/json', body: ok(detail.batch) }),
  );
  await page.route('**/files?*', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: ok({ id: detail.batch.id }),
    }),
  );
  await page.route('**/start', (route) =>
    route.fulfill({ status: 202, contentType: 'application/json', body: ok({ ok: true }) }),
  );
  await page.getByRole('button', { name: 'Make the ads' }).click();
  await expect(page).toHaveURL(batchPath);
  await expect(page.getByText('2 of 2 ads done')).toBeVisible();
  await shot(page, 'new-submitted');
});
test('batch: done, downloads, all job states, empty, loading and error', async ({ page }) => {
  await page.goto(batchPath);
  await expect(page.getByText('2 of 2 ads done')).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Bring your day along. — Find your cup' }),
  ).toHaveCount(2);
  await shot(page, 'batch-done');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download all' }).click();
  expect((await downloaded).suggestedFilename()).toBe('ad-stills.zip');
  for (const state of ['queued', 'running', 'failed'] as const) {
    await page.route(batchApi, (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: ok({
          ...detail,
          ads: detail.ads.map((ad) => ({
            ...ad,
            state,
            resultKey: null,
            copy: null,
            failureReason: state === 'failed' ? 'The new ad has the wrong shape. Try again.' : null,
          })),
        }),
      }),
    );
    await page.reload();
    await expect(
      page
        .getByText(
          state === 'queued'
            ? 'Waiting for a runner'
            : state === 'running'
              ? 'Making your ad…'
              : 'Could not make this ad',
        )
        .first(),
    ).toBeVisible();
    await shot(page, `batch-${state}`);
    await page.unroute(batchApi);
  }
  await page.route(batchApi, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: ok({ ...detail, batch: { ...detail.batch, startedAt: null }, ads: [], photos: [] }),
    }),
  );
  await page.reload();
  await expect(page.getByText('This upload did not finish.')).toBeVisible();
  await shot(page, 'batch-empty');
  await page.unroute(batchApi);
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(batchApi, async (route) => {
    await held;
    await route.fulfill({ contentType: 'application/json', body: ok(detail) });
  });
  await page.reload();
  await expect(page.getByText('Loading batch…')).toBeVisible();
  await shot(page, 'batch-loading');
  release?.();
  await page.unroute(batchApi);
  await page.route(batchApi, (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: error }),
  );
  await page.reload();
  await expect(page.getByRole('main').getByRole('alert').first()).toContainText(
    'Test connection failed',
  );
  await shot(page, 'batch-error');
});
test('passcode: empty, waiting and error', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Open Ad Stills' })).toBeVisible();
  await shot(page, 'login-empty');
  await page.getByLabel('App passcode').fill('wrong-passcode');
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/login', async (route) => {
    await held;
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: false,
        data: null,
        error: { code: 'WRONG_PASSCODE', message: 'That passcode is not right.', source: 'client' },
      }),
    });
  });
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Opening…' })).toBeVisible();
  await shot(page, 'login-loading');
  release?.();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'That passcode is not right.',
  );
  await shot(page, 'login-error');
  await page.unroute('**/api/login');
  await page.route('**/api/login', (route) =>
    route.fulfill({ contentType: 'application/json', body: ok({ ok: true }) }),
  );
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page).toHaveURL('/');
  await shot(page, 'login-opened');
});

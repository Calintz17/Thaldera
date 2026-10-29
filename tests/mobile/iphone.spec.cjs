const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  // Avoid external font CDN availability controlling the CI UI tests.
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
});
async function noHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  expect(metrics.scrollWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.width + 2);
  expect(metrics.bodyWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.width + 2);
}

test('iPhone portrait: compact header, world cards and Explorer without keyboard hijack', async ({ page }) => {
  await page.goto('/#/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#world .wcrest').first()).toBeVisible();
  const top = await page.locator('.top').boundingBox();
  expect(top.height).toBeLessThan(153);
  await noHorizontalOverflow(page);
  const inputSize = await page.locator('#q').evaluate(e => parseFloat(getComputedStyle(e).fontSize));
  expect(inputSize).toBeGreaterThanOrEqual(16);
  await page.locator('#ebtn').click();
  await expect(page.locator('#elog')).toBeVisible();
  expect(await page.evaluate(() => document.activeElement.id)).not.toBe('equery');
  await expect(page.locator('#econtinent')).toBeVisible();
  await page.locator('#elog .eclose').click();
  await expect(page.locator('#elog')).toBeHidden();
});

test('iPhone: continent map points and labelled touch destinations', async ({ page }) => {
  await page.goto('/#/istra', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.map-labels .pin:not(.offscreen) .in').first()).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.mobile-places summary')).toBeVisible();
  await page.locator('.mobile-places summary').click();
  await expect(page.locator('.mobile-places-list a').first()).toBeVisible();
  await noHorizontalOverflow(page);
  const mapHeight = await page.locator('#stage').evaluate(el => Math.round(el.getBoundingClientRect().height));
  expect(mapHeight).toBeGreaterThanOrEqual(245);
});

test('iPhone: journal drawers scroll and close', async ({ page }) => {
  await page.goto('/#/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.wcrest').first()).toBeVisible();
  await page.locator('#sbtn').click();
  await expect(page.locator('#slog')).toBeVisible();
  await expect(page.locator('#slog .session-entry').first()).toBeVisible();
  await page.locator('#slog .session-entry summary').first().click();
  await expect(page.locator('#slog .session-entry').first()).toHaveAttribute('open', '');
  await page.locator('#slog .qx').click();
  await expect(page.locator('#slog')).toBeHidden();
  await page.locator('#rbtn').click();
  await expect(page.locator('#rlog')).toBeVisible();
  await page.locator('#rlog .qx').click();
  await page.locator('#qbtn').click();
  await expect(page.locator('#qlog')).toBeVisible();
  await page.locator('#qlog .qx').click();
  await expect(page.locator('#qlog')).toBeHidden();
});

test('iPhone: gallery carousel touch controls remain tappable', async ({ page }) => {
  await page.goto('/#/ink', { waitUntil: 'domcontentloaded' });
  const next = page.locator('.gal .gnav button[data-d="1"]');
  await expect(next).toBeVisible({ timeout: 60000 });
  const dots = page.locator('.gal .gdots button');
  const dotRect = await dots.first().boundingBox();
  expect(dotRect.height).toBeGreaterThanOrEqual(40);
  expect(dotRect.width).toBeGreaterThanOrEqual(30);
  await expect(page.locator('#mapcap')).toBeHidden();
  const first = await page.locator('.gal .sl.act').evaluate(el => [...el.parentElement.children].indexOf(el));
  await next.click();
  const second = await page.locator('.gal .sl.act').evaluate(el => [...el.parentElement.children].indexOf(el));
  expect(second).not.toBe(first);
});

test('narrow iPhone SE and landscape: no horizontal scrolling or clipped header', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/#/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.wcrest').first()).toBeVisible();
  await noHorizontalOverflow(page);
  await page.setViewportSize({ width: 667, height: 375 });
  await noHorizontalOverflow(page);
  const header = await page.locator('.top').boundingBox();
  expect(header.height).toBeLessThan(160);
});

import { test, expect } from './fixtures.mjs';

const pages = ['index.html', 'krankenhaus.html', 'pflegedienst.html', 'katastrophenschutz.html', 'rettungsdienst.html', 'mitmachen.html', 'mitmachen-aufnahme.html', 'impressum.html', 'datenschutz.html', 'nutzungsbedingungen.html'];

for (const filename of pages) {
  test(`public ${filename} opens without a password`, async ({ page, baseURL }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    const response = await page.goto(`${baseURL}/${filename}`);
    expect(response.status()).toBe(200);
    await expect(page.locator('main h1').first()).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('preview redirects retain query parameters and anchors', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/website-preview/index.html?source=preview#kontakt`);
  await expect(page).toHaveURL(`${baseURL}/?source=preview#kontakt`);
  await page.goto(`${baseURL}/website-preview/pflegedienst.html?source=preview#main`);
  await expect(page).toHaveURL(`${baseURL}/pflegedienst.html?source=preview#main`);
  await expect(page.locator('main h1').first()).toBeVisible();
});

test('mobile navigation and the public language switch work', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/`);
  await expect(page.locator('main h1').first()).toBeVisible();
  await page.locator('.langswitch__btn').click();
  await page.locator('[data-lang="en"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('[data-langlabel]')).toHaveText('EN');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const burger = page.locator('.nav__burger');
  await burger.click();
  await expect(burger).toHaveAttribute('aria-expanded', 'true');
  await page.locator('#navLinks a[href="pflegedienst.html"]').click();
  await expect(page).toHaveURL(`${baseURL}/pflegedienst.html`);
  await expect(page.locator('main h1').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('the root and preview fallback remain readable without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${baseURL}/`);
  await expect(page.locator('main h1').first()).toBeVisible();
  await page.goto(`${baseURL}/website-preview/index.html`);
  await expect(page).toHaveURL(`${baseURL}/`);
  await expect(page.locator('main h1').first()).toBeVisible();
  await context.close();
});

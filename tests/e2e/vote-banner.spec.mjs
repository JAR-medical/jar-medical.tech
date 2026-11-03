import { test, expect } from './fixtures.mjs';

for (const path of ['/', '/info/', '/pflege/', '/corporate/']) {
  test(`the voting notice fits above mobile navigation on ${path}`, async ({ page, baseURL }) => {
    await page.clock.setFixedTime(new Date('2026-11-03T12:00:00+01:00'));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseURL}${path}`);
    const notice = page.locator('.jar-vote-banner');
    await expect(notice).toBeVisible();
    await expect(notice.locator('a')).toHaveAttribute('href', 'https://www.bw-ki.de/publikumspreis');
    const nav = page.locator('header.nav, header.header');
    await expect(nav).toBeVisible();
    const noticeBox = await notice.boundingBox();
    const navBox = await nav.boundingBox();
    expect(navBox.y).toBeGreaterThanOrEqual(noticeBox.y + noticeBox.height - 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('an open page removes the notice and layout space at the Berlin deadline', async ({ page, baseURL }) => {
  await page.clock.install({ time: new Date('2026-11-09T23:58:00+01:00') });
  await page.goto(`${baseURL}/pflege/`);
  await expect(page.locator('.jar-vote-banner')).toBeVisible();
  await page.clock.pauseAt(new Date('2026-11-09T23:59:59+01:00'));
  await page.clock.runFor(1000);
  await expect(page.locator('.jar-vote-banner')).toHaveCount(0);
  await expect(page.locator('.jar-vote-spacer')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveClass(/jar-vote-active/);
  expect((await page.locator('header.header').boundingBox()).y).toBe(0);
});

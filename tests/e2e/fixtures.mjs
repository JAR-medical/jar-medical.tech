// Shared fixtures for the end-to-end suite.
//
// Three jobs:
//   - hand every test the ephemeral base URL globalSetup produced,
//   - keep the run hermetic by serving map tiles locally instead of reaching
//     out to OpenStreetMap or Carto,
//   - collect console errors and failed requests so a spec can assert on them.
import { test as base, expect } from '@playwright/test';

// A 1x1 transparent PNG - stands in for every map tile.
const TILE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

// Every third-party host the site can reach for map imagery.
export const TILE_HOSTS = [
  '**://*.tile.openstreetmap.org/**',
  '**://tile.openstreetmap.org/**',
  '**://*.basemaps.cartocdn.com/**',
  '**://basemaps.cartocdn.com/**',
];

/** Requests a browser makes on its own that carry no meaning for these tests. */
const IGNORED_FAILURES = [/\/favicon\.ico$/];

export const test = base.extend({
  // globalSetup writes the address after the config has already been read, so
  // baseURL is supplied here rather than in playwright.config.mjs.
  baseURL: async ({}, use) => {
    const url = process.env.E2E_BASE_URL;
    if (!url) {
      throw new Error(
        'E2E_BASE_URL is not set - the static server in tests/e2e/global-setup.mjs did not start. ' +
        'Run the suite through `npx playwright test` so globalSetup executes.',
      );
    }
    await use(url);
  },

  // Hermetic by default: no test ever touches a third-party host.
  // Enabled for every test; a spec that wants to see real tile behaviour would
  // have to opt out explicitly, and none does.
  tileStub: [async ({ context }, use) => {
    const served = [];
    for (const pattern of TILE_HOSTS) {
      await context.route(pattern, async (route) => {
        served.push(route.request().url());
        await route.fulfill({ status: 200, contentType: 'image/png', body: TILE_PNG });
      });
    }
    await use(served);
  }, { auto: true }],

  /**
   * Console errors and failed network requests seen on this page.
   * Attached before the first navigation so nothing during load is missed.
   *
   * Cancellations are kept apart from failures: the language switcher replaces
   * the concept diagram's src while the browser is still fetching the one in
   * the markup, so the first load always cancels one image. A cancellation is
   * the browser doing as it was told, not a resource that could not be served -
   * but it is still recorded, and asserted on explicitly in site.spec.mjs.
   */
  pageProblems: async ({ page }, use) => {
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];
    const abortedRequests = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`${msg.text()} @ ${msg.location().url}`);
    });
    page.on('pageerror', (err) => pageErrors.push(String(err)));
    page.on('requestfailed', (req) => {
      if (IGNORED_FAILURES.some((re) => re.test(req.url()))) return;
      const reason = req.failure()?.errorText ?? 'unknown';
      if (reason === 'net::ERR_ABORTED') abortedRequests.push(req.url());
      else failedRequests.push(`${req.url()} (${reason})`);
    });
    page.on('response', (res) => {
      if (res.status() < 400) return;
      if (IGNORED_FAILURES.some((re) => re.test(res.url()))) return;
      failedRequests.push(`${res.url()} -> HTTP ${res.status()}`);
    });

    await use({ consoleErrors, pageErrors, failedRequests, abortedRequests });
  },
});

export { expect };

/** Assert a page produced no console errors, no page errors and no failed requests. */
export function expectClean(problems, where) {
  expect(problems.pageErrors, `uncaught JavaScript errors on ${where}`).toEqual([]);
  expect(problems.consoleErrors, `console errors on ${where}`).toEqual([]);
  expect(problems.failedRequests, `failed network requests on ${where}`).toEqual([]);
}

/**
 * The seven languages the site offers, with the label on their switcher button
 * and the translation of `nav_solution` - the one key whose value differs in
 * all seven languages, so it proves the copy really changed.
 */
export const LANGUAGES = [
  { code: 'de', label: 'Deutsch', navSolution: 'Unsere Lösung' },
  { code: 'en', label: 'English', navSolution: 'Our Solution' },
  { code: 'fr', label: 'Français', navSolution: 'Notre solution' },
  { code: 'es', label: 'Español', navSolution: 'Nuestra solución' },
  { code: 'it', label: 'Italiano', navSolution: 'La nostra soluzione' },
  { code: 'pt', label: 'Português', navSolution: 'A nossa solução' },
  { code: 'zh', label: '中文', navSolution: '我们的方案' },
];

// The public site, driven end to end against the real files.
import { test, expect, expectClean, LANGUAGES } from './fixtures.mjs';
import { readText, TOP_LEVEL_PAGES } from '../lib/repo.mjs';
import { objectFromHtml, i18nKeys } from '../lib/html.mjs';

const INDEX_SOURCE = readText('index.html');
const I18N = objectFromHtml(INDEX_SOURCE, 'I18N');
const I18N_META = objectFromHtml(INDEX_SOURCE, 'I18N_META');
const I18N_CONCEPT_IMAGES = objectFromHtml(INDEX_SOURCE, 'I18N_CONCEPT_IMAGES');
const MARKUP_KEYS = i18nKeys(INDEX_SOURCE);

/** Read every translated node out of the live DOM, keyed by data-i18n. */
async function renderedCopy(page) {
  return page.evaluate(() => {
    const out = {};
    for (const el of document.querySelectorAll('[data-i18n]')) {
      out[el.getAttribute('data-i18n')] = el.innerHTML;
    }
    return out;
  });
}

test.describe('homepage', () => {
  test('renders its hero, sections and footer', async ({ page, baseURL, pageProblems }) => {
    await page.goto(`${baseURL}/`);

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.site-title, header')).toBeVisible();

    // Every anchor the navigation points at must exist as a real section.
    for (const id of ['problem', 'loesung', 'einsatz', 'kontakt']) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }

    await expect(page.locator('#conceptImage')).toBeVisible();
    await expect(page.locator('.lang-bar button[data-setlang]')).toHaveCount(7);
    await expect(page.getByRole('link', { name: /Impressum|Imprint|Mentions|Aviso|Note legali|Impresso|法律/ }).first())
      .toBeVisible();

    expectClean(pageProblems, 'the homepage');
  });

  test('the only cancelled request is the concept image the switcher replaces', async ({ page, baseURL, pageProblems }) => {
    // The markup ships jar-concept-de.png so the diagram is there without
    // JavaScript. apply() then points the same <img> at the chosen language's
    // file, and the browser cancels the fetch already in flight. That costs a
    // partial download of a ~1 MB image on every first visit; it is recorded
    // here so the behaviour is visible rather than quietly swallowed.
    await page.goto(`${baseURL}/`);
    await expect(page.locator('#conceptImage')).toBeVisible();
    for (const url of pageProblems.abortedRequests) {
      expect(url, 'something other than the concept diagram was cancelled')
        .toMatch(/jar-concept-[a-z]{2}\.png$/);
    }
    expectClean(pageProblems, 'the homepage');
  });

  test('the concept image for the active language actually loads', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/`);
    const img = page.locator('#conceptImage');
    await expect(img).toBeVisible();
    // naturalWidth stays 0 for an image the browser could not decode.
    const width = await img.evaluate((el) => el.naturalWidth);
    expect(width, 'the concept diagram did not decode').toBeGreaterThan(100);
  });

  test('in-page navigation scrolls to the linked section', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/`);
    await page.locator('#mainNav a[href="#problem"]').click();
    await expect(page).toHaveURL(/#problem$/);
    const onScreen = await page.locator('#problem').evaluate((el) => {
      const box = el.getBoundingClientRect();
      return box.top < window.innerHeight && box.bottom > 0;
    });
    expect(onScreen, '#problem is not in the viewport after clicking its nav link').toBe(true);
  });

  test('the mobile menu toggle opens and closes the navigation', async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await page.goto(`${baseURL}/`);
    const toggle = page.locator('#menuToggle');
    const nav = page.locator('#mainNav');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(nav).toHaveClass(/open/);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await toggle.click();
    await expect(nav).not.toHaveClass(/open/);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('language switcher', () => {
  test('every switcher button is present and labelled', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/`);
    for (const lang of LANGUAGES) {
      await expect(page.locator(`.lang-bar button[data-setlang="${lang.code}"]`))
        .toHaveText(lang.label);
    }
  });

  for (const lang of LANGUAGES) {
    test(`switching to ${lang.label} rewrites every translated node`, async ({ page, baseURL, pageProblems }) => {
      await page.goto(`${baseURL}/`);
      await page.locator(`.lang-bar button[data-setlang="${lang.code}"]`).click();

      // The page marks itself as the chosen language...
      await expect(page.locator('html')).toHaveAttribute('lang', lang.code);
      await expect(page.locator(`.lang-bar button[data-setlang="${lang.code}"]`))
        .toHaveAttribute('aria-current', 'true');

      // ...the title and meta description follow...
      await expect(page).toHaveTitle(I18N_META[lang.code].title);
      const desc = await page.locator('meta[name="description"]').getAttribute('content');
      expect(desc).toBe(I18N_META[lang.code].desc);

      // ...and the visible copy really is the copy from that dictionary.
      await expect(page.locator('#mainNav a[href="#loesung"]')).toHaveText(lang.navSolution);

      if (lang.code !== 'de') {
        const rendered = await renderedCopy(page);
        const wrong = MARKUP_KEYS.filter((key) => rendered[key] !== I18N[lang.code][key]);
        expect(wrong, `${lang.code} left these nodes untranslated: ${wrong.join(', ')}`).toEqual([]);
      }

      // The localised concept diagram is swapped and still decodes.
      const img = page.locator('#conceptImage');
      await expect(img).toHaveAttribute('src', I18N_CONCEPT_IMAGES[lang.code].src);
      await expect(img).toHaveAttribute('alt', I18N_CONCEPT_IMAGES[lang.code].alt);
      expect(await img.evaluate((el) => el.naturalWidth),
        `the ${lang.code} concept diagram did not decode`).toBeGreaterThan(100);

      expectClean(pageProblems, `the homepage in ${lang.label}`);
    });
  }

  test('all seven languages render genuinely different copy', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/`);
    const snapshots = new Map();
    for (const lang of LANGUAGES) {
      await page.locator(`.lang-bar button[data-setlang="${lang.code}"]`).click();
      await expect(page.locator('html')).toHaveAttribute('lang', lang.code);
      const text = await page.locator('main, body').first().innerText();
      snapshots.set(lang.code, text);
    }
    const seen = new Map();
    for (const [code, text] of snapshots) {
      expect(text.length, `${code} rendered almost no text`).toBeGreaterThan(500);
      if (seen.has(text)) {
        throw new Error(`${code} renders exactly the same copy as ${seen.get(text)} - the switch did nothing`);
      }
      seen.set(text, code);
    }
  });

  test('switching back to German restores the original markup', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/`);
    await page.locator('.lang-bar button[data-setlang="de"]').click();
    const german = await renderedCopy(page);
    await page.locator('.lang-bar button[data-setlang="zh"]').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh');
    await page.locator('.lang-bar button[data-setlang="de"]').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    expect(await renderedCopy(page)).toEqual(german);
  });

  test('the chosen language survives a reload', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/`);
    await page.locator('.lang-bar button[data-setlang="it"]').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'it');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'it');
    await expect(page).toHaveTitle(I18N_META.it.title);
  });

  test('the header toggle flips between German and English only', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/`);
    const toggle = page.locator('#langToggle');
    const label = page.locator('#langLabel');

    // A fresh visitor gets English, so the toggle offers German.
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(label).toHaveText('DE');

    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(label).toHaveText('EN');

    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(label).toHaveText('DE');
  });
});

test.describe('every page of the site', () => {
  for (const page_ of TOP_LEVEL_PAGES) {
    test(`${page_} loads cleanly`, async ({ page, baseURL, pageProblems }) => {
      const response = await page.goto(`${baseURL}/${page_}`);
      expect(response.status(), `${page_} did not return 200`).toBe(200);
      await expect(page.locator('h1').first()).toBeVisible();
      const text = await page.locator('body').innerText();
      expect(text.length, `${page_} rendered almost nothing`).toBeGreaterThan(300);
      expectClean(pageProblems, page_);
    });
  }

  test('the legal pages link back to the homepage and to each other', async ({ page, baseURL }) => {
    for (const legal of ['imprint.html', 'privacy.html', 'terms.html']) {
      await page.goto(`${baseURL}/${legal}`);
      const targets = await page.locator('a[href]').evaluateAll((els) =>
        els.map((el) => el.getAttribute('href')));
      expect(targets, `${legal} does not link home`).toContain('index.html');
    }
  });

  test('every internal link on the homepage resolves to a real page', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/`);
    const hrefs = await page.locator('a[href]').evaluateAll((els) =>
      els.map((el) => el.getAttribute('href'))
        .filter((h) => h && !/^(https?:|mailto:|tel:|#)/.test(h)));
    expect(hrefs.length, 'the homepage has no internal links at all').toBeGreaterThan(3);
    for (const href of new Set(hrefs)) {
      const res = await page.request.get(new URL(href, `${baseURL}/`).toString());
      expect(res.status(), `${href} is a dead link`).toBe(200);
    }
  });

  test('a path that does not exist really is a 404', async ({ page, baseURL }) => {
    // Guards the static server itself: a server that silently serves
    // index.html for everything would make the dead-link check above useless.
    const res = await page.request.get(`${baseURL}/definitely-not-a-page.html`);
    expect(res.status()).toBe(404);
  });
});

test.describe('the call to action', () => {
  test('"Zur Live-Demo der App" opens the TriARge demo', async ({ page, baseURL, context }) => {
    await page.goto(`${baseURL}/`);
    await page.locator('.lang-bar button[data-setlang="de"]').click();

    const cta = page.getByRole('link', { name: /Zur Live-Demo der App/ });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', 'demo/');
    await expect(cta).toHaveAttribute('target', '_blank');
    await expect(cta).toHaveAttribute('rel', /noopener/);

    const [demo] = await Promise.all([context.waitForEvent('page'), cta.click()]);
    await demo.waitForLoadState('domcontentloaded');
    expect(demo.url()).toContain('/demo/');
    await expect(demo.locator('#app')).toBeVisible();
    await demo.close();
  });

  test('the hero and nav demo links point at the same demo', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/`);
    for (const selector of ['.nav-cta', '.hero .btn-primary', '.btn-outline']) {
      await expect(page.locator(selector).first()).toHaveAttribute('href', 'demo/');
    }
  });
});

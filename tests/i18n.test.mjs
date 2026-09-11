// Integrity of the seven hand-maintained language dictionaries.
//
// index.html swaps copy with `if (dict[key] != null) el.innerHTML = dict[key]`.
// A key missing from, say, `zh` therefore leaves that one node in German with
// no error anywhere - exactly the failure this file exists to catch.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { htmlFiles, readText, exists, LANGUAGES } from './lib/repo.mjs';
import { i18nKeys, i18nKeyOccurrences, i18nMarkupText, normalize, objectFromHtml } from './lib/html.mjs';

const INDEX = readText('index.html');

// The dictionaries as shipped. `de` is not in the literal: index.html builds it
// at runtime by harvesting the German innerHTML out of the markup.
const I18N = objectFromHtml(INDEX, 'I18N');
const I18N_META = objectFromHtml(INDEX, 'I18N_META');
const I18N_CONCEPT_IMAGES = objectFromHtml(INDEX, 'I18N_CONCEPT_IMAGES');

const MARKUP_KEYS = i18nKeys(INDEX);
const TRANSLATED_LANGS = LANGUAGES.filter((l) => l !== 'de');

describe('i18n dictionaries', () => {
  test('the language bar offers exactly the seven supported languages', () => {
    const offered = [...INDEX.matchAll(/data-setlang\s*=\s*"([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(offered, LANGUAGES, 'lang-bar buttons drifted from the supported language list');
  });

  test('German is the inline default and has no dictionary of its own', () => {
    assert.equal(I18N.de, undefined, 'a `de` dict in I18N would be dead code: apply() rebuilds it from markup');
  });

  test('every advertised language except German has a dictionary', () => {
    for (const lang of TRANSLATED_LANGS) {
      assert.ok(I18N[lang], `I18N is missing the "${lang}" dictionary`);
      assert.equal(typeof I18N[lang], 'object');
    }
  });

  test('the markup uses a non-trivial number of translated keys', () => {
    // Guards against a refactor that silently strips data-i18n attributes:
    // every assertion below would still pass on an empty key set.
    assert.ok(MARKUP_KEYS.length >= 50, `only ${MARKUP_KEYS.length} data-i18n keys found in index.html`);
  });

  for (const lang of TRANSLATED_LANGS) {
    test(`"${lang}" translates every key used in the markup`, () => {
      const missing = MARKUP_KEYS.filter((k) => I18N[lang][k] == null);
      assert.deepEqual(missing, [], `"${lang}" silently falls back to German for: ${missing.join(', ')}`);
    });

    test(`"${lang}" has no orphan translations`, () => {
      const known = new Set(MARKUP_KEYS);
      const orphans = Object.keys(I18N[lang]).filter((k) => !known.has(k)).sort();
      assert.deepEqual(orphans, [], `"${lang}" translates keys no element uses: ${orphans.join(', ')}`);
    });

    test(`"${lang}" has no empty or whitespace-only values`, () => {
      const blank = Object.entries(I18N[lang])
        .filter(([, v]) => typeof v !== 'string' || v.trim() === '')
        .map(([k]) => k);
      assert.deepEqual(blank, [], `"${lang}" has blank values for: ${blank.join(', ')}`);
    });
  }

  test('all six dictionaries have byte-identical key sets', () => {
    const reference = Object.keys(I18N.en).sort();
    for (const lang of TRANSLATED_LANGS) {
      assert.deepEqual(Object.keys(I18N[lang]).sort(), reference, `"${lang}" key set differs from "en"`);
    }
  });

  test('reused keys carry identical German source text', () => {
    // apply() writes one value to every node sharing a key. If two nodes with
    // the same key ship different German text, switching to German clobbers one.
    const byKey = i18nMarkupText(INDEX);
    const conflicts = [];
    for (const [key, texts] of byKey) {
      const distinct = new Set(texts.map(normalize));
      if (distinct.size > 1) conflicts.push(`${key}: ${[...distinct].map((t) => JSON.stringify(t)).join(' vs ')}`);
    }
    assert.deepEqual(conflicts, [], `reused data-i18n keys disagree on their German text:\n${conflicts.join('\n')}`);
  });

  test('markup keys and the reused-key map agree', () => {
    const occurrences = i18nKeyOccurrences(INDEX);
    assert.equal(i18nMarkupText(INDEX).size, MARKUP_KEYS.length, 'element scan and attribute scan disagree');
    assert.ok(occurrences.length >= MARKUP_KEYS.length);
  });

  test('translated HTML fragments keep their tags balanced', () => {
    // Values go in via innerHTML; a stray </strong> would corrupt the layout.
    const failures = [];
    for (const lang of TRANSLATED_LANGS) {
      for (const [key, value] of Object.entries(I18N[lang])) {
        const stack = [];
        for (const m of value.matchAll(/<(\/?)([a-zA-Z][\w-]*)\b[^>]*?(\/?)>/g)) {
          const [, closing, tag, selfClosing] = m;
          if (selfClosing || ['br', 'img', 'hr', 'input', 'meta', 'link'].includes(tag.toLowerCase())) continue;
          if (closing) {
            if (stack.pop() !== tag.toLowerCase()) failures.push(`${lang}.${key}: unexpected </${tag}>`);
          } else {
            stack.push(tag.toLowerCase());
          }
        }
        if (stack.length) failures.push(`${lang}.${key}: unclosed <${stack.join('>, <')}>`);
      }
    }
    assert.deepEqual(failures, [], failures.join('\n'));
  });

  test('every link inside a translation opens safely in a new tab', () => {
    const failures = [];
    for (const lang of TRANSLATED_LANGS) {
      for (const [key, value] of Object.entries(I18N[lang])) {
        for (const m of value.matchAll(/<a\b([^>]*)>/g)) {
          const attrs = m[1];
          if (!/href\s*=/.test(attrs)) failures.push(`${lang}.${key}: <a> without href`);
          if (/target\s*=\s*"_blank"/.test(attrs) && !/rel\s*=\s*"[^"]*noopener/.test(attrs)) {
            failures.push(`${lang}.${key}: target="_blank" without rel="noopener"`);
          }
        }
      }
    }
    assert.deepEqual(failures, [], failures.join('\n'));
  });
});

describe('i18n metadata', () => {
  test('every language has a page title and a meta description', () => {
    for (const lang of LANGUAGES) {
      const meta = I18N_META[lang];
      assert.ok(meta, `I18N_META is missing "${lang}"`);
      assert.ok(meta.title && meta.title.trim().length > 10, `"${lang}" title is too short`);
      assert.ok(meta.desc && meta.desc.trim().length > 40, `"${lang}" meta description is too short`);
    }
  });

  test('I18N_META covers exactly the supported languages', () => {
    assert.deepEqual(Object.keys(I18N_META).sort(), [...LANGUAGES].sort());
  });

  test('the page ships a meta description for apply() to overwrite', () => {
    assert.match(INDEX, /<meta\s+name="description"\s+content="[^"]{40,}"/);
  });

  test('the static <title> and description match the German metadata', () => {
    // The served document is German; I18N_META.de must restate it verbatim,
    // otherwise switching away from and back to German rewrites the page title.
    const title = /<title>([^<]*)<\/title>/.exec(INDEX)[1];
    const desc = /<meta\s+name="description"\s+content="([^"]*)"/.exec(INDEX)[1];
    assert.equal(title, I18N_META.de.title, 'static <title> drifted from I18N_META.de.title');
    assert.equal(desc, I18N_META.de.desc, 'static meta description drifted from I18N_META.de.desc');
  });

  test('the served document declares the language its markup is written in', () => {
    // Regression guard: index.html shipped lang="en" over German markup, a
    // WCAG 3.1.1 violation for every pre-JS render and every non-JS crawler.
    const lang = /<html[^>]*\slang\s*=\s*"([^"]+)"/.exec(INDEX)[1];
    assert.equal(lang, 'de', 'markup, <title> and meta description are German - <html lang> must say so');
  });

  test('every language has a localised concept image that exists on disk', () => {
    for (const lang of LANGUAGES) {
      const entry = I18N_CONCEPT_IMAGES[lang];
      assert.ok(entry, `I18N_CONCEPT_IMAGES is missing "${lang}"`);
      assert.ok(entry.src, `"${lang}" concept image has no src`);
      assert.equal(exists(entry.src), true, `concept image for "${lang}" does not exist: ${entry.src}`);
      assert.ok(entry.alt && entry.alt.trim().length > 20, `"${lang}" concept image alt text is too short`);
    }
  });

  test('I18N_CONCEPT_IMAGES covers exactly the supported languages', () => {
    assert.deepEqual(Object.keys(I18N_CONCEPT_IMAGES).sort(), [...LANGUAGES].sort());
  });

  test('each language gets its own concept image file', () => {
    const srcs = LANGUAGES.map((l) => I18N_CONCEPT_IMAGES[l].src);
    assert.equal(new Set(srcs).size, srcs.length, `duplicate concept images: ${srcs.join(', ')}`);
  });
});

describe('i18n coverage across every page of the site', () => {
  // The other pages are monolingual today. If somebody adds data-i18n to one of
  // them without shipping a dictionary, the attribute would be inert - catch it.
  const pagesWithKeys = htmlFiles().filter((f) => i18nKeys(readText(f)).length > 0);

  test('index.html is the only page using data-i18n', () => {
    assert.deepEqual(pagesWithKeys, ['index.html'],
      `these pages use data-i18n but have no dictionary: ${pagesWithKeys.filter((p) => p !== 'index.html').join(', ')}`);
  });

  for (const page of ['imprint.html', 'privacy.html', 'terms.html']) {
    test(`${page} declares a language and a title`, () => {
      const html = readText(page);
      assert.match(html, /<html[^>]*\slang\s*=\s*"[a-z]{2}"/, `${page} has no <html lang>`);
      assert.match(html, /<title>[^<]{5,}<\/title>/, `${page} has no usable <title>`);
    });
  }
});

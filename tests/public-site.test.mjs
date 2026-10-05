import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readText, exists, htmlFiles } from './lib/repo.mjs';
import { i18nKeys } from './lib/html.mjs';

export const PUBLIC_PAGES = ['index.html', 'krankenhaus.html', 'pflegedienst.html', 'katastrophenschutz.html', 'rettungsdienst.html', 'mitmachen.html', 'mitmachen-aufnahme.html', 'impressum.html', 'datenschutz.html', 'nutzungsbedingungen.html'];

test('every public page has parseable scripts and complete English translations', () => {
  for (const page of PUBLIC_PAGES) {
    const html = readText(page);
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
    for (const [, script] of scripts) new vm.Script(script, { filename: page });
    const dictionaryScript = scripts.find(([, s]) => s.startsWith('/* js/i18n.js */'))[1];
    const context = { window: {} };
    vm.runInNewContext(dictionaryScript, context);
    const dict = context.window.JAR_I18N.en;
    const missing = i18nKeys(html).filter(key => !dict[key]);
    assert.deepEqual(missing, [], `${page}: missing English copy`);
    assert.match(html, /<main\b/);
    assert.doesNotMatch(html, /(?:jar\.preview\.pw|Vorschau geschützt|type="password"|src="blob:)/);
  }
});

test('all former preview pages redirect publicly and preserve URL suffixes', () => {
  for (const page of PUBLIC_PAGES) {
    const html = readText(`website-preview/${page}`);
    const destination = page === 'index.html' ? '/' : `/${page}`;
    assert.ok(html.includes(`url=${destination}`));
    assert.ok(html.includes('location.search + location.hash'));
  }
});

test('no deployed HTML page requires the old preview password', () => {
  for (const page of htmlFiles()) {
    assert.doesNotMatch(readText(page), /(?:jar\.preview\.pw|Vorschau geschützt|PBKDF2)/, page);
  }
});

test('the archived homepage and its localized diagrams remain available', () => {
  assert.match(readText('website_old/index.html'), /id="conceptImage"/);
  for (const language of ['de', 'en', 'fr', 'es', 'it', 'pt', 'zh']) {
    assert.ok(exists(`website_old/jar-concept-${language}.png`));
  }
  assert.match(readText('website_old/index.html'), /href="\/demo\/"/);
});

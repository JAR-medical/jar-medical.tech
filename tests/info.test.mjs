import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readText } from './lib/repo.mjs';

// Run the shipped page script at its browser boundary. Country responses are
// controlled so locale, old defaults and a choice made mid-request can differ.
function openInfo({ locale = 'en-US', stored = {}, lookup } = {}) {
  const storage = new Map(Object.entries(stored));
  const makeNode = (extra = {}) => ({
    innerHTML: '', textContent: '', dataset: {},
    attributes: {}, listeners: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, listener) { this.listeners[name] = listener; },
    classList: { remove() {}, contains() { return false; } },
    ...extra,
  });
  const buttons = ['de', 'en'].map(language => makeNode({ dataset: { language } }));
  const title = makeNode({ innerHTML: 'Mehr Zeit am Menschen.', dataset: { copy: 'hero_title' } });
  const nodes = new Map([
    ['meta[name="description"]', makeNode({ content: 'Beschreibung' })],
    ['.languages', makeNode()], ['.example-tabs', makeNode()],
    ['.nav', makeNode()], ['.menu-toggle', makeNode()], ['.nav-links', makeNode()],
  ]);
  const document = {
    title: 'J.A.R. Medical', documentElement: { lang: 'de' },
    querySelector: selector => nodes.get(selector),
    querySelectorAll: selector => selector === '[data-language]' ? buttons : selector === '[data-copy]' ? [title] : [],
    getElementById: () => makeNode(), addEventListener() {},
  };
  const requests = [];
  const timers = new Map();
  vm.runInNewContext(readText('info/info.js'), {
    document, navigator: { language: locale },
    window: { matchMedia: () => ({ addEventListener() {} }) },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    AbortController,
    setTimeout: callback => { const id = timers.size + 1; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id),
    fetch: (url, options) => {
      requests.push(url);
      return lookup ? lookup(options) : Promise.resolve({ ok: true, text: async () => 'loc=DE\n' });
    },
  });
  return { document, storage, requests, timers, choose: language => buttons.find(b => b.dataset.language === language).listeners.click() };
}

const settled = () => new Promise(resolve => setImmediate(resolve));

test('a visitor in Germany gets German even with an English browser and an old automatic English default', async () => {
  const page = openInfo({ stored: { jarLang: 'en', 'jar.lang': 'en' } });
  await settled();
  assert.equal(page.document.documentElement.lang, 'de');
  assert.deepEqual(page.requests, ['/cdn-cgi/trace']);
  assert.equal(page.storage.has('jar.info.language'), false, 'an automatic default must not become a saved choice');
  assert.equal(page.timers.size, 0);
});

test('an explicit saved English choice wins over country and browser language', async () => {
  const page = openInfo({ locale: 'de-DE', stored: { 'jar.info.language': 'en' } });
  await settled();
  assert.equal(page.document.documentElement.lang, 'en');
  assert.equal(page.requests.length, 0);
});

test('a manual choice made during the country request is never overwritten', async () => {
  let respond;
  const page = openInfo({ lookup: () => new Promise(resolve => { respond = resolve; }) });
  page.choose('en');
  respond({ ok: true, text: async () => 'loc=DE\n' });
  await settled();
  assert.equal(page.document.documentElement.lang, 'en');
  assert.equal(page.storage.get('jar.info.language'), 'en');
  assert.equal(page.storage.get('jar.lang'), 'en');
});

test('outside Germany the browser language supplies the default', async () => {
  const page = openInfo({ lookup: async () => ({ ok: true, text: async () => 'loc=US\n' }) });
  await settled();
  assert.equal(page.document.documentElement.lang, 'en');
});

test('a failed country lookup leaves the browser-language fallback usable', async () => {
  const page = openInfo({ locale: 'de-DE', lookup: async () => { throw new Error('offline'); } });
  await settled();
  assert.equal(page.document.documentElement.lang, 'de');
  assert.equal(page.timers.size, 0);
});

test('a stalled country lookup times out without changing the fallback', async () => {
  const page = openInfo({ lookup: ({ signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')));
  }) });
  [...page.timers.values()].forEach(callback => callback());
  await settled();
  assert.equal(page.document.documentElement.lang, 'en');
  assert.equal(page.timers.size, 0);
});

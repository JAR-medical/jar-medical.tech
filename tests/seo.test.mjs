import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readText, exists, htmlFiles } from './lib/repo.mjs';

const BASE = 'https://jar-medical.tech';
const locs = [...readText('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
const fileFor = loc => {
  const path = loc.slice(BASE.length + 1);
  return !path ? 'index.html' : path.endsWith('/') ? `${path}index.html` : path;
};
const head = page => readText(page).split('</head>')[0];
const meta = (html, pattern) => (html.match(pattern) || [])[1];
const title = html => meta(html, /<title[^>]*>([^<]*)<\/title>/);
const description = html => meta(html, /<meta name="description" content="([^"]*)"/);

test('every sitemap URL is an indexable page that names itself as canonical', () => {
  assert.ok(locs.length >= 15);
  for (const loc of locs) {
    const page = fileFor(loc);
    assert.ok(exists(page), `${loc}: no file`);
    const html = head(page);
    assert.equal(meta(html, /<link rel="canonical" href="([^"]*)"/), loc);
    assert.doesNotMatch(html, /noindex/, page);
  }
});

// An instant meta refresh or location.replace is a redirect to Google: such a
// URL is never indexed, and listing it in the sitemap makes Search Console
// report "Page with redirect". The /demo/<lage>/ shortcuts are exactly that.
const redirects = html => /http-equiv="refresh"/i.test(html) || /location\.replace\(/.test(html);
const indexable = html => /<link rel="canonical"/.test(html) && !/noindex/.test(html) && !redirects(html);

test('no sitemap URL redirects', () => {
  for (const loc of locs) assert.ok(!redirects(head(fileFor(loc))), `${loc} redirects; drop it from sitemap.xml`);
});

test('every indexable page is in the sitemap', () => {
  const listed = new Set(locs.map(fileFor));
  const missing = htmlFiles().filter(page => indexable(head(page)) && !listed.has(page));
  assert.deepEqual(missing, [], 'add these to sitemap.xml (then run node tools/sitemap.mjs)');
});

test('every sitemap entry carries a real lastmod date', () => {
  const entries = [...readText('sitemap.xml').matchAll(/<url>([\s\S]*?)<\/url>/g)].map(m => m[1]);
  assert.equal(entries.length, locs.length);
  for (const entry of entries) {
    const date = (entry.match(/<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/) || [])[1];
    assert.ok(date && !Number.isNaN(Date.parse(date)) && Date.parse(date) <= Date.now(), entry);
  }
});

test('indexable pages have unique titles and descriptions of a usable length', () => {
  const titles = new Map();
  const descriptions = new Map();
  for (const page of locs.map(fileFor)) {
    const html = head(page);
    const t = title(html);
    const d = description(html);
    assert.ok(t && t.length <= 65, `${page}: title "${t}"`);
    assert.ok(d && d.length >= 70 && d.length <= 170, `${page}: description (${d?.length}) "${d}"`);
    assert.ok(!titles.has(t), `${page} repeats the title of ${titles.get(t)}`);
    assert.ok(!descriptions.has(d), `${page} repeats the description of ${descriptions.get(d)}`);
    titles.set(t, page);
    descriptions.set(d, page);
  }
});

test('indexable pages carry parseable structured data and a full social card', () => {
  for (const page of locs.map(fileFor)) {
    const html = head(page);
    const block = meta(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert.ok(block, `${page}: no JSON-LD`);
    const graph = JSON.parse(block)['@graph'];
    assert.ok(graph.some(node => node['@id'] === `${locFor(page)}#webpage`), `${page}: no WebPage node`);
    for (const tag of ['og:title', 'og:description', 'og:image', 'og:url']) assert.match(html, new RegExp(`property="${tag}"`), page);
    assert.match(html, /name="twitter:card"/, page);
  }
});

const locFor = page => locs.find(loc => fileFor(loc) === page);

test('content pages have exactly one h1', () => {
  for (const page of ['index.html', 'info/index.html', 'krankenhaus.html', 'pflegedienst.html', 'katastrophenschutz.html', 'rettungsdienst.html', 'mitmachen.html', 'mitmachen-aufnahme.html', 'presse.html']) {
    assert.equal(readText(page).match(/<h1[\s>]/g).length, 1, page);
  }
});

test('the home page keeps the main keyword in its h1', () => {
  const h1 = readText('index.html').match(/<h1[\s\S]*?<\/h1>/)[0];
  assert.match(h1, /Medizinische Spracherkennung/);
});

test('the FAQ markup and its structured data say the same thing', () => {
  const page = readText('info/index.html');
  const graph = JSON.parse(page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
  const faq = graph.find(node => node['@type'] === 'FAQPage');
  assert.ok(faq.mainEntity.length >= 5);
  for (const { name, acceptedAnswer } of faq.mainEntity) {
    assert.ok(page.includes(`>${name}</summary>`), name);
    assert.ok(page.includes(`>${acceptedAnswer.text}</p>`), name);
  }
});

test('heavy 3D data stays out of the page HTML', () => {
  for (const page of ['krankenhaus.html', 'pflegedienst.html', 'katastrophenschutz.html']) {
    assert.ok(readText(page).length < 400_000, page);
  }
  assert.ok(exists('assets/model/Pilot.glb'));
  assert.ok(exists('assets/model/assembly.js'));
});

test('robots.txt points to the sitemap and archived pages stay out of the index', () => {
  assert.match(readText('robots.txt'), new RegExp(`Sitemap: ${BASE}/sitemap.xml`));
  for (const page of ['website_old/index.html', 'website-preview/index.html', 'demo/DataSet/legal/impressum.html', '404.html']) {
    assert.match(head(page), /<meta name="robots" content="noindex">/, page);
  }
});

test('the home and info pages link the SZ report on J.A.R. itself', () => {
  for (const page of ['index.html', 'info/index.html']) {
    assert.match(readText(page), /href="https:\/\/www\.sueddeutsche\.de\/[^"]*bundeswettbewerb-li\.3570070[^"]*"/, page);
  }
});

test('the public pages link the J.A.R. LinkedIn company page', () => {
  for (const page of ['index.html', 'info/index.html', 'pflege/index.html', 'krankenhaus.html']) {
    assert.match(readText(page), /href="https:\/\/www\.linkedin\.com\/company\/jar-med\/"/, page);
  }
});

test('no page links to the unrelated company with a similar name', () => {
  for (const page of htmlFiles()) {
    assert.doesNotMatch(readText(page), /instagram\.com\/jarmedical|linkedin\.com\/company\/jar-?medical\b/, page);
  }
});

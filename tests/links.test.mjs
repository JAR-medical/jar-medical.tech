// Link integrity for the whole deployed surface.
//
// GitHub Pages serves this repo verbatim: a reference to a file that is not in
// the repo is a 404 in production with nothing to warn you first. That is
// exactly what happened when a directory was removed and a call-to-action
// button was left pointing at it, so every internal href/src is resolved here
// against the real filesystem.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { htmlFiles, readText, exists, isDirectory, TOP_LEVEL_PAGES, LANGUAGES } from './lib/repo.mjs';
import { references, isExternal, elementIds, objectFromHtml } from './lib/html.mjs';

const PAGES = htmlFiles();

/**
 * Resolve a reference the way a browser would, given the page it appears on.
 * Returns { kind, target, fragment } where kind is 'external' | 'fragment' | 'file'.
 */
export function resolveRef(pageRel, value) {
  const raw = value.trim();
  if (raw === '') return { kind: 'external', target: null, fragment: null };
  if (isExternal(raw)) return { kind: 'external', target: null, fragment: null };
  if (raw.startsWith('#')) return { kind: 'fragment', target: pageRel, fragment: raw.slice(1) };

  const hashAt = raw.indexOf('#');
  const fragment = hashAt === -1 ? null : raw.slice(hashAt + 1);
  let pathPart = hashAt === -1 ? raw : raw.slice(0, hashAt);
  pathPart = pathPart.split('?')[0];

  // "index.html?lage=halle" with no path left means "this directory".
  if (pathPart === '') return { kind: 'fragment', target: pageRel, fragment };

  let target;
  if (pathPart.startsWith('/')) {
    // Custom domain: the site root IS the repo root.
    target = pathPart.replace(/^\/+/, '');
  } else {
    target = path.posix.normalize(path.posix.join(path.posix.dirname(pageRel), pathPart));
  }
  if (target === '.' || target === '') target = 'index.html';
  return { kind: 'file', target, fragment };
}

/** A directory reference (".../" or a real directory) is served as its index.html. */
function servedFile(target) {
  if (target.endsWith('/')) return `${target}index.html`;
  if (isDirectory(target)) return `${target}/index.html`;
  return target;
}

describe('internal links resolve to files that exist', () => {
  for (const page of PAGES) {
    test(page, () => {
      const html = readText(page);
      const broken = [];
      for (const ref of references(html)) {
        const r = resolveRef(page, ref.value);
        if (r.kind !== 'file') continue;
        const file = servedFile(r.target);
        if (!exists(file)) {
          broken.push(`line ${ref.line}: ${ref.attr}="${ref.value}" -> ${file} (not in the repo)`);
        }
      }
      assert.deepEqual(broken, [], `${page} has dangling references:\n  ${broken.join('\n  ')}`);
    });
  }
});

describe('in-page anchors point at elements that exist', () => {
  const idsFor = new Map();
  const ids = (rel) => {
    if (!idsFor.has(rel)) idsFor.set(rel, exists(rel) ? elementIds(readText(rel)) : new Set());
    return idsFor.get(rel);
  };

  for (const page of PAGES) {
    test(page, () => {
      const html = readText(page);
      const broken = [];
      for (const ref of references(html)) {
        if (ref.attr !== 'href') continue;
        const r = resolveRef(page, ref.value);
        if (r.kind === 'external' || !r.fragment) continue;
        const targetFile = r.kind === 'fragment' ? page : servedFile(r.target);
        if (!exists(targetFile)) continue; // reported by the suite above
        if (!ids(targetFile).has(r.fragment)) {
          broken.push(`line ${ref.line}: href="${ref.value}" -> no id="${r.fragment}" in ${targetFile}`);
        }
      }
      assert.deepEqual(broken, [], `${page} has dead anchors:\n  ${broken.join('\n  ')}`);
    });
  }
});

describe('the site skeleton GitHub Pages needs', () => {
  test('CNAME pins the custom domain', () => {
    assert.equal(readText('CNAME').trim(), 'jar-medical.tech');
  });

  test('.nojekyll is present so underscore paths are served', () => {
    assert.equal(exists('.nojekyll'), true);
  });

  test('every top-level page is on disk', () => {
    for (const p of TOP_LEVEL_PAGES) assert.equal(exists(p), true, `${p} is missing`);
  });

  test('the live demo has an entry point', () => {
    assert.equal(exists('demo/index.html'), true);
  });

  test('every directory reachable from a link has an index.html', () => {
    const missing = [];
    for (const page of PAGES) {
      for (const ref of references(readText(page))) {
        const r = resolveRef(page, ref.value);
        if (r.kind !== 'file') continue;
        if (!r.target.endsWith('/') && !isDirectory(r.target)) continue;
        const idx = servedFile(r.target);
        if (!exists(idx)) missing.push(`${page}: ${ref.value} -> ${idx}`);
      }
    }
    assert.deepEqual(missing, [], `directory links without an index.html:\n  ${missing.join('\n  ')}`);
  });
});

describe('references hidden inside JavaScript', () => {
  const INDEX = readText('index.html');

  test('every localised concept image referenced by the switcher exists', () => {
    const images = objectFromHtml(INDEX, 'I18N_CONCEPT_IMAGES');
    const missing = LANGUAGES
      .map((lang) => images[lang] && images[lang].src)
      .filter((src) => !src || !exists(src));
    assert.deepEqual(missing, [], `concept images missing from the repo: ${missing.join(', ')}`);
  });

  test('every script and stylesheet the demo loads exists', () => {
    const html = readText('demo/index.html');
    const assets = references(html)
      .filter((r) => !isExternal(r.value) && /\.(js|css)(\?|$)/.test(r.value))
      .map((r) => resolveRef('demo/index.html', r.value).target);
    assert.ok(assets.length >= 10, `expected the demo to load its full asset set, saw ${assets.length}`);
    const missing = assets.filter((a) => !exists(a));
    assert.deepEqual(missing, [], `demo assets missing: ${missing.join(', ')}`);
  });

  test('the scenario redirect pages all point back at the demo', () => {
    for (const lage of ['halle', 'muenchen', 'neubiberg']) {
      const rel = `demo/${lage}/index.html`;
      assert.equal(exists(rel), true, `${rel} is missing`);
      const html = readText(rel);
      assert.match(html, new RegExp(`\\?lage=${lage}`), `${rel} does not select the "${lage}" scenario`);
      // Both the no-JS meta refresh and the JS redirect must be present.
      assert.match(html, /http-equiv\s*=\s*"refresh"/, `${rel} has no no-JS fallback`);
      assert.match(html, /location\.replace\(/, `${rel} has no JS redirect`);
    }
  });
});

describe('removed features leave nothing behind', () => {
  // The Oculus app and its call-to-action were deliberately deleted from this
  // repo. A stale reference would render a button leading to a 404.
  test('no page references the removed oculusapp directory', () => {
    const offenders = PAGES.filter((p) => /oculusapp/i.test(readText(p)));
    assert.deepEqual(offenders, [], `oculusapp references resurfaced in: ${offenders.join(', ')}`);
  });

  test('no translation references the removed AR call-to-action', () => {
    const I18N = objectFromHtml(readText('index.html'), 'I18N');
    const offenders = Object.entries(I18N)
      .filter(([, dict]) => Object.keys(dict).some((k) => k.startsWith('cta_btn_ar')))
      .map(([lang]) => lang);
    assert.deepEqual(offenders, [], `stale cta_btn_ar translations in: ${offenders.join(', ')}`);
  });

  test('the oculusapp directory really is gone', () => {
    assert.equal(exists('oculusapp'), false);
  });
});

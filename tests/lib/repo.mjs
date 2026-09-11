// Repo-relative file access for the test suite.
// Everything is resolved from this file's own location, so the suite is
// independent of the checkout path and of the caller's working directory.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Absolute path for a repo-relative path. */
export function abs(rel) {
  return path.join(ROOT, rel);
}

/** Read a repo-relative file as UTF-8 text. Throws loudly if it is missing. */
export function readText(rel) {
  const p = abs(rel);
  if (!fs.existsSync(p)) throw new Error(`missing file: ${rel} (looked in ${ROOT})`);
  return fs.readFileSync(p, 'utf8');
}

export function exists(rel) {
  return fs.existsSync(abs(rel));
}

export function isDirectory(rel) {
  const p = abs(rel);
  return fs.existsSync(p) && fs.statSync(p).isDirectory();
}

const IGNORED_DIRS = new Set(['.git', 'node_modules', 'test-results', 'playwright-report', 'tests']);

/**
 * Every file under the repo matching `filter`, as repo-relative POSIX paths, sorted.
 * Skips VCS, tooling and test directories so the deployed surface is what gets checked.
 */
export function walk(filter = () => true, startRel = '.') {
  const out = [];
  const stack = [startRel === '.' ? '' : startRel];
  while (stack.length) {
    const relDir = stack.pop();
    const entries = fs.readdirSync(abs(relDir) || ROOT, { withFileTypes: true });
    for (const e of entries) {
      const rel = relDir ? `${relDir}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (IGNORED_DIRS.has(e.name)) continue;
        stack.push(rel);
      } else if (e.isFile() && filter(rel)) {
        out.push(rel);
      }
    }
  }
  return out.sort();
}

/** All .html files that GitHub Pages actually serves. */
export function htmlFiles() {
  return walk((rel) => rel.endsWith('.html'));
}

/** The four top-level pages of the public site. */
export const TOP_LEVEL_PAGES = ['index.html', 'imprint.html', 'privacy.html', 'terms.html'];

/** The seven languages the site offers in its language bar. */
export const LANGUAGES = ['de', 'en', 'fr', 'es', 'it', 'pt', 'zh'];

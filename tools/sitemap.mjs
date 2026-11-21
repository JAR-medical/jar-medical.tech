#!/usr/bin/env node
// Sets every <lastmod> in sitemap.xml to the date of the last commit that
// touched the page's file, so Google can trust the dates.
//
//   node tools/sitemap.mjs           rewrite sitemap.xml in place
//   node tools/sitemap.mjs --check   exit 1 if any date is stale (changes nothing)
//
// Run it after committing page changes, then commit sitemap.xml. It needs the
// full git history (a shallow clone would date every page to the clone's tip),
// which is why CI does not run it; tests/seo.test.mjs checks the rest.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://jar-medical.tech';
const SITEMAP = join(ROOT, 'sitemap.xml');
const check = process.argv.includes('--check');

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

if (git('rev-parse', '--is-shallow-repository') === 'true') {
  console.error('sitemap: shallow clone, commit dates would be wrong. Run `git fetch --unshallow` first.');
  process.exit(2);
}

const fileFor = (loc) => {
  const path = loc.slice(BASE.length + 1);
  return !path ? 'index.html' : path.endsWith('/') ? `${path}index.html` : path;
};

const xml = readFileSync(SITEMAP, 'utf8');
const stale = [];
const updated = xml.replace(
  /<url><loc>([^<]+)<\/loc><lastmod>([^<]*)<\/lastmod><\/url>/g,
  (entry, loc, current) => {
    const file = fileFor(loc);
    if (!existsSync(join(ROOT, file))) {
      console.error(`sitemap: ${loc} has no file ${file}`);
      process.exit(1);
    }
    const date = git('log', '-1', '--format=%cs', '--', file);
    if (!date) {
      console.error(`sitemap: ${file} is not committed yet; commit it, then run this again.`);
      process.exit(1);
    }
    if (date === current) return entry;
    stale.push(`${loc}: ${current} -> ${date}`);
    return `<url><loc>${loc}</loc><lastmod>${date}</lastmod></url>`;
  },
);

if (!stale.length) {
  console.log('sitemap: all dates current');
} else if (check) {
  console.error(`sitemap: ${stale.length} stale date(s):\n  ${stale.join('\n  ')}`);
  process.exit(1);
} else {
  writeFileSync(SITEMAP, updated);
  console.log(`sitemap: updated ${stale.length} date(s):\n  ${stale.join('\n  ')}`);
}

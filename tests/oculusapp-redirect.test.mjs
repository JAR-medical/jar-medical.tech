// The AR client lived at /oculusapp/ until 2026-09-10 and could be installed from there as an app.
// That address must keep forwarding to /holo-lens/, and its service worker must retire the old one
// without touching the caches of the current client (same origin, same "jar-ar-" prefix).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readText, exists } from './lib/repo.mjs';

test('/oculusapp/ forwards to /holo-lens/, keeps the query and stays out of the index', () => {
  const html = readText('oculusapp/index.html');
  const head = html.split('</head>')[0];
  assert.match(head, /<meta name="robots" content="noindex">/);
  assert.match(head, /<meta http-equiv="refresh" content="0; url=\/holo-lens\/">/);
  assert.match(head, /"\/holo-lens\/" \+ location\.search \+ location\.hash/);
  assert.ok(exists('holo-lens/index.html'), 'the target exists');
});

test('the old service worker is replaced by one that unregisters and clears only the old cache', () => {
  const sw = readText('oculusapp/sw.js');
  assert.match(sw, /const OLD_CACHE = "jar-ar-v1-shell";/);
  assert.match(sw, /caches\.delete\(OLD_CACHE\)/);
  assert.match(sw, /self\.registration\.unregister\(\)/);
  assert.doesNotMatch(sw, /caches\.keys\(\)/, 'must not sweep every cache of the origin');
  assert.doesNotMatch(sw, /addEventListener\("fetch"/, 'must not intercept requests');
  const current = readText('holo-lens/sw.js').match(/const VERSION = "([^"]+)"/)[1];
  assert.notEqual(`${current}-shell`, 'jar-ar-v1-shell', 'the current client must not use the retired cache name');
});

// The RP-XR demo course and its simulator share one access code
// (corporate/js/passcode.js). The code itself is never in the repository, so
// these tests check the wiring and the PBKDF2 check with a throwaway code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import { readText } from './lib/repo.mjs';
import { RP_XR_PASSCODE, tryUnlock, retryDelayMs } from '../corporate/js/passcode.js';
import course from '../corporate/js/courses/demo-rp-simulation.js';

test('the RP-XR course requires the shared access code', () => {
  assert.equal(course.passcode, RP_XR_PASSCODE);
  assert.match(RP_XR_PASSCODE.salt, /^[0-9a-f]{32}$/);
  assert.match(RP_XR_PASSCODE.hash, /^[0-9a-f]{64}$/);
  assert.ok(RP_XR_PASSCODE.iterations >= 100000);
});

test('the simulator only starts its app through the gate', () => {
  const html = readText('demo/rp-xr/index.html');
  assert.doesNotMatch(html, /<script[^>]+src="js\/main\.js"/);
  assert.match(html, /<html lang="en" class="gate-locked">/);
  assert.match(html, /<script type="module" src="gate\.js"><\/script>/);
  const gate = readText('demo/rp-xr/gate.js');
  assert.match(gate, /from "\.\.\/\.\.\/corporate\/js\/passcode\.js"/);
  assert.match(gate, /import\("\.\/js\/main\.js"\)/);
});

test('tryUnlock accepts exactly the code behind the hash', async () => {
  const salt = '00112233445566778899aabbccddeeff';
  const pc = { storeKey: 'test', salt, iterations: 1000, rememberDays: 1,
    hash: pbkdf2Sync('right-code', Buffer.from(salt, 'hex'), 1000, 32, 'sha256').toString('hex') };
  assert.equal(await tryUnlock(pc, 'right-code'), true);
  assert.equal(await tryUnlock(pc, '  right-code  '), true);
  assert.equal(await tryUnlock(pc, 'wrong-code'), false);
  assert.equal(await tryUnlock(pc, ''), false);
});

test('wrong codes back off up to 8 seconds', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 9].map(retryDelayMs), [1000, 2000, 4000, 8000, 8000, 8000]);
});

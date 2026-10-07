// Test the recorder actually shipped on mitmachen-aufnahme.html. The inlined
// script runs in a sandbox with a fake microphone and a fake API: no device,
// no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { readText } from './lib/repo.mjs';

const source = readText('mitmachen-aufnahme.html');
const recorder = source.match(/<script>\/\* js\/record\.js \*\/([\s\S]*?)<\/script>/)[1];
const api = source.match(/data-api="([^"]+)"/)[1];

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
async function settle() { for (let i = 0; i < 20; i++) await tick(); }

function harness({ consented = false, clipState = 'basic_accepted', failUploads = 0 } = {}) {
  class Element {
    hidden = false; disabled = false; checked = false; textContent = ''; href = '';
    attrs = {}; handlers = {}; children = []; style = {};
    classList = { add() {}, remove() {} };
    addEventListener(name, fn) { this.handlers[name] = fn; }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    getAttribute(name) { return name in this.attrs ? this.attrs[name] : null; }
    removeAttribute(name) { delete this.attrs[name]; }
    appendChild(child) { this.children.push(child); }
    focus() { this.focused = true; }
    fire(name = 'click') { return this.handlers[name]?.(); }
  }
  const nodes = new Map();
  const root = new Element();
  root.attrs = { 'data-state': 'idle', 'data-api': api };
  root.querySelector = (sel) => { if (!nodes.has(sel)) nodes.set(sel, new Element()); return nodes.get(sel); };
  const el = (name) => root.querySelector(`[data-rec-${name}]`);
  el('consent').checked = consented;

  const state = { requests: [], mediaCalls: 0, tracksStopped: 0, processors: [], failUploads };
  class AudioContext {
    sampleRate = 48000; state = 'running'; destination = {};
    resume() { return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createScriptProcessor() { const node = { connect() {}, disconnect() {}, onaudioprocess: null }; state.processors.push(node); return node; }
    createGain() { return { gain: {}, connect() {}, disconnect() {} }; }
  }
  const storage = new Map();
  const sandbox = {
    document: {
      documentElement: { lang: 'de' },
      querySelector: (sel) => (sel === '[data-rec]' ? root : null),
      addEventListener() {},
      createElement: () => new Element(),
      createTextNode: (text) => ({ text }),
    },
    navigator: { mediaDevices: { async getUserMedia() {
      state.mediaCalls++;
      return { getTracks: () => [{ stop: () => state.tracksStopped++, addEventListener() {} }] };
    } } },
    sessionStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
    crypto: webcrypto, TextEncoder, Blob, Float32Array, Uint8Array, Uint32Array, ArrayBuffer, DataView,
    JSON, Math, Date, Promise, Error, String, Array, encodeURIComponent,
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
    setInterval: () => 1, clearInterval() {}, setTimeout, clearTimeout,
    async fetch(url, options) {
      state.requests.push({ url, ...options });
      let status = 200, body;
      if (url.endsWith('/api/contribution-sessions')) {
        body = { ok: true, contributor_token: 'ctr_test.token', session_id: 'ses_test', recovery_code: 'AAA-BBB' };
      } else if (state.failUploads > 0) {
        state.failUploads--; status = 503; body = { detail: 'outage' };
      } else {
        status = 202; body = { ok: true, clip_id: 'clp_test', validation_state: clipState };
      }
      return { ok: status < 400, status, json: async () => body };
    },
  };
  sandbox.window = { AudioContext, isSecureContext: true, crypto: webcrypto, JAR_I18N: {} };
  vm.runInNewContext(recorder, sandbox);

  // Feed `seconds` of a 220 Hz tone at 48 kHz through the live processor.
  function speak(seconds) {
    const node = state.processors.at(-1);
    const total = Math.round(48000 * seconds);
    for (let done = 0; done < total; done += 4096) {
      const data = new Float32Array(Math.min(4096, total - done));
      for (let i = 0; i < data.length; i++) data[i] = 0.3 * Math.sin(2 * Math.PI * 220 * (done + i) / 48000);
      node.onaudioprocess({ inputBuffer: { getChannelData: () => data } });
    }
  }
  return { root, el, state, storage, speak, click: () => el('btn').fire('click') };
}

// Minimal RIFF reader: chunk ids in order, INFO fields, and the fmt header.
async function parseWav(blob) {
  const buf = Buffer.from(await blob.arrayBuffer());
  assert.equal(buf.toString('ascii', 0, 4), 'RIFF');
  assert.equal(buf.readUInt32LE(4), buf.length - 8);
  assert.equal(buf.toString('ascii', 8, 12), 'WAVE');
  const chunks = [], info = {};
  let fmt = null, dataBytes = 0;
  for (let o = 12; o < buf.length;) {
    const id = buf.toString('ascii', o, o + 4), size = buf.readUInt32LE(o + 4), body = o + 8;
    chunks.push(id);
    if (id === 'fmt ') fmt = { format: buf.readUInt16LE(body), channels: buf.readUInt16LE(body + 2), rate: buf.readUInt32LE(body + 4), bits: buf.readUInt16LE(body + 14) };
    if (id === 'data') dataBytes = size;
    if (id === 'LIST') {
      assert.equal(buf.toString('ascii', body, body + 4), 'INFO');
      for (let p = body + 4; p < body + size;) {
        const key = buf.toString('ascii', p, p + 4), len = buf.readUInt32LE(p + 4);
        info[key] = buf.toString('latin1', p + 8, p + 8 + len).replace(/\0+$/, '');
        p += 8 + len + (len & 1);
      }
    }
    o = body + size + (size & 1);
  }
  return { chunks, info, fmt, dataBytes };
}

const uploads = (h) => h.state.requests.filter((r) => r.url.endsWith('/api/clips'));

test('nothing is requested and the microphone stays closed without consent', async () => {
  const h = harness();
  h.click(); await settle();
  assert.equal(h.state.mediaCalls, 0);
  assert.equal(h.state.requests.length, 0);
  assert.equal(h.root.getAttribute('data-state'), 'idle');
  assert.equal(h.el('consent').focused, true);
});

test('a random passage is shown before recording, with numbers spelled out', () => {
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    const h = harness();
    const text = h.el('text').textContent;
    assert.match(text, /^„.+“$/);
    assert.doesNotMatch(text, /\d/, 'digits would not match what is actually said');
    assert.ok(h.el('tag').textContent);
    seen.add(text);
  }
  assert.ok(seen.size > 10, `only ${seen.size} distinct passages in 40 page loads`);
});

test('"another text" does not repeat the template just shown', () => {
  const h = harness();
  const templates = [];
  for (let i = 0; i < 6; i++) {
    templates.push(h.storage.get('jar.rec.recent').split(',').at(-1));
    h.el('shuffle').fire('click');
  }
  assert.equal(new Set(templates).size, templates.length);
});

test('a take is uploaded as 16 kHz mono PCM16 with the read text in its metadata', async () => {
  const h = harness({ consented: true });
  const shown = h.el('text').textContent.slice(1, -1);
  h.click(); await settle();
  assert.equal(h.root.getAttribute('data-state'), 'recording');
  h.speak(2.5);
  h.click(); await settle();

  const [session] = h.state.requests;
  assert.equal(session.url, `${api}/api/contribution-sessions`);
  assert.equal(session.credentials, 'omit');
  const consent = JSON.parse(session.body);
  assert.equal(consent.consent_version, '2026-08-25-v3');
  assert.equal(consent.age_band, '16+');

  const [clip] = uploads(h);
  assert.equal(clip.credentials, 'omit');
  assert.equal(clip.headers['X-Medicraft-Contributor-Token'], 'ctr_test.token');
  assert.equal(clip.headers['X-Medicraft-Session-Id'], 'ses_test');
  assert.equal(clip.headers['X-Medicraft-Task-Type'], 'read_aloud');
  assert.equal(decodeURIComponent(clip.headers['X-Medicraft-Expected-Text']), shown);
  assert.match(clip.headers['X-Medicraft-Prompt-Id'], /^web-[a-z-]+-v\d+$/);
  assert.ok(clip.headers['Idempotency-Key']);

  const wav = await parseWav(clip.body);
  assert.deepEqual(wav.chunks, ['fmt ', 'LIST', 'data'], 'INFO must precede data so streaming readers see it');
  assert.deepEqual(wav.fmt, { format: 1, channels: 1, rate: 16000, bits: 16 });
  assert.ok(Math.abs(wav.dataBytes / 2 / 16000 - 2.5) < 0.3);
  assert.equal(wav.info.INAM, shown);
  assert.equal(wav.info.ISRC, clip.headers['X-Medicraft-Prompt-Id']);
  assert.match(wav.info.ICMT, /^[\x20-\x7e]+$/, 'ICMT JSON stays plain ASCII');
  const meta = JSON.parse(wav.info.ICMT);
  assert.equal(meta.text, shown);
  assert.equal(meta.prompt_id, clip.headers['X-Medicraft-Prompt-Id']);
  assert.equal(meta.language, 'de-DE');
  assert.equal(meta.sample_rate, 16000);
  assert.ok(meta.template && meta.slots && meta.recorded_at && meta.consent);
  assert.equal(h.state.tracksStopped, 1, 'the microphone is released after the take');

  // Accepted: a new passage, a counter, and the deletion code.
  assert.equal(h.root.getAttribute('data-state'), 'idle');
  assert.notEqual(h.el('text').textContent.slice(1, -1), shown);
  assert.equal(h.el('code').hidden, false);
  assert.equal(h.el('status').getAttribute('data-kind'), 'ok');
});

test('the second take reuses the session', async () => {
  const h = harness({ consented: true });
  for (let i = 0; i < 2; i++) { h.click(); await settle(); h.speak(1.5); h.click(); await settle(); }
  assert.equal(h.state.requests.filter((r) => r.url.endsWith('/contribution-sessions')).length, 1);
  assert.equal(uploads(h).length, 2);
});

test('a take shorter than a second is discarded locally', async () => {
  const h = harness({ consented: true });
  h.click(); await settle(); h.speak(0.4); h.click(); await settle();
  assert.equal(h.state.requests.length, 0);
  assert.equal(h.el('status').getAttribute('data-kind'), 'warn');
});

test('a rejected take keeps the same passage for another try', async () => {
  const h = harness({ consented: true, clipState: 'rejected' });
  const shown = h.el('text').textContent;
  h.click(); await settle(); h.speak(1.5); h.click(); await settle();
  assert.equal(h.el('text').textContent, shown);
  assert.equal(h.el('status').getAttribute('data-kind'), 'warn');
});

test('a failed upload keeps the take for retry or download, with the same idempotency key', async () => {
  const h = harness({ consented: true, failUploads: 1 });
  h.click(); await settle(); h.speak(1.5); h.click(); await settle();
  assert.equal(h.root.getAttribute('data-state'), 'failed');
  assert.equal(h.el('fail').hidden, false);
  assert.match(h.el('download').getAttribute('download'), /^web-.+\.wav$/);
  h.el('retry').fire('click'); await settle();
  const [first, second] = uploads(h);
  assert.equal(first.headers['Idempotency-Key'], second.headers['Idempotency-Key']);
  assert.equal(h.root.getAttribute('data-state'), 'idle');
});

test('the privacy page describes the recorder actually used', () => {
  const privacy = readText('datenschutz.html');
  assert.match(privacy, /id="ds-aufnahme"/);
  assert.match(privacy, /tailscale\.com\/privacy-policy/);
  assert.doesNotMatch(privacy.replace(/<script>[\s\S]*?<\/script>/g, ''), /speakpipe/i);
  assert.doesNotMatch(source, /speakpipe/i);
});

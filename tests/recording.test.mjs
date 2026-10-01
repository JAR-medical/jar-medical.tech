import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { decryptPreview, encryptPreview } from '../tools/preview-crypt.mjs';

const wrapper = fs.readFileSync(new URL('../website-preview/mitmachen-aufnahme.html', import.meta.url), 'utf8');
const password = process.env.JAR_PREVIEW_PASSWORD;
const source = password ? decryptPreview(wrapper, password) : '';
const skip = !password && 'Set JAR_PREVIEW_PASSWORD privately to test encrypted payload';
const recorder = source.match(/<script>\/\* js\/contribute.js \*\/([\s\S]*?)<\/script>/)?.[1];

// Exercise the real inlined controller without a device, browser or network.
function harness({ storage = new Map(), mediaError, deferredMedia, deferredClip, failClip = false } = {}) {
  class Element {
    checked = false; hidden = false; disabled = false; textContent = ''; src = '';
    handlers = {}; attributes = {};
    addEventListener(name, handler) { this.handlers[name] = handler; }
    setAttribute(name, value) { this.attributes[name] = value; }
    removeAttribute(name) { delete this.attributes[name]; if (name === 'src') this.src = ''; }
    getAttribute(name) { return this.attributes[name]; }
    focus() {} scrollIntoView() {} pause() {} load() {}
    async fire(name = 'click') { return this.handlers[name]?.(); }
  }
  const nodes = new Map();
  const q = selector => {
    if (!nodes.has(selector)) nodes.set(selector, new Element());
    return nodes.get(selector);
  };
  const root = { querySelector: q, closest: () => ({ querySelectorAll: () => [] }) };
  for (const selector of ['[data-recording-stage]', '[data-recording-review]', '[data-recording-receipt]', '[data-recovery-note]', '[data-record-next]']) {
    q(selector).hidden = true;
  }
  const doc = { documentElement: { lang: 'de' }, hidden: false, handlers: {},
    querySelector: () => root, addEventListener(name, fn) { this.handlers[name] = fn; } };
  const state = { requests: [], mediaCalls: 0, stopped: 0, timers: new Map(), failClip };
  const track = { stop: () => state.stopped++ };
  class AudioContext {
    sampleRate = 48000; state = 'running';
    async resume() {} async close() { this.state = 'closed'; }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createScriptProcessor() {
      state.processor = { connect() {}, disconnect() {}, onaudioprocess: null };
      return state.processor;
    }
    createGain() { return { gain: {}, connect() {}, disconnect() {} }; }
  }
  const sandbox = {
    document: doc, navigator: { language: 'de-DE', mediaDevices: {
      async getUserMedia() {
        state.mediaCalls++;
        if (mediaError) throw Object.assign(new Error('denied'), { name: mediaError });
        if (deferredMedia) await deferredMedia;
        return { getTracks: () => [track] };
      }
    } },
    crypto: webcrypto, sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    MutationObserver: class { observe() {} }, Blob, URL, AbortController,
    Float32Array, Uint32Array, ArrayBuffer, DataView, Map, Date, console,
    setInterval(fn) { const id = state.timers.size + 1; state.timers.set(id, fn); return id; },
    clearInterval(id) { state.timers.delete(id); }, setTimeout, clearTimeout,
    async fetch(url, options) {
      state.requests.push({ url, ...options });
      let result;
      let status = 200;
      if (url.endsWith('/api/contribution-sessions')) {
        result = { ok: true, contributor_token: 'test-token', session_id: 'test-session', recovery_code: 'test-recovery' };
      } else if (url.endsWith('/api/contribution-events')) result = { ok: true };
      else {
        if (deferredClip) await deferredClip;
        if (state.failClip) { state.failClip = false; status = 503; result = { detail: 'test outage' }; }
        else result = { ok: true, clip_id: 'test-clip', validation_state: 'basic_accepted' };
      }
      return { ok: status < 400, json: async () => result };
    }
  };
  sandbox.window = { AudioContext, isSecureContext: true, addEventListener() {} };
  vm.runInNewContext(recorder, sandbox);
  async function agree() {
    q('#recording-consent').checked = q('#recording-age').checked = true;
    await q('#recording-age').fire('change');
    await q('[data-consent-continue]').fire();
  }
  async function record() {
    await q('[data-record-toggle]').fire();
    // Start's event handler deliberately does not await the async permission.
    await new Promise(resolve => setImmediate(resolve));
    const values = new Float32Array(48000).fill(0.1);
    state.processor.onaudioprocess({ inputBuffer: { getChannelData: () => values } });
    await q('[data-record-toggle]').fire();
    await new Promise(resolve => setImmediate(resolve));
  }
  return { q, state, agree, record, doc, storage };
}

test('encryption round-trip preserves wrapper and authenticates payload', () => {
  const encrypted = encryptPreview(wrapper, '<p>private test</p>', 'temporary-test-password');
  assert.equal(decryptPreview(encrypted, 'temporary-test-password'), '<p>private test</p>');
  assert.throws(() => decryptPreview(encrypted, 'wrong-password'));
  assert.ok(!encrypted.includes('private test'));
  assert.ok(!encrypted.includes('temporary-test-password'));
});

test('recording controller and every inline script parse', { skip }, () => {
  for (const match of source.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
  assert.ok(!source.includes('data-speakpipe-widget'));
  assert.ok(source.includes('[data-recorder] [hidden]'));
});

test('both confirmations gate recording, with no backend contact', { skip }, async () => {
  const h = harness();
  assert.equal(h.q('[data-consent-continue]').disabled, true);
  await h.q('[data-record-toggle]').fire();
  assert.equal(h.state.mediaCalls, 0);
  h.q('#recording-consent').checked = true;
  await h.q('#recording-consent').fire('change');
  assert.equal(h.q('[data-consent-continue]').disabled, true);
  await h.agree();
  assert.equal(h.q('[data-recording-stage]').hidden, false);
  assert.equal(h.q('[data-record-toggle]').disabled, false);
  assert.equal(h.state.requests.length, 0);
});

test('stopping automatically uploads WAV with exact prompt and consent audit', { skip }, async () => {
  const h = harness();
  await h.agree();
  assert.equal(h.state.requests.length, 0);
  await h.record();
  assert.equal(h.state.stopped, 1);
  assert.equal(h.q('[data-recording-review]').hidden, false);
  assert.equal(h.state.requests.length, 3);
  const [session, event, clip] = h.state.requests;
  assert.equal(JSON.parse(session.body).age_band, '16+');
  assert.equal(JSON.parse(session.body).mode, 'website_read_aloud');
  assert.equal(JSON.parse(session.body).medic_context, false);
  const audit = JSON.parse(event.body);
  assert.equal(audit.event_name, 'prompt_shown'); // accepted by existing API
  assert.equal(audit.payload.audio_consent, true);
  assert.equal(audit.payload.age_confirmed_16_plus, true);
  assert.equal(audit.payload.automatic_upload_consent, true);
  assert.equal(audit.payload.medic_context, false);
  assert.ok(audit.payload.accepted_at);
  assert.equal(clip.headers['x-medicraft-prompt-id'], h.q('[data-prompt-id]').textContent);
  assert.equal(decodeURIComponent(clip.headers['x-medicraft-expected-text']), h.q('[data-prompt-text]').textContent);
  assert.equal(audit.payload.prompt_id, clip.headers['x-medicraft-prompt-id']);
  assert.equal(clip.credentials, 'omit');
  assert.equal(clip.headers['x-medicraft-contributor-token'], 'test-token');
  const wav = Buffer.from(await clip.body.arrayBuffer());
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.readUInt32LE(24), 16000);
  assert.equal(wav.readUInt16LE(22), 1);
  assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.length, 44 + 16000 * 2);
  assert.equal(h.q('[data-recording-receipt]').hidden, false);
  assert.equal(h.q('[data-recovery-code]').textContent, 'test-recovery');
  assert.equal(h.q('[data-record-send]').disabled, true);
  assert.equal(h.q('[data-record-next]').hidden, false);
  assert.equal(h.q('[data-record-next]').disabled, false);
});

test('an outage retains playback, recovery code and idempotency on retry', { skip }, async () => {
  const h = harness({ failClip: true });
  await h.agree(); await h.record();
  assert.equal(h.q('[data-recording-receipt]').hidden, true);
  assert.equal(h.q('[data-recording-review]').hidden, false);
  assert.equal(h.q('[data-recovery-note]').hidden, false);
  assert.equal(h.q('[data-record-send]').disabled, false);
  assert.equal(h.q('[data-record-next]').hidden, true);
  await h.q('[data-record-send]').fire();
  assert.equal(h.state.requests.length, 4);
  assert.equal(h.state.requests[2].headers['idempotency-key'], h.state.requests[3].headers['idempotency-key']);
  assert.equal(h.q('[data-recording-receipt]').hidden, false);
});

test('microphone refusal leaves the recorder retryable', { skip }, async () => {
  const h = harness({ mediaError: 'NotAllowedError' });
  await h.agree(); await h.q('[data-record-toggle]').fire();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.q('[data-record-toggle]').disabled, false);
  assert.match(h.q('[data-record-status]').textContent, /Mikrofonzugriff/);
  assert.equal(h.state.requests.length, 0);
});

test('revoking a checkbox cancels an outstanding permission request', { skip }, async () => {
  let resolve;
  const h = harness({ deferredMedia: new Promise(done => { resolve = done; }) });
  await h.agree(); await h.q('[data-record-toggle]').fire();
  await new Promise(done => setImmediate(done));
  h.q('#recording-consent').checked = false;
  await h.q('#recording-consent').fire('change');
  resolve(); await new Promise(done => setImmediate(done));
  assert.equal(h.state.stopped, 1);
  assert.equal(h.q('[data-record-toggle]').disabled, true);
  assert.equal(h.q('[data-recording-stage]').hidden, true);
  assert.equal(h.state.requests.length, 0);
});

test('reloads select a different versioned passage, each around 30 seconds', { skip }, () => {
  const storage = new Map(), seen = new Set();
  let previous;
  for (let n = 0; n < 80; n++) {
    const h = harness({ storage });
    const id = h.q('[data-prompt-id]').textContent;
    assert.notEqual(id, previous);
    const words = h.q('[data-prompt-text]').textContent.split(/\s+/).length;
    assert.ok(words >= 60 && words <= 85, `${id}: ${words} words`);
    seen.add(id); previous = id;
  }
  assert.equal(seen.size, 6);
});

test('privacy describes automatic upload, optional medical context and withdrawal code', { skip }, () => {
  const privacy = decryptPreview(fs.readFileSync(new URL('../website-preview/datenschutz.html', import.meta.url), 'utf8'), password);
  const section = privacy.match(/<section aria-labelledby="ds-aufnahme">([\s\S]*?)<\/section>/)[1];
  assert.match(section, /elrsisbest\.tailb58b58\.ts\.net/);
  assert.match(section, /Widerrufscode/);
  assert.match(section, /Text-ID/);
  assert.match(section, /automatisch an Alex PC gesendet/);
  assert.match(section, /freiwillige Selbstauskunft/);
  assert.doesNotMatch(section, /speakpipe\.com/);
});

test('optional medical status is recorded once and preserved across Next recordings', { skip }, async () => {
  const h = harness();
  assert.equal(h.q('#recording-medic').checked, false);
  h.q('#recording-medic').checked = true;
  await h.agree(); await h.record();
  const firstPrompt = h.q('[data-prompt-id]').textContent;
  assert.equal(JSON.parse(h.state.requests[0].body).medic_context, true);
  assert.equal(JSON.parse(h.state.requests[1].body).payload.medic_context, true);
  assert.equal(h.q('#recording-medic').disabled, true);
  await h.q('[data-record-next]').fire();
  assert.notEqual(h.q('[data-prompt-id]').textContent, firstPrompt);
  assert.equal(h.q('[data-recording-review]').hidden, true);
  assert.equal(h.q('[data-recording-receipt]').hidden, true);
  assert.equal(h.q('[data-record-toggle]').disabled, false);
  assert.equal(h.state.mediaCalls, 1); // Next does not start the microphone
  assert.equal(h.state.requests.length, 3); // or upload anything by itself
  await h.record();
  assert.equal(h.state.requests.length, 5);
  assert.equal(h.state.requests.filter(r => r.url.endsWith('/api/contribution-sessions')).length, 1);
  const audit = JSON.parse(h.state.requests[3].body);
  const clip = h.state.requests[4];
  assert.equal(audit.payload.medic_context, true);
  assert.notEqual(clip.headers['x-medicraft-prompt-id'], firstPrompt);
  assert.equal(audit.payload.prompt_id, clip.headers['x-medicraft-prompt-id']);
  assert.equal(decodeURIComponent(clip.headers['x-medicraft-expected-text']), h.q('[data-prompt-text]').textContent);
  assert.notEqual(clip.headers['idempotency-key'], h.state.requests[2].headers['idempotency-key']);
});

test('Next stays unavailable while storage acknowledgement is pending', { skip }, async () => {
  let resolve;
  const h = harness({ deferredClip: new Promise(done => { resolve = done; }) });
  await h.agree(); await h.record();
  assert.equal(h.state.requests.length, 3);
  assert.equal(h.q('[data-record-next]').hidden, true);
  assert.equal(h.q('[data-record-next]').disabled, true);
  const prompt = h.q('[data-prompt-id]').textContent;
  await h.q('[data-record-next]').fire();
  assert.equal(h.q('[data-prompt-id]').textContent, prompt);
  assert.equal(h.q('[data-record-toggle]').disabled, true);
  resolve(); await new Promise(done => setImmediate(done));
  assert.equal(h.q('[data-record-next]').hidden, false);
});

test('an interrupted recording stays local until explicitly retried', { skip }, async () => {
  const h = harness();
  await h.agree(); await h.q('[data-record-toggle]').fire();
  await new Promise(done => setImmediate(done));
  h.state.processor.onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array(48000).fill(0.1) } });
  h.doc.hidden = true;
  h.doc.handlers.visibilitychange();
  await new Promise(done => setImmediate(done));
  assert.equal(h.state.stopped, 1);
  assert.equal(h.state.requests.length, 0);
  assert.equal(h.q('[data-recording-review]').hidden, false);
  assert.match(h.q('[data-record-status]').textContent, /unterbrochen/);
});

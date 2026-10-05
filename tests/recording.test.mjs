// Test the recorder actually shipped by the promoted preview. No microphone,
// third-party request or upload is made by this harness.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readText } from './lib/repo.mjs';

const source = readText('mitmachen-aufnahme.html');
const recorder = source.match(/<script>\/\* js\/contribute.js \*\/([\s\S]*?)<\/script>/)[1];
const widget = source.match(/data-speakpipe-widget="([^"]+)"/)[1];

function harness({ secure = true, configured = true } = {}) {
  class Element {
    disabled = false; hidden = true; style = {}; attrs = {}; children = [];
    handlers = {}; textContent = ''; innerHTML = '';
    addEventListener(name, handler) { this.handlers[name] = handler; }
    setAttribute(name, value) { this.attrs[name] = value; }
    appendChild(child) { this.children.push(child); }
    focus() { this.focused = true; }
  }
  const button = new Element(), mount = new Element(), label = new Element(), hint = new Element();
  button.querySelector = () => label;
  const root = {
    getAttribute: () => configured ? widget : '',
    querySelector: selector => ({ '[data-recorder-load]': button, '[data-recorder-mount]': mount, '.contrib-recorder__hint': hint })[selector],
  };
  const body = new Element();
  const sandbox = {
    document: { documentElement: { lang: 'de' }, body,
      querySelector: selector => selector === '[data-recorder]' ? root : null,
      createElement: tag => Object.assign(new Element(), { tag }),
    },
    window: { isSecureContext: secure, JAR_I18N: {} }, encodeURIComponent,
  };
  vm.runInNewContext(recorder, sandbox);
  return { button, mount, body, label, hint, click: () => button.handlers.click() };
}

test('the configured recorder does not load a third party before consent', () => {
  const h = harness();
  assert.ok(widget);
  assert.equal(h.mount.children.length, 0);
  assert.equal(h.body.children.length, 0);
  assert.equal(h.button.disabled, false);
  assert.equal(h.mount.hidden, true);
});

test('an explicit click loads the configured iframe and loader', () => {
  const h = harness(); h.click();
  assert.equal(h.mount.children[0].src, `https://www.speakpipe.com/widget/inline/${widget}`);
  assert.equal(h.mount.children[0].attrs.allow, 'microphone');
  assert.equal(h.body.children[0].src, 'https://www.speakpipe.com/widget/loader.js');
  assert.equal(h.button.disabled, true);
  assert.equal(h.mount.hidden, false);
  assert.equal(h.mount.focused, true);
});

test('insecure origins and missing configuration fail without third-party contact', () => {
  for (const options of [{ secure: false }, { configured: false }]) {
    const h = harness(options); h.click();
    assert.equal(h.mount.children.length, 0);
    assert.equal(h.body.children.length, 0);
    assert.equal(h.button.disabled, true);
    assert.ok(h.mount.innerHTML.includes(options.secure === false ? 'HTTPS' : 'konfiguriert'));
  }
});

test('the privacy page identifies the actual recorder provider', () => {
  const privacy = readText('datenschutz.html');
  assert.match(privacy, /id="ds-aufnahme"/);
  assert.match(privacy, /speakpipe\.com\/privacy/);
});

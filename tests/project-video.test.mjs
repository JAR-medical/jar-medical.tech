import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readText } from './lib/repo.mjs';

function openVideo({ sdkLoaded = true, fullscreenError = false } = {}) {
  const node = extra => ({
    listeners: {},
    addEventListener(name, callback) { this.listeners[name] = callback; },
    focus() { this.focused = true; },
    ...extra,
  });
  let iframe, script, languageChanged;
  const events = {};
  const play = node({
    href: 'https://player.vimeo.com/video/1240976700?dnt=1&title=0&byline=0&portrait=0',
    replaceWith(replacement) { iframe = replacement; },
  });
  const dialog = node({
    open: false, invitations: 0,
    showModal() { this.open = true; this.invitations++; },
    close() { this.open = false; },
  });
  const close = node({});
  const title = node({ dataset: { videoCopy: 'vote_title' } });
  const document = {
    documentElement: { lang: 'de' },
    querySelector: selector => ({ '[data-video-play]': play, '.project-vote': dialog, '[data-video-close]': close })[selector],
    querySelectorAll: () => [title],
    createElement: tagName => node({ tagName }),
    head: { appendChild(element) { script = element; } },
  };
  const Vimeo = { Player: function (element) {
    assert.equal(element, iframe);
    this.on = (event, callback) => { events[event] = callback; };
    this.exitFullscreen = () => fullscreenError ? Promise.reject(new Error('not fullscreen')) : Promise.resolve();
  } };
  const window = sdkLoaded ? { Vimeo } : {};
  vm.runInNewContext(readText('assets/project-video.js'), {
    document, window,
    MutationObserver: class { constructor(callback) { languageChanged = callback; } observe() {} },
  });
  return {
    play, dialog, close, title, events, document,
    get iframe() { return iframe; }, get script() { return script; },
    loadSDK() { window.Vimeo = Vimeo; script.onload(); },
    languageChanged: () => languageChanged(),
    click: () => play.listeners.click({ button: 0, preventDefault() {} }),
  };
}

const settled = () => new Promise(resolve => setImmediate(resolve));

test('Vimeo and its SDK load only after a normal play click', () => {
  const page = openVideo({ sdkLoaded: false });
  assert.equal(page.iframe, undefined);
  assert.equal(page.script, undefined);
  page.play.listeners.click({ button: 0, ctrlKey: true });
  assert.equal(page.iframe, undefined);
  page.click();
  assert.match(page.iframe.src, /dnt=1.*autoplay=1&loop=0$/);
  assert.equal(page.iframe.allowFullscreen, true);
  assert.equal(page.iframe.focused, true);
  assert.equal(page.script.src, 'https://player.vimeo.com/api/player.js');
  page.loadSDK();
  assert.equal(typeof page.events.ended, 'function');
  assert.equal(page.dialog.open, false);
});

test('finishing the video opens one voting invitation, which can be dismissed', async () => {
  const page = openVideo({ fullscreenError: true });
  page.click();
  assert.equal(page.dialog.open, false);
  page.events.ended();
  await settled();
  assert.equal(page.dialog.open, true, 'the invitation also opens if fullscreen exit is unavailable');
  assert.equal(page.title.textContent, 'Hat dich J.A.R. überzeugt?');
  page.close.listeners.click();
  assert.equal(page.dialog.open, false);
  page.events.ended();
  await settled();
  assert.equal(page.dialog.invitations, 1, 'replay does not repeatedly interrupt the viewer');
});

test('language changes update the invitation without replacing the playing video', async () => {
  const page = openVideo();
  page.click();
  const original = page.iframe;
  page.document.documentElement.lang = 'en';
  page.languageChanged();
  page.events.ended();
  await settled();
  assert.equal(page.title.textContent, 'Did J.A.R. convince you?');
  assert.equal(page.iframe, original);
});

test('the homepage and info page both put the shared video first and link to the official ballot', () => {
  for (const path of ['index.html', 'info/index.html']) {
    const html = readText(path);
    assert.match(html, /<main\b[^>]*>\s*<section class="project-video"/);
    assert.match(html, /src="(?:\.\.\/)?assets\/project-video\.js\?v=1" defer/);
    assert.match(html, /<a class="project-vote-link" href="https:\/\/www\.bw-ki\.de\/publikumspreis"/);
    assert.match(html, /<dialog[^>]*aria-labelledby="project-vote-title"/);
  }
});

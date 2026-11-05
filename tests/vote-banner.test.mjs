import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readText, htmlFiles } from './lib/repo.mjs';

function openPage(at) {
  let now = Date.parse(at), nextTimer = 0;
  const timers = new Map(), events = {}, classes = new Set();
  class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.attributes = {}; }
    setAttribute(name, value) { this.attributes[name] = value; }
    append(...children) { this.children.push(...children); }
    prepend(...children) {
      this.children.unshift(...children);
      children.forEach(child => { child.parent = this; });
    }
    remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
  }
  const body = new Element('body');
  const root = { classList: { add: name => classes.add(name), remove: name => classes.delete(name) } };
  vm.runInNewContext(readText('assets/vote-banner.js'), {
    Date: { parse: Date.parse, now: () => now },
    document: { body, documentElement: root, createElement: tag => new Element(tag), addEventListener: (name, fn) => { events[name] = fn; } },
    window: { addEventListener: (name, fn) => { events[name] = fn; } },
    setTimeout: (fn, delay) => { const id = ++nextTimer; timers.set(id, { fn, delay }); return id; },
    clearTimeout: id => timers.delete(id),
  });
  return { body, classes, timers, events, setTime: time => { now = Date.parse(time); } };
}

test('the campaign notice links to the voting page and reserves space below it', () => {
  const page = openPage('2026-11-03T12:00:00+01:00');
  assert.equal(page.body.children.length, 2);
  const [banner, spacer] = page.body.children;
  assert.equal(banner.className, 'jar-vote-banner');
  assert.equal(spacer.className, 'jar-vote-spacer');
  const link = banner.children[0];
  assert.equal(link.href, 'https://www.bw-ki.de/publikumspreis');
  assert.equal(link.target, '_blank');
  assert.match(link.rel, /noopener/);
  assert.equal(link.children[0].textContent, 'Vote for us ↗');
  assert.equal(page.classes.has('jar-vote-active'), true);
});

test('the banner is visible through the last millisecond of 9 November in Berlin', () => {
  const page = openPage('2026-11-09T22:59:59.999Z');
  assert.equal(page.body.children.length, 2);
  assert.equal([...page.timers.values()][0].delay, 1);
});

test('the banner is absent from midnight on 10 November in Berlin', () => {
  const page = openPage('2026-11-09T23:00:00Z');
  assert.equal(page.body.children.length, 0);
  assert.equal(page.classes.has('jar-vote-active'), false);
  assert.equal(page.timers.size, 0);
});

test('an open tab removes the banner and its spacer at the deadline', () => {
  const page = openPage('2026-11-09T23:59:00+01:00');
  const timer = [...page.timers.values()][0];
  page.setTime('2026-11-10T00:00:00+01:00');
  timer.fn();
  assert.equal(page.body.children.length, 0);
  assert.equal(page.classes.has('jar-vote-active'), false);
});

test('resuming or restoring a tab checks the date without duplicating the notice', () => {
  const page = openPage('2026-11-05T12:00:00+01:00');
  page.events.pageshow();
  page.events.visibilitychange();
  assert.equal(page.body.children.length, 2);
  assert.equal(page.timers.size, 1);
  page.setTime('2026-11-10T10:00:00+01:00');
  page.events.visibilitychange();
  assert.equal(page.body.children.length, 0);
  assert.equal(page.timers.size, 0);
});

test('the banner is absent before the campaign starts', () => {
  const page = openPage('2026-11-02T22:59:59Z');
  assert.equal(page.body.children.length, 0);
});

test('all main public pages include the shared campaign assets', () => {
  const pages = htmlFiles().filter(page => {
    if (/^(info|pflege|corporate)\//.test(page)) return true;
    return !page.includes('/') && page !== '404.html' && !/http-equiv="refresh"/i.test(readText(page));
  });
  assert.equal(pages.length, 17);
  for (const page of pages) {
    assert.match(readText(page), /assets\/vote-banner\.css\?v=1/, page);
    assert.match(readText(page), /assets\/vote-banner\.js\?v=1" defer/, page);
  }
});

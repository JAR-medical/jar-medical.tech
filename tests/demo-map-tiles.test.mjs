import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadInternalFunctions } from './lib/demo.mjs';

// Exercise the actual map initialisation and Leaflet tile events. Rendering
// unrelated patient/incident layers is stubbed; network time is deterministic.
function openMap() {
  let now = 0, nextTimer = 0;
  const timers = new Map();
  const layers = new Set();
  const basis = {};
  const messages = [];
  const select = { value: 'hell' };
  const container = { clientWidth: 800, clientHeight: 500, classList: { toggle() {} } };
  const map = {
    getSize: () => ({ x: 800, y: 500 }), invalidateSize() {}, on() {},
    createPane: () => ({ style: {} }), getPane: () => ({ style: {} }),
    hasLayer: layer => layers.has(layer),
    addLayer(layer) { layers.add(layer); layer.fire?.('add'); return this; },
    removeLayer(layer) { layers.delete(layer); layer.fire?.('remove'); return this; },
  };
  class Layer {
    handlers = new Map();
    on(events, callback) {
      for (const event of events.split(' ')) {
        if (!this.handlers.has(event)) this.handlers.set(event, []);
        this.handlers.get(event).push(callback);
      }
      return this;
    }
    fire(event, payload = {}) { for (const callback of this.handlers.get(event) || []) callback(payload); }
    addTo(target) { target.addLayer(this); return this; }
  }
  const state = { ebenen: { wege: false } };
  const noop = () => {};
  const renderers = Object.fromEntries([
    'startAusschnitt', 'zoomEinrichten', 'wegenetzZeichnen', 'rasterZeichnen',
    'abschnitteZeichnen', 'gefahrenZeichnen', 'sperrenZeichnen', 'poiZeichnen',
    'mittelZeichnen', 'patientenZeichnen', 'ebenenAnwenden', 'darstellungAnpassen',
    'frameTakt', 'auswahlZeigen',
  ].map(name => [name, noop]));
  const { init } = loadInternalFunctions('demo/map.js', ['init', 'basisSetzen', 'kachelnUeberwachen'], {
    ...renderers, S: state, TR: { on() {}, ereignis: (type, text) => messages.push(text) },
    L: {
      map: () => map, SVG: { extend: () => class {} },
      control: { zoom: () => ({ addTo() {} }), scale: () => ({ addTo() {} }) },
      tileLayer: () => new Layer(), layerGroup: () => new Layer(),
    },
    map: null, basis, aktiveBasis: 'hell', G: {}, behaelterEl: null,
    KACHELN: { hell: { url: 'tiles', opt: {} }, osm: { url: 'tiles', opt: {} } },
    document: { getElementById: id => id === 'basiskarte' ? select : container },
    window: { addEventListener() {} }, requestAnimationFrame() {}, setInterval() {},
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { at: now + delay, callback }); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  init('map');
  function advance(ms) {
    const end = now + ms;
    while (true) {
      const next = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      now = next[1].at;
      timers.delete(next[0]);
      next[1].callback();
    }
    now = end;
  }
  function tile() {
    let src = 'https://tile.openstreetmap.org/16/34890/22757.png';
    const image = { complete: false, naturalWidth: 0, requests: [], removeAttribute() {} };
    Object.defineProperty(image, 'src', {
      get: () => src,
      set: value => { src = value; image.requests.push(value); },
    });
    basis.hell.fire('tileloadstart', { tile: image });
    return image;
  }
  function loaded(image) {
    image.complete = true;
    image.naturalWidth = 256;
    basis.hell.fire('tileload', { tile: image });
  }
  return { basis, map, advance, tile, loaded, select, state, messages };
}

test('a partially loaded map retries its stalled tile and eventually switches to local roads', () => {
  const page = openMap();
  page.loaded(page.tile());
  const missing = page.tile();
  page.advance(8000);
  assert.deepEqual(missing.requests, [missing.src], 'a missing tile must retry even when another tile loaded');
  page.advance(8000);
  assert.equal(page.map.hasLayer(page.basis.hell), false, 'partial tile failures must not leave permanent blank areas');
  assert.equal(page.select.value, 'leer');
  assert.equal(page.state.ebenen.wege, true);
  assert.equal(page.messages.length, 1);
});

test('a successful retry keeps the real tile map and cancels its fallback', () => {
  const page = openMap();
  const missing = page.tile();
  page.advance(8000);
  page.loaded(missing);
  page.advance(20000);
  assert.equal(page.map.hasLayer(page.basis.hell), true);
  assert.equal(page.messages.length, 0);
});

test('tiles discarded by pan or zoom cannot trigger a later fallback', () => {
  const page = openMap();
  page.loaded(page.tile());
  const discarded = page.tile();
  page.basis.hell.fire('tileunload', { tile: discarded });
  page.advance(20000);
  assert.deepEqual(discarded.requests, []);
  assert.equal(page.map.hasLayer(page.basis.hell), true);
  assert.equal(page.messages.length, 0);
});

test('an HTTP/image error is retried once, then reports a single fallback', () => {
  const page = openMap();
  const missing = page.tile();
  page.basis.hell.fire('tileerror', { tile: missing });
  assert.equal(missing.requests.length, 1);
  page.basis.hell.fire('tileerror', { tile: missing });
  page.advance(20000);
  assert.equal(page.map.hasLayer(page.basis.hell), false);
  assert.equal(page.messages.length, 1);
});

test('switching the base layer cancels outstanding retries', () => {
  const page = openMap();
  const missing = page.tile();
  page.map.removeLayer(page.basis.hell);
  page.advance(20000);
  assert.deepEqual(missing.requests, []);
  assert.equal(page.messages.length, 0);
});

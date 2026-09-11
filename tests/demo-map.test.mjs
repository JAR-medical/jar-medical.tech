// Geometry and drawing-order rules from demo/map.js, plus the nearest-node
// selection from demo/engine.js.
//
// These helpers live inside IIFEs and are never exported, so the tests lift the
// function declarations verbatim out of the shipped sources and evaluate them
// in a sandbox - see loadInternalFunctions in tests/lib/demo.mjs. Change the
// maths in map.js and these tests run the changed maths.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadInternalFunctions } from './lib/demo.mjs';

const geo = loadInternalFunctions('demo/map.js',
  ['flaechenRinge', 'ringFlaeche', 'flaechenInhalt', 'imPolygon']);
const rank = loadInternalFunctions('demo/map.js',
  ['mittelRang', 'patientRang', 'abschnittRang']);

describe('polygon ring extraction', () => {
  test('a GeoJSON Polygon is flipped from lon/lat to lat/lon', () => {
    const rings = geo.flaechenRinge({ type: 'Polygon', coordinates: [[[11.6, 48.1], [11.7, 48.2]]] });
    assert.deepEqual(rings, [[[48.1, 11.6], [48.2, 11.7]]]);
  });

  test('a MultiPolygon flattens to one ring list', () => {
    const rings = geo.flaechenRinge({
      type: 'MultiPolygon',
      coordinates: [[[[11.0, 48.0]]], [[[11.1, 48.1]], [[11.2, 48.2]]]],
    });
    assert.equal(rings.length, 3);
    assert.deepEqual(rings[0], [[48.0, 11.0]]);
  });

  test('a bare lat/lon ring is accepted as a single ring', () => {
    const ring = [[48.0, 11.0], [48.1, 11.0], [48.1, 11.1]];
    assert.deepEqual(geo.flaechenRinge(ring), [ring]);
  });

  test('an already-nested ring list is passed through unchanged', () => {
    const rings = [[[48.0, 11.0], [48.1, 11.0]], [[48.5, 11.5], [48.6, 11.5]]];
    assert.deepEqual(geo.flaechenRinge(rings), rings);
  });

  test('missing or empty geometry yields no rings instead of throwing', () => {
    assert.deepEqual(geo.flaechenRinge(null), []);
    assert.deepEqual(geo.flaechenRinge(undefined), []);
    assert.deepEqual(geo.flaechenRinge([]), []);
  });

  test('an unknown GeoJSON type yields no rings', () => {
    assert.deepEqual(geo.flaechenRinge({ type: 'LineString', coordinates: [[11, 48]] }), []);
  });
});

describe('ring area in square metres', () => {
  // 0.001 deg latitude is 110.54 m; 0.001 deg longitude at 48 deg N is
  // 111320 * cos(48) = 74.49 m. The rectangle below is therefore ~8235 m2.
  const RECT = [[48.000, 11.000], [48.001, 11.000], [48.001, 11.001], [48.000, 11.001]];

  test('a rectangle measures its analytic area', () => {
    const area = geo.ringFlaeche(RECT);
    assert.ok(Math.abs(area - 8235) < 60, `expected ~8235 m2, got ${area.toFixed(0)}`);
  });

  test('winding direction does not change the area', () => {
    assert.equal(geo.ringFlaeche(RECT).toFixed(6), geo.ringFlaeche([...RECT].reverse()).toFixed(6));
  });

  test('a degenerate ring has no area', () => {
    assert.equal(geo.ringFlaeche([[48, 11], [48.001, 11]]), 0);
    assert.equal(geo.ringFlaeche([]), 0);
    assert.equal(geo.ringFlaeche(null), 0);
  });

  test('a collinear ring has no area', () => {
    assert.ok(geo.ringFlaeche([[48, 11], [48.001, 11], [48.002, 11]]) < 1e-6);
  });

  test('area scales with the square of the side length', () => {
    const big = [[48.000, 11.000], [48.002, 11.000], [48.002, 11.002], [48.000, 11.002]];
    assert.ok(Math.abs(geo.ringFlaeche(big) / geo.ringFlaeche(RECT) - 4) < 0.01);
  });

  test('flaechenInhalt sums the rings and never returns zero', () => {
    const two = [RECT, [[49.000, 11.000], [49.001, 11.000], [49.001, 11.001], [49.000, 11.001]]];
    const sum = geo.flaechenInhalt(two);
    assert.ok(sum > geo.ringFlaeche(RECT), 'two rings should measure more than one');
    // Areas are used as a sort key for "smallest shape under the cursor wins",
    // so a zero would make an empty shape swallow every click.
    assert.equal(geo.flaechenInhalt(null), 1);
    assert.equal(geo.flaechenInhalt([]), 1);
  });
});

describe('point in polygon', () => {
  const SQUARE = [[48.0, 11.0], [48.0, 11.1], [48.1, 11.1], [48.1, 11.0]];

  test('the centre is inside and far points are outside', () => {
    assert.equal(geo.imPolygon([48.05, 11.05], SQUARE), true);
    assert.equal(geo.imPolygon([47.9, 11.05], SQUARE), false);
    assert.equal(geo.imPolygon([48.2, 11.05], SQUARE), false);
    assert.equal(geo.imPolygon([48.05, 10.9], SQUARE), false);
    assert.equal(geo.imPolygon([48.05, 11.2], SQUARE), false);
  });

  test('a concave polygon excludes the notch', () => {
    // A "U": the gap between the two prongs must not count as inside.
    const u = [[0, 0], [0, 3], [1, 3], [1, 1], [2, 1], [2, 3], [3, 3], [3, 0]];
    assert.equal(geo.imPolygon([0.5, 1.5], u), true, 'left prong');
    assert.equal(geo.imPolygon([2.5, 1.5], u), true, 'right prong');
    assert.equal(geo.imPolygon([1.5, 2.0], u), false, 'the notch must be outside');
    assert.equal(geo.imPolygon([1.5, 0.5], u), true, 'the base is inside');
  });

  test('a point far outside a triangle is rejected', () => {
    const tri = [[0, 0], [0, 4], [4, 0]];
    assert.equal(geo.imPolygon([0.5, 0.5], tri), true);
    assert.equal(geo.imPolygon([3, 3], tri), false);
  });

  test('an empty polygon contains nothing', () => {
    assert.equal(geo.imPolygon([1, 1], []), false);
  });
});

describe('map drawing order', () => {
  test('command posts draw above doctors, which draw above ambulances', () => {
    assert.ok(rank.mittelRang({ art: 'fuehrung' }) < rank.mittelRang({ art: 'nef' }));
    assert.ok(rank.mittelRang({ art: 'nef' }) < rank.mittelRang({ art: 'rtw' }));
    assert.ok(rank.mittelRang({ art: 'rtw' }) < rank.mittelRang({ art: 'polizei' }));
  });

  test('doctors, helicopters and NEFs share one rank', () => {
    const r = rank.mittelRang({ art: 'nef' });
    assert.equal(rank.mittelRang({ art: 'arzt' }), r);
    assert.equal(rank.mittelRang({ art: 'rth' }), r);
  });

  test('a unit carrying a patient is promoted one step', () => {
    assert.equal(rank.mittelRang({ art: 'rtw', patient: 7 }), rank.mittelRang({ art: 'rtw' }) - 1);
    assert.equal(rank.mittelRang({ art: 'polizei', patient: 7 }), rank.mittelRang({ art: 'polizei' }) - 1);
  });

  test('promotion never pushes a unit above the top rank', () => {
    assert.equal(rank.mittelRang({ art: 'fuehrung', patient: 7 }), 1);
    for (const art of ['fuehrung', 'nef', 'arzt', 'rth', 'rtw', 'polizei', 'drohne', 'trupp']) {
      assert.ok(rank.mittelRang({ art, patient: 1 }) >= 1, `${art} fell below rank 1`);
    }
  });

  test('red patients draw above yellow, yellow above everything else', () => {
    assert.equal(rank.patientRang({ kat: 'SK1' }), 1);
    assert.equal(rank.patientRang({ kat: 'SK2' }), 2);
    for (const kat of ['SK3', 'SK4', 'TOT', 'UNG']) {
      assert.equal(rank.patientRang({ kat }), 3, `${kat} should share the bottom rank`);
    }
  });

  test('headquarters and the damage site outrank every other section', () => {
    assert.equal(rank.abschnittRang({ hq: true, art: 'fuehrung' }), 1);
    assert.equal(rank.abschnittRang({ id: 'SCHADEN', art: 'einsatz' }), 1);
    assert.equal(rank.abschnittRang({ id: 'PA', art: 'med' }), 2);
    assert.equal(rank.abschnittRang({ id: 'RMHP', art: 'transport' }), 2);
    assert.equal(rank.abschnittRang({ id: 'BST', art: 'betreuung' }), 3);
    assert.equal(rank.abschnittRang({ id: 'VER', art: 'sonstig' }), 3);
  });
});

describe('nearest routable node', () => {
  // naechsterKnoten picks the graph node a route starts or ends at. Selecting a
  // node no edge touches makes Dijkstra fail and the path collapse to a
  // straight line, so the eligibility rules are worth pinning down exactly.
  const buildGraph = (knoten, adj) => ({ knoten, adj });

  function nearest(knoten, adj) {
    return loadInternalFunctions('demo/engine.js', ['dist', 'naechsterKnoten'], {
      RAD: Math.PI / 180,
      ERD: 6371000,
      graph: buildGraph(knoten, adj),
    }).naechsterKnoten;
  }

  test('it picks the geometrically nearest eligible node', () => {
    const fn = nearest(
      [[48.000, 11.000], [48.010, 11.000], [48.001, 11.000]],
      [[[1, 100, 0]], [[0, 100, 0]], [[0, 50, 0]]],
    );
    assert.equal(fn([48.0011, 11.0], true), 2);
  });

  test('it skips nodes that no edge touches', () => {
    // Node 0 is the nearest but has no edges: an OSM line made of the same
    // point twice produces exactly this, and routing from it always failed.
    const fn = nearest(
      [[48.000, 11.000], [48.004, 11.000], [48.005, 11.000]],
      [[], [[2, 100, 2]], [[1, 100, 2]]],
    );
    assert.equal(fn([48.0001, 11.0], true), 1, 'an orphan node was chosen as a route endpoint');
  });

  test('vehicles ignore foot-only nodes, teams on foot do not', () => {
    // class 2 = footpath. Node 0 is nearest but only reachable on foot.
    const knoten = [[48.000, 11.000], [48.004, 11.000], [48.005, 11.000]];
    const adj = [[[1, 100, 2]], [[0, 100, 2], [2, 100, 0]], [[1, 100, 0]]];
    assert.equal(nearest(knoten, adj)([48.0001, 11.0], true), 0, 'foot routing should use the footpath');
    assert.equal(nearest(knoten, adj)([48.0001, 11.0], false), 1, 'a vehicle must not start on a footpath');
  });

  test('an empty graph reports no node rather than node zero', () => {
    assert.equal(nearest([], [])([48.0, 11.0], true), -1);
  });

  test('a graph of nothing but orphans reports no node', () => {
    assert.equal(nearest([[48.0, 11.0], [48.1, 11.1]], [[], []])([48.0, 11.0], true), -1);
  });
});

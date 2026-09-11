// The three exercise scenarios and their geodata, validated against the shape
// demo/engine.js actually requires.
//
// A missing field here does not throw at load time - it surfaces as a marker
// that never appears, a vehicle parked on the epicentre, or a section nobody
// ever carries a patient to. The checks below are derived from what init(),
// takt(), rollenZiel(), klinikWaehlen() and transportZiel() read.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadEngine, runSimulation, SCENARIO_IDS } from './lib/demo.mjs';

const { TR, window: W } = loadEngine();
const SZENARIEN = W.SZENARIEN;
const KAT = TR.KAT;

const inside = (bbox, ll) =>
  ll[0] >= bbox[0] && ll[0] <= bbox[2] && ll[1] >= bbox[1] && ll[1] <= bbox[3];

describe('the scenario catalogue', () => {
  test('exactly the three advertised scenarios are registered', () => {
    assert.deepEqual([...SZENARIEN].map((s) => s.id), SCENARIO_IDS);
  });

  test('scenario ids and aliases never collide', () => {
    const handles = [...SZENARIEN].flatMap((s) => [s.id, ...(s.alias || [])]);
    assert.equal(new Set(handles).size, handles.length, `duplicate handle in: ${handles.join(', ')}`);
  });

  test('each scenario has a short name for the picker and a session name', () => {
    for (const s of SZENARIEN) {
      assert.ok(s.kurz && s.kurz.length > 3, `${s.id} has no usable short name`);
      assert.ok(s.sitzung && s.sitzung.length > 3, `${s.id} has no session name`);
    }
  });

  test('the scenario ids match the deep-link pages under demo/', () => {
    // demo/<id>/index.html redirects to ../?lage=<id>; a renamed scenario would
    // leave those pages pointing at nothing.
    for (const id of SCENARIO_IDS) {
      assert.ok(SZENARIEN.some((s) => s.id === id), `no scenario answers to "${id}"`);
    }
  });
});

for (const s of SZENARIEN) {
  describe(`scenario "${s.id}"`, () => {
    test('the bounding box is well formed and the epicentre sits inside it', () => {
      const b = s.geo.bbox;
      assert.equal(b.length, 4, 'bbox must be [south, west, north, east]');
      assert.ok(b[2] > b[0], 'north is not above south');
      assert.ok(b[3] > b[1], 'east is not right of west');
      assert.ok(inside(b, s.epi), `epicentre ${s.epi} is outside the bounding box`);
    });

    test('the grid stays inside the alphabet the cell labels use', () => {
      // zelle() builds labels with String.fromCharCode(65 + column) and
      // zellGrenzen() parses a single letter, so 26 columns is the hard ceiling.
      assert.ok(s.raster.spalten >= 2 && s.raster.spalten <= 26, `${s.raster.spalten} columns`);
      assert.ok(s.raster.zeilen >= 2 && s.raster.zeilen <= 99, `${s.raster.zeilen} rows`);
    });

    test('grid cells stay a usable size on the ground', () => {
      const b = s.geo.bbox;
      const width = TR.dist([b[0], b[1]], [b[0], b[3]]) / s.raster.spalten;
      const height = TR.dist([b[0], b[1]], [b[2], b[1]]) / s.raster.zeilen;
      for (const [label, m] of [['cell width', width], ['cell height', height]]) {
        assert.ok(m > 40 && m < 400, `${label} is ${Math.round(m)} m`);
      }
    });

    test('the way network is well formed', () => {
      assert.ok(Array.isArray(s.geo.ways) && s.geo.ways.length > 0, 'no ways at all');
      s.geo.ways.forEach(([name, klasse, pts], i) => {
        assert.equal(typeof klasse, 'number', `way ${i} (${name}) has no road class`);
        assert.ok([0, 1, 2].includes(klasse), `way ${i} has unknown road class ${klasse}`);
        assert.ok(Array.isArray(pts), `way ${i} has no point list`);
        assert.equal(pts.length % 2, 0, `way ${i} has an odd coordinate count`);
        assert.ok(pts.length >= 2, `way ${i} has no points`);
        for (let j = 0; j < pts.length; j++) {
          assert.ok(Number.isFinite(pts[j]), `way ${i} has a non-numeric coordinate`);
        }
      });
    });

    test('the way network lies within the mapped area', () => {
      const b = s.geo.bbox;
      const pad = 0.02; // ~2 km, room for approach roads that leave the box
      const strays = [];
      s.geo.ways.forEach(([name, , pts], i) => {
        for (let j = 0; j < pts.length; j += 2) {
          if (!inside([b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad], [pts[j], pts[j + 1]])) {
            strays.push(`way ${i} (${name}) at ${pts[j]},${pts[j + 1]}`);
          }
        }
      });
      assert.deepEqual(strays.slice(0, 5), [], `${strays.length} way points far outside the box`);
    });

    test('sections are complete and uniquely identified', () => {
      const ids = s.abschnitte.map((a) => a.id);
      assert.equal(new Set(ids).size, ids.length, `duplicate section id in ${ids.join(', ')}`);
      for (const a of s.abschnitte) {
        for (const field of ['id', 'kurz', 'name', 'art', 'info', 'leitung']) {
          assert.ok(a[field], `section ${a.id} has no ${field}`);
        }
        assert.equal(a.ll.length, 2, `section ${a.id} has no position`);
        // A section is drawn either as a circle or as a polygon; one or the
        // other must be there or it has no extent on the map at all.
        assert.ok(a.r > 0 || a.flaeche || a.flaechen, `section ${a.id} has neither radius nor area`);
        assert.ok(inside(s.geo.bbox, a.ll), `section ${a.id} sits outside the bounding box`);
      }
    });

    test('every section the simulation drives to is a circle with a radius', () => {
      // rollenZiel() sends teams and vehicles to streu(ziel.ll, 14) and
      // abschnittBei() matches arrivals with dist(ll, a.ll) <= a.r, so a
      // staging area without a radius would never register an arrival.
      const destinations = ['ablagen', 'ablage', 'behandlung', 'behandlungen', 'betreuung',
        'bereitstellung', 'halteplatz', 'verstorbene', 'landeplatz'];
      const byId = new Map(s.abschnitte.map((a) => [a.id, a]));
      for (const role of destinations) {
        const value = s.rollen[role];
        if (!value) continue;
        for (const id of Array.isArray(value) ? value : [value]) {
          assert.ok(byId.get(id).r > 0, `destination section ${id} (role ${role}) has no radius`);
        }
      }
    });

    test('every role the engine looks up names a real section', () => {
      // rollenZiel()/istSchadensabschnitt() resolve these ids straight against
      // S.abschnitte; an unknown id means patients are never carried anywhere.
      const required = ['betreuung', 'bereitstellung', 'halteplatz', 'verstorbene', 'landeplatz'];
      for (const role of required) {
        assert.ok(s.rollen[role], `${s.id} defines no "${role}" role`);
      }
      assert.ok(s.rollen.ablagen && s.rollen.ablagen.length, 'no casualty collection point');
      assert.ok(s.rollen.behandlung || (s.rollen.behandlungen && s.rollen.behandlungen.length),
        'no treatment area');
      assert.ok(s.rollen.schaden && s.rollen.schaden.length, 'no damage site to rescue from');

      const known = new Set(s.abschnitte.map((a) => a.id));
      const unknown = Object.entries(s.rollen)
        .flatMap(([role, value]) => (Array.isArray(value) ? value : [value]).map((id) => [role, id]))
        .filter(([, id]) => !known.has(id))
        .map(([role, id]) => `${role} -> ${id}`);
      assert.deepEqual(unknown, [], `roles point at sections that do not exist: ${unknown.join(', ')}`);
    });

    test('hazards carry a detection time, a level and a position', () => {
      for (const g of s.gefahren) {
        assert.ok(g.id && g.name, 'hazard without id or name');
        // init() reads `aktiv: g.t === 0`; an undefined t leaves it inert forever.
        assert.equal(typeof g.t, 'number', `hazard ${g.id} has no detection time`);
        assert.ok(g.t >= 0, `hazard ${g.id} is detected before the incident starts`);
        assert.ok([1, 2, 3].includes(g.stufe), `hazard ${g.id} has level ${g.stufe}`);
        // A hazard is a circle, a polygon, or a plain point symbol (r: 0) -
        // but a negative or non-numeric radius would break the map layer.
        assert.ok(g.r === undefined || (Number.isFinite(g.r) && g.r >= 0),
          `hazard ${g.id} has an unusable radius ${g.r}`);
        assert.ok(inside(s.geo.bbox, g.ll), `hazard ${g.id} sits outside the bounding box`);
        assert.ok(g.status && g.verantwortlich, `hazard ${g.id} has no status or owner`);
      }
    });

    test('every polygon on the map is a closed ring of coordinates', () => {
      const rings = [];
      for (const x of [...s.abschnitte, ...s.gefahren]) {
        if (x.flaeche) rings.push([x.id, x.flaeche]);
        for (const f of x.flaechen || []) rings.push([x.id, f]);
      }
      for (const [id, ring] of rings) {
        assert.ok(ring.length >= 3, `${id} has a polygon with only ${ring.length} corners`);
        for (const corner of ring) {
          assert.equal(corner.length, 2, `${id} has a malformed polygon corner`);
          assert.ok(Number.isFinite(corner[0]) && Number.isFinite(corner[1]),
            `${id} has a non-numeric polygon corner`);
          assert.ok(inside(s.geo.bbox, corner), `${id} has a polygon corner outside the bounding box`);
        }
      }
    });

    test('hazard readings declare a unit and a warning threshold', () => {
      for (const g of s.gefahren) {
        if (!g.messwert) continue;
        const m = g.messwert;
        assert.ok(m.label && m.einheit, `hazard ${g.id} reading has no label or unit`);
        assert.equal(typeof m.wert, 'number', `hazard ${g.id} reading has no value`);
        assert.equal(typeof m.warn, 'number', `hazard ${g.id} reading has no warning level`);
      }
    });

    test('clinics can receive the categories the engine transports', () => {
      // transportZiel() sends SK1, SK2 and SK3 only; klinikWaehlen() skips a
      // clinic whose frei map has no bucket for the patient's category, so a
      // missing bucket silently removes that clinic from the whole scenario.
      const ids = s.kliniken.map((k) => k.id);
      assert.equal(new Set(ids).size, ids.length, 'duplicate clinic id');
      assert.ok(s.kliniken.length >= 2, 'a mass-casualty scenario needs more than one clinic');
      for (const k of s.kliniken) {
        assert.ok(k.name && k.stufe, `clinic ${k.id} is incomplete`);
        assert.ok(k.minuten > 0, `clinic ${k.id} has no travel time`);
        assert.ok(k.km > 0, `clinic ${k.id} has no distance`);
        for (const kat of ['SK1', 'SK2', 'SK3']) {
          assert.equal(typeof k.frei[kat], 'number', `clinic ${k.name} has no ${kat} capacity`);
          assert.ok(k.frei[kat] >= 0, `clinic ${k.name} has negative ${kat} capacity`);
        }
      }
    });

    test('total clinic capacity can absorb the roster', () => {
      const beds = s.kliniken.reduce((sum, k) => sum + k.frei.SK1 + k.frei.SK2 + k.frei.SK3, 0);
      const needing = s.patienten.filter((p) => ['SK1', 'SK2', 'SK3'].includes(p.kat)).length;
      assert.ok(beds >= needing, `${beds} beds for ${needing} transportable patients`);
    });

    test('a child casualty always has a paediatric clinic to go to', () => {
      const children = s.patienten.filter((p) => p.kind);
      if (!children.length) return;
      const paediatric = s.kliniken.filter((k) => k.kinder);
      assert.ok(paediatric.length > 0,
        `${s.id} has ${children.length} child casualties but no clinic accepting children`);
      for (const kat of new Set(children.map((p) => p.kat))) {
        if (!['SK1', 'SK2', 'SK3'].includes(kat)) continue;
        assert.ok(paediatric.some((k) => k.frei[kat] > 0),
          `no paediatric clinic has free ${kat} capacity`);
      }
    });

    test('units are based at a section or a cordon point the scenario defines', () => {
      const ids = s.mittel.map((m) => m.id);
      assert.equal(new Set(ids).size, ids.length, 'duplicate unit id');
      const known = new Set([...s.abschnitte.map((a) => a.id), ...s.sperren.map((x) => x.id)]);
      for (const m of s.mittel) {
        assert.ok(m.name, `unit ${m.id} has no name`);
        assert.ok(m.art, `unit ${m.id} has no type`);
        // init() falls back to the epicentre for an unknown base, which parks
        // the whole fleet on the damage site.
        assert.ok(known.has(m.basis), `unit ${m.id} is based at unknown "${m.basis}"`);
      }
    });

    test('every unit type has behaviour in the simulation loop', () => {
      const known = new Set(['trupp', 'rtw', 'rth', 'nef', 'arzt', 'drohne',
        'fuehrung', 'polizei', 'loesch']);
      const unknown = [...new Set(s.mittel.map((m) => m.art))].filter((a) => !known.has(a));
      assert.deepEqual(unknown, [], `unit types with no takt handler: ${unknown.join(', ')}`);
    });

    test('the scenario fields enough ambulances and teams to run', () => {
      const count = (art) => s.mittel.filter((m) => m.art === art).length;
      assert.ok(count('rtw') >= 2, `only ${count('rtw')} ambulances`);
      assert.ok(count('trupp') >= 2, `only ${count('trupp')} rescue teams`);
    });

    test('the patient roster is complete and uniquely numbered', () => {
      const ids = s.patienten.map((p) => p.id);
      assert.equal(new Set(ids).size, ids.length, 'duplicate patient id');
      assert.ok(s.patienten.length >= 15, `only ${s.patienten.length} casualties`);
      for (const p of s.patienten) {
        assert.equal(typeof p.t, 'number', `patient #${p.id} has no detection time`);
        assert.ok(p.t >= 0, `patient #${p.id} is detected before the incident starts`);
        assert.ok(KAT[p.kat], `patient #${p.id} has unknown triage category "${p.kat}"`);
        assert.notEqual(p.kat, 'UNG', `patient #${p.id} is authored as permanently unsighted`);
        assert.equal(p.ll.length, 2, `patient #${p.id} has no position`);
        assert.ok(inside(s.geo.bbox, p.ll), `patient #${p.id} lies outside the bounding box`);
        assert.ok(Array.isArray(p.verletzt), `patient #${p.id} has no findings list`);
        assert.ok(Array.isArray(p.massnahmen), `patient #${p.id} has no measures list`);
        assert.ok(p.befund && p.befund.length > 10, `patient #${p.id} has no triage report`);
        assert.ok(p.trupp, `patient #${p.id} was found by nobody`);
        assert.equal(typeof p.vit, 'object', `patient #${p.id} has no vitals object`);
      }
    });

    test('living patients carry vital signs and the deceased do not', () => {
      for (const p of s.patienten) {
        if (p.kat === 'TOT') {
          assert.deepEqual(Object.keys(p.vit), [], `deceased patient #${p.id} still has vitals`);
        } else {
          assert.equal(typeof p.vit.puls, 'number', `patient #${p.id} has no pulse`);
          assert.ok(p.vit.puls > 0 && p.vit.puls < 260, `patient #${p.id} pulse ${p.vit.puls}`);
          if (p.vit.spo2 != null) {
            assert.ok(p.vit.spo2 > 0 && p.vit.spo2 <= 100, `patient #${p.id} SpO2 ${p.vit.spo2}`);
          }
          if (p.vit.gcs != null) {
            assert.ok(p.vit.gcs >= 3 && p.vit.gcs <= 15, `patient #${p.id} GCS ${p.vit.gcs}`);
          }
          if (p.vit.af != null) assert.ok(p.vit.af > 0 && p.vit.af < 60, `patient #${p.id} AF ${p.vit.af}`);
        }
      }
    });

    test('a scripted deterioration names a time, a category and a report', () => {
      for (const p of s.patienten) {
        if (!p.verschlechtert) continue;
        const v = p.verschlechtert;
        assert.equal(typeof v.t, 'number', `deterioration of #${p.id} has no time`);
        assert.ok(v.t > p.t, `patient #${p.id} deteriorates before being found`);
        assert.ok(KAT[v.kat], `deterioration of #${p.id} has unknown category "${v.kat}"`);
        assert.ok(v.befund, `deterioration of #${p.id} has no report`);
      }
    });

    test('the radio script is complete and every patient reference resolves', () => {
      const ids = new Set(s.patienten.map((p) => p.id));
      for (const f of s.funk) {
        assert.equal(typeof f.t, 'number', 'radio line without a time');
        assert.ok(f.von, `radio line at t=${f.t} has no sender`);
        assert.ok(f.text && f.text.length > 10, `radio line at t=${f.t} has no text`);
        for (const ref of f.refs || []) {
          assert.ok(ids.has(ref), `radio line at t=${f.t} references patient #${ref}, who is not on the roster`);
        }
      }
    });

    test('cordon points and points of interest are positioned', () => {
      for (const x of [...s.sperren, ...s.poi]) {
        assert.ok(x.name, 'cordon or POI without a name');
        assert.equal(x.ll.length, 2, `${x.name} has no position`);
        assert.ok(inside(s.geo.bbox, x.ll), `${x.name} sits outside the bounding box`);
      }
    });

    test('the incident header carries everything the situation report prints', () => {
      for (const field of ['name', 'stichwort', 'ort', 'oel', 'lna', 'orgl',
        'alarmiert', 'betroffene', 'wetter']) {
        assert.ok(s.einsatz[field], `${s.id} incident header has no "${field}"`);
      }
      assert.match(s.einsatz.alarmiert, /^\d{2}:\d{2}$/, 'alert time must be HH:MM for uhr()');
    });
  });
}

describe('roster reveal timing', () => {
  // takt() walks the roster strictly in order and stops at the first entry in
  // the future. Scenarios with several damage sites list their casualties in
  // per-site blocks, each restarting at a low t - so init() sorts the roster.
  for (const id of SCENARIO_IDS) {
    test(`"${id}" reveals every casualty at its authored time`, () => {
      const T = loadEngine({ seed: 3 }).TR;
      const szenario = T.szenarien().find((s) => s.id === id);
      T.init(szenario);
      const horizon = Math.max(...szenario.patienten.map((p) => p.t)) + 30;
      runSimulation(T, horizon);
      const late = [];
      for (const v of szenario.patienten) {
        const p = T.S.patienten.get(v.id);
        assert.ok(p, `patient #${v.id} (t=${v.t}) never appeared`);
        const drift = p.erkannt - v.t;
        if (drift > 2) late.push(`#${v.id} authored t=${v.t}, revealed at ${Math.round(p.erkannt)}`);
      }
      assert.deepEqual(late, [], `casualties revealed late:\n  ${late.join('\n  ')}`);
    });
  }

  test('the muenchen roster is authored out of order, which is why init sorts', () => {
    // Pins the reason the sort exists: without it, patients 9-15 all appeared
    // at t=162 and 16-21 at t=190 instead of at their own times.
    const muenchen = SZENARIEN.find((s) => s.id === 'muenchen');
    const unsorted = muenchen.patienten.some((p, i, a) => i > 0 && a[i - 1].t > p.t);
    assert.equal(unsorted, true,
      'the muenchen roster is sorted now - keep the sort in init() anyway, but this note is stale');
  });
});

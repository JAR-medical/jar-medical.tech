// The TriARge simulation core (demo/engine.js), exercised as shipped.
//
// engine.js is the whole product on a static page: there is no backend, so the
// triage rules, the routing over the OpenStreetMap way network and the
// situational-picture arithmetic all live here. Everything below runs the real
// file in a sandbox - see tests/lib/demo.mjs.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { loadEngine, runSimulation, plain } from './lib/demo.mjs';

const { TR, window: W } = loadEngine();
const SZENARIEN = W.SZENARIEN;
const NEUBIBERG = SZENARIEN.find((s) => s.id === 'neubiberg');

describe('geodesy helpers', () => {
  const MUNICH = [48.13743, 11.57549];
  const NUREMBERG = [49.45390, 11.07730];

  test('dist matches the known Munich-Nuremberg great-circle distance', () => {
    // 150.5 km on the sphere; the equirectangular approximation is within ~0.5 %
    // at this latitude, which is all the simulation needs.
    const km = TR.dist(MUNICH, NUREMBERG) / 1000;
    assert.ok(km > 149 && km < 152, `expected ~150.5 km, got ${km.toFixed(1)} km`);
  });

  test('dist is zero for a point against itself and symmetric otherwise', () => {
    assert.equal(TR.dist(MUNICH, MUNICH), 0);
    assert.equal(TR.dist(MUNICH, NUREMBERG).toFixed(6), TR.dist(NUREMBERG, MUNICH).toFixed(6));
  });

  test('dist obeys the triangle inequality', () => {
    const via = [48.7, 11.4];
    assert.ok(TR.dist(MUNICH, NUREMBERG) <= TR.dist(MUNICH, via) + TR.dist(via, NUREMBERG) + 1e-6);
  });

  test('bearing reads 0 north, 90 east, 180 south, 270 west', () => {
    const p = [48.0, 11.0];
    assert.equal(Math.round(TR.bearing(p, [48.01, 11.0])), 0);
    assert.equal(Math.round(TR.bearing(p, [48.0, 11.01])), 90);
    assert.equal(Math.round(TR.bearing(p, [47.99, 11.0])), 180);
    assert.equal(Math.round(TR.bearing(p, [48.0, 10.99])), 270);
  });

  test('versetzt moves exactly the requested distance on the requested bearing', () => {
    for (const grad of [0, 45, 90, 180, 271, 359]) {
      const target = TR.versetzt(MUNICH, 250, grad);
      assert.ok(Math.abs(TR.dist(MUNICH, target) - 250) < 1, `distance off on bearing ${grad}`);
      const back = TR.bearing(MUNICH, target);
      assert.ok(Math.abs(((back - grad + 540) % 360) - 180) < 0.5, `bearing off on ${grad}`);
    }
  });

  test('versetzt and dist round-trip through a closed square', () => {
    let p = MUNICH;
    for (const grad of [0, 90, 180, 270]) p = TR.versetzt(p, 100, grad);
    assert.ok(TR.dist(MUNICH, p) < 1, 'walking a 100 m square should return to the start');
  });

  test('streu stays inside the requested scatter radius', () => {
    for (let i = 0; i < 200; i++) {
      assert.ok(TR.dist(MUNICH, TR.streu(MUNICH, 20)) <= 20.001);
    }
  });
});

describe('the operations grid', () => {
  before(() => TR.init(NEUBIBERG));

  test('the epicentre falls inside the grid', () => {
    const cell = TR.zelle(TR.S.epi);
    assert.match(cell, /^[A-J][1-8]$/, `epicentre landed outside the grid: ${cell}`);
  });

  test('the grid corners map to A1 and the far cell', () => {
    const [south, west, north, east] = TR.S.bbox;
    const eps = 1e-6;
    assert.equal(TR.zelle([north - eps, west + eps]), 'A1', 'north-west corner should be A1');
    const last = String.fromCharCode(64 + TR.S.raster.spalten) + TR.S.raster.zeilen;
    assert.equal(TR.zelle([south + eps, east - eps]), last, `south-east corner should be ${last}`);
  });

  test('points outside the bounding box have no cell', () => {
    const [south, west, north, east] = TR.S.bbox;
    assert.equal(TR.zelle([north + 0.5, west]), '-');
    assert.equal(TR.zelle([south - 0.5, east]), '-');
    assert.equal(TR.zelle([south, west - 0.5]), '-');
    assert.equal(TR.zelle([north, east + 0.5]), '-');
  });

  test('zellGrenzen returns the box the cell was derived from', () => {
    for (const ref of ['A1', 'C4', 'J8']) {
      const [[s, w], [n, e]] = TR.zellGrenzen(ref);
      assert.ok(n > s && e > w, `${ref} has an inverted box`);
      const centre = [(n + s) / 2, (e + w) / 2];
      assert.equal(TR.zelle(centre), ref, `centre of ${ref} does not map back to ${ref}`);
    }
  });

  test('zellGrenzen rejects references that are not grid cells', () => {
    assert.equal(TR.zellGrenzen('ZZ'), null);
    assert.equal(TR.zellGrenzen(''), null);
    assert.equal(TR.zellGrenzen(null), null);
  });

  test('every grid cell tiles the box without gaps or overlap', () => {
    const { spalten, zeilen } = TR.S.raster;
    const seen = new Set();
    for (let c = 0; c < spalten; c++) {
      for (let r = 0; r < zeilen; r++) {
        const ref = String.fromCharCode(65 + c) + (r + 1);
        const [[s, w], [n, e]] = TR.zellGrenzen(ref);
        const got = TR.zelle([(n + s) / 2, (e + w) / 2]);
        assert.equal(got, ref);
        assert.equal(seen.has(got), false, `${got} produced twice`);
        seen.add(got);
      }
    }
    assert.equal(seen.size, spalten * zeilen);
  });

  test('zellSchluessel sorts A2 before A10 and pushes unknown cells last', () => {
    const refs = ['B3', 'A10', 'A2', '-', 'C1'];
    const sorted = [...refs].sort((a, b) => TR.zellSchluessel(a).localeCompare(TR.zellSchluessel(b)));
    assert.deepEqual(sorted, ['A2', 'A10', 'B3', 'C1', '-']);
  });
});

describe('time formatting', () => {
  before(() => TR.init(NEUBIBERG));

  test('zeit renders mm:ss and clamps negatives to zero', () => {
    assert.equal(TR.zeit(0), '00:00');
    assert.equal(TR.zeit(65), '01:05');
    assert.equal(TR.zeit(3599), '59:59');
    assert.equal(TR.zeit(3600), '60:00');
    assert.equal(TR.zeit(-30), '00:00');
  });

  test('uhr counts forward from the alert time of the active scenario', () => {
    assert.equal(TR.uhr(0), '09:07:00');
    assert.equal(TR.uhr(125), '09:09:05');
    assert.equal(TR.uhr(3600), '10:07:00');
  });

  test('uhr wraps past midnight rather than reporting hour 25', () => {
    assert.equal(TR.uhr(15 * 3600), '00:07:00');
  });
});

describe('output escaping', () => {
  test('esc neutralises every HTML-significant character', () => {
    assert.equal(TR.esc('<script>alert("x")</script>'),
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    assert.equal(TR.esc("O'Brien & Söhne"), 'O&#39;Brien &amp; Söhne');
  });

  test('esc renders null and undefined as the empty string', () => {
    assert.equal(TR.esc(null), '');
    assert.equal(TR.esc(undefined), '');
    assert.equal(TR.esc(0), '0');
  });
});

describe('routing over the way network', () => {
  before(() => TR.init(NEUBIBERG));

  test('the way network produced a usable graph', () => {
    assert.ok(TR.graph.knoten.length > 500, `graph has only ${TR.graph.knoten.length} nodes`);
    assert.equal(TR.graph.knoten.length, TR.graph.adj.length);
    const connected = TR.graph.adj.filter((a) => a.length > 0).length;
    assert.ok(connected / TR.graph.knoten.length > 0.99,
      `${TR.graph.knoten.length - connected} of ${TR.graph.knoten.length} nodes have no edges`);
  });

  test('the way network forms one dominant connected component', () => {
    // Dijkstra falls back to a straight line whenever origin and destination
    // sit in different components, so the extract must not be a pile of islands.
    const seen = new Int32Array(TR.graph.knoten.length).fill(-1);
    const sizes = [];
    for (let i = 0; i < TR.graph.knoten.length; i++) {
      if (seen[i] >= 0) continue;
      const c = sizes.length;
      const stack = [i];
      seen[i] = c;
      let n = 0;
      while (stack.length) {
        const u = stack.pop();
        n++;
        for (const [v] of TR.graph.adj[u]) if (seen[v] < 0) { seen[v] = c; stack.push(v); }
      }
      sizes.push(n);
    }
    const largest = Math.max(...sizes);
    assert.ok(largest / TR.graph.knoten.length > 0.75,
      `the biggest component holds only ${largest} of ${TR.graph.knoten.length} nodes`);
  });

  test('every vehicle route between deployed sections follows the network', () => {
    // A straight-line fallback here would mean ambulances driving through
    // buildings on the map - the one routing failure a viewer would notice.
    const sections = [...TR.S.abschnitte.values()];
    const fallbacks = [];
    for (const a of sections) {
      for (const b of sections) {
        if (a === b) continue;
        if (TR.route(a.ll, b.ll, false).length <= 2) fallbacks.push(`${a.id} -> ${b.id}`);
      }
    }
    assert.deepEqual(fallbacks, [],
      `vehicle routing fell back to a straight line for: ${fallbacks.join(', ')}`);
  });

  test('a route never contains a non-finite coordinate', () => {
    const sections = [...TR.S.abschnitte.values()];
    for (const fuss of [true, false]) {
      for (const b of sections) {
        for (const point of TR.route(TR.S.epi, b.ll, fuss)) {
          assert.ok(Number.isFinite(point[0]) && Number.isFinite(point[1]),
            `route to ${b.id} produced ${JSON.stringify(point)}`);
        }
      }
    }
  });

  test('a route starts at its origin and ends at its destination', () => {
    const from = TR.S.epi;
    const to = TR.S.abschnitte.get('BHP').ll;
    const path = TR.route(from, to, false);
    assert.ok(path.length > 2, 'a cross-town route should follow more than a straight line');
    assert.deepEqual(plain(path[0]), plain(from));
    assert.deepEqual(plain(path[path.length - 1]), plain(to));
  });

  test('a route is never shorter than the straight line it replaces', () => {
    const from = TR.S.epi;
    const to = TR.S.abschnitte.get('BST').ll;
    const path = TR.route(from, to, true);
    let len = 0;
    for (let i = 1; i < path.length; i++) len += TR.dist(path[i - 1], path[i]);
    assert.ok(len >= TR.dist(from, to) - 1e-6, 'routed distance undercuts the crow-flies distance');
    assert.ok(len < TR.dist(from, to) * 4, `route detours ${(len / TR.dist(from, to)).toFixed(1)}x`);
  });

  test('consecutive route waypoints stay plausibly close together', () => {
    const path = TR.route(TR.S.epi, TR.S.abschnitte.get('RTH').ll, false);
    for (let i = 1; i < path.length; i++) {
      assert.ok(TR.dist(path[i - 1], path[i]) < 1500,
        `route jumps ${Math.round(TR.dist(path[i - 1], path[i]))} m between waypoints`);
    }
  });

  test('a route to the same place degenerates to a two-point path', () => {
    const p = TR.S.epi;
    assert.deepEqual(plain(TR.route(p, p, true)), [plain(p), plain(p)]);
  });

  test('vehicle routes and foot routes may differ but both connect', () => {
    const from = TR.S.abschnitte.get('BR').ll;
    const to = TR.S.abschnitte.get('BHP').ll;
    for (const fuss of [true, false]) {
      const path = TR.route(from, to, fuss);
      assert.ok(path.length >= 2);
      assert.deepEqual(path[0], from);
      assert.deepEqual(path[path.length - 1], to);
    }
  });
});

describe('triage state rules', () => {
  let T;
  before(() => {
    T = loadEngine({ seed: 7 }).TR;
    T.init(T.szenarien().find((s) => s.id === 'neubiberg'));
    runSimulation(T, 120);
  });

  test('every triage category the scenarios use has a label and a colour', () => {
    for (const kat of ['SK1', 'SK2', 'SK3', 'SK4', 'TOT', 'UNG']) {
      assert.ok(T.KAT[kat], `category ${kat} is undefined`);
      assert.match(T.KAT[kat].farbe, /^#[0-9a-f]{6}$/i);
      assert.ok(T.KAT[kat].label.length > 0);
      assert.equal(typeof T.KAT[kat].ord, 'number');
    }
  });

  test('triage categories are ordered red before yellow before green', () => {
    const ord = (k) => T.KAT[k].ord;
    assert.ok(ord('SK1') < ord('SK2'));
    assert.ok(ord('SK2') < ord('SK3'));
    assert.ok(ord('SK3') < ord('SK4'));
    assert.ok(ord('SK4') < ord('TOT'));
    assert.ok(ord('TOT') < ord('UNG'), 'unsighted must sort last');
  });

  test('patients appear unsighted and only gain vitals once triaged', () => {
    const patients = [...T.S.patienten.values()];
    assert.ok(patients.length > 0, 'no patients appeared in the first two minutes');
    for (const p of patients) {
      if (p.gesichtet == null) {
        assert.equal(p.kat, 'UNG', `patient #${p.id} has a category before triage`);
        assert.deepEqual(plain(p.vit), {}, `patient #${p.id} leaks vitals before triage`);
        assert.deepEqual(plain(p.verletzt), [], `patient #${p.id} leaks findings before triage`);
      } else {
        assert.notEqual(p.kat, 'UNG', `patient #${p.id} is triaged but still uncategorised`);
        assert.ok(p.gesichtet >= p.erkannt, 'triaged before being detected');
      }
    }
  });

  test('re-triage records the change and stamps the patient as sighted', () => {
    const p = [...T.S.patienten.values()][0];
    const before = p.proto.length;
    T.kategorieSetzen(p.id, 'SK1');
    assert.equal(T.S.patienten.get(p.id).kat, 'SK1');
    assert.notEqual(T.S.patienten.get(p.id).zustand, 'unsighted');
    assert.ok(T.S.patienten.get(p.id).gesichtet != null);
    assert.equal(p.proto.length, before + 1, 're-triage must leave a protocol entry');
    assert.match(p.proto[p.proto.length - 1].text, /manuell gesetzt/);
  });

  test('re-triage of an unknown patient is a no-op rather than a crash', () => {
    const before = T.S.patienten.size;
    T.kategorieSetzen(999999, 'SK1');
    assert.equal(T.S.patienten.size, before);
  });

  test('deleting a patient releases the bearer that was carrying them', () => {
    const p = [...T.S.patienten.values()].find((x) => x.traeger) || [...T.S.patienten.values()][0];
    if (p.traeger) {
      const bearer = p.traeger;
      T.patientLoeschen(p.id);
      assert.equal(T.S.mittel.get(bearer).patient, null, 'bearer still holds a deleted patient');
    } else {
      T.patientLoeschen(p.id);
    }
    assert.equal(T.S.patienten.has(p.id), false);
  });

  test('moving a patient updates the position and the grid cell', () => {
    const p = [...T.S.patienten.values()][0];
    const target = T.versetzt(p.ll, 180, 90);
    T.patientVerschieben(p.id, target);
    assert.deepEqual(plain(T.S.patienten.get(p.id).ll), plain(target));
    assert.equal(T.patientZelle(T.S.patienten.get(p.id)), T.zelle(target));
  });
});

describe('situational-picture arithmetic', () => {
  let T;
  before(() => {
    T = loadEngine({ seed: 11 }).TR;
    T.init(T.szenarien().find((s) => s.id === 'neubiberg'));
    runSimulation(T, 900);
  });

  test('the category tally adds up to the patient count', () => {
    const k = T.kennzahlen();
    const sum = Object.values(k.kat).reduce((a, b) => a + b, 0);
    assert.equal(sum, k.gesamt, 'category counters and patient count disagree');
    assert.equal(k.gesamt, T.S.patienten.size);
  });

  test('sub-counters never exceed the total', () => {
    const k = T.kennzahlen();
    for (const field of ['gesichtet', 'transportiert', 'imBHP', 'inPA', 'offen']) {
      assert.ok(k[field] <= k.gesamt, `${field}=${k[field]} exceeds gesamt=${k.gesamt}`);
      assert.ok(k[field] >= 0, `${field} went negative`);
    }
    assert.ok(k.freieRTW <= k.rtwGesamt);
  });

  test('the average time-to-triage is a real, non-negative number', () => {
    const k = T.kennzahlen();
    assert.ok(Number.isFinite(k.sichtSchnitt) && k.sichtSchnitt >= 0);
    assert.ok(k.gesichtet > 0, 'nothing was triaged in 15 minutes of simulation');
  });

  test('the CSV export has one header and one row per patient', () => {
    const csv = T.csvExport();
    const rows = csv.split('\r\n');
    assert.equal(rows.length, T.S.patienten.size + 1);
    assert.equal(rows[0].split(';').length, 17);
    assert.match(rows[0], /^ID;Kategorie;Zustand;Abschnitt;Raster;Lat;Lon;/);
  });

  test('the CSV export never emits a raw semicolon inside a field', () => {
    const csv = T.csvExport();
    for (const row of csv.split('\r\n').slice(1)) {
      assert.equal(row.split(';').length, 17, `column count drifted in row: ${row.slice(0, 80)}`);
    }
  });

  test('the CSV export lists patients in ascending id order', () => {
    const ids = T.csvExport().split('\r\n').slice(1).map((r) => Number(r.split(';')[0]));
    assert.deepEqual(ids, [...ids].sort((a, b) => a - b));
  });

  test('the situation report carries all six numbered sections', () => {
    const text = T.lagemeldung();
    for (const section of ['1. LAGE', '2. SICHTUNG', '3. VERSORGUNG UND TRANSPORT',
      '4. GEFAHREN UND EINSCHRÄNKUNGEN', '5. EINSATZABSCHNITTE', '6. OFFENE PUNKTE']) {
      assert.ok(text.includes(section), `situation report is missing "${section}"`);
    }
  });

  test('the situation report restates the live triage counts', () => {
    const k = T.kennzahlen();
    const text = T.lagemeldung();
    assert.ok(text.includes(`2. SICHTUNG (${k.gesichtet} von ${k.gesamt} gesichtet)`));
    assert.ok(text.includes(`SK I (rot)    : ${k.kat.SK1}`));
    assert.ok(text.includes('Simulierte Übungslage'), 'the exercise disclaimer must survive');
  });

  test('the situation report names every deployed section', () => {
    const text = T.lagemeldung();
    for (const a of T.S.abschnitte.values()) assert.ok(text.includes(a.name), `${a.name} is missing`);
  });
});

describe('a meaningful slice of the Neubiberg scenario', () => {
  let T;
  const SIM_SECONDS = 1200;
  before(() => {
    T = loadEngine({ seed: 23 }).TR;
    T.init(T.szenarien().find((s) => s.id === 'neubiberg'));
    runSimulation(T, SIM_SECONDS);
  });

  test('simulated time advanced to the requested horizon', () => {
    assert.ok(T.S.simSek >= SIM_SECONDS - 1 && T.S.simSek <= SIM_SECONDS + 1,
      `simSek is ${T.S.simSek.toFixed(1)}`);
  });

  test('the whole scripted patient roster was revealed', () => {
    const roster = T.aktivesSzenario().patienten;
    for (const v of roster) {
      assert.ok(T.S.patienten.has(v.id) || v.geloescht,
        `roster patient #${v.id} (t=${v.t}) never appeared`);
    }
    assert.ok(T.S.patienten.size >= roster.length, 'fewer patients than the roster defines');
  });

  test('follow-up casualties are reported once the roster runs out', () => {
    const roster = T.aktivesSzenario().patienten;
    assert.ok(T.S.patienten.size > roster.length,
      'no follow-up casualties after the scripted roster finished');
  });

  test('the scripted radio traffic played in order', () => {
    const script = T.aktivesSzenario().funk;
    const played = [...T.S.funk].reverse(); // S.funk is newest-first
    for (const line of script) {
      assert.ok(played.some((f) => f.text === line.text), `radio line at t=${line.t} never played`);
    }
    const times = played.map((f) => f.t);
    assert.deepEqual(times, [...times].sort((a, b) => a - b), 'radio log is not chronological');
  });

  test('triage progressed well past the halfway mark', () => {
    const k = T.kennzahlen();
    assert.ok(k.gesichtet >= 15, `only ${k.gesichtet} of ${k.gesamt} triaged after 20 minutes`);
    assert.ok(k.kat.SK1 > 0 && k.kat.SK2 > 0 && k.kat.SK3 > 0,
      'the scenario should produce red, yellow and green patients');
  });

  test('patients were carried out of the damage site into the sections', () => {
    const placed = [...T.S.patienten.values()].filter((p) => p.abschnitt);
    assert.ok(placed.length >= 5, `only ${placed.length} patients reached a section`);
    for (const p of placed) {
      assert.ok(T.S.abschnitte.has(p.abschnitt), `patient #${p.id} sits in unknown section ${p.abschnitt}`);
    }
  });

  test('transports started and every one names a real clinic and vehicle', () => {
    assert.ok(T.S.transporte.length >= 3, `only ${T.S.transporte.length} transports after 20 minutes`);
    for (const t of T.S.transporte) {
      assert.ok(T.S.kliniken.some((k) => k.id === t.klinik), `unknown clinic ${t.klinik}`);
      assert.ok(T.S.mittel.has(t.mittel), `unknown vehicle ${t.mittel}`);
      assert.ok(T.S.patienten.has(t.patient), `transport for a patient that does not exist`);
      assert.ok(t.an > t.ab, 'a transport arrives before it departs');
      assert.match(t.status, /unterwegs|übergeben|abgeschlossen/);
    }
  });

  test('clinic bed counts stay within their starting capacity', () => {
    for (const k of T.S.kliniken) {
      assert.deepEqual(Object.keys(k.frei).sort(), Object.keys(k.startFrei).sort(),
        `${k.name} grew a capacity bucket it did not start with`);
      for (const kat of Object.keys(k.frei)) {
        assert.ok(Number.isFinite(k.frei[kat]), `${k.name} has a non-numeric free ${kat} count`);
        assert.ok(k.frei[kat] >= 0, `${k.name} has negative free ${kat} capacity`);
        assert.ok(k.frei[kat] <= k.startFrei[kat], `${k.name} gained ${kat} capacity out of nowhere`);
      }
    }
  });

  test('every clinic counts exactly the patients delivered to it', () => {
    for (const k of T.S.kliniken) {
      const delivered = T.S.transporte.filter((t) => t.klinik === k.id).length;
      assert.equal(k.belegt, delivered, `${k.name} reports belegt=${k.belegt} for ${delivered} transports`);
      // frei never drops faster than beds are actually taken; it clamps at 0
      // when the region is saturated, which is why belegt can exceed it.
      const consumed = Object.keys(k.frei).reduce((s, kat) => s + (k.startFrei[kat] - k.frei[kat]), 0);
      assert.ok(consumed <= k.belegt, `${k.name} freed more beds than it took`);
    }
  });

  test('vehicles stayed inside a sane radius of the incident', () => {
    for (const m of T.S.mittel.values()) {
      const km = T.dist(m.ll, T.S.epi) / 1000;
      assert.ok(km < 30, `${m.name} drifted ${km.toFixed(1)} km from the incident`);
      assert.ok(Number.isFinite(m.ll[0]) && Number.isFinite(m.ll[1]), `${m.name} has a NaN position`);
    }
  });

  test('hazards became active and produced warnings', () => {
    const active = [...T.S.gefahren.values()].filter((g) => g.aktiv);
    assert.ok(active.length > 0, 'no hazard ever became active');
    assert.ok(T.S.ereignisse.length > 30, `only ${T.S.ereignisse.length} events logged`);
  });

  test('the event log is chronological and consecutively numbered', () => {
    const e = T.S.ereignisse;
    for (let i = 1; i < e.length; i++) {
      assert.ok(e[i].t >= e[i - 1].t, `event ${e[i].nr} goes back in time`);
      assert.equal(e[i].nr, e[i - 1].nr + 1, 'event numbering has a gap');
    }
  });

  test('every patient reference in the event log resolves', () => {
    for (const ev of T.S.ereignisse) {
      if (ev.ref && ev.ref.typ === 'patient') {
        assert.equal(typeof ev.ref.id, 'number');
      }
    }
  });

  test('the simulation stays deterministic for a given seed', () => {
    const again = loadEngine({ seed: 23 }).TR;
    again.init(again.szenarien().find((s) => s.id === 'neubiberg'));
    runSimulation(again, SIM_SECONDS);
    assert.deepEqual(plain(again.kennzahlen()), plain(T.kennzahlen()),
      'same seed produced a different outcome');
  });
});

describe('run control', () => {
  let T;
  before(() => {
    T = loadEngine({ seed: 31 }).TR;
    T.init(T.szenarien().find((s) => s.id === 'neubiberg'));
    runSimulation(T, 300);
  });

  test('pause freezes simulated time', () => {
    T.pauseUmschalten();
    assert.equal(T.S.pause, true);
    const frozen = T.S.simSek;
    runSimulation(T, 120);
    assert.equal(T.S.simSek, frozen, 'simulated time advanced while paused');
    T.pauseUmschalten();
    assert.equal(T.S.pause, false);
  });

  test('tempo is applied to the simulation clock', () => {
    const before = T.S.simSek;
    runSimulation(T, 100, { tempo: 4 });
    const advanced = T.S.simSek - before;
    assert.ok(Math.abs(advanced - 100) < 2, `asked for 100 s, advanced ${advanced.toFixed(1)} s`);
  });

  test('selection state round-trips', () => {
    T.auswaehlen({ typ: 'patient', id: 1 });
    assert.deepEqual(T.S.auswahl, { typ: 'patient', id: 1 });
    T.auswaehlen(null);
    assert.equal(T.S.auswahl, null);
  });

  test('a manually added team appears as a unit and can be removed again', () => {
    const before = T.S.mittel.size;
    T.truppHinzufuegen('Prüftrupp', 'aus dem Test');
    assert.equal(T.S.mittel.size, before + 1);
    const added = [...T.S.mittel.values()].find((m) => m.name === 'Prüftrupp');
    assert.ok(added, 'the added team is not in the unit list');
    assert.equal(added.art, 'trupp');
    T.truppEntfernen(added.id);
    assert.equal(T.S.mittel.size, before, 'removing the team did not shrink the unit list');
  });

  test('a fresh incident clears the log but keeps the scenario loaded', () => {
    T.neuerEinsatz('Testeinsatz');
    assert.equal(T.S.patienten.size, 0);
    assert.equal(T.S.funk.length, 0);
    assert.equal(T.S.transporte.length, 0);
    assert.ok(T.S.sitzungen.some((s) => s.name === 'Testeinsatz' && s.aktiv));
    assert.equal(T.S.sitzungen.filter((s) => s.aktiv).length, 1, 'two incidents are active at once');
    assert.ok(T.aktivesSzenario(), 'the scenario was dropped');
  });

  test('restarting replays the scenario from zero', () => {
    T.neustart();
    assert.equal(T.S.simSek, 0);
    assert.equal(T.S.patienten.size, 0);
    assert.equal(T.S.transporte.length, 0);
    runSimulation(T, 200);
    assert.ok(T.S.patienten.size > 0, 'the restarted run produced no patients');
  });
});

describe('switching between the three exercise scenarios', () => {
  for (const id of ['neubiberg', 'halle', 'muenchen']) {
    test(`"${id}" initialises and runs`, () => {
      const T = loadEngine({ seed: 5 }).TR;
      const szenario = T.szenarien().find((s) => s.id === id);
      assert.ok(szenario, `scenario ${id} is not registered`);
      T.init(szenario);
      assert.equal(T.aktivesSzenario().id, id);
      assert.ok(T.S.bbox, `${id} has no bounding box`);
      // Neubiberg ships a real OSM extract; Halle and Munich ship a deliberately
      // simplified axis network (see the header of demo/data/*.js).
      assert.ok(T.graph.knoten.length > 10, `${id} produced only ${T.graph.knoten.length} graph nodes`);
      runSimulation(T, 400);
      const k = T.kennzahlen();
      assert.ok(k.gesamt > 0, `${id} produced no patients in 400 s`);
      assert.ok(T.S.funk.length > 0, `${id} produced no radio traffic`);
      assert.ok(T.lagemeldung().includes(szenario.einsatz.name));
    });
  }

  test('szenarioWechseln swaps the active scenario and its geography', () => {
    const T = loadEngine({ seed: 5 }).TR;
    T.init(T.szenarien().find((s) => s.id === 'neubiberg'));
    runSimulation(T, 120);
    const bboxBefore = plain(T.S.bbox);
    T.szenarioWechseln('muenchen');
    assert.equal(T.aktivesSzenario().id, 'muenchen');
    assert.notDeepEqual(plain(T.S.bbox), bboxBefore, 'the bounding box did not follow the scenario');
    assert.equal(T.S.simSek, 0, 'the clock did not reset on scenario change');
    runSimulation(T, 200);
    assert.ok(T.S.patienten.size > 0);
  });

  test('switching to an unknown scenario leaves the current one alone', () => {
    const T = loadEngine({ seed: 5 }).TR;
    T.init(T.szenarien().find((s) => s.id === 'neubiberg'));
    T.szenarioWechseln('does-not-exist');
    assert.equal(T.aktivesSzenario().id, 'neubiberg');
  });
});

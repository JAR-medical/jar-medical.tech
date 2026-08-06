/* Prüfungen für die reine Logik des AR-Clients — kein Browser nötig.
 *
 *   node tests/logic.test.mjs        (oder: npm test)
 *
 * Geprüft wird, was still falsch sein könnte: jeder Pfad durch das
 * mSTaRT-Schema, das Schritt-zurück, die Kartenarithmetik und der Ablauf vom
 * Anlegen eines Patienten im Raum bis zur zugewiesenen Umhängekarte. Die
 * Darstellung (Canvas, WebXR, DOM) ist hier bewusst nicht dabei — die wird im
 * Browser geprüft.
 */

import { MStartSession, MAX_STEPS, NODES, FIRST_STEP } from "../js/mstart.js";
import { FieldMap, distance, nearest } from "../js/layout.js";
import { Workflow } from "../js/workflow.js";
import { resolvePatient, patientCount, createPatient, assignCard, cardHolder,
         tally, resetEinsatz } from "../js/data.js";

let run = 0, failed = 0;

function check(ok, what) {
  run++;
  if (ok) { console.log("  ok   " + what); return; }
  failed++;
  console.log("  FAIL " + what);
}

function near(a, b, what, eps = 0.01) {
  check(Math.abs(a - b) < eps, `${what} (${a.toFixed(3)} ≈ ${b.toFixed(3)})`);
}

/* ------------------------------------------------------------- mSTaRT */

function play(...answers) {
  const s = new MStartSession();
  for (const a of answers) s.answer(a);
  return s;
}

function allPaths() {
  const out = [];
  const stack = [[]];
  while (stack.length) {
    const prefix = stack.pop();
    const s = play(...prefix);
    if (s.done) { out.push(prefix); continue; }
    if (prefix.length >= MAX_STEPS) continue;
    stack.push([...prefix, true], [...prefix, false]);
  }
  return out;
}

function mstartBranches() {
  console.log("mSTaRT-Entscheidungsbaum");

  const bleeding = play(true);
  check(bleeding.done && bleeding.result.category === "SK1", "kritische Blutung → SK I");
  check(bleeding.result.measures.some((m) => m.includes("Blutstillung")), "Blutstillung als Sofortmaßnahme");

  check(play(false, true).result.category === "SK3", "gehfähig → SK III");

  const dead = play(false, false, false, false);
  check(dead.result.category === "DECEASED", "keine Atmung nach Freimachen → verstorben");
  check(dead.result.measures.some((m) => m.includes("Atemwege freimachen")), "Atemwege freimachen dokumentiert");

  check(play(false, false, false, true).result.category === "SK1", "Atmung erst nach Freimachen → SK I");
  check(play(false, false, true, true).result.category === "SK1", "AF außerhalb 10–30 → SK I");
  check(play(false, false, true, false, false).result.category === "SK1", "kein Radialispuls → SK I");
  check(play(false, false, true, false, true, false).result.category === "SK1", "befolgt keine Aufforderungen → SK I");

  const yellow = play(false, false, true, false, true, true);
  check(yellow.result.category === "SK2", "voller Durchlauf → SK II");
  check(yellow.answers.length === MAX_STEPS, `längster Pfad = MAX_STEPS (${MAX_STEPS})`);
  check(yellow.result.trail.length === MAX_STEPS, "Trail enthält jede Antwort");
  check(yellow.result.measures.length === 0, "kein Maßnahmen-Eintrag ohne Anlass");

  const paths = allPaths();
  const produced = new Set(paths.map((p) => play(...p).result.category));
  check(!produced.has("SK4"), "SK IV wird vom Algorithmus nicht vergeben");
  check(["SK1", "SK2", "SK3", "DECEASED"].every((c) => produced.has(c)),
        "SK I, II, III und verstorben sind erreichbar");
  check(paths.every((p) => play(...p).done), "jeder Pfad endet in einer Kategorie");

  const reached = new Set([FIRST_STEP]);
  for (const p of paths) {
    const s = new MStartSession();
    for (const a of p) { reached.add(s.current); s.answer(a); }
  }
  check(Object.keys(NODES).every((k) => reached.has(k)), "jeder Knoten ist erreichbar");
  check(Object.values(NODES).every((n) =>
          [n.yes, n.no].every((o) => (o.category !== null) !== (o.next !== null) &&
                                     (!o.next || NODES[o.next] !== undefined))),
        "jeder Ausgang zeigt genau auf Kategorie oder gültigen Folgeschritt");
}

function mstartBack() {
  console.log("mSTaRT Schritt zurück");

  const s = play(false, false, false);
  check(s.current === "atmungFrei", "steht bei der Nachkontrolle");
  check(s.stepNumber === 4, "Schritt 4 von 6");

  check(s.back() === true, "back() meldet Erfolg");
  check(s.current === "atmung", "eine Frage zurück");
  check(s.answers.length === 2, "Antwort entfernt");

  s.answer(true);
  check(s.current === "atemfrequenz", "andere Verzweigung erreichbar");
  s.answer(false); s.answer(true); s.answer(true);
  check(s.result.category === "SK2", "Ergebnis nach Korrektur = SK II");
  check(s.result.measures.length === 0, "zurückgenommene Sofortmaßnahme verworfen");

  check(new MStartSession().back() === false, "back() am Anfang meldet false");

  const done = play(true);
  done.answer(false);
  check(done.result.category === "SK1", "Antworten nach dem Ergebnis ändern nichts");
}

/* --------------------------------------------------------------- Akten */

function akten() {
  console.log("Patientenakten");
  resetEinsatz();

  check(patientCount() === 0, "Einsatz beginnt leer — keine Beispieldaten");

  const a = createPatient({ x: 1, y: 0, z: -2 });
  const b = createPatient({ x: 4, y: 0, z: -2 });
  check(a.marker_id === 1 && b.marker_id === 2, "laufende Nummern in Anlagereihenfolge");
  check(a.category === "UNSIGHTED", "frisch angelegt = ungesichtet");
  check(a.card === null, "frisch angelegt = ohne Karte");
  check(a.pos.x === 1 && a.pos.z === -2, "Position festgehalten");
  check(a.protocol.length === 1, "Anlegen steht im Protokoll");

  check(assignCard(1, 7).ok === true, "Karte 7 an Patient 1");
  check(cardHolder(7) === a, "Karte 7 gehört Patient 1");

  const clash = assignCard(2, 7);
  check(clash.ok === false && clash.takenBy === 1, "dieselbe Karte nicht zweimal");
  check(b.card === null, "abgelehnte Zuweisung ändert nichts");

  check(assignCard(2, 8).ok === true, "andere Karte geht");
  const t = tally();
  check(t.total === 2 && t.ohneKarte === 0, "Zählung stimmt");
  check(t.UNSIGHTED === 2, "beide noch ungesichtet");
}

/* ------------------------------------------------------------ Lagekarte */

function lagekarte() {
  console.log("Lagekarte");

  const map = new FieldMap({ minSpan: 8, padding: 2 });
  map.fit([], null);
  check(!map.ready, "ohne Punkte kein Ausschnitt");

  map.fit([{ x: 0, y: 0, z: 0 }], { x: 0, y: 0, z: 0 });
  check(map.spanMeters === 8, "einzelner Punkt → Mindestausschnitt");
  const c = map.project({ x: 0, y: 0, z: 0 });
  near(c.x, 0.5, "Mittelpunkt x");
  near(c.y, 0.5, "Mittelpunkt y");

  map.fit([{ x: -10, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }], { x: 0, y: 0, z: 0 });
  check(map.spanMeters === 24, "Ausschnitt wächst mit den Punkten (20 m + 2×2 Rand)");
  near(map.project({ x: -10, y: 0, z: 0 }).x, 0.5 - 10 / 24, "linker Punkt");
  near(map.project({ x: 10, y: 0, z: 0 }).x, 0.5 + 10 / 24, "rechter Punkt");

  // Oben auf der Karte ist die anfängliche Blickrichtung (−Z).
  check(map.project({ x: 0, y: 0, z: -5 }).y > 0.5, "−Z liegt oben");
  near(map.heading({ x: 0, y: 0, z: -1 }), 0, "Blick nach vorn = 0°");
  near(map.heading({ x: 1, y: 0, z: 0 }), 90, "Blick nach rechts = 90°");

  near(distance({ x: 0, y: 9, z: 0 }, { x: 3, y: 0, z: 4 }), 5, "Distanz ist waagerecht");

  resetEinsatz();
  const p1 = createPatient({ x: 0, y: 0, z: -1 });
  const p2 = createPatient({ x: 0, y: 0, z: -9 });
  const hit = nearest({ x: 0, y: 0, z: 0 }, [p1, p2], 2);
  check(hit && hit.patient === p1, "nächster Patient gefunden");
  check(nearest({ x: 0, y: 0, z: 0 }, [p2], 2) === null, "außerhalb des Radius → null");
}

/* ------------------------------------------------------------ Workflow */

function workflow() {
  console.log("Workflow");
  resetEinsatz();

  const w = new Workflow();
  const screens = [];
  w.onScreen = (s) => screens.push(s);
  w.start();

  const last = () => screens[screens.length - 1];
  const press = (re) => {
    const b = last().buttons.find((x) => re.test(x.label));
    if (!b) throw new Error("Knopf fehlt: " + re + " — da: " +
      last().buttons.map((x) => x.label).join(", "));
    b.action();
  };

  check(w.state === "lage", "startet bei der Lage");
  check(/kein Patient/i.test(last().headline), "leere Lage wird benannt");

  w.setPose({ x: 2, y: 1.7, z: -3 }, { x: 0, y: 0, z: -1 }, 0);
  press(/Neuer Patient/);
  check(w.state === "sichtung", "Anlegen führt direkt in die Sichtung");
  check(patientCount() === 1, "genau ein Patient angelegt");
  check(w.target.pos.x === 2 && w.target.pos.z === -3, "an der eigenen Position angelegt");
  check(w.target.pos.y === 0, "Marker liegt auf dem Boden, nicht auf Kopfhöhe");

  const answer = (yes) => press(yes ? /^JA$/ : /^NEIN$/);
  answer(false); answer(false); answer(true); answer(false); answer(true); answer(true);
  check(w.state === "ergebnis" && w.result.category === "SK2", "Ergebnis SK II");

  press(/Karte zuweisen/);
  check(w.state === "karte", "Kartenschritt");
  check(w.scanArmed === true, "Scanner scharf");
  check(/#1 übernehmen/.test(last().buttons.map((b) => b.label).join(" ")), "erste freie Nummer vorgeschlagen");

  press(/\+/);
  check(/#2 übernehmen/.test(last().buttons.map((b) => b.label).join(" ")), "Nummer erhöhen");
  press(/−/);
  press(/übernehmen/);

  check(w.state === "bestaetigt", "zugewiesen");
  check(resolvePatient(1).card === 1, "Karte in der Akte");
  check(resolvePatient(1).category === "SK2", "Kategorie in der Akte");
  check(resolvePatient(1).protocol.some((e) => /mSTaRT/.test(e.transcript)), "Antwortpfad im Protokoll");
  check(w.scanArmed === false, "Scanner wieder aus");

  press(/Weiter/);
  check(w.state === "lage", "zurück zur Lage");

  // Danebenstehen darf NICHTS aufmachen — ein Patient wird angeklickt.
  for (let i = 0; i < 5; i++) w.tick();
  check(w.state === "lage", "Nähe allein öffnet nichts");

  // Zweiter Patient, Karte, die schon vergeben ist.
  w.setPose({ x: 12, y: 1.7, z: -3 }, { x: 0, y: 0, z: -1 }, 0);
  press(/Neuer Patient/);
  answer(true);                                    // kritische Blutung → SK I
  check(w.result.category === "SK1", "zweiter Patient SK I");
  press(/Karte zuweisen/);
  w.onMarker(1);                                   // Karte 1 hat schon Patient 1
  check(w.state === "karte-belegt", "belegte Karte → Rückfrage");
  check(resolvePatient(2).card === null, "nichts gebucht bei belegter Karte");

  press(/entziehen/);
  check(resolvePatient(2).card === 1, "Karte umgehängt");
  check(resolvePatient(1).card === null, "voriger Träger hat sie nicht mehr");
  check(resolvePatient(1).protocol.some((e) => /entzogen/.test(e.transcript)), "Entzug protokolliert");

  press(/Weiter/);

  // Ein bestehender Patient wird über seinen Marker geöffnet.
  w.openPatient(resolvePatient(1));
  check(w.state === "approach" && w.target.marker_id === 1, "Marker öffnet den Patienten");
  check(last().buttons.some((b) => /Neu sichten/.test(b.label)), "Neusichtung angeboten");

  // SK IV nur als ausdrücklicher Override.
  press(/Neu sichten/);
  answer(true);
  const lna = last().buttons.find((b) => /SK IV/.test(b.label));
  check(!!lna, "SK-IV-Knopf auf dem Ergebnisschirm");
  lna.action();
  check(w.result.category === "SK4" && /LNA/.test(w.result.why), "Override setzt SK IV und vermerkt es");

  // Kartenmodell auf der Lagekarte
  const m = w.mapModel();
  check(m.dots.length === 2, "beide Patienten auf der Karte");
  check(m.counts.total === 2, "Zählung im Kartenmodell");
  check(m.medic && typeof m.medic.heading === "number", "eigene Position mit Blickrichtung");

  const tags = w.worldTags();
  check(tags.length >= 1, "Marker am Boden für Patienten in der Nähe");
  check(tags.every((t) => t.pos.y === 0), "alle Marker auf Bodenhöhe");
  check(w.cardAnchor() !== null, "Handlungskarte hat einen Ankerpunkt beim Patienten");
}

/* ---------------------------------------------------------------- main */

mstartBranches();
mstartBack();
akten();
lagekarte();
workflow();

console.log();
console.log(failed === 0
  ? `${run} Prüfungen, alle bestanden.`
  : `${run} Prüfungen, ${failed} fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);

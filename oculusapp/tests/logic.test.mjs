/* Prüfungen für die reine Logik des AR-Clients — kein Browser nötig.
 *
 *   node tests/logic.test.mjs        (oder: npm test)
 *
 * Geprüft wird, was still falsch sein könnte: jeder Pfad durch das
 * mSTaRT-Schema, das Schritt-zurück, die Rasterarithmetik der Lagekarte und der
 * Ablauf des Workflows bis zur gebuchten Karte. Die Darstellung (Canvas, WebXR,
 * DOM) ist hier bewusst nicht dabei — die wird im Browser geprüft.
 */

import { MStartSession, MAX_STEPS, NODES, FIRST_STEP } from "../js/mstart.js";
import { ScenarioLayout, parseCell, columnLabel } from "../js/layout.js";
import { Workflow } from "../js/workflow.js";
import { MARKER_IDS, resolvePatient, setCategory } from "../js/data.js";

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

/** Alle Antwortfolgen, die zu einem Ergebnis führen. */
function allPaths() {
  const out = [];
  const stack = [[]];
  while (stack.length) {
    const prefix = stack.pop();
    const s = play(...prefix);
    if (s.done) { out.push(prefix); continue; }
    if (prefix.length >= MAX_STEPS) continue;      // Schutz gegen Zyklen
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

  // Jeder Knoten ist erreichbar und jeder Ausgang zeigt auf etwas Gültiges.
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

/* -------------------------------------------------------- Rasterzellen */

function cells() {
  console.log("Rasterzellen");

  const c2 = parseCell("C2");
  check(c2 && c2.col === 2 && c2.row === 2, '"C2" → Spalte 2, Reihe 2');
  const a10 = parseCell("a10");
  check(a10 && a10.col === 0 && a10.row === 10, '"a10" → Spalte 0, Reihe 10');
  const g6 = parseCell(" G6 ");
  check(g6 && g6.col === 6 && g6.row === 6, "Leerzeichen toleriert");
  check(parseCell("") === null, "leer → null");
  check(parseCell(null) === null, "null → null");
  check(parseCell("2C") === null, '"2C" → null');
  check(parseCell("C") === null, '"C" → null');
  check(parseCell("C0") === null, "Reihe 0 → null");
  check(parseCell("C2x") === null, '"C2x" → null');
  check(columnLabel(0) === "A" && columnLabel(6) === "G", "Spaltenbeschriftung");
}

function layoutMaths() {
  console.log("Feld-Layout");

  const patients = MARKER_IDS.map(resolvePatient);
  const layout = new ScenarioLayout({ cellSize: 3, fieldDistance: 6 });
  layout.build(patients);

  check(layout.hasCells, "Zellen aus dem Datensatz gelesen");
  check(layout.minCol === 0 && layout.maxCol === 6, "Spalten A–G");
  check(layout.minRow === 2 && layout.maxRow === 6, "Reihen 2–6");
  check(layout.columns === 7 && layout.rows === 5, "7 Spalten, 5 Reihen");
  check(layout.cellLabel(1) === "C2", "Patient 1 steht auf C2");

  check(!layout.aligned, "vor dem Ausrichten nicht ausgerichtet");
  layout.align({ x: 0, y: 1.7, z: 0 }, { x: 0, y: 0, z: 1 });
  check(layout.aligned, "nach align() ausgerichtet");

  // C2, Feldmitte 6 m voraus: lokal (-3, -6) → Welt (-3, 0).
  const w1 = layout.world(1);
  near(w1.x, -3, "Patient 1 x");
  near(w1.z, 0, "Patient 1 z");

  const w6 = layout.world(6);
  near(w6.x, 9, "Patient 6 (G6) x");
  near(w6.z, 12, "Patient 6 (G6) z");

  near(layout.distance(1, { x: 0, y: 1.7, z: 0 }), 3, "Distanz ist waagerecht");

  const near1 = layout.nearest({ x: 0, y: 1.7, z: 0 }, MARKER_IDS, 4);
  check(near1 && near1.markerId === 1, "nächster Patient ist #1");
  near(near1.distance, 3, "Distanz zum nächsten");
  check(layout.nearest({ x: 0, y: 0, z: 0 }, MARKER_IDS, 1) === null, "außerhalb des Radius → null");

  // Gedrehte Ausrichtung spiegelt das Feld, Abstände bleiben.
  const rotated = new ScenarioLayout({ cellSize: 3, fieldDistance: 6 });
  rotated.build(patients);
  rotated.align({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });
  const r1 = rotated.world(1);
  near(r1.x, 3, "gedreht: x gespiegelt");
  near(r1.z, 0, "gedreht: z gespiegelt");
  near(rotated.distance(1, { x: 0, y: 0, z: 0 }), 3, "Distanz bleibt gleich");

  // Karte: wer auf der Zelle steht, sitzt auf dem Punkt des Patienten.
  const uvMedic = layout.normalizedFromWorld(layout.world(1));
  const uvPatient = layout.normalizedFor(1);
  near(uvMedic.x, uvPatient.x, "Karte: x deckt sich");
  near(uvMedic.y, uvPatient.y, "Karte: y deckt sich");

  near(layout.headingDegrees({ x: 0, y: 0, z: 1 }), 0, "Blick nach vorn = 0°");
  near(layout.headingDegrees({ x: 1, y: 0, z: 0 }), 90, "Blick nach rechts = 90°");

  const empty = new ScenarioLayout();
  empty.build([]);
  check(!empty.hasCells && empty.columns === 1 && empty.rows === 1, "leerer Datensatz bleibt benutzbar");
  check(empty.nearest({ x: 0, y: 0, z: 0 }, [], 5) === null, "leer → kein Treffer");
}

/* ------------------------------------------------------------ Workflow */

function workflow() {
  console.log("Workflow");

  const w = new Workflow();
  const screens = [];
  w.onScreen = (s) => screens.push(s);
  w.start();

  check(w.state === "align", "startet beim Ausrichten");
  const alignScreen = screens[screens.length - 1];
  check(alignScreen.buttons.some((b) => /ausrichten/i.test(b.label)), "Ausrichten-Knopf angeboten");

  w.setPose({ x: 0, y: 1.7, z: 0 }, { x: 0, y: 0, z: 1 });
  alignScreen.buttons.find((b) => /ausrichten/i.test(b.label)).action();
  check(w.state === "lage", "nach dem Ausrichten in der Lage");

  // Zu Patient 1 laufen (C2 → 3 m vor der Ausrichtungspose).
  w.setPose({ x: -3, y: 1.7, z: 0 }, { x: 0, y: 0, z: 1 });
  w.tick();
  check(w.state === "approach" && w.target === 1, "Anlaufen erkannt (#1)");

  const approach = screens[screens.length - 1];
  const startBtn = approach.buttons.find((b) => /Sichtung starten/i.test(b.label));
  check(!!startBtn, "„Sichtung starten“ angeboten");
  startBtn.action();
  check(w.state === "sichtung", "Sichtung läuft");

  // Blutung nein, gehfähig nein, Atmung ja, AF nein, Puls ja, folgt ja → SK II
  const answer = (yes) => {
    const s = screens[screens.length - 1];
    s.buttons.find((b) => b.label === (yes ? "JA" : "NEIN")).action();
  };
  answer(false); answer(false); answer(true); answer(false); answer(true); answer(true);
  check(w.state === "ergebnis", "Ergebnis erreicht");
  check(w.result.category === "SK2", "Ergebnis SK II");

  screens[screens.length - 1].buttons.find((b) => /Karte scannen/i.test(b.label)).action();
  check(w.state === "scan", "Kartenschritt");
  check(w.scanArmed === true, "Scanner scharf");

  // Falsche Karte darf nichts buchen.
  w.onMarker(7);
  check(w.state === "scan-mismatch", "falsche Karte → Rückfrage");
  check(resolvePatient(1).category !== "SK2", "nichts gebucht bei falscher Karte");

  screens[screens.length - 1].buttons.find((b) => /Nochmal/i.test(b.label)).action();
  check(w.state === "scan", "zurück zum Scannen");

  w.onMarker(1);
  check(w.state === "bestaetigt", "richtige Karte → gebucht");
  check(w.scanArmed === false, "Scanner wieder aus");
  check(resolvePatient(1).category === "SK2", "Kategorie in der Akte");
  check(resolvePatient(1).protocol.some((e) => /mSTaRT/.test(e.transcript)), "Antwortpfad im Protokoll");
  check(w.done.has(1), "Patient als gesichtet vermerkt");

  screens[screens.length - 1].buttons.find((b) => /Nächster/i.test(b.label)).action();
  check(w.state === "lage", "zurück zur Lage");

  // Direkt daneben stehen bleiben darf nicht sofort zurückspringen.
  w.tick();
  check(w.state === "lage", "gerade verlassener Patient wird nicht neu gegriffen");

  // Weggehen und wiederkommen darf ihn wieder anbieten.
  w.setPose({ x: -30, y: 1.7, z: 0 }, { x: 0, y: 0, z: 1 });
  w.tick();
  w.setPose({ x: -3, y: 1.7, z: 0 }, { x: 0, y: 0, z: 1 });
  w.tick();
  check(w.state === "approach" && w.target === 1, "nach dem Weggehen wieder anlaufbar");

  // SK IV nur als ausdrücklicher Override.
  const w2 = new Workflow();
  w2.onScreen = (s) => screens.push(s);
  w2.start();
  w2.setPose({ x: 0, y: 1.7, z: 0 }, { x: 0, y: 0, z: 1 });
  w2.alignHere();
  w2.selectPatient(3);
  w2.startSichtung();
  w2.answer(true);                       // kritische Blutung → SK I
  check(w2.result.category === "SK1", "Override-Test: erst SK I");
  const lna = screens[screens.length - 1].buttons.find((b) => /SK IV/.test(b.label));
  check(!!lna, "SK-IV-Knopf auf dem Ergebnisschirm");
  lna.action();
  check(w2.result.category === "SK4", "Override setzt SK IV");
  check(/LNA/.test(w2.result.why), "Override ist als ärztliche Entscheidung vermerkt");

  // Ohne Kamera muss der Kartenschritt manuell abschließbar bleiben.
  w2.enterScan();
  check(w2.state === "scan", "Kartenschritt ohne Kamera erreichbar");
  const manual = screens[screens.length - 1].buttons.find((b) => /Manuell/i.test(b.label));
  check(!!manual, "manuelle Bestätigung angeboten, wenn kein Scanner läuft");
  manual.action();
  check(resolvePatient(3).category === "SK4", "manuell gebucht");

  setCategory(1, "SK2");   // Datensatz ist ein Modul-Singleton — Zustand egal machen
}

/* ---------------------------------------------------------------- main */

mstartBranches();
mstartBack();
cells();
layoutMaths();
workflow();

console.log();
console.log(failed === 0
  ? `${run} Prüfungen, alle bestanden.`
  : `${run} Prüfungen, ${failed} fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);

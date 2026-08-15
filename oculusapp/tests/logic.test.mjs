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
import { TASKS, findTask, primaryLabel, MEASURES } from "../js/tasks.js";
import { REGIONS, pickRegion, FINDINGS } from "../js/body.js";
import { parseCommand } from "../js/voice.js";
import { CELLS, ANCHORS, COLS, ROWS, PANEL_W, PANEL_H, cellRect, cellAt,
         PanelPress, coveredCell } from "../js/wristband.js";
import { mul, matTranslate, matBasis, matRotY, matRotX, matScale,
         intoModel } from "../js/xr.js";
import { resolvePatient, patientCount, createPatient, assignCard, cardHolder,
         tally, resetEinsatz } from "../js/data.js";
import { Spring, AngleSpring, Decay, VelocityTracker, SPRINGS, DECELERATION,
         project, nearestSnap, rubberband, clampRubber,
         setReducedMotion } from "../js/motion.js";
import { fovFromProjection, fitToFov, displayProfile, paletteFor,
         sessionLadder } from "../js/display.js";

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
  // Knöpfe stehen auf dem Ablaufschirm oder — was jederzeit geht — am HUD-Rand.
  const all = () => [...last().buttons, ...last().hudActions];
  const press = (re) => {
    const b = all().find((x) => re.test(x.label));
    if (!b) throw new Error("Knopf fehlt: " + re + " — da: " +
      all().map((x) => x.label).join(", "));
    b.action();
  };

  check(w.state === "auftrag", "startet bei der Tätigkeitswahl");
  check(last().buttons.length === TASKS.length, "jede Tätigkeit steht zur Wahl");
  press(/^Vorsichtung$/);
  check(w.state === "lage" && w.task.id === "vorsichtung", "Wahl führt in die Lage");
  check(/kein Patient/i.test(last().headline), "leere Lage wird benannt");
  check(last().showCard === false, "die Lage zeigt keinen großen Schirm");
  check(last().hudActions.some((b) => /Neuer Patient/.test(b.label)),
        "„Neuer Patient“ ist ein kleiner Knopf am HUD-Rand");
  check(last().buttons.length === 0, "und steht nicht auf dem Ablaufschirm");

  w.setPose({ x: 2, y: 1.7, z: -3 }, { x: 0, y: 0, z: -1 }, 0);
  press(/Neuer Patient/);
  check(w.state === "sichtung", "ohne Zeiger führt Anlegen direkt in die Sichtung");
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

/* ------------------------------------------------------- Stelle am Boden */

/** Kleiner Prüfstand: ein Ablauf, seine Schirme und ein Knopfdruck. */
function rig(opts = {}) {
  const w = new Workflow(opts);
  const screens = [];
  w.onScreen = (s) => screens.push(s);
  w.start();
  const last = () => screens[screens.length - 1];
  const all = () => [...last().buttons, ...last().hudActions];
  const press = (re) => {
    const b = all().find((x) => re.test(x.label));
    if (!b) throw new Error("Knopf fehlt: " + re + " — da: " +
      all().map((x) => x.label).join(", "));
    b.action();
  };
  return { w, last, all, press };
}

function platzieren() {
  console.log("Patient anlegen — Stelle am Boden");
  resetEinsatz();

  const { w, last, press } = rig({ pointing: true });
  press(/^Vorsichtung$/);
  w.setPose({ x: 0, y: 1.7, z: 0 }, { x: 0, y: 0, z: -1 }, 0);

  press(/Neuer Patient/);
  check(w.state === "platzieren", "mit Zeiger wird erst die Stelle gewählt");
  check(last().placing === true, "der Schirm sagt der AR-Ebene, dass gezeigt wird");
  check(last().showCard === false, "auch dabei bleibt die Mitte frei");
  check(patientCount() === 0, "vor der Bestätigung entsteht nichts");

  press(/Abbrechen/);
  check(w.state === "lage" && patientCount() === 0, "Abbrechen legt nichts an");

  press(/Neuer Patient/);
  w.placeAt({ x: 3.5, y: 0, z: -4.25 });
  check(patientCount() === 1, "die bestätigte Stelle legt den Patienten an");
  check(w.target.pos.x === 3.5 && w.target.pos.z === -4.25, "er liegt dort, wohin gezeigt wurde");
  check(w.target.pos.y === 0, "und auf dem Boden");
  check(w.state === "sichtung", "danach geht es weiter wie gewohnt");

  // Ohne brauchbaren Punkt bleibt der eigene Standort der Notbehelf.
  w.goToLage();
  w.setPose({ x: -2, y: 1.7, z: 7 }, { x: 0, y: 0, z: -1 }, 0);
  press(/Neuer Patient/);
  w.placeAt(null);
  check(w.target.pos.x === -2 && w.target.pos.z === 7, "ohne Punkt: am eigenen Standort");

  // Ein Patient entsteht nur aus der Lage heraus, nicht mitten im Ablauf.
  const before = patientCount();
  w.placeAt({ x: 99, y: 0, z: 99 });
  check(patientCount() === before, "während der Sichtung legt nichts an");
}

/* ------------------------------------------------------------ Tätigkeiten */

function taetigkeiten() {
  console.log("Tätigkeiten");

  // --- ärztliche Sichtung: Kategorie wird gesetzt, nicht errechnet ---------
  resetEinsatz();
  {
    const { w, last, press } = rig();
    press(/^Sichtung/);
    check(w.task.id === "sichtung", "ärztliche Sichtung gewählt");
    w.setPose({ x: 0, y: 1.7, z: 0 }, { x: 0, y: 0, z: -1 }, 0);
    press(/Neuer Patient/);
    check(w.state === "kategorie", "kein mSTaRT, sondern die Kategoriewahl");
    check(last().buttons.some((b) => /BLAU/.test(b.label)),
          "SK IV ist hier reguläre Wahl, kein Override");

    press(/^GELB$/);
    check(resolvePatient(1).category === "SK2", "Kategorie in der Akte");
    check(w.state === "karte", "ohne Karte geht es zum Kartenschritt");
    check(resolvePatient(1).protocol.some((e) => /Ärztliche Sichtung/.test(e.transcript)),
          "als ärztliche Sichtung protokolliert");
    check(resolvePatient(1).protocol.every((e) => e.task === "Sichtung (ärztlich)"),
          "die Tätigkeit steht in jeder Protokollzeile");
    check(!resolvePatient(1).protocol.some((e) => /mSTaRT/.test(e.transcript)),
          "kein mSTaRT-Pfad untergeschoben");

    press(/übernehmen/);
    check(w.state === "bestaetigt" && resolvePatient(1).card === 1, "Karte zugewiesen");
  }

  // --- Registrierung: direkt zum Kartenschritt ----------------------------
  {
    const { w, press } = rig();
    press(/^Registrierung$/);
    w.openPatient(resolvePatient(1));
    check(w.state === "approach", "Marker öffnet den Patienten");
    check(primaryLabel(findTask("registrierung"), resolvePatient(1)) === "Karte ändern",
          "hat schon eine Karte → „Karte ändern“");
    press(/Karte ändern/);
    check(w.state === "karte", "Registrierung springt in den Kartenschritt");
    check(w._cardDraft === 1, "die getragene Nummer steht schon da");
    press(/\+/);
    press(/übernehmen/);
    check(resolvePatient(1).card === 2, "Nummer geändert");
    check(resolvePatient(1).category === "SK2", "die Kategorie bleibt unangetastet");
  }

  // --- Behandlung & Transport --------------------------------------------
  {
    const { w, last, press } = rig();
    press(/^Behandlung/);
    check(w.task.canCreate === false, "Behandlung legt keine Patienten an");
    check(last().hudActions.every((b) => !/Neuer Patient/.test(b.label)),
          "und bietet den Knopf gar nicht erst an");
    const vorher = patientCount();
    w.placeAt({ x: 5, y: 0, z: 5 });
    check(patientCount() === vorher && w.state === "lage",
          "auch eine von außen gereichte Stelle legt dann nichts an");

    w.openPatient(resolvePatient(1));
    press(/^Behandlung$/);
    check(w.state === "behandlung", "Behandlungsschirm");

    press(new RegExp("^" + MEASURES[0] + "$"));
    check(resolvePatient(1).treatments.includes(MEASURES[0]), "Maßnahme festgehalten");
    press(new RegExp("✓ " + MEASURES[0]));
    check(!resolvePatient(1).treatments.includes(MEASURES[0]), "nochmal drücken nimmt sie zurück");
    check(resolvePatient(1).protocol.some((e) => /zurückgenommen/.test(e.transcript)),
          "die Rücknahme steht im Protokoll");

    press(/^Abtransport$/);
    check(resolvePatient(1).transported === true, "Abtransport gebucht");
    check(w.state === "bestaetigt", "und abgeschlossen");
    check(/abtransportiert/.test(last().headline), "der Abschluss benennt ihn");
    check(tally().abtransportiert === 1, "Zählung kennt den Abtransport");
    check(w.worldTags()[0].transported === true, "der Bodenmarker weiß davon");
  }

  // --- Wechsel jederzeit ---------------------------------------------------
  {
    const { w, press } = rig();
    press(/^Vorsichtung$/);
    press(/Tätigkeit/);
    check(w.state === "auftrag", "Tätigkeit lässt sich aus der Lage wechseln");
  }
}

/* ------------------------------------------------------------ Körpermodell */

function koerper() {
  console.log("Körpermodell und Befunde");
  resetEinsatz();

  const { w, last, press } = rig();
  press(/^Vorsichtung$/);
  w.setPose({ x: 0, y: 1.7, z: 0 }, { x: 0, y: 0, z: -1 }, 0);
  press(/Neuer Patient/);
  press(/^JA$/);                                   // Blutung → SK I
  press(/Karte zuweisen/); press(/übernehmen/); press(/Weiter/);

  check(w.bodyModel() === null, "in der Lage steht kein Körpermodell");

  w.openPatient(resolvePatient(1));
  const bm = w.bodyModel();
  check(bm !== null, "am geöffneten Patienten steht es");
  check(bm.pos === resolvePatient(1).pos, "und zwar an dessen Stelle, nicht am Kopf");

  // Geometrie: jede Region ist auch wirklich zu treffen.
  check(REGIONS.length === 13, "dreizehn Körperregionen");
  const front = pickRegion({ x: 0, y: 0.757, z: 3 }, { x: 0, y: 0, z: -1 });
  check(front && front.id === "thorax", "Strahl von vorn auf Brusthöhe trifft den Thorax");
  const head = pickRegion({ x: 0, y: 0.945, z: 3 }, { x: 0, y: 0, z: -1 });
  check(head && head.id === "kopf", "auf Scheitelhöhe den Kopf");
  const left = pickRegion({ x: 0.14, y: 0.749, z: 3 }, { x: 0, y: 0, z: -1 });
  check(left && left.id === "arm-li-ober", "+x ist die linke Seite des Patienten");
  check(pickRegion({ x: 0, y: 3, z: 3 }, { x: 0, y: 0, z: -1 }) === null,
        "über dem Scheitel trifft nichts");

  // Befund eintragen, streichen, wieder eintragen.
  w.pickRegion("bein-re-unter");
  check(w.state === "befund", "Region öffnet den Befundschirm");
  check(last().headline === "Unterschenkel rechts", "die Region steht darüber");

  press(/^Fraktur$/);
  const p = resolvePatient(1);
  check(p.injuries.length === 1, "Befund in der Akte");
  check(p.injuries[0].region === "bein-re-unter" && p.injuries[0].text === "Fraktur",
        "am richtigen Körperteil");
  check(w.bodyModel().findings["bein-re-unter"][0] === "Fraktur", "das Modell weiß davon");
  check(p.protocol.some((e) => /Befund: Fraktur/.test(e.transcript)), "protokolliert");

  press(/✓ Fraktur/);
  check(p.injuries.length === 0, "nochmal drücken streicht ihn");
  check(p.protocol.some((e) => /gestrichen/.test(e.transcript)), "auch das steht im Protokoll");

  press(/^Blutung$/);
  press(/Fertig/);
  check(w.state === "approach", "Fertig führt zurück zum Patienten");
  check(last().body.some((b) => /Unterschenkel rechts: Blutung/.test(b.text)),
        "der Befund steht am Patienten");

  // Aus der Lage heraus lässt sich keine Region wählen — es gibt keinen Patienten.
  w.goToLage();
  w.pickRegion("kopf");
  check(w.state === "lage", "ohne offenen Patienten passiert nichts");
}

/* ------------------------------ Zeigen auf das Modell in der Brille */

/**
 * In AR steht das Körpermodell gedreht und verschoben im Raum; getroffen wird
 * es, indem der Strahl in den Modellraum zurückgerechnet wird. Genau diese
 * Rückrechnung (`intoModel` in xr.js) lässt sich ohne Headset sonst nicht
 * prüfen — hier gegen die Vorwärtsrichtung gegengerechnet.
 */
function modellraum() {
  console.log("Körpermodell im Raum");

  const scale = 0.62;
  const face = { right: { x: 0.6, y: 0, z: -0.8 },
                 up: { x: 0, y: 1, z: 0 },
                 normal: { x: 0.8, y: 0, z: 0.6 } };

  const M = mul(mul(matTranslate(3, 1.06, -4), matBasis(face)),
                mul(mul(matRotY(0.7), matRotX(-0.3)),
                    mul(matScale(scale), matTranslate(0, -0.5, 0))));

  // Vorwärts: Modellpunkt → Welt, wie es der Shader täte.
  const forward = (p) => ({
    x: M[0] * p.x + M[4] * p.y + M[8] * p.z + M[12],
    y: M[1] * p.x + M[5] * p.y + M[9] * p.z + M[13],
    z: M[2] * p.x + M[6] * p.y + M[10] * p.z + M[14],
  });

  for (const p of [{ x: 0, y: 0.5, z: 0 }, { x: 0.14, y: 0.945, z: 0.05 },
                   { x: -0.05, y: 0.02, z: -0.03 }]) {
    const back = intoModel(M, scale, forward(p), true);
    near(back.x, p.x, "Punkt kommt zurück (x)", 1e-4);
    near(back.y, p.y, "Punkt kommt zurück (y)", 1e-4);
    near(back.z, p.z, "Punkt kommt zurück (z)", 1e-4);
  }

  const eye = { x: 3, y: 1.6, z: 0 };
  const shoot = (p) => {
    const w = forward(p);
    const d = { x: w.x - eye.x, y: w.y - eye.y, z: w.z - eye.z };
    const len = Math.hypot(d.x, d.y, d.z);
    const dir = { x: d.x / len, y: d.y / len, z: d.z / len };
    return { hit: pickRegion(intoModel(M, scale, eye, true), intoModel(M, scale, dir, false)), len };
  };

  // Auf den Kopf zielen: den verdeckt aus keiner Drehung etwas.
  const head = shoot({ x: 0, y: 0.945, z: 0 });
  check(head.hit !== null, "Strahl aus der Welt trifft das Modell");
  check(head.hit && head.hit.id === "kopf", "auf den Kopf gezielt trifft den Kopf");
  check(head.hit && Math.abs(head.hit.t - head.len) < 0.12,
        `Strahlparameter ist die Weltentfernung (${head.hit ? head.hit.t.toFixed(2) : "—"} ≈ ${head.len.toFixed(2)})`);

  // Auf die Brust gezielt trifft bei dieser Drehung den davorstehenden Arm —
  // das Nächstliegende gewinnt, sonst würde man durch den Patienten hindurch
  // Befunde eintragen.
  const chest = shoot({ x: 0, y: 0.757, z: 0 });
  check(chest.hit && chest.hit.id === "arm-re-ober",
        "was davorsteht, gewinnt (hier der Oberarm vor dem Thorax)");
  check(chest.hit && chest.hit.t < chest.len, "und liegt näher als das Ziel dahinter");
}

/* --------------------------------------------------------------- Sprache */

function sprache() {
  console.log("Spracheingabe");

  const t = (s) => { const c = parseCommand(s); return c ? c.type : null; };
  check(t("ja") === "yes", "„ja“");
  check(t("nein") === "no", "„nein“");
  check(t("Ja, er atmet") === "yes", "ganzer Satz mit ja");
  check(t("nein, keine Atmung") === "no", "ganzer Satz mit nein");
  check(t("nee") === "no" && t("jawohl") === "yes", "umgangssprachliche Formen");
  check(t("negativ") === "no" && t("korrekt") === "yes", "Funksprache");
  // „nein“ muss vor „ja“ greifen, sonst kippt ein Widerspruch ins Gegenteil.
  check(t("nein ja doch nein") === "no", "Verneinung schlägt Bejahung");
  check(t("zurück") === "back", "„zurück“ nimmt einen Schritt zurück");
  check(t("abbrechen") === "close", "„abbrechen“ bricht ab");
  check(t("wetterbericht") === null, "Unbeteiligtes wird nicht gedeutet");

  // Am Ablauf: die sechs Fragen lassen sich durchsprechen.
  resetEinsatz();
  const { w, press } = rig();
  press(/^Vorsichtung$/);
  w.setPose({ x: 0, y: 1.7, z: 0 }, { x: 0, y: 0, z: -1 }, 0);
  press(/Neuer Patient/);
  check(w.state === "sichtung", "Sichtung läuft");

  const say = (s) => w.handleSpeech(parseCommand(s));
  check(say("nein") === true, "gesprochenes Nein wird angenommen");
  check(w.session.answers.length === 1, "und beantwortet die Frage");
  say("nein"); say("ja"); say("nein"); say("ja");
  check(w.session.answers.length === 5, "fünf Fragen gesprochen beantwortet");

  say("zurück");
  check(w.session.answers.length === 4, "„zurück“ nimmt die letzte zurück");
  say("ja"); say("ja");
  check(w.state === "ergebnis" && w.result.category === "SK2",
        "der ganze Fragebogen ist sprechbar — Ergebnis SK II");

  check(w.handleSpeech(parseCommand("wetterbericht")) === false,
        "Unverstandenes ändert nichts");
  check(say("weiter") === true && w.state === "karte",
        "„weiter“ drückt den Hauptknopf des Schirms");
}

/* --------------------------------------------------------------- Armband */

function armband() {
  console.log("Armband");

  // --- Raster: Felder dürfen sich nicht überlappen und müssen treffbar sein.
  check(CELLS.length === COLS * ROWS, `${CELLS.length} Felder in ${COLS}×${ROWS}`);
  const marks = new Set([...CELLS.map((c) => c.marker), ...ANCHORS]);
  check(marks.size === CELLS.length + ANCHORS.length,
        "jede Markernummer kommt nur einmal vor");
  check(CELLS.every((c) => cellAt(cellRect(c).x, cellRect(c).y) === c),
        "jedes Feld wird in seiner Mitte getroffen");
  check(cellAt(0, PANEL_H) === null, "über dem Band trifft nichts");
  check(cellAt(PANEL_W, 0) === null, "neben dem Band trifft nichts");

  // Nachbarfelder dürfen nicht ineinanderlaufen: knapp diesseits der Kante
  // muss noch das eigene Feld kommen, knapp jenseits das andere.
  const a = CELLS[0], b = CELLS[1];
  const ra = cellRect(a);
  check(cellAt(ra.x + ra.w / 2 - 0.001, ra.y) === a, "innen an der Kante noch das eigene Feld");
  check(cellAt(ra.x + ra.w / 2 + 0.001, ra.y) === b, "außen an der Kante schon das nächste");

  // --- Auslösen: halten, entprellen, loslassen.
  const fired = [];
  const p = new PanelPress((action) => fired.push(action), { hold: 200, cool: 500 });

  p.update(CELLS[0], 0);
  check(fired.length === 0, "Berühren allein löst nicht aus");
  p.update(CELLS[0], 100);
  check(fired.length === 0, "vor Ablauf der Haltezeit auch nicht");
  p.update(CELLS[0], 250);
  check(fired.length === 1 && fired[0] === "ja", "nach der Haltezeit löst es aus");

  p.update(CELLS[0], 400);
  p.update(CELLS[0], 900);
  check(fired.length === 1, "liegenbleiben feuert nicht nach");

  p.update(null, 950);                       // losgelassen
  p.update(CELLS[0], 1000);
  p.update(CELLS[0], 1300);
  check(fired.length === 2, "nach dem Loslassen geht dasselbe Feld wieder");

  // Über ein Nachbarfeld streifen darf nichts auslösen.
  const q = new PanelPress((action) => fired.push(action), { hold: 200, cool: 0 });
  q.update(CELLS[0], 0);
  q.update(CELLS[1], 50);                    // gewandert → Haltezeit neu
  q.update(CELLS[2], 100);
  q.update(CELLS[2], 180);
  check(fired.length === 2, "Streifen über Felder löst nichts aus");
  q.update(CELLS[2], 320);
  check(fired.length === 3 && fired[2] === "zurueck", "erst Liegenbleiben löst aus");

  // --- Kameraweg: Verdeckung.
  const all = new Set([...CELLS.map((c) => c.marker), ...ANCHORS]);
  check(coveredCell(all, all) === null, "alles sichtbar → nichts verdeckt");

  const oneGone = new Set(all); oneGone.delete(CELLS[3].marker);
  check(coveredCell(oneGone, all) === CELLS[3], "ein fehlender Marker = Finger darauf");

  const twoGone = new Set(oneGone); twoGone.delete(CELLS[4].marker);
  check(coveredCell(twoGone, all) === null,
        "zwei fehlende sind kein Druck, sondern ein schräg gehaltenes Band");

  const noAnchor = new Set(all);
  for (const x of ANCHORS) noAnchor.delete(x);
  noAnchor.delete(CELLS[0].marker);
  check(coveredCell(noAnchor, all) === null,
        "ohne Anker ist das Band aus dem Bild — kein Druck");

  // Ein Feld, das noch nie zu sehen war, gilt nicht als verdeckt.
  const nieGesehen = new Set([...ANCHORS]);
  check(coveredCell(nieGesehen, nieGesehen) === null,
        "was nie sichtbar war, kann nicht verdeckt sein");
}

/* ------------------------------------------ Anzeige beim Herantreten */

function anzeige() {
  console.log("Anzeige über dem Marker");
  resetEinsatz();

  const { w, press } = rig();
  press(/^Vorsichtung$/);
  w.setPose({ x: 0, y: 1.7, z: 0 }, { x: 0, y: 0, z: -1 }, 0);
  press(/Neuer Patient/);
  press(/^JA$/); press(/Karte zuweisen/); press(/übernehmen/); press(/Weiter/);

  w.setPose({ x: 0, y: 1.7, z: -2 }, { x: 0, y: 0, z: -1 }, 0);
  const tag = w.worldTags()[0];
  check(Math.abs(tag.distance - 2) < 0.001, "der Marker kennt seine Entfernung");
  check(tag.label === "SK I — rot", "und die Kategorie im Klartext");
  check(tag.card === 1, "die Kartennummer");
  check(tag.treatments === 1, "die Zahl der Maßnahmen");
  check(tag.findings === 0, "und die der Befunde");
}

/* ---------------------------------------------------------------- main */

mstartBranches();
mstartBack();
akten();
lagekarte();
workflow();
platzieren();
taetigkeiten();
koerper();
modellraum();
sprache();
/* ============================================================== Bewegung
 *
 * Federn, Schwungübergabe und Anschläge. Alles Rechnung, also hier prüfbar —
 * und genau das ist der Punkt: ob sich eine Bewegung richtig anfühlt, sieht man
 * erst in der Brille, aber ob sie überschwingt, wo sie nicht darf, und ob sie
 * beim Umlenken springt, lässt sich ausrechnen.
 */

/** Eine Feder n Sekunden laufen lassen und den Verlauf mitschreiben. */
function laufen(s, seconds, dt = 1 / 90) {
  const trace = [];
  for (let t = 0; t < seconds; t += dt) trace.push(s.step(dt));
  return trace;
}

function bewegung() {
  console.log("\nFedern");
  setReducedMotion(false);

  // Der Normalfall: ankommen, ohne über das Ziel hinauszuschießen.
  const kritisch = new Spring(0, SPRINGS.move).to(1);
  const t1 = laufen(kritisch, 2);
  near(kritisch.value, 1, "aperiodisch gedämpft kommt am Ziel an", 0.005);
  check(Math.max(...t1) <= 1.0001, "und schwingt dabei nie über");
  check(kritisch.settled(), "danach steht sie");

  // Überschwingen gibt es nur da, wo es bestellt ist.
  const weich = new Spring(0, { damping: 0.6, response: 0.4 }).to(1);
  check(Math.max(...laufen(weich, 2)) > 1.02, "unterdämpft schwingt über");

  // „response" ist keine Dauer, aber es steuert das Tempo.
  const schnell = new Spring(0, { damping: 1, response: 0.2 }).to(1);
  const langsam = new Spring(0, { damping: 1, response: 0.8 }).to(1);
  laufen(schnell, 0.3); laufen(langsam, 0.3);
  check(schnell.value > langsam.value, "kleineres response ist früher am Ziel");

  // Analytisch gelöst heißt: das Ergebnis hängt nicht an der Bildrate. Genau
  // das trägt in WebXR, wo einzelne Bilder deutlich länger dauern können.
  const grob = new Spring(0, SPRINGS.move).to(1);
  const fein = new Spring(0, SPRINGS.move).to(1);
  for (let i = 0; i < 5; i++) grob.step(0.1);
  for (let i = 0; i < 50; i++) fein.step(0.01);
  near(grob.value, fein.value, "grobe und feine Schrittweite kommen gleich weit", 0.002);

  // Der wichtigste Punkt: mitten in der Bewegung umlenken darf nicht springen.
  const umlenken = new Spring(0, SPRINGS.move).to(1);
  laufen(umlenken, 0.15);
  const vorher = umlenken.value, tempo = umlenken.velocity;
  umlenken.to(-1);
  check(umlenken.value === vorher, "Umlenken lässt den Wert stehen");
  check(umlenken.velocity === tempo, "und die Geschwindigkeit auch");
  const ersterSchritt = umlenken.step(1 / 90);
  check(Math.abs(ersterSchritt - vorher) < 0.03,
        "der erste Schritt danach ist kein Sprung");

  // Und der eigentliche Punkt: der mitgenommene Schwung trägt noch ein Stück
  // in die alte Richtung, statt an einer Wand abzuprallen. Zum Vergleich
  // dieselbe Feder, deren Geschwindigkeit beim Umlenken abgeschnitten wurde —
  // genau das erzeugt den harten Knick, den es zu vermeiden gilt.
  const abgeschnitten = new Spring(vorher, SPRINGS.move).to(-1);
  const ohneSchwung = abgeschnitten.step(1 / 90);
  check(tempo > 0 && ersterSchritt > vorher,
        "der mitgenommene Schwung trägt noch über den Wendepunkt hinaus");
  check(ersterSchritt > ohneSchwung,
        "eine abgeschnittene Geschwindigkeit kehrte sofort um — die Feder nicht");

  // Schwungübergabe: mit Geschwindigkeit losgelassen wird weitergetragen.
  const ohne = new Spring(0, SPRINGS.move).to(0);
  const mit = new Spring(0, SPRINGS.move).to(0).handoff(4);
  ohne.step(0.05); mit.step(0.05);
  check(mit.value > ohne.value + 0.05, "übergebene Geschwindigkeit trägt weiter");
  laufen(mit, 3);
  near(mit.value, 0, "und läuft am Ende doch ins Ziel", 0.005);

  console.log("\nWinkel, Schwung und Anschläge");

  // Kurzer Weg statt einmal fast herum.
  const winkel = new AngleSpring(3.0, SPRINGS.rotate);
  winkel.to(-3.0);
  check(winkel.target > 3.0, "die Winkelfeder nimmt den kurzen Weg über π");
  near(winkel.target - winkel.value, (Math.PI * 2) - 6.0,
       "und legt dabei nur den kleinen Rest zurück", 0.001);

  // Schwungprojektion: Apples Exponentialform, nicht v²/2a.
  near(project(1000, 0.998), 499, "1000 px/s rollen rund 499 px aus", 1);
  check(project(2000) > project(1000), "mehr Schwung heißt weiter");
  check(project(-1000) < 0, "und die Richtung bleibt erhalten");
  check(project(1000, 0.99) < project(1000, 0.998), "trägere Kurve rollt weiter");
  check(project(NaN) === 0, "Unsinn rollt gar nicht");

  // Was der Nachlauf zurücklegt, muss zu dem passen, was die Projektion
  // vorhersagt — sonst zeigte die Vorschau etwas anderes als die Bewegung.
  const nach = new Decay(1000);
  const vorhergesagt = nach.remaining;
  let gelaufen = 0;
  for (let i = 0; i < 4000 && !nach.done; i++) gelaufen += nach.step(1 / 90);
  check(Math.abs(gelaufen - vorhergesagt) / vorhergesagt < 0.01,
        `der Nachlauf legt die vorhergesagte Strecke zurück (${gelaufen.toFixed(0)} ≈ ${vorhergesagt.toFixed(0)})`);
  check(nach.done, "und kommt zum Stehen");

  check(nearestSnap(7, [0, 5, 10]) === 5, "der nächste Rastpunkt");
  check(nearestSnap(7, []) === 7, "ohne Rastpunkte bleibt es, wie es ist");

  // Gummiband: nachgeben, nicht anschlagen.
  check(rubberband(0, 100) === 0, "ohne Überzug gibt es nichts nachzugeben");
  check(rubberband(50, 100) < 50, "über den Anschlag geht weniger mit als gezogen");
  check(rubberband(200, 100) < rubberband(200, 100) + 1 &&
        rubberband(200, 100) / 200 < rubberband(20, 100) / 20,
        "und je weiter gezogen, desto weniger anteilig");
  check(clampRubber(0.3, -0.7, 0.7) === 0.3, "innerhalb der Grenzen ändert sich nichts");
  const drueber = clampRubber(1.4, -0.7, 0.7);
  check(drueber > 0.7 && drueber < 1.4, "darüber geht es weiter, aber nicht ganz mit");
  check(clampRubber(-1.4, -0.7, 0.7) === -drueber, "nach unten spiegelbildlich");

  console.log("\nGeschwindigkeit messen");
  const v = new VelocityTracker(100);
  v.add(0, 0).add(10, 20).add(20, 40).add(30, 60);
  near(v.velocity(60), 500, "gleichmäßige Bewegung ergibt ihre Geschwindigkeit", 1);
  check(v.velocity(400) === 0, "nach einer Pause ist die Geste vorbei, nicht schnell");
  check(new VelocityTracker().add(5, 0).velocity(0) === 0,
        "ein einzelner Punkt ist keine Geschwindigkeit");

  console.log("\nWeniger Bewegung");
  setReducedMotion(true);
  const sofort = new Spring(0, SPRINGS.move).to(1);
  check(sofort.step(1 / 90) === 1, "bei „weniger Bewegung\" wird sofort gesetzt");
  check(sofort.velocity === 0, "und es bleibt nichts in Bewegung");
  check(new Decay(1000).step(1 / 90) === 0, "auch kein Nachlauf");
  setReducedMotion(false);
}

/* ========================================================== Anzeigegerät
 *
 * Der Teil, der über die HoloLens-2-Tauglichkeit entscheidet — und der sich
 * ohne Gerät nur hier prüfen lässt. Ein zu großes HUD merkt man sonst erst,
 * wenn jemand die Brille aufsetzt und die Hälfte der Anzeige nie zu sehen
 * bekommt.
 */

const grad = (r) => (r * 180) / Math.PI;
const bogen = (d) => (d * Math.PI) / 180;

/** Symmetrische Projektionsmatrix aus zwei vollen Öffnungswinkeln (Grad). */
function projektion(hDeg, vDeg, schiefe = 0) {
  const m = new Array(16).fill(0);
  m[0] = 1 / Math.tan(bogen(hDeg) / 2);
  m[5] = 1 / Math.tan(bogen(vDeg) / 2);
  m[8] = schiefe;
  m[10] = -1; m[11] = -1; m[14] = -0.2;
  return m;
}

// Die beiden Geräte, um die es geht.
const HOLOLENS2 = projektion(43, 29);
const QUEST = projektion(105, 95);

function anzeigegeraet() {
  console.log("\nBlickfeld ausmessen");

  const hl = fovFromProjection(HOLOLENS2);
  near(grad(hl.horizontal), 43, "HoloLens 2: 43° breit", 0.1);
  near(grad(hl.vertical), 29, "und 29° hoch", 0.1);
  near(hl.left, hl.right, "symmetrisch gerechnet, symmetrisch heraus", 1e-6);

  const schief = fovFromProjection(projektion(90, 90, 0.2));
  check(schief.right > schief.left, "eine schiefe Projektion wird auch schief gemessen");
  near(grad(schief.horizontal), 90 + 0, "ihre Gesamtbreite bleibt plausibel", 12);

  const kaputt = fovFromProjection([0, 0, 0, 0, 0, 0, 0, 0, NaN, NaN, 0, 0, 0, 0, 0, 0]);
  check(Number.isFinite(kaputt.horizontal), "eine unbrauchbare Matrix ergibt keine NaN");

  console.log("\nHUD ins Blickfeld einpassen");

  const profilHL = displayProfile("additive", hl);
  check(profilHL.additive, "additives Glas wird erkannt");
  check(profilHL.narrow, "und sein kleines Blickfeld auch");
  check(profilHL.hudDistance > 1.25,
        "auf durchsichtigem Glas steht das HUD außerhalb der Nahzone");

  const passt = fitToFov(hl, profilHL.hudDistance, 16 / 9);
  const halbH = Math.atan(passt.halfW / profilHL.hudDistance);
  const halbV = Math.atan(passt.halfH / profilHL.hudDistance);
  check(halbH < hl.left && halbH < hl.right, "das eingepasste HUD bleibt seitlich im Glas");
  check(halbV < hl.up && halbV < hl.down, "und oben wie unten auch");
  near(passt.halfW / passt.halfH, 16 / 9, "das Seitenverhältnis bleibt erhalten", 0.001);

  // Der Grund für die ganze Übung: die alte feste Größe lag weit daneben.
  const altHalbwinkel = Math.atan(0.82 / 0.95);
  check(altHalbwinkel > hl.left * 1.5,
        `die alte feste HUD-Breite lag weit außerhalb (${Math.round(grad(altHalbwinkel) * 2)}° gegen 43°)`);

  const quest = fovFromProjection(QUEST);
  const profilQ = displayProfile("alpha-blend", quest);
  check(!profilQ.narrow, "eine Quest gilt nicht als kleines Blickfeld");
  check(!profilQ.additive, "und nicht als additiv");
  const passtQ = fitToFov(quest, profilQ.hudDistance, 16 / 9);
  check(passtQ.halfW > 0.6 && passtQ.halfW < 0.85,
        "dort bleibt das HUD ungefähr so groß wie bisher");
  check(passtQ.halfW > passt.halfW, "und größer als auf der HoloLens");

  console.log("\nFarben für additives Glas");

  const add = paletteFor(true);
  const alpha = paletteFor(false);
  // Der eine Punkt, an dem eine für Quest gebaute Anzeige auf der HoloLens
  // scheitert: alles Dunkle ist dort schlicht nicht vorhanden.
  const durchsichtig = (c) => /rgba\([^)]*,\s*0\s*\)$/.test(c);
  check(durchsichtig(add.blockFill), "additiv: keine dunkle Unterlage");
  check(durchsichtig(add.btnFill), "additiv: kein dunkler Knopffond");
  check(add.blockTint === 0, "additiv: auch keine getönte — jede Fläche wäre ein Schleier");
  check(!durchsichtig(alpha.blockFill), "auf Passthrough bleibt sie erhalten");
  // Ein Saum wirkt, indem er abdunkelt. Auf additivem Glas geht das nicht, und
  // ein heller Saum um helle Type macht daraus einen Klumpen — nachgemessen an
  // tests/probe_flow.html?additiv=1. Also gar keiner.
  check(durchsichtig(add.halo) && durchsichtig(add.haloRule),
        "additiv: gar kein Saum — er könnte nur abdunkeln");
  check(alpha.halo.startsWith("rgba(0"), "auf Passthrough bleibt der Saum dunkel");
  const deckkraft = (c) => Number(/rgba\([^)]*,\s*([\d.]+)\s*\)/.exec(c)[1]);
  check(deckkraft(add.faint) > deckkraft(alpha.faint),
        "additiv: auch das Zurückgenommene bleibt kräftig, sonst wäre es weg");
  check(add.additive === true && alpha.additive === false,
        "die Palette weiß selbst, welche sie ist");

  console.log("\nSitzungsleiter");

  const leiter = sessionLadder();
  check(leiter[0].mode === "immersive-ar", "zuerst wird AR versucht");
  check(leiter.some((s) => s.mode === "immersive-ar" &&
                           !s.init.requiredFeatures && !s.init.optionalFeatures),
        "es gibt eine Stufe ganz ohne Zusatzmerkmale");
  check(leiter.every((s) => !(s.init.requiredFeatures || []).includes("local-floor")),
        "Bodenbezug wird nie verbindlich verlangt");
  check(leiter.every((s) => !JSON.stringify(s.init).includes("bounded-floor")),
        "eine gezeichnete Spielfläche wird nirgends verlangt");
  check(leiter[leiter.length - 1].mode === "immersive-vr",
        "und zuletzt VR — der Weg für Edge ohne immersive-ar");
  const ersterVR = leiter.findIndex((s) => s.mode === "immersive-vr");
  check(leiter.slice(0, ersterVR).every((s) => s.mode === "immersive-ar"),
        "VR kommt erst, wenn AR durch ist");
}

armband();
anzeige();
bewegung();
anzeigegeraet();

console.log();
console.log(failed === 0
  ? `${run} Prüfungen, alle bestanden.`
  : `${run} Prüfungen, ${failed} fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);

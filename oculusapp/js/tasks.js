/* Die Tätigkeiten — was der Träger der Brille gerade tut.
 *
 * Beim Start wird einmal gewählt, worin man eingesetzt ist. Das ist keine
 * Beschriftung: die Wahl bestimmt, was am Patienten passiert, wenn man seinen
 * Bodenmarker anklickt, und ob überhaupt neue Patienten angelegt werden können.
 * Im MANV macht dieselbe Person nicht alles — wer an der Patientenablage
 * behandelt, sichtet nicht nebenbei, und wer Umhängekarten ausgibt, stellt keine
 * Kategorie fest.
 *
 * Jede Tätigkeit steht außerdem in jeder Protokollzeile (siehe
 * `setActiveTask` in data.js), damit später nachvollziehbar ist, in welcher
 * Rolle ein Eintrag entstanden ist.
 *
 * Eine fünfte Tätigkeit ist ein Eintrag in dieser Tabelle plus ein Zweig in
 * `Workflow._atPatient()`. Sonst nichts.
 *
 *   id          Schlüssel im Ablauf
 *   canCreate   darf neue Patienten anlegen?
 *   opens       Zustand, in den „Weiter" am Patienten führt
 *   doneWhen    woran man sieht, dass diese Tätigkeit hier schon getan wurde
 *   action      Beschriftung des Weiter-Knopfes (frisch / noch einmal)
 */

"use strict";

export const TASKS = [
  {
    id: "vorsichtung",
    label: "Vorsichtung",
    short: "VORSICHTUNG",
    spoken: "Vorsichtung",
    note: "mSTaRT · sechs Fragen → Sichtungskategorie",
    color: "#7cc0ff",
    canCreate: true,                 // hier werden Verletzte gefunden
    opens: "sichtung",
    doneWhen: "category",
    action: { fresh: "Sichtung starten", again: "Neu sichten" },
  },
  {
    id: "sichtung",
    label: "Sichtung (ärztlich)",
    short: "SICHTUNG",
    spoken: "ärztliche Sichtung",
    note: "Kategorie direkt festlegen — SK I–IV, LNA",
    color: "#3e7bfa",
    canCreate: true,                 // auch der LNA trifft Undokumentierte an
    opens: "kategorie",
    doneWhen: "category",
    action: { fresh: "Kategorie festlegen", again: "Kategorie ändern" },
  },
  {
    id: "registrierung",
    label: "Registrierung",
    short: "REGISTRIERUNG",
    spoken: "Registrierung",
    note: "Umhängekarten zuweisen und nachtragen",
    color: "#f5b301",
    canCreate: true,                 // wer Karten ausgibt, findet auch Unerfasste
    opens: "karte",
    doneWhen: "card",
    action: { fresh: "Karte zuweisen", again: "Karte ändern" },
  },
  {
    id: "behandlung",
    label: "Behandlung & Transport",
    short: "BEHANDLUNG",
    spoken: "Behandlung und Transport",
    note: "Maßnahmen festhalten, Abtransport buchen",
    color: "#46a758",
    // Wer behandelt, arbeitet an Patienten, die schon auf der Lagekarte stehen.
    // Einen Patienten zu erfinden, den man gerade behandelt, ergibt keinen Sinn.
    canCreate: false,
    opens: "behandlung",
    doneWhen: "never",
    action: { fresh: "Behandlung", again: "Behandlung" },
  },
];

export const DEFAULT_TASK = "vorsichtung";

export function findTask(id) {
  return TASKS.find((t) => t.id === id) || null;
}

/**
 * Beschriftung des Weiter-Knopfes am Patienten — je nachdem, ob diese Tätigkeit
 * hier schon einmal getan wurde.
 */
export function primaryLabel(task, patient) {
  if (!task) return "Weiter";
  const done = task.doneWhen === "card" ? patient && patient.card != null
             : task.doneWhen === "category" ? patient && patient.category !== "UNSIGHTED"
             : false;
  return done ? task.action.again : task.action.fresh;
}

/**
 * Sofortmaßnahmen, die sich mit einem Griff festhalten lassen. Bewusst kurz:
 * vier Knöpfe, die im Blickfeld noch lesbar sind. Freitext-Befunde sind Sache
 * des Diktats (siehe README, „Next steps").
 */
export const MEASURES = [
  "Blutstillung",
  "Atemweg gesichert",
  "Schocklage",
  "Wärmeerhalt",
];

/**
 * Die Kategorien, die bei der ärztlichen Sichtung direkt gewählt werden —
 * anders als in der Vorsichtung ist SK IV hier eine reguläre Wahl und kein
 * Override, denn genau diese Entscheidung trifft der LNA.
 */
export const SIGHTING_CATEGORIES = ["SK1", "SK2", "SK3", "SK4", "DECEASED"];

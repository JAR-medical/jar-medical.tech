/* mSTaRT — die Vorsichtung als Entscheidungsbaum.
 *
 * mSTaRT = modifiziertes "Simple Triage and Rapid Treatment", der Algorithmus,
 * den Feuerwehr München und LMU 2006 veröffentlicht haben (Kanz et al., Notfall +
 * Rettungsmedizin) und auf den sich auch die Übungslagen in ../demo beziehen
 * ("Sichtung nach mSTaRT"). Sechs Ja/Nein-Fragen, Kategorie in Sekunden.
 *
 * ⚠️ ÜBUNGSZWECK — Schülerprojekt, kein Medizinprodukt. Die Kategorie ist ein
 * Vorschlag; die Sichtung bleibt Verantwortung der Person mit der Brille.
 *
 * Reihenfolge hier:
 *   1. kritische Blutung?   ja → Blutstillung, SK I
 *   2. gehfähig?            ja → SK III
 *   3. Atmung vorhanden?    nein → Atemwege freimachen → 3a
 *      3a. Atmung jetzt?    ja → SK I | nein → tot (SK V)
 *   4. AF < 10 oder > 30?   ja → SK I
 *   5. Radialispuls / Rekap ≤ 2 s?  nein → SK I
 *   6. befolgt Aufforderungen?      nein → SK I | ja → SK II
 *
 * Zu Schritt 1: publizierte Fassungen unterscheiden sich darin, ob die kritische
 * Blutung vor oder nach der Gehprobe geprüft wird. Hier zuerst, weil
 * "Blutstillung hat Vorrang" — ein gehfähiger Patient mit spritzender Blutung
 * darf nicht grün herauskommen. Der ganze Baum steht in NODES, Umstellen ist
 * eine Änderung an einer Stelle.
 *
 * SK IV (blau) vergibt der Algorithmus bewusst NICHT: das ist eine ärztliche
 * Entscheidung (LNA) und keine Vorsichtung. Die Oberfläche bietet sie als
 * ausdrücklich beschrifteten Override an.
 *
 * Zu jeder Frage stand hier einmal ein erklärender Nebensatz („sehen, hören,
 * fühlen — höchstens 10 Sekunden"). Der ist raus: wer die Brille trägt, hat
 * mSTaRT gelernt, und im Blickfeld ist jede Zeile, die man nicht liest, eine
 * Zeile zu viel. Die Fragen stehen für sich.
 */

"use strict";

export const DISCLAIMER =
  "mSTaRT-Vorsichtung · Übungszweck · Einschätzung bleibt beim Anwender";

/** Längster Pfad durch den Baum — für „Schritt n von m“. */
export const MAX_STEPS = 6;

/** Ergebnis eines Schritts: entweder `next` (weiter) oder `category` (fertig). */
const go = (next, why) => ({ next, category: null, measure: null, why });
const goWith = (next, why, measure) => ({ next, category: null, measure, why });
const end = (category, why, measure = null) => ({ next: null, category, measure, why });

export const NODES = {
  blutung: {
    step: "blutung",
    question: "Kritische Blutung?",
    yes: end("SK1", "Kritische Blutung — sofortige Blutstillung, SK I",
             "Blutstillung: Tourniquet / Druckverband"),
    no: go("gehfaehig", "Keine kritische Blutung"),
  },
  gehfaehig: {
    step: "gehfaehig",
    question: "Gehfähig?",
    yes: end("SK3", "Gehfähig — SK III, Verweis zur Sammelstelle"),
    no: go("atmung", "Nicht gehfähig"),
  },
  atmung: {
    step: "atmung",
    question: "Atmung vorhanden?",
    yes: go("atemfrequenz", "Atmung vorhanden"),
    no: goWith("atmungFrei", "Keine Atmung — Atemwege freimachen",
               "Atemwege freimachen (Esmarch-Handgriff)"),
  },
  atmungFrei: {
    step: "atmungFrei",
    question: "Atmung nach Freimachen?",
    yes: end("SK1", "Atmung erst nach Freimachen — SK I",
             "Atemwege offen halten / stabile Seitenlage"),
    no: end("DECEASED", "Keine Atmung nach Freimachen — verstorben (SK V)"),
  },
  atemfrequenz: {
    step: "atemfrequenz",
    question: "Atemfrequenz < 10 oder > 30 /min?",
    yes: end("SK1", "Atemfrequenz außerhalb 10–30/min — SK I"),
    no: go("kreislauf", "Atemfrequenz 10–30/min"),
  },
  kreislauf: {
    step: "kreislauf",
    question: "Radialispuls tastbar?",
    yes: go("bewusstsein", "Radialispuls tastbar"),
    no: end("SK1", "Radialispuls nicht tastbar — SK I"),
  },
  bewusstsein: {
    step: "bewusstsein",
    question: "Befolgt einfache Aufforderungen?",
    yes: end("SK2", "Aufforderungen werden befolgt — SK II"),
    no: end("SK1", "Aufforderungen werden nicht befolgt — SK I"),
  },
};

export const FIRST_STEP = "blutung";

/** Ein Durchlauf für einen Patienten. Schritt-zurück inklusive. */
export class MStartSession {
  constructor() { this.reset(); }

  reset() {
    this.current = FIRST_STEP;
    this.answers = [];      // [{step, yes, line}]
    this.measures = [];
    this.result = null;     // {category, why, measures[], trail[]}
  }

  get done() { return this.result !== null; }
  get node() { return NODES[this.current]; }
  /** 1-basierte Position der Frage auf dem Schirm. */
  get stepNumber() { return this.answers.length + 1; }

  /** Aktuelle Frage beantworten. Nach dem Ergebnis wirkungslos. */
  answer(yes) {
    if (this.done) return;

    const node = this.node;
    const outcome = yes ? node.yes : node.no;

    this.answers.push({
      step: node.step,
      yes,
      line: `${node.question} ${yes ? "ja" : "nein"}`,
    });

    if (outcome.measure && !this.measures.includes(outcome.measure))
      this.measures.push(outcome.measure);

    if (outcome.category) {
      this.result = {
        category: outcome.category,
        why: outcome.why,
        measures: this.measures.slice(),
        trail: this.answers.map((a) => a.line),
      };
      return;
    }
    this.current = outcome.next || this.current;
  }

  /** Letzte Antwort zurücknehmen. false, wenn es nichts zurückzunehmen gibt. */
  back() {
    if (this.answers.length === 0) return false;

    const last = this.answers.pop();
    this.result = null;
    this.current = last.step;

    // Maßnahmenliste aus den verbliebenen Antworten neu aufbauen, damit ein
    // Schritt zurück auch die Sofortmaßnahme dieses Schritts wieder entfernt.
    this.measures = [];
    let step = FIRST_STEP;
    for (const a of this.answers) {
      const outcome = a.yes ? NODES[step].yes : NODES[step].no;
      if (outcome.measure && !this.measures.includes(outcome.measure))
        this.measures.push(outcome.measure);
      if (!outcome.next) break;
      step = outcome.next;
    }
    return true;
  }
}

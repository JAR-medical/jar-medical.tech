/* Die Patientenakten dieses Einsatzes — anfangs leer.
 *
 * Es gibt keinen mitgelieferten Datensatz mehr. Patienten entstehen dort, wo der
 * Trupp sie antrifft: `createPatient(pos)` legt einen an der Position an, an der
 * man gerade steht, die Sichtung füllt ihn, und `assignCard` verknüpft ihn am
 * Ende mit der Nummer der Umhängekarte, die tatsächlich um seinen Hals hängt.
 *
 * Bis zur Zuweisung trägt ein Patient nur eine laufende Nummer dieses Einsatzes
 * (#1, #2, …). Die Kartennummer ist etwas anderes und kommt erst dazu — genau
 * wie im Feld, wo erst gesichtet und dann die Karte angehängt wird.
 *
 * Alle Schreibzugriffe laufen durch die Funktionen hier. Das ist die Naht, an
 * der später PATCH /api/patients/{id} + WebSocket zum Lagebild der
 * Einsatzleitung hängen; solange es keinen Hub gibt, lebt der Einsatz im
 * Speicher dieser Sitzung.
 */

"use strict";

export const CATEGORY_META = {
  SK1:       { label: "SK I — rot",    short: "ROT",         spoken: "rot",        color: "#e5484d", order: 0 },
  SK2:       { label: "SK II — gelb",  short: "GELB",        spoken: "gelb",       color: "#f5b301", order: 1 },
  SK3:       { label: "SK III — grün", short: "GRÜN",        spoken: "grün",       color: "#46a758", order: 2 },
  SK4:       { label: "SK IV — blau",  short: "BLAU",        spoken: "blau",       color: "#3e7bfa", order: 3 },
  DECEASED:  { label: "verstorben",    short: "SCHWARZ",     spoken: "schwarz",    color: "#6f6f6f", order: 4 },
  UNSIGHTED: { label: "ungesichtet",   short: "UNGESICHTET", spoken: "ungesichtet",color: "#4a5561", order: 5 },
};

const PATIENTS = new Map();      // laufende Nummer → Akte
let nextId = 1;

/* In welcher Tätigkeit gerade gearbeitet wird (tasks.js). Steht in jeder
 * Protokollzeile: sonst ließe sich später nicht mehr sagen, ob eine Kategorie
 * aus der Vorsichtung des Trupps oder aus der ärztlichen Sichtung stammt. Die
 * Tätigkeit gehört zur Sitzung, nicht zur einzelnen Akte — im Produkt wäre das
 * die Rolle am angemeldeten Gerät. */
let activeTask = null;

export function setActiveTask(label) { activeTask = label || null; }
export function getActiveTask() { return activeTask; }

export function patientIds() { return [...PATIENTS.keys()]; }
export function patientCount() { return PATIENTS.size; }
export function resolvePatient(id) { return PATIENTS.get(id) || null; }

/**
 * Neuen Patienten an einer Weltposition anlegen.
 * @param {{x:number,y:number,z:number}|null} pos  wo er liegt (Referenzraum der Sitzung)
 */
export function createPatient(pos, by = "AR-Client") {
  const id = nextId++;
  const now = new Date().toISOString();
  const p = {
    marker_id: id,               // laufende Nummer dieses Einsatzes
    card: null,                  // Nummer der Umhängekarte, sobald zugewiesen
    pos: pos ? { x: pos.x, y: pos.y, z: pos.z } : null,
    category: "UNSIGHTED",
    transported: false,          // vom Behandlungsplatz abtransportiert
    sex: null, age_estimate: null,
    ambulatory: null, conscious: null, airway_clear: null,
    location: null,
    vitals: {},
    injuries: [], treatments: [], protocol: [],
    created_at: now, updated_at: now,
    last_seen: { by, at: now },
  };
  PATIENTS.set(id, p);
  pushProtocol(id, { author: by, transcript: "Patient angelegt" });
  return p;
}

/** Karte zuordnen. Eine Karte gehört immer nur einem Patienten. */
export function assignCard(id, card) {
  const p = resolvePatient(id);
  if (!p) return { ok: false, reason: "unbekannter Patient" };

  for (const other of PATIENTS.values())
    if (other.card === card && other.marker_id !== id)
      return { ok: false, takenBy: other.marker_id,
               reason: `Karte #${card} gehört schon zu Patient #${other.marker_id}` };

  p.card = card;
  touch(p, `Umhängekarte #${card} zugewiesen`);
  return { ok: true };
}

export function cardHolder(card) {
  for (const p of PATIENTS.values()) if (p.card === card) return p;
  return null;
}

export function pushProtocol(id, { source = "client", author = "AR-Client", transcript, task = activeTask }) {
  const p = resolvePatient(id);
  if (!p || !transcript) return;
  p.protocol.push({ source, author, task: task || null, transcript, at: new Date().toISOString() });
  p.updated_at = new Date().toISOString();
}

export function setCategory(id, category) {
  const p = resolvePatient(id);
  if (!p || !CATEGORY_META[category]) return;
  p.category = category;
  touch(p, `Sichtungskategorie: ${CATEGORY_META[category].label}`);
}

export function addTreatment(id, treatment) {
  const p = resolvePatient(id);
  if (!p || !treatment) return;
  if (p.treatments.includes(treatment)) return;      // schon festgehalten
  p.treatments.push(treatment);
  touch(p, `Maßnahme: ${treatment}`);
}

/** Eine irrtümlich festgehaltene Maßnahme wieder herausnehmen — mit Eintrag. */
export function removeTreatment(id, treatment) {
  const p = resolvePatient(id);
  if (!p || !treatment) return;
  const i = p.treatments.indexOf(treatment);
  if (i < 0) return;
  p.treatments.splice(i, 1);
  touch(p, `Maßnahme zurückgenommen: ${treatment}`);
}

/**
 * Abtransport vom Behandlungsplatz. Der Patient bleibt in der Lage stehen — wo
 * er lag, ist Teil des Lagebilds —, wird aber als versorgt und weg geführt.
 */
export function markTransported(id, on = true) {
  const p = resolvePatient(id);
  if (!p || p.transported === !!on) return;
  p.transported = !!on;
  touch(p, on ? "Abtransport gebucht" : "Abtransport zurückgenommen");
}

/**
 * Ein Befund hängt an einer Körperregion (body.js), nicht frei in der Akte —
 * „Blutung, Oberschenkel rechts" ist das, was weitergegeben wird.
 * @param {string} region  Regions-Schlüssel aus body.js
 */
export function addInjury(id, region, text) {
  const p = resolvePatient(id);
  if (!p || !region || !text) return;
  if (p.injuries.some((i) => i.region === region && i.text === text)) return;
  p.injuries.push({ region, text, at: new Date().toISOString() });
  touch(p, `Befund: ${text} (${region})`);
}

export function removeInjury(id, region, text) {
  const p = resolvePatient(id);
  if (!p) return;
  const i = p.injuries.findIndex((x) => x.region === region && x.text === text);
  if (i < 0) return;
  p.injuries.splice(i, 1);
  touch(p, `Befund gestrichen: ${text} (${region})`);
}

/** Befunde eines Patienten nach Region — genau die Form, die das Modell malt. */
export function injuriesByRegion(p) {
  const out = {};
  for (const i of (p && p.injuries) || []) (out[i.region] ||= []).push(i.text);
  return out;
}

export function markSeen(id, by = "AR-Client") {
  const p = resolvePatient(id);
  if (p) p.last_seen = { by, at: new Date().toISOString() };
}

/** Zählt die Kategorien über alle Patienten dieses Einsatzes. */
export function tally() {
  const t = { SK1: 0, SK2: 0, SK3: 0, SK4: 0, DECEASED: 0, UNSIGHTED: 0,
              total: PATIENTS.size, ohneKarte: 0, abtransportiert: 0 };
  for (const p of PATIENTS.values()) {
    if (t[p.category] !== undefined) t[p.category]++;
    if (p.card == null) t.ohneKarte++;
    if (p.transported) t.abtransportiert++;
  }
  return t;
}

/** Nur für Prüfungen: den Einsatz zurücksetzen. */
export function resetEinsatz() {
  PATIENTS.clear();
  nextId = 1;
  activeTask = null;
}

function touch(p, transcript) {
  p.updated_at = new Date().toISOString();
  pushProtocol(p.marker_id, { transcript });
}

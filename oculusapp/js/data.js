/* J.A.R. AR-Client — patient data model.
 *
 * This is the paramedic ("Trupp") counterpart to the Einsatzleitung dashboard
 * (Website/demo). It mirrors that dashboard's data model 1:1 so a marker scanned
 * here resolves to exactly the same patient record shown on the command board:
 *
 *   marker_id, category (SK1..SK4 / DECEASED / UNSIGHTED), sex, age_estimate,
 *   ambulatory, conscious, airway_clear, location, vitals{...}, injuries[],
 *   treatments[], plus a per-patient protocol log.
 *
 * In the real product these records stream from the FastAPI hub over REST +
 * WebSocket. With no backend on a static host, the roster below stands in for
 * that hub — the same scripted MANV (overturned coach on the A9) used by the
 * dashboard demo. Everything the medic changes here (re-triage, treatments,
 * dictated notes) is written back into this in-memory store and the protocol,
 * exactly as `PATCH /api/patients/{id}` would.
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

/* The scenario roster — identical records to the dashboard's ROSTER. */
const ROSTER = {
  1: { marker_id: 1, category: "SK1", sex: "m", age_estimate: 45, ambulatory: false,
       conscious: false, airway_clear: false, location: "C2",
       vitals: { breathing_rate: 32, pulse: 130, spo2: 84, bp_systolic: 90, bp_diastolic: 60, gcs: 6 },
       injuries: ["Thoraxtrauma", "Schädel-Hirn-Trauma"], treatments: ["Sauerstoff", "HWS-Immobilisation"],
       protocol: [{ source: "client", author: "Trupp-1", transcript: "Männlich, ca. 45, bewusstlos, Schnappatmung, instabiler Thorax — rot." }] },
  2: { marker_id: 2, category: "SK1", sex: "w", age_estimate: 31, ambulatory: false,
       conscious: true, airway_clear: true, location: "B3",
       vitals: { breathing_rate: 28, pulse: 124, spo2: 90, bp_systolic: 95, gcs: 13 },
       injuries: ["offene Femurfraktur", "starke Blutung"], treatments: ["Tourniquet", "Druckverband"],
       protocol: [{ source: "client", author: "Trupp-2", transcript: "Weiblich, ca. 30, spritzende Blutung Oberschenkel. Tourniquet gesetzt — rot." }] },
  3: { marker_id: 3, category: "SK2", sex: "m", age_estimate: 52, ambulatory: false,
       conscious: true, airway_clear: true, location: "D3",
       vitals: { breathing_rate: 18, pulse: 96, spo2: 96, bp_systolic: 130, bp_diastolic: 85, gcs: 15 },
       injuries: ["Unterschenkelfraktur geschlossen"], treatments: ["Vakuumschiene", "Analgesie"],
       protocol: [{ source: "client", author: "Trupp-1", transcript: "Männlich, ca. 50, Unterschenkel deformiert, ansprechbar, kreislaufstabil — gelb." }] },
  4: { marker_id: 4, category: "SK2", sex: "w", age_estimate: 24, ambulatory: false,
       conscious: true, airway_clear: true, location: "D4",
       vitals: { breathing_rate: 20, pulse: 104, spo2: 95, bp_systolic: 110, bp_diastolic: 70, gcs: 14 },
       injuries: ["V. a. Beckentrauma", "Abdomen druckschmerzhaft"], treatments: ["Beckenschlinge"],
       protocol: [{ source: "client", author: "Trupp-2", transcript: "Weiblich, ca. 25, Beckenschmerz, Abdomen gespannt — gelb, engmaschig beobachten." }] },
  5: { marker_id: 5, category: "SK3", sex: "m", age_estimate: 19, ambulatory: true,
       conscious: true, airway_clear: true, location: "F6",
       vitals: { breathing_rate: 16, pulse: 82, spo2: 99, bp_systolic: 125, gcs: 15 },
       injuries: ["Schürfwunden", "Prellungen"], treatments: [],
       protocol: [{ source: "client", author: "Trupp-2", transcript: "Männlich, jung, gehfähig, nur Schürfwunden — grün, zum Sammelplatz." }] },
  6: { marker_id: 6, category: "SK3", sex: "w", age_estimate: 38, ambulatory: true,
       conscious: true, airway_clear: true, location: "G6",
       vitals: { breathing_rate: 15, pulse: 78, spo2: 99, gcs: 15 },
       injuries: ["HWS-Distorsion"], treatments: [],
       protocol: [{ source: "client", author: "Trupp-2", transcript: "Weiblich, ca. 40, Nackenschmerz, gehfähig, stabil — grün." }] },
  7: { marker_id: 7, category: "SK2", sex: "m", age_estimate: 60, ambulatory: false,
       conscious: true, airway_clear: true, location: "E3",
       vitals: { breathing_rate: 22, pulse: 110, spo2: 93, bp_systolic: 150, bp_diastolic: 95, gcs: 15 },
       injuries: ["thorakaler Druck", "kardiale Vorerkrankung"], treatments: ["Sauerstoff", "Monitoring"],
       protocol: [{ source: "client", author: "Trupp-1", transcript: "Männlich, ca. 60, Thoraxschmerz, bekannte KHK — gelb, EKG anfordern." }] },
  8: { marker_id: 8, category: "SK1", sex: "w", age_estimate: 8, ambulatory: false,
       conscious: false, airway_clear: true, location: "C3",
       vitals: { breathing_rate: 30, pulse: 140, spo2: 88, gcs: 8 },
       injuries: ["Schädel-Hirn-Trauma", "Platzwunde"], treatments: ["Sauerstoff", "Wärmeerhalt"],
       protocol: [{ source: "client", author: "Trupp-1", transcript: "Kind, ca. 8, somnolent, GCS 8, Kopfplatzwunde — rot, NEF dringend." }] },
  9: { marker_id: 9, category: "SK3", sex: "m", age_estimate: 27, ambulatory: true,
       conscious: true, airway_clear: true, location: "F5",
       vitals: { breathing_rate: 16, pulse: 80, spo2: 99, gcs: 15 },
       injuries: ["oberflächliche Schnittwunden"], treatments: [],
       protocol: [{ source: "client", author: "Trupp-2", transcript: "Männlich, gehfähig, kleine Schnittwunden am Arm — grün." }] },
  10:{ marker_id: 10, category: "SK2", sex: "w", age_estimate: 44, ambulatory: false,
       conscious: true, airway_clear: true, location: "E4",
       vitals: { breathing_rate: 21, pulse: 100, spo2: 94, bp_systolic: 120, gcs: 15 },
       injuries: ["Klavikulafraktur", "Rippenserienfraktur"], treatments: ["Analgesie", "Sauerstoff"],
       protocol: [{ source: "client", author: "Trupp-1", transcript: "Weiblich, ca. 45, Rippenserie links, atemabhängiger Schmerz — gelb." }] },
  11:{ marker_id: 11, category: "DECEASED", sex: "m", age_estimate: 70, ambulatory: false,
       conscious: false, airway_clear: false, location: "A2",
       vitals: {}, injuries: ["keine Lebenszeichen"], treatments: [],
       protocol: [{ source: "client", author: "Trupp-1", transcript: "Männlich, ca. 70, keine Atmung, keine Reaktion, keine Zeichen — schwarz." }] },
  12:{ marker_id: 12, category: "SK4", sex: "m", age_estimate: 66, ambulatory: false,
       conscious: false, airway_clear: false, location: "B2",
       vitals: { breathing_rate: 8, pulse: 40, spo2: 70, gcs: 3 },
       injuries: ["schwerstes Polytrauma"], treatments: ["Sauerstoff", "betreuende Maßnahmen"],
       protocol: [{ source: "client", author: "LNA", transcript: "Männlich, ca. 65, infauste Prognose, Behandlung nachrangig — SK IV (blau)." }] },
};

export const MARKER_IDS = Object.keys(ROSTER).map(Number).sort((a, b) => a - b);

const isoNow = () => new Date().toISOString();
const clone = (x) => JSON.parse(JSON.stringify(x));

/* Live store: marker_id -> patient record (with mutable protocol[]). Seeded
 * from the roster on first access so edits persist for the session but never
 * corrupt the pristine roster template. */
const store = new Map();

function ensure(markerId) {
  if (!store.has(markerId) && ROSTER[markerId]) {
    const rec = clone(ROSTER[markerId]);
    rec.updated_at = isoNow();
    rec.protocol = rec.protocol.map((e) => ({ ...e, timestamp: isoNow() }));
    store.set(markerId, rec);
  }
  return store.get(markerId) || null;
}

/** Resolve a scanned marker id to its (live) patient record, or null. */
export function resolvePatient(markerId) {
  return ensure(Number(markerId));
}

/** Does a marker id map to a known patient? */
export function isKnownMarker(markerId) {
  return Object.prototype.hasOwnProperty.call(ROSTER, Number(markerId));
}

/** Append a protocol entry (mirrors the dashboard's pushProto). */
export function pushProtocol(markerId, { source = "client", author = "AR-Client", transcript }) {
  const p = ensure(markerId);
  if (!p) return null;
  p.protocol.push({ source, author, transcript, timestamp: isoNow() });
  p.updated_at = isoNow();
  return p;
}

/** Set triage category + log it (mirrors dashboard setCategory). */
export function setCategory(markerId, category) {
  const p = ensure(markerId);
  if (!p || !CATEGORY_META[category]) return null;
  p.category = category;
  p.updated_at = isoNow();
  p.protocol.push({
    source: "client", author: "AR-Client",
    transcript: `Sichtungskategorie gesetzt: ${CATEGORY_META[category].label}`,
    timestamp: isoNow(),
  });
  return p;
}

/** Add a treatment (deduplicated) + log it. */
export function addTreatment(markerId, treatment) {
  const p = ensure(markerId);
  if (!p || !treatment) return null;
  if (!p.treatments.includes(treatment)) p.treatments.push(treatment);
  p.updated_at = isoNow();
  p.protocol.push({ source: "client", author: "AR-Client",
    transcript: `Maßnahme dokumentiert: ${treatment}`, timestamp: isoNow() });
  return p;
}

/** Add an injury/finding (deduplicated) + log it. */
export function addInjury(markerId, injury) {
  const p = ensure(markerId);
  if (!p || !injury) return null;
  if (!p.injuries.includes(injury)) p.injuries.push(injury);
  p.updated_at = isoNow();
  p.protocol.push({ source: "client", author: "AR-Client",
    transcript: `Befund dokumentiert: ${injury}`, timestamp: isoNow() });
  return p;
}

/** Record that this device (Trupp) has just sighted the patient. */
export function markSeen(markerId, by = "AR-Client") {
  const p = ensure(markerId);
  if (!p) return null;
  p.last_seen = { by, at: isoNow() };
  return p;
}

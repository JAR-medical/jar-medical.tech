/* Die Lagekarte — aus echten Positionen, nicht aus einem Raster.
 *
 * Patienten werden dort angelegt, wo der Trupp steht; ihre Position ist also
 * eine echte Koordinate im Referenzraum der Sitzung. Diese Karte rechnet solche
 * Koordinaten in Kartenfläche um und passt ihren Ausschnitt selbst an: sie
 * umfasst immer alle angelegten Patienten und die eigene Position, mit etwas
 * Rand, mindestens aber einen sinnvollen Mindestausschnitt — sonst würde der
 * erste Patient allein die ganze Karte füllen und jeder Schritt den Maßstab
 * umwerfen.
 *
 * Oben auf der Karte ist die Richtung, in die man zu Beginn der Sitzung
 * geschaut hat (−Z des Referenzraums). Das ist willkürlich, aber stabil — und
 * eine Karte, die sich mit dem Kopf dreht, kann niemand lesen.
 */

"use strict";

const MIN_SPAN = 8;        // Meter: kleinster Kartenausschnitt
const PADDING = 2;         // Meter Rand um die äußersten Punkte

export class FieldMap {
  constructor({ minSpan = MIN_SPAN, padding = PADDING } = {}) {
    this.minSpan = minSpan;
    this.padding = padding;
    this._box = null;      // {cx, cz, span}
  }

  /** Ausschnitt so wählen, dass alles darin liegt. */
  fit(positions, medic) {
    const pts = positions.filter(Boolean);
    if (medic) pts.push(medic);
    if (pts.length === 0) { this._box = null; return; }

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    }

    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const span = Math.max(this.minSpan,
                          maxX - minX + this.padding * 2,
                          maxZ - minZ + this.padding * 2);
    this._box = { cx, cz, span };
  }

  get ready() { return this._box !== null; }

  /** Kantenlänge des Ausschnitts in Metern — für den Maßstab auf der Karte. */
  get spanMeters() { return this._box ? this._box.span : this.minSpan; }

  /**
   * Weltposition → 0..1 auf der Karte. x nach rechts, y nach oben, wobei oben
   * die anfängliche Blickrichtung (−Z) ist.
   */
  project(pos) {
    if (!this._box || !pos) return { x: 0.5, y: 0.5 };
    const { cx, cz, span } = this._box;
    return {
      x: (pos.x - cx) / span + 0.5,
      y: (cz - pos.z) / span + 0.5,
    };
  }

  /** Blickrichtung als Winkel auf der Karte, in Grad, 0 = oben. */
  heading(forward) {
    if (!forward) return 0;
    return Math.atan2(forward.x, -forward.z) * 180 / Math.PI;
  }
}

/** Waagerechter Abstand — Kopfhöhe darf nicht als „weit weg“ zählen. */
export function distance(a, b) {
  if (!a || !b) return Infinity;
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/**
 * Nächster Patient aus `patients` innerhalb von `maxDistance` Metern.
 * @returns {{patient:object, distance:number}|null}
 */
export function nearest(from, patients, maxDistance) {
  let best = null, bestD = Infinity;
  for (const p of patients) {
    if (!p || !p.pos) continue;
    const d = distance(from, p.pos);
    if (d < bestD) { bestD = d; best = p; }
  }
  if (!best || bestD > maxDistance) return null;
  return { patient: best, distance: bestD };
}

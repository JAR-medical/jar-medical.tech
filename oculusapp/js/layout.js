/* Wo die Patienten stehen — die Brücke zwischen Datensatz und Raum.
 *
 * Der Datensatz trägt pro Patient schon eine Rasterzelle (`location`: "C2",
 * "B3", "F6" …) — dasselbe Ablage-Raster, das auch das Lagebild der
 * Einsatzleitung zeigt. Hier werden daraus Meter, damit der AR-Client zwei Dinge
 * kann, die der flache Client nicht kann:
 *
 *   • eine Lagekarte zeichnen, auf der jeder in seiner Zelle steht, und
 *   • merken, wenn der Trupp körperlich bei einem Patienten angekommen ist.
 *
 * Das Raster wird einmal am Anfang im Raum verankert: am Feldrand stehen, über
 * die Schadensstelle blicken, bestätigen. Alles danach ist relativ zu dieser
 * Pose — eine Übung in der Turnhalle passt so ohne Vermessung zum Datensatz.
 *
 * Konvention: +Z des Feldes zeigt von der Ausrichtungspose weg (Reihen wachsen
 * ins Feld hinein), +X nach rechts (Spalten A→G).
 */

"use strict";

/** "C2" → {col: 2, row: 2}. Kleinschreibung und Leerzeichen sind egal. */
export function parseCell(location) {
  if (typeof location !== "string") return null;
  const s = location.trim();
  if (s.length < 2) return null;

  const c = s[0].toUpperCase();
  if (c < "A" || c > "Z") return null;

  const rest = s.slice(1);
  if (!/^\d+$/.test(rest)) return null;
  const row = Number(rest);
  if (row <= 0) return null;

  return { col: c.charCodeAt(0) - 65, row };
}

export function columnLabel(col) {
  return col >= 0 && col < 26 ? String.fromCharCode(65 + col) : "?";
}

export class ScenarioLayout {
  /**
   * @param {object} [opts]
   * @param {number} [opts.cellSize]      Meter zwischen zwei Rasterzellen
   * @param {number} [opts.fieldDistance] Meter von der Ausrichtungspose zur Feldmitte
   */
  constructor({ cellSize = 3, fieldDistance = 6 } = {}) {
    this.cellSize = cellSize;
    this.fieldDistance = fieldDistance;

    this.cells = new Map();     // markerId → {col,row}
    this.local = new Map();     // markerId → {x,z} im Feldkoordinatensystem
    this.minCol = 0; this.maxCol = 0;
    this.minRow = 1; this.maxRow = 1;

    this.aligned = false;
    this._anchor = { x: 0, y: 0, z: 0 };
    this._yaw = 0;              // Bogenmaß, Drehung um +Y
  }

  get hasCells() { return this.cells.size > 0; }
  get columns() { return this.maxCol - this.minCol + 1; }
  get rows() { return this.maxRow - this.minRow + 1; }

  /** Rasterzellen aus den Patienten lesen und das Feld um seine Mitte legen. */
  build(patients) {
    this.cells.clear();
    this.local.clear();
    let minCol = Infinity, maxCol = -Infinity, minRow = Infinity, maxRow = -Infinity;

    for (const p of patients) {
      if (!p) continue;
      const cell = parseCell(p.location);
      if (!cell) continue;
      this.cells.set(p.marker_id, cell);
      minCol = Math.min(minCol, cell.col); maxCol = Math.max(maxCol, cell.col);
      minRow = Math.min(minRow, cell.row); maxRow = Math.max(maxRow, cell.row);
    }

    if (this.cells.size === 0) {
      this.minCol = this.maxCol = 0;
      this.minRow = this.maxRow = 1;
      return;
    }

    this.minCol = minCol; this.maxCol = maxCol;
    this.minRow = minRow; this.maxRow = maxRow;

    const cx = (minCol + maxCol) / 2;
    const cz = (minRow + maxRow) / 2;
    for (const [id, cell] of this.cells)
      this.local.set(id, { x: (cell.col - cx) * this.cellSize, z: (cell.row - cz) * this.cellSize });
  }

  /** Feld im Raum verankern: hier steht der Trupp, dorthin blickt er. */
  align(headPosition, headForward) {
    let fx = headForward.x, fz = headForward.z;
    const len = Math.hypot(fx, fz);
    if (len < 1e-3) { fx = 0; fz = 1; }
    else { fx /= len; fz /= len; }

    this._yaw = Math.atan2(fx, fz);
    this._anchor = {
      x: headPosition.x + fx * this.fieldDistance,
      y: headPosition.y,
      z: headPosition.z + fz * this.fieldDistance,
    };
    this.aligned = true;
  }

  cell(markerId) { return this.cells.get(markerId) || null; }

  cellLabel(markerId) {
    const c = this.cell(markerId);
    return c ? columnLabel(c.col) + c.row : "—";
  }

  /** Weltposition (in der Referenzraum-Ebene) oder null. */
  world(markerId) {
    const l = this.local.get(markerId);
    if (!l) return null;
    const s = Math.sin(this._yaw), c = Math.cos(this._yaw);
    return {
      x: this._anchor.x + l.x * c + l.z * s,
      y: this._anchor.y,
      z: this._anchor.z - l.x * s + l.z * c,
    };
  }

  /** Waagerechter Abstand — Kopfhöhe darf nicht als „weit weg“ zählen. */
  distance(markerId, from) {
    const w = this.world(markerId);
    if (!w) return Infinity;
    return Math.hypot(w.x - from.x, w.z - from.z);
  }

  /** Nächster Patient aus `candidates` innerhalb von `maxDistance` Metern. */
  nearest(from, candidates, maxDistance) {
    if (!this.aligned) return null;
    let best = null, bestD = Infinity;
    for (const id of candidates) {
      const d = this.distance(id, from);
      if (d < bestD) { bestD = d; best = id; }
    }
    if (best === null || bestD > maxDistance) return null;
    return { markerId: best, distance: bestD };
  }

  // --- Lagekarte ---------------------------------------------------------

  /** Zelle → 0..1 im Raster (x = Spalte, y = Reihe, y wächst ins Feld). */
  normalized(col, row) {
    return {
      x: (col - this.minCol + 0.5) / this.columns,
      y: (row - this.minRow + 0.5) / this.rows,
    };
  }

  normalizedFor(markerId) {
    const c = this.cell(markerId);
    return c ? this.normalized(c.col, c.row) : null;
  }

  /** Weltposition → 0..1 im Raster. Werte außerhalb 0..1 heißen: neben dem Feld. */
  normalizedFromWorld(pos) {
    if (!this.aligned) return { x: 0.5, y: 0.5 };

    const dx = pos.x - this._anchor.x, dz = pos.z - this._anchor.z;
    const s = Math.sin(-this._yaw), c = Math.cos(-this._yaw);
    const lx = dx * c + dz * s;
    const lz = -dx * s + dz * c;

    const cx = (this.minCol + this.maxCol) / 2;
    const cz = (this.minRow + this.maxRow) / 2;
    const colF = lx / Math.max(0.01, this.cellSize) + cx;
    const rowF = lz / Math.max(0.01, this.cellSize) + cz;
    return {
      x: (colF - this.minCol + 0.5) / this.columns,
      y: (rowF - this.minRow + 0.5) / this.rows,
    };
  }

  /** Blickrichtung als Drehung um die Karten-Hochachse, in Grad. */
  headingDegrees(headForward) {
    if (!this.aligned) return 0;
    const s = Math.sin(-this._yaw), c = Math.cos(-this._yaw);
    const lx = headForward.x * c + headForward.z * s;
    const lz = -headForward.x * s + headForward.z * c;
    return Math.atan2(lx, lz) * 180 / Math.PI;
  }
}

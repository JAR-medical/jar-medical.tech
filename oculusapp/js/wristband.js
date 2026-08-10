/* Das Armband — ein Stück Papier als Bedienfeld.
 *
 * Sechs Felder auf einem Streifen, der am Unterarm sitzt. Jedes Feld trägt
 * einen ArUco-Marker und ein Zeichen. Wer ein Feld berührt, löst die Handlung
 * aus. Der Sinn: die Hände sind am Patienten, der Blick ist beim Patienten —
 * eine Reihe Knöpfe im Blickfeld ist beides nicht.
 *
 * Dieses Modul ist die **eine Wahrheit** über das Armband: welche Felder es
 * gibt, welcher Marker auf welchem sitzt, wie groß gedruckt wird und wann eine
 * Berührung als Druck zählt. Drei Dinge hängen daran und müssen deshalb
 * zusammenpassen:
 *
 *   assets/panel/armband.html   der Druckbogen (zeichnet die Marker aus
 *                               vendor/aruco.js — dieselbe Bibliothek, die
 *                               sie später liest, also per Konstruktion gleich)
 *   xr.js                       das Armband am Controller: seine Lage ist
 *                               bekannt, „berührt" heißt Fingerspitze im Feld
 *   arucoscan.js                das Armband vor einer Kamera: „berührt" heißt,
 *                               der Marker ist plötzlich verdeckt
 *
 * Keine GL, kein DOM, keine Kamera — nur Maße und Zustand. Damit ist der Teil,
 * der falsch sein könnte (wann gilt etwas als gedrückt), ohne Gerät prüfbar.
 */

"use strict";

/* ------------------------------------------------------------------ Maße
 *
 * Gedruckt wird in Millimetern, gerechnet in Metern. Die Feldgröße ist ein
 * Kompromiss: kleiner wird der Marker aus 40 cm nicht mehr sicher erkannt,
 * größer passt der Streifen nicht mehr auf einen Unterarm. */

export const CELL_MM = 26;        // Kantenlänge eines Feldes
export const MARK_MM = 20;        // der Marker darin (Rest ist Rand + Zeichen)
export const COLS = 3;
export const ROWS = 2;
export const PANEL_W = (COLS * CELL_MM) / 1000;   // 0,078 m
export const PANEL_H = (ROWS * CELL_MM) / 1000;   // 0,052 m

/**
 * Die Felder. `marker` ist die Nummer im Wörterbuch ARUCO_MIP_36h12 (250
 * Codes, großer Hamming-Abstand — verwechselt sich also kaum), `action` der
 * Schlüssel, den die Verdrahtung auf den Ablauf abbildet.
 *
 * Die Anordnung ist nicht beliebig: JA und NEIN liegen nebeneinander in der
 * oberen Reihe, weil sie im mSTaRT-Durchlauf abwechselnd gebraucht werden und
 * der Daumen dann nur seitlich wandert. „Zurück" liegt daneben, nicht darunter
 * — eine Korrektur soll nicht in der Nähe von „Neuer Patient" liegen.
 */
export const CELLS = [
  { action: "ja",         marker: 0, label: "Ja",       glyph: "✓", col: 0, row: 0 },
  { action: "nein",       marker: 1, label: "Nein",     glyph: "✗", col: 1, row: 0 },
  { action: "zurueck",    marker: 2, label: "Zurück",   glyph: "↩", col: 2, row: 0 },
  { action: "neu",        marker: 3, label: "Patient",  glyph: "＋", col: 0, row: 1 },
  { action: "taetigkeit", marker: 4, label: "Tätigkeit", glyph: "⇄", col: 1, row: 1 },
  { action: "lagebild",   marker: 5, label: "Lagebild", glyph: "▦", col: 2, row: 1 },
];

/**
 * Zwei Marker außen an den Schmalseiten, die zu keinem Feld gehören. Sie sagen
 * der Kameraerkennung „das Armband ist im Bild" — ohne sie ließe sich ein
 * verdecktes Feld nicht von einem weggedrehten Armband unterscheiden. Zwei,
 * damit einer verdeckt sein darf.
 */
export const ANCHORS = [8, 9];

export const DICTIONARY = "ARUCO_MIP_36h12";

export function cellByMarker(id) {
  return CELLS.find((c) => c.marker === id) || null;
}

export function cellByAction(action) {
  return CELLS.find((c) => c.action === action) || null;
}

/**
 * Feldmitte und -größe im Panelraum: Ursprung in der Panelmitte, x nach
 * rechts, y nach oben, alles in Metern. Genau dieses Raster benutzen der
 * Druckbogen und die Trefferprüfung am Controller.
 */
export function cellRect(cell) {
  const s = CELL_MM / 1000;
  return {
    x: (cell.col - (COLS - 1) / 2) * s,
    y: ((ROWS - 1) / 2 - cell.row) * s,
    w: s,
    h: s,
  };
}

/** Welches Feld liegt an dieser Stelle im Panelraum? null = daneben. */
export function cellAt(x, y) {
  for (const c of CELLS) {
    const r = cellRect(c);
    if (Math.abs(x - r.x) <= r.w / 2 && Math.abs(y - r.y) <= r.h / 2) return c;
  }
  return null;
}

/* --------------------------------------------------------------- Auslösen
 *
 * Beide Erkennungswege liefern dasselbe: „auf Feld X liegt gerade eine
 * Berührung" oder „auf keinem". Was daraus ein Druck wird, steht hier — einmal,
 * für beide.
 *
 * Drei Regeln, jede gegen einen konkreten Fehler:
 *
 *   HOLD_MS   eine Berührung muss kurz stehen. Beim Wandern über das Armband
 *             streift man Nachbarfelder; ohne Haltezeit löste jedes davon aus.
 *   COOL_MS   nach dem Auslösen ist eine Weile Ruhe. Sonst feuert ein liegender
 *             Finger die Frage im Bildtakt durch.
 *   Loslassen zwischen zwei Drücken auf **dasselbe** Feld muss das Feld einmal
 *             frei gewesen sein. Zweimal „Ja" ist damit bewusst zwei
 *             Berührungen, nicht ein langes Liegenbleiben.
 */

export const HOLD_MS = 220;
export const COOL_MS = 700;

export class PanelPress {
  /**
   * @param {(action: string, cell: object) => void} onPress
   */
  constructor(onPress, { hold = HOLD_MS, cool = COOL_MS } = {}) {
    this.onPress = onPress || (() => {});
    this.hold = hold;
    this.cool = cool;
    this.reset();
  }

  reset() {
    this.touching = null;      // Feld unter der Berührung, oder null
    this._since = 0;
    this._firedAt = -Infinity;
    this._armed = true;        // wurde seit dem letzten Auslösen losgelassen?
    this._lastFired = null;
  }

  /**
   * Einen Beobachtungsschritt einspeisen.
   * @param {object|null} cell Feld unter der Berührung (aus CELLS) oder null
   * @param {number} now Zeitstempel in ms
   * @returns {object|null} das ausgelöste Feld, falls jetzt gedrückt wurde
   */
  update(cell, now) {
    if (!cell) {
      this.touching = null;
      this._armed = true;                      // losgelassen
      return null;
    }

    if (this.touching !== cell) {              // neues Feld → Haltezeit neu
      this.touching = cell;
      this._since = now;
      if (cell !== this._lastFired) this._armed = true;
      return null;
    }

    if (!this._armed) return null;
    if (now - this._since < this.hold) return null;
    if (now - this._firedAt < this.cool) return null;

    this._firedAt = now;
    this._armed = false;
    this._lastFired = cell;
    this.onPress(cell.action, cell);
    return cell;
  }

  /** Wie weit die Haltezeit fortgeschritten ist — 0…1, für die Anzeige. */
  progress(now) {
    if (!this.touching || !this._armed) return 0;
    return Math.max(0, Math.min(1, (now - this._since) / this.hold));
  }
}

/**
 * Aus einer Liste sichtbarer Markernummern ablesen, welches Feld verdeckt ist.
 * Das ist der Kameraweg: alle Felder waren zu sehen, eines fehlt plötzlich —
 * dann liegt ein Finger darauf.
 *
 * @param {Set<number>|number[]} visible  gerade erkannte Marker
 * @param {Set<number>} seen              welche Felder in dieser Sitzung je zu sehen waren
 * @returns {object|null} verdecktes Feld, oder null
 */
export function coveredCell(visible, seen) {
  const vis = visible instanceof Set ? visible : new Set(visible);

  // Ohne Anker ist das Armband nicht im Bild — dann ist gar nichts verdeckt,
  // sondern nur weggedreht.
  if (!ANCHORS.some((a) => vis.has(a))) return null;

  const missing = CELLS.filter((c) => seen.has(c.marker) && !vis.has(c.marker));
  // Genau eines fehlt: ein Finger. Mehrere fehlen: halbes Armband aus dem Bild,
  // schräg gehalten, Schatten — daraus wird keine Handlung.
  return missing.length === 1 ? missing[0] : null;
}

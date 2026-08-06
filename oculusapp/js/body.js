/* Das Körpermodell — wo am Patienten was ist.
 *
 * Ein Mensch aus dreizehn Regionen, jede aus ein oder zwei Quadern. Das ist
 * absichtlich grob: es soll aus zwei Metern Entfernung erkennbar sein, welcher
 * Körperteil rot ist, und nicht anatomisch stimmen. Die Regionen sind die
 * Einheit, an der Befunde hängen — „Blutung, Oberschenkel rechts" ist das, was
 * man weitergibt, nicht ein Punkt auf einer Haut.
 *
 * Der Raum des Modells: y von 0 (Fußsohlen) bis 1 (Scheitel), x nach **links
 * des Patienten**, z nach vorn (aus der Brust heraus). Wer dem Modell
 * gegenübersteht, sieht seine linke Seite also rechts — spiegelverkehrt, wie
 * bei einem echten Gegenüber. Beschriftet wird anatomisch, aus Sicht des
 * Patienten.
 *
 * Dieses Modul ist reine Geometrie: keine GL, kein DOM. Das Zeichnen steht in
 * bodyview.js, damit dieselben Maße in der Brille und flach im Browser gelten.
 */

"use strict";

/** [Mittelpunkt x,y,z, halbe Kantenlängen x,y,z] im Modellraum. */
const box = (cx, cy, cz, hx, hy, hz) => ({ cx, cy, cz, hx, hy, hz });

export const REGIONS = [
  { id: "kopf",    label: "Kopf",    boxes: [box(0, 0.945, 0.005, 0.048, 0.055, 0.055)] },
  { id: "hals",    label: "Hals",    boxes: [box(0, 0.868, 0.000, 0.030, 0.022, 0.030)] },
  { id: "thorax",  label: "Thorax",  boxes: [box(0, 0.757, 0.000, 0.105, 0.090, 0.060)] },
  { id: "abdomen", label: "Abdomen", boxes: [box(0, 0.617, 0.000, 0.090, 0.050, 0.056)] },
  { id: "becken",  label: "Becken",  boxes: [box(0, 0.516, 0.000, 0.098, 0.051, 0.058)] },

  { id: "arm-li-ober",  label: "Oberarm links",  boxes: [box( 0.140, 0.749, 0, 0.030, 0.085, 0.030)] },
  { id: "arm-li-unter", label: "Unterarm links", boxes: [box( 0.140, 0.566, 0, 0.026, 0.098, 0.026),
                                                         box( 0.140, 0.440, 0, 0.028, 0.028, 0.018)] },
  { id: "arm-re-ober",  label: "Oberarm rechts",  boxes: [box(-0.140, 0.749, 0, 0.030, 0.085, 0.030)] },
  { id: "arm-re-unter", label: "Unterarm rechts", boxes: [box(-0.140, 0.566, 0, 0.026, 0.098, 0.026),
                                                          box(-0.140, 0.440, 0, 0.028, 0.028, 0.018)] },

  { id: "bein-li-ober",  label: "Oberschenkel links",  boxes: [box( 0.050, 0.362, 0, 0.050, 0.103, 0.052)] },
  { id: "bein-li-unter", label: "Unterschenkel links", boxes: [box( 0.050, 0.140, 0.000, 0.040, 0.119, 0.043),
                                                               box( 0.050, 0.011, 0.045, 0.040, 0.011, 0.075)] },
  { id: "bein-re-ober",  label: "Oberschenkel rechts",  boxes: [box(-0.050, 0.362, 0, 0.050, 0.103, 0.052)] },
  { id: "bein-re-unter", label: "Unterschenkel rechts", boxes: [box(-0.050, 0.140, 0.000, 0.040, 0.119, 0.043),
                                                                box(-0.050, 0.011, 0.045, 0.040, 0.011, 0.075)] },
];

export function findRegion(id) {
  return REGIONS.find((r) => r.id === id) || null;
}

export function regionLabel(id) {
  const r = findRegion(id);
  return r ? r.label : id;
}

/**
 * Was sich an einer Region festhalten lässt. Kurz gehalten: sechs Knöpfe passen
 * auf einen Schirm, und im Einsatz wird ohnehin nur das Grobe festgehalten —
 * Freitext ist Sache des Diktats.
 */
export const FINDINGS = [
  "Blutung", "Fraktur", "Wunde", "Verbrennung", "Prellung", "Amputation",
];

/* ------------------------------------------------------------------ Netz */

// Ein Würfel: sechs Flächen, je zwei Dreiecke, Ecken gegen den Uhrzeigersinn
// von außen gesehen.
const FACES = [
  { n: [0, 0, 1],  c: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { n: [0, 0, -1], c: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
  { n: [1, 0, 0],  c: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
  { n: [-1, 0, 0], c: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
  { n: [0, 1, 0],  c: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
  { n: [0, -1, 0], c: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
];

/**
 * Ein Puffer für den ganzen Körper, dazu je Region der Abschnitt darin — so
 * lässt sich jede Region einzeln und in ihrer eigenen Farbe zeichnen.
 * @returns {{data: Float32Array, stride: number, ranges: Array<{id,start,count}>}}
 */
export function buildMesh() {
  const out = [];
  const ranges = [];

  for (const region of REGIONS) {
    const start = out.length / 6;
    for (const b of region.boxes) {
      for (const f of FACES) {
        const v = f.c.map(([sx, sy, sz]) => [
          b.cx + sx * b.hx, b.cy + sy * b.hy, b.cz + sz * b.hz,
        ]);
        for (const i of [0, 1, 2, 0, 2, 3]) {
          out.push(v[i][0], v[i][1], v[i][2], f.n[0], f.n[1], f.n[2]);
        }
      }
    }
    ranges.push({ id: region.id, start, count: out.length / 6 - start });
  }

  return { data: new Float32Array(out), stride: 6, ranges };
}

/** Grobe Hülle des ganzen Modells — für den schnellen Vortest beim Zeigen. */
export const BOUNDS = { hx: 0.22, cy: 0.5, hy: 0.52, hz: 0.13 };

/* ----------------------------------------------------------------- Zeigen */

/** Strahl gegen einen achsenparallelen Quader. Gibt die Entfernung oder null. */
function hitBox(o, d, b) {
  let tMin = -Infinity, tMax = Infinity;
  const lo = [b.cx - b.hx, b.cy - b.hy, b.cz - b.hz];
  const hi = [b.cx + b.hx, b.cy + b.hy, b.cz + b.hz];
  const oo = [o.x, o.y, o.z], dd = [d.x, d.y, d.z];

  for (let i = 0; i < 3; i++) {
    if (Math.abs(dd[i]) < 1e-9) {
      if (oo[i] < lo[i] || oo[i] > hi[i]) return null;
      continue;
    }
    let t1 = (lo[i] - oo[i]) / dd[i];
    let t2 = (hi[i] - oo[i]) / dd[i];
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return null;
  }
  if (tMax < 0) return null;
  return tMin >= 0 ? tMin : tMax;
}

/**
 * Welche Region trifft der Strahl? Ursprung und Richtung im **Modellraum**.
 * @returns {{id: string, label: string, t: number}|null}
 */
export function pickRegion(origin, dir) {
  let best = null;
  for (const region of REGIONS) {
    for (const b of region.boxes) {
      const t = hitBox(origin, dir, b);
      if (t === null) continue;
      if (!best || t < best.t) best = { id: region.id, label: region.label, t };
    }
  }
  return best;
}

/** Trifft der Strahl das Modell überhaupt? Billiger Vortest gegen die Hülle. */
export function hitsBounds(origin, dir) {
  return hitBox(origin, dir,
                box(0, BOUNDS.cy, 0, BOUNDS.hx, BOUNDS.hy, BOUNDS.hz)) !== null;
}

/* ------------------------------------------------------------------ Farben */

export const BODY_SKIN = [0.72, 0.78, 0.86];
export const BODY_HURT = [0.90, 0.28, 0.30];
export const BODY_PICK = [0.49, 0.75, 1.0];

/**
 * Farbe einer Region: rot, wo ein Befund hängt; hell, wo der Zeiger liegt oder
 * gerade eingetragen wird; sonst neutral.
 * @param {object} findings {regionId: [text, …]}
 */
export function regionColor(id, findings, hover, active) {
  if (id === active || id === hover) return BODY_PICK;
  const has = findings && findings[id] && findings[id].length;
  return has ? BODY_HURT : BODY_SKIN;
}

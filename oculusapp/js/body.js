/* Das Körpermodell — wo am Patienten was ist.
 *
 * Gezeichnet wird ein echtes Menschnetz: das **MakeHuman-Basisnetz**, im
 * September 2020 unter CC0 gestellt und geschlechtsneutral (MakeHuman formt
 * daraus erst über Modifikatoren einen bestimmten Körper). `make_body.py` holt
 * es, wirft Helfergeometrie und Gelenkwürfel weg und legt es in
 * `assets/body/` ab — Herkunft und Lizenz stehen dort in HERKUNFT.md.
 *
 * Dieses Modul hält die **dreizehn Regionen**, an denen Befunde hängen:
 * „Blutung, Oberschenkel rechts" ist das, was weitergegeben wird, nicht ein
 * Punkt auf einer Haut. Jede Region ist ein Quader — nicht als Bild, sondern
 * als Trefferfläche zum Zeigen und als Notbehelf, solange das Netz noch lädt.
 *
 * Die Quader sind **nicht ausgedacht**: `make_body.py` ordnet jeden Punkt des
 * Netzes dem nächstgelegenen Knochen zu (MakeHuman liefert die Gelenke als
 * eigene Gruppen mit) und gibt die Hüllen aus, die dabei entstehen. Sie stehen
 * unten so, wie das Skript sie gemeldet hat. Ändert sich das Netz, wird das
 * Skript neu gelaufen und die Liste ersetzt.
 *
 * Der Raum des Modells: y von 0 (Fußsohlen) bis 1 (Scheitel), x nach **links
 * des Patienten**, z nach vorn (aus der Brust heraus). Wer dem Modell
 * gegenübersteht, sieht seine linke Seite also rechts — spiegelverkehrt, wie
 * bei einem echten Gegenüber. Beschriftet wird anatomisch, aus Sicht des
 * Patienten. Das Netz steht in A-Haltung, die Arme also schräg abgespreizt;
 * deshalb sitzen die Unterarme weit außen.
 *
 * Dieses Modul ist reine Geometrie: keine GL, kein DOM. Das Zeichnen steht in
 * bodyview.js, damit dieselben Maße in der Brille und flach im Browser gelten.
 */

"use strict";

/** [Mittelpunkt x,y,z, halbe Kantenlängen x,y,z] im Modellraum. */
const box = (cx, cy, cz, hx, hy, hz) => ({ cx, cy, cz, hx, hy, hz });

/* Reihenfolge und Schlüssel müssen zu `REGION_ORDER` in make_body.py passen —
 * daran hängen die Abschnitte im Netz. */
export const REGIONS = [
  { id: "kopf",    label: "Kopf",    boxes: [box(+0.0000, 0.9526, -0.0318, 0.0528, 0.0474, 0.0622)] },
  { id: "hals",    label: "Hals",    boxes: [box(+0.0000, 0.8735, -0.0312, 0.0474, 0.0317, 0.0589)] },
  { id: "thorax",  label: "Thorax",  boxes: [box(+0.0000, 0.7958, -0.0465, 0.0709, 0.0460, 0.0604)] },
  { id: "abdomen", label: "Abdomen", boxes: [box(+0.0000, 0.6629, -0.0372, 0.0892, 0.0869, 0.0640)] },
  { id: "becken",  label: "Becken",  boxes: [box(+0.0000, 0.5197, -0.0574, 0.0656, 0.0562, 0.0741)] },

  { id: "arm-li-ober",  label: "Oberarm links",  boxes: [box(+0.1203, 0.7604, -0.0463, 0.0833, 0.0778, 0.0606)] },
  { id: "arm-li-unter", label: "Unterarm links", boxes: [box(+0.2332, 0.6429, +0.0233, 0.0647, 0.0796, 0.0991)] },
  { id: "arm-re-ober",  label: "Oberarm rechts", boxes: [box(-0.1203, 0.7604, -0.0463, 0.0833, 0.0778, 0.0606)] },
  { id: "arm-re-unter", label: "Unterarm rechts", boxes: [box(-0.2332, 0.6429, +0.0233, 0.0647, 0.0796, 0.0991)] },

  { id: "bein-li-ober",  label: "Oberschenkel links",  boxes: [box(+0.0620, 0.4316, -0.0622, 0.0620, 0.1788, 0.0692)] },
  { id: "bein-li-unter", label: "Unterschenkel links", boxes: [box(+0.1128, 0.1402, -0.0323, 0.0495, 0.1402, 0.0766)] },
  { id: "bein-re-ober",  label: "Oberschenkel rechts", boxes: [box(-0.0620, 0.4316, -0.0622, 0.0620, 0.1788, 0.0692)] },
  { id: "bein-re-unter", label: "Unterschenkel rechts", boxes: [box(-0.1128, 0.1402, -0.0323, 0.0495, 0.1402, 0.0766)] },
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
export const BOUNDS = { hx: 0.30, cy: 0.5, hy: 0.52, hz: 0.14 };

/** Wo das fertige Netz liegt (aus make_body.py). */
export const MESH_URL = "assets/body/body.json";

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
 * gerade eingetragen wird; sonst die Grundfarbe. Die ist normalerweise ein
 * neutraler Ton — bei den kleinen Figuren über den Markern dagegen die
 * Sichtungsfarbe, damit man von weitem sieht, wer da liegt.
 *
 * @param {object} findings {regionId: [text, …]}
 * @param {number[]|null} base Grundfarbe [r,g,b] 0…1
 */
export function regionColor(id, findings, hover, active, base = null) {
  if (id != null && (id === active || id === hover)) return BODY_PICK;
  const has = findings && findings[id] && findings[id].length;
  return has ? BODY_HURT : (base || BODY_SKIN);
}

/** "#e5484d" → [0.90, 0.28, 0.30] */
export function rgbOf(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

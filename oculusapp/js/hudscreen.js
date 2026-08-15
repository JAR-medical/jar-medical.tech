/* Die Anzeige — als HUD, nicht als Fenster.
 *
 * Vier getrennte Ebenen, weil sie unterschiedlich im Raum hängen (siehe xr.js):
 *
 *   drawHudLayer  Randinformation, kopffest: Zustand oben links, Zählung oben
 *                 rechts, Lagekarte unten links, Hinweis unten rechts. Die Mitte
 *                 bleibt frei — da schaut man durch. Dazu eine Reihe kleiner
 *                 Knöpfe unten (`screen.hudActions`) für das, was jederzeit
 *                 möglich ist; sie liefert deren Trefferflächen zurück.
 *   drawCard      der Handlungsschritt, raumfest beim Patienten: Frage, Antwort,
 *                 Vitalwerte. Liefert die Trefferflächen für den Handstrahl.
 *   drawMarker    Bodenmarker je Patient, raumfest an seiner Position.
 *   drawReticle   der Ring, mit dem beim Anlegen die Stelle am Boden gezeigt wird.
 *
 * Gestaltung: keine Kacheln, keine Rundungen, keine Schlagschatten. Haarlinien,
 * Versalien-Kleinlabels, Tabellenziffern, und Farbe ausschließlich für
 * Sichtungskategorien. Alles Dunkle ist nur so dunkel, dass die Schrift über dem
 * Durchblick lesbar bleibt.
 */

"use strict";

/* Die Farben liegen NICHT fest, sondern kommen aus display.js: auf einem
 * additiven Glas (HoloLens 2) ist Schwarz unsichtbar, und genau darauf beruhte
 * hier bisher jede Lesbarkeit — dunkle Unterlage, schwarzer Saum. `setPalette`
 * tauscht beides gegen die additive Fassung aus, ohne dass eine einzige
 * Zeichenroutine davon wissen muss. */

import { PALETTE_ALPHA, paletteFor } from "./display.js";

const C = { ...PALETTE_ALPHA };

/** @param {boolean} additive aus dem Geräteprofil */
export function setPalette(additive) {
  Object.assign(C, paletteFor(!!additive));
  return C;
}

/** Nur für Prüfungen: die gerade geltende Palette. */
export function palette() { return C; }

const F = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/* ------------------------------------------------------------- Laufweite
 *
 * Eine Laufweite für alle Größen ist immer irgendwo falsch. Buchstaben stehen
 * beim Vergrößern optisch weiter auseinander — große Type muss also enger
 * laufen, kleine Type etwas weiter, damit sie nicht verklebt. Versalien
 * brauchen darüber hinaus generell Luft, weil ihnen die Unterlängen fehlen, an
 * denen das Auge sonst trennt.
 *
 * Die Werte sind in em, also größenrelativ — genau das ist der Punkt.
 */
function trackFor(size, isCaps) {
  if (isCaps) {
    // Versalien: viel Luft im Kleinen, deutlich weniger im Großen.
    if (size <= 14) return 0.16;
    if (size <= 20) return 0.14;
    if (size <= 28) return 0.11;
    return 0.08;
  }
  if (size <= 14) return 0.01;      // Kleingedrucktes hält sich sonst zu eng
  if (size <= 24) return 0;         // Lesegrößen laufen normal
  if (size <= 40) return -0.012;
  return -0.022;                    // Schlagzeilen deutlich enger
}

/* ------------------------------------------------------------- Werkzeug
 *
 * Über dem Durchblick gibt es keinen verlässlichen Hintergrund: dieselbe Schrift
 * steht mal auf Asphalt, mal auf einer weißen Wand. Statt alles auf Kacheln zu
 * legen (was jede Anzeige sofort wie ein Fenster aussehen lässt), bekommt jede
 * Type einen dunklen Saum — so bleibt sie auf jedem Untergrund lesbar und die
 * Fläche dahinter frei. */

function T(ctx, str, x, y, { size = 20, weight = 400, color = C.ink,
                             align = "left", track = null, caps = false } = {}) {
  const text = caps ? String(str).toUpperCase() : String(str);
  // Auf additivem Glas trägt kein Saum (siehe Palette), also muss die Type
  // selbst mehr Substanz haben: ein Schritt schwerer und eine Spur weiter
  // gesperrt. Das ist derselbe Handgriff wie über durchscheinenden Flächen —
  // Gewicht statt Deckkraft, weil Deckkraft hier nichts hergibt.
  const w = C.additive ? Math.min(900, weight + 100) : weight;
  const tr = (track == null ? trackFor(size, caps) : track) + (C.additive ? 0.01 : 0);
  ctx.font = `${w} ${size}px ${F}`;
  ctx.textAlign = align;
  if (tr) ctx.letterSpacing = tr + "em";

  // Der Saum trägt die helle Type über wechselndem Untergrund — aber nur, wo
  // er abdunkeln kann. Ist er durchsichtig (additives Glas), entfällt der
  // ganze Zug: er brächte nichts und kostete je Textstelle einen Strich.
  if (C.halo !== "rgba(0,0,0,0)") {
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeStyle = C.halo;
    ctx.lineWidth = Math.max(3, size / 6);
    ctx.strokeText(text, x, y);
  }

  ctx.fillStyle = color;
  ctx.fillText(text, x, y);

  if (tr) ctx.letterSpacing = "0px";
  ctx.textAlign = "left";
  return ctx.measureText(text).width;
}

/** Kleinlabel in Versalien. Die Sperrung richtet sich nach der Größe. */
function caps(ctx, text, x, y, size = 15, color = C.faint, align = "left") {
  return T(ctx, text, x, y, { size, weight: 600, color, align, caps: true });
}

/** Haarlinie mit Saum, damit sie auf jedem Untergrund steht. */
function rule(ctx, x, y, w, color = C.ruleSoft) {
  const yy = Math.round(y) + 0.5;
  if (C.haloRule !== "rgba(0,0,0,0)") {
    ctx.fillStyle = C.haloRule;
    ctx.fillRect(x, yy + 1, w, 1);
  }
  ctx.fillStyle = color;
  // Eine Haarlinie ohne Saum verschwindet auf hellem Grund. Auf additivem Glas
  // ist der Saum keine Option — dort wird die Linie selbst kräftiger.
  ctx.fillRect(x, yy, w, C.additive ? 2 : 1);
}

/**
 * Unterlage für einen Anzeigeblock: dunkle Fläche, damit die Schrift über jedem
 * Untergrund trägt, ein Hauch der zugehörigen Farbe darüber und eine kräftige
 * Kante an der Führungsseite. Flach und ungerundet — die Farbe ordnet zu, sie
 * dekoriert nicht.
 */
function block(ctx, x, y, w, h, accent = null, edge = "left") {
  // Auf einem additiven Glas ist `blockFill` durchsichtig: die Fläche entfällt
  // ersatzlos, statt als Schleier über der Einsatzstelle zu liegen. Die Kante
  // in der Farbe bleibt — sie ist die eigentliche Zuordnung.
  ctx.fillStyle = C.blockFill;
  ctx.fillRect(x, y, w, h);

  if (accent) {
    ctx.globalAlpha = C.blockTint;
    ctx.fillStyle = accent;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;

    ctx.fillStyle = accent;
    if (edge === "left") ctx.fillRect(x, y, 4, h);
    else if (edge === "right") ctx.fillRect(x + w - 4, y, 4, h);
    else if (edge === "top") ctx.fillRect(x, y, w, 4);
  }
}

function wrap(ctx, text, maxW) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function disc(ctx, x, y, r, color) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (C.haloRule !== "rgba(0,0,0,0)") {
    // Ein dunkler Ring um den Punkt hebt ihn vom Untergrund ab. Ohne
    // Abdunkeln (additiv) wäre derselbe Ring ein zweiter, blasser Punkt
    // daneben — also entfällt er.
    ctx.strokeStyle = C.haloRule;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.fill();
}

function ring(ctx, x, y, r, color, width = 2) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (C.haloRule !== "rgba(0,0,0,0)") {
    ctx.strokeStyle = C.haloRule;
    ctx.lineWidth = width + 2.5;
    ctx.stroke();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = C.additive ? width + 1 : width;
  ctx.stroke();
}

/* ============================================================ HUD-Ebene */

/**
 * Kopffeste Randinformation. Die Bildmitte bleibt leer — da schaut man durch.
 * @param {object} screen von workflow.screen()
 * @param {object} map    von workflow.mapModel()
 * @param {{hover?:number, dwell?:number}} [opts] Zeigerzustand der HUD-Knöpfe
 * @returns {Array<{x,y,w,h,index}>} Trefferflächen von `screen.hudActions`
 */
export function drawHudLayer(ctx, W, H, screen, map, opts = {}) {
  ctx.clearRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  const pad = Math.round(W * 0.038);
  topLeft(ctx, pad, pad, screen);
  topRight(ctx, W - pad, pad, map);
  bottomLeft(ctx, pad, H - pad, map);
  bottomRight(ctx, W - pad, H - pad, screen);
  return hudButtons(ctx, pad, H - pad, W, screen.hudActions || [],
                    opts.hover ?? -1, opts.dwell || 0, !!opts.press);
}

function topLeft(ctx, x, y, screen) {
  // Unter dem Zustand steht, in welcher Tätigkeit gearbeitet wird, und — während
  // der Vorsichtung — der Schritt. Beides je eine Zeile, nur wenn es sie gibt.
  const sub = [];
  if (screen.task) sub.push("task");
  if (screen.progress) sub.push("progress");
  block(ctx, x - 14, y - 12, 430, 60 + sub.length * 30, C.accent);

  caps(ctx, screen.title || "J.A.R.", x, y + 20, 22, C.dim);
  rule(ctx, x, y + 38, 390, C.rule);

  let sy = y + 68;
  for (const kind of sub) {
    if (kind === "task") {
      caps(ctx, screen.task, x, sy + 6, 16, C.faint);
    } else {
      const { step, total } = screen.progress;
      caps(ctx, `Schritt ${step}/${total}`, x, sy + 6, 18, C.faint);
      for (let i = 0; i < total; i++) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(x + 205 + i * 26, sy - 7, 19, 7);
        ctx.fillStyle = i < step ? C.accent : "rgba(255,255,255,0.28)";
        ctx.fillRect(x + 205 + i * 26, sy - 6, 18, 4);
      }
    }
    sy += 30;
  }
}

/* ------------------------------------------------------------ HUD-Knöpfe
 *
 * Was jederzeit möglich ist — einen Patienten anlegen, die Tätigkeit wechseln,
 * abbrechen — gehört nicht auf einen raumfesten Schirm vor dem Gesicht, sondern
 * als kleiner Knopf an den Rand des Blickfelds. Die Reihe sitzt rechts neben der
 * Lagekarte und über der Statuszeile; die Mitte bleibt frei.
 *
 * Sie wird nur in Zuständen ohne Handlungskarte benutzt (Lage, Stelle wählen).
 * Läge doch einmal eine Karte davor, gewinnt beim Zeigen die Karte — sie wird
 * auch darüber gezeichnet (siehe xr.js).
 */

const ACT_W = 300, ACT_H = 76, ACT_GAP = 18;
const ACT_LEFT = 452;          // rechts an der Lagekarte vorbei

function hudButtons(ctx, pad, yBottom, W, list, hover, dwell, press = false) {
  const rects = [];
  if (!list.length) return rects;

  const x0 = pad + ACT_LEFT;
  const y = yBottom - 54 - ACT_H;                 // über der Statuszeile
  const room = W - pad - x0 - ACT_GAP * (list.length - 1);
  const bw = Math.max(150, Math.min(ACT_W, room / list.length));

  list.forEach((b, i) => {
    const bx = x0 + i * (bw + ACT_GAP);
    const on = hover === i;
    const tint = b.tint === "primary" ? C.accent : C.rule;
    face(ctx, bx, y, bw, ACT_H, { on, press: on && press, tint, dwell });
    caps(ctx, b.label, bx + bw / 2, y + ACT_H / 2 + 8, 21, C.ink, "center");
    rects.push({ x: bx, y, w: bw, h: ACT_H, index: i });
  });
  return rects;
}

/**
 * Der Umriss eines Knopfes in seinen drei Zuständen.
 *
 * **Gedrückt ist ein eigener Zustand.** Er erscheint, sobald der Trigger unten
 * ist — nicht erst, wenn er losgelassen wird. Ein Knopf, der erst beim
 * Auslösen reagiert, fühlt sich tot an: dazwischen liegen leicht ein paar
 * Zehntel, und in denen weiß man nicht, ob man getroffen hat. Sichtbar wird er
 * als schmaler eingerückter Rahmen — dieselbe Bewegung, die ein echter Knopf
 * macht, wenn er nachgibt.
 */
function face(ctx, x, y, w, h, { on, press, tint, dwell = 0 }) {
  const inset = press ? Math.min(6, h * 0.06) : 0;
  const bx = x + inset, by = y + inset;
  const bw = w - inset * 2, bh = h - inset * 2;

  ctx.fillStyle = on ? C.btnFillOn : C.btnFill;
  ctx.fillRect(bx, by, bw, bh);
  if (tint) {
    // Auf additivem Glas bleibt die Füllung durchweg schwach: was gefüllt wird,
    // leuchtet, und ein leuchtender Knopf überstrahlt seine eigene Beschriftung.
    // Der Zustand sitzt dort im Umriss, nicht in der Fläche.
    ctx.globalAlpha = C.additive ? (press ? 0.16 : on ? 0.10 : 0.05)
                    : (press ? 0.34 : on ? 0.22 : 0.12);
    ctx.fillStyle = tint;
    ctx.fillRect(bx, by, bw, bh);
    ctx.globalAlpha = 1;
  }

  ctx.strokeStyle = on ? C.ink : tint;
  ctx.lineWidth = (press ? 4 : on ? 3 : 1.5) + (C.additive ? 1 : 0);
  ctx.strokeRect(Math.round(bx) + 0.5, Math.round(by) + 0.5, Math.round(bw), Math.round(bh));

  // Verweil-Anzeige: der Ersatz für den Trigger auf Geräten, die keinen
  // schicken. Sie sitzt an der Unterkante des Knopfes, auf den gezeigt wird.
  if (on && dwell > 0) {
    ctx.fillStyle = C.accent;
    ctx.fillRect(bx + 2, by + bh - 7, (bw - 4) * Math.min(1, dwell), 5);
  }
}

function topRight(ctx, x, y, map) {
  const c = map.counts;
  const items = [["#e5484d", c.SK1], ["#f5b301", c.SK2], ["#46a758", c.SK3],
                 ["#3e7bfa", c.SK4], ["#9aa4ae", c.DECEASED]];

  block(ctx, x - 456, y - 12, 470, 110, C.accent, "right");
  caps(ctx, `${c.total} erfasst`, x, y + 20, 22, C.dim, "right");
  rule(ctx, x - 430, y + 38, 430, C.rule);

  let cx = x;
  for (let i = items.length - 1; i >= 0; i--) {
    const [color, n] = items[i];
    const w = T(ctx, n, cx, y + 80, { size: 30, weight: 600, align: "right" });
    disc(ctx, cx - w - 16, y + 70, 8, color);
    cx -= w + 48;
  }
}

function bottomLeft(ctx, x, yBottom, map) {
  const w = 400, h = 300;
  const y = yBottom - h - 38;

  block(ctx, x - 14, y - 40, w + 34, h + 62, C.accent);
  caps(ctx, "Lagekarte", x, y - 14, 18, C.faint);
  drawField(ctx, x, y, w, h, map, { compact: true });
  T(ctx, map.footer || "", x, yBottom - 4, { size: 23, weight: 500, color: C.dim });
}

function bottomRight(ctx, x, yBottom, screen) {
  const text = screen.status || "";
  if (!text) return;
  ctx.font = `400 21px ${F}`;
  const w = ctx.measureText(text).width;
  block(ctx, x - w - 26, yBottom - 34, w + 40, 44, null);
  T(ctx, text, x, yBottom - 4, { size: 21, color: C.dim, align: "right" });
}

/* ------------------------------------------------------------ Lagekarte */

/**
 * Freie Lagekarte: ein Rahmen, ein Fadenkreuz zur Orientierung, die angelegten
 * Patienten als Punkte und die eigene Position mit Blickrichtung. Oben ist die
 * Richtung, in die zu Sitzungsbeginn geschaut wurde. Unten ein Maßstab, weil
 * sich der Ausschnitt mit jedem neuen Patienten ändert.
 */
function drawField(ctx, x, y, w, h, map, { compact = false } = {}) {
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 3;
  ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, w, h);
  ctx.strokeStyle = C.ruleSoft;
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, w, h);

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h);
  ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2);
  ctx.stroke();

  const toXY = (uv) => ({
    x: x + Math.max(0.02, Math.min(0.98, uv.x)) * w,
    y: y + (1 - Math.max(0.02, Math.min(0.98, uv.y))) * h,
  });

  const r = compact ? 9 : 11;
  for (const d of map.dots) {
    const p = toXY(d.uv);
    // Abtransportierte bleiben stehen — wo einer lag, gehört zum Lagebild —,
    // treten aber zurück, damit die offenen Fälle vorn bleiben.
    if (d.transported) ctx.globalAlpha = 0.4;
    if (d.target) ring(ctx, p.x, p.y, r + 7, C.accent, 2);
    if (d.sighted) disc(ctx, p.x, p.y, r, d.color);
    else ring(ctx, p.x, p.y, r - 1, d.color, 2);
    T(ctx, d.id, p.x, p.y + 5, { size: compact ? 13 : 15, weight: 600, align: "center" });
    ctx.globalAlpha = 1;
  }

  if (map.medic) {
    const p = toXY(map.medic.uv);
    const rad = (map.medic.heading * Math.PI) / 180;
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.sin(rad) * 18, p.y - Math.cos(rad) * 18);
    ctx.stroke();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    disc(ctx, p.x, p.y, 4.5, C.ink);
  }

  // Maßstab: ein Viertel der Kantenlänge.
  const meters = map.spanMeters ? map.spanMeters / 4 : null;
  if (meters) {
    const barW = w / 4;
    const by = y + h - 12;
    ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x + 10, by); ctx.lineTo(x + 10 + barW, by); ctx.stroke();
    ctx.strokeStyle = C.dim; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 10, by); ctx.lineTo(x + 10 + barW, by); ctx.stroke();
    caps(ctx, `${meters < 10 ? meters.toFixed(1) : Math.round(meters)} m`,
         x + 16 + barW, by + 5, 13, C.faint);
  }
}

/* ======================================================== Patientenkarte */

/**
 * Der Handlungsschritt, raumfest beim Patienten. Kein Kasten: nur Type mit Saum,
 * zwei Haarlinien und die Umrisse der Knöpfe.
 * @returns {Array<{x,y,w,h,index}>} Trefferflächen der Knöpfe
 */
export function drawCard(ctx, W, H, screen, opts = {}) {
  ctx.clearRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  const pad = 34;
  const w = W - pad * 2;

  // Unterlage in der Farbe, um die es geht: die Sichtungskategorie, sonst Akzent.
  block(ctx, 0, 0, W, H, screen.band || C.accent, "top");

  caps(ctx, screen.cardTitle || screen.title || "", pad, pad + 18, 19, C.dim);
  if (screen.badge) caps(ctx, screen.badge, W - pad, pad + 18, 19, C.faint, "right");

  // Die Sichtungsfarbe ist eine Linie, kein Banner.
  if (screen.band) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(pad, pad + 30, w, 5);
    ctx.fillStyle = screen.band;
    ctx.fillRect(pad, pad + 30, w, 3);
  } else rule(ctx, pad, pad + 31, w, C.rule);

  let y = pad + 104;

  const big = (screen.headline || "").length > 26 ? 44 : 52;
  ctx.font = `600 ${big}px ${F}`;
  for (const line of wrap(ctx, screen.headline, w).slice(0, 2)) {
    T(ctx, line, pad, y, { size: big, weight: 600, color: screen.headlineColor || C.ink });
    y += big + 8;
  }

  y += 22;
  ctx.font = `400 23px ${F}`;
  for (const line of wrap(ctx, screen.hint, w).slice(0, 3)) {
    T(ctx, line, pad, y, { size: 23, color: C.dim });
    y += 32;
  }

  y += 20;
  for (const item of screen.body || []) {
    const color = item.color === "muted" ? C.faint
                : item.color === "good" ? C.good
                : item.color === "warn" ? "#f2dfae"
                : item.color === "cat" ? (item.color2 || C.ink)
                : C.ink;
    ctx.font = `400 22px ${F}`;
    for (const line of wrap(ctx, item.text, w).slice(0, 3)) {
      T(ctx, line, pad, y, { size: 22, color });
      y += 30;
    }
    y += 6;
  }

  const grid = buttonGrid(screen.buttons || [], H - 48);
  if (screen.vitals && screen.vitals.length)
    vitalsRow(ctx, pad, grid.top - 84, w, screen.vitals);
  return buttons(ctx, pad, w, screen.buttons || [], grid, opts.hover, opts.dwell || 0,
                 !!opts.press);
}

/** Vitalwerte als Zahlenreihe mit Kleinlabels — kein Kachelgitter. */
function vitalsRow(ctx, x, y, w, vitals) {
  rule(ctx, x, y - 30, w, C.ruleSoft);
  let cx = x;
  for (const v of vitals) {
    caps(ctx, v.label, cx, y - 6, 15, C.faint);
    const vw = T(ctx, v.value, cx, y + 32, { size: 36, weight: 600 });
    cx += Math.max(108, vw + 62);
  }
}

/**
 * Wie die Knöpfe unter der Karte liegen. Bis zu drei stehen nebeneinander;
 * mehr bricht in eine zweite Reihe um (die Kategoriewahl hat sechs), die dann
 * etwas flacher ausfällt, damit der Text darüber Platz behält.
 */
function buttonGrid(list, yBottom) {
  const gap = 14;
  const perRow = list.length <= 3 ? Math.max(1, list.length) : Math.ceil(list.length / 2);
  const rows = Math.max(1, Math.ceil(list.length / perRow));
  const bh = rows > 1 ? 88 : 104;
  return { gap, perRow, rows, bh, top: yBottom - rows * bh - (rows - 1) * gap };
}

/** Knöpfe: Umriss, kein Fond. Gefüllt wird nur, worauf gezeigt wird. */
function buttons(ctx, x, w, list, grid, hover, dwell = 0, press = false) {
  const rects = [];
  if (!list.length) return rects;

  const { gap, perRow, rows, bh, top } = grid;
  const size = perRow > 2 ? 25 : 32;
  let i = 0;

  for (let r = 0; r < rows; r++) {
    const n = Math.min(perRow, list.length - i);
    const bw = (w - gap * (n - 1)) / n;
    const y = top + r * (bh + gap);

    for (let k = 0; k < n; k++, i++) {
      const b = list[i];
      const bx = x + k * (bw + gap);
      const on = hover === i;
      const tint = b.color ? b.color
                 : b.tint === "yes" ? "#46a758"
                 : b.tint === "no" ? "#e5484d"
                 : b.tint === "lna" ? "#3e7bfa"
                 : b.tint === "primary" ? C.accent
                 : C.rule;

      face(ctx, bx, y, bw, bh, { on, press: on && press, tint, dwell });

      ctx.font = `600 ${size}px ${F}`;
      const lines = wrap(ctx, b.label, bw - 28).slice(0, 2);
      lines.forEach((line, li) =>
        T(ctx, line, bx + bw / 2, y + bh / 2 + 10 + (li - (lines.length - 1) / 2) * 28,
          { size, weight: 600, align: "center" }));

      rects.push({ x: bx, y, w: bw, h: bh, index: i });
    }
  }
  return rects;
}

/* ====================================================== Bodenmarker */

/**
 * Der Marker, der am Boden beim Patienten liegt. Er ist gleichzeitig die
 * Schaltfläche: angeklickt wird der Patient, nicht ein Knopf, der von selbst
 * aufgeht.
 *
 * Gezeichnet als Ring mit Nummer — er wird flach auf den Boden gelegt, also
 * muss er aus jeder Richtung als Kreis funktionieren und darf keine Kante
 * haben, die eine Blickrichtung behauptet.
 *
 * @param {object} m {id, color, sighted, card, transported, hover}
 */
export function drawMarker(ctx, W, H, m) {
  ctx.clearRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  // Abtransportierte bleiben liegen, wo sie lagen, treten aber zurück: der Ring
  // ist dann Ortsangabe, keine offene Aufgabe mehr.
  if (m.transported) ctx.globalAlpha = 0.45;

  const cx = W / 2, cy = H / 2;
  const outer = W * 0.46;

  // Weicher Schein nach außen, damit der Ring auch auf hellem Boden steht. Auf
  // einem additiven Glas trägt ein dunkler Schein nichts — dort leuchtet der
  // Ring stattdessen selbst nach außen aus.
  const glow = ctx.createRadialGradient(cx, cy, outer * 0.55, cx, cy, outer);
  if (C.additive) {
    glow.addColorStop(0, hexA(m.color, 0.30));
    glow.addColorStop(1, hexA(m.color, 0));
  } else {
    glow.addColorStop(0, "rgba(0,0,0,0.45)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
  }
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(cx, cy, outer, 0, Math.PI * 2); ctx.fill();

  // Fläche in der Sichtungsfarbe, außen kräftiger Ring. Ungesichtet bleibt die
  // Fläche auf additivem Glas leer statt dunkel — sie wäre dort ein Fleck.
  ctx.fillStyle = m.sighted ? hexA(m.color, C.additive ? 0.26 : 0.42)
                : C.additive ? "rgba(0,0,0,0)" : "rgba(8,11,15,0.55)";
  ctx.beginPath(); ctx.arc(cx, cy, outer * 0.78, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = C.haloRule;
  ctx.lineWidth = W * 0.055;
  ctx.beginPath(); ctx.arc(cx, cy, outer * 0.78, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = m.hover ? C.ink : m.color;
  ctx.lineWidth = W * (m.hover ? 0.045 : 0.032);
  ctx.beginPath(); ctx.arc(cx, cy, outer * 0.78, 0, Math.PI * 2); ctx.stroke();

  // Ungesichtet: gestrichelter Innenring als „steht noch aus".
  if (!m.sighted) {
    ctx.setLineDash([W * 0.05, W * 0.04]);
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = W * 0.016;
    ctx.beginPath(); ctx.arc(cx, cy, outer * 0.58, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }

  T(ctx, "#" + m.id, cx, cy + W * 0.09, { size: W * 0.30, weight: 600, align: "center" });
  caps(ctx, m.transported ? "abtransportiert" : m.card != null ? `Karte ${m.card}` : "ohne Karte",
       cx, cy + W * 0.30, W * 0.062, m.sighted ? C.dim : C.faint, "center");

  ctx.globalAlpha = 1;
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ==================================================== Stelle am Boden */

/**
 * Der Ring, mit dem beim Anlegen die Stelle gezeigt wird. Er wandert flach über
 * den Boden dorthin, wohin der Controller zeigt, und wird bestätigt — deshalb
 * gestrichelt und offen: was hier liegt, ist noch nichts, sondern ein Vorschlag.
 *
 * Der Bogen am Rand ist die Verweil-Anzeige. Sie ist auf Geräten ohne Trigger
 * (Blicksteuerung im PICO-Browser) die einzige Rückmeldung darüber, dass gleich
 * ausgelöst wird, und muss deshalb an der Stelle stehen, auf die man schaut —
 * nicht am Rand des Blickfelds.
 *
 * @param {{ok?:boolean, dwell?:number, distance?:number}} m
 */
export function drawReticle(ctx, W, H, m = {}) {
  ctx.clearRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  const cx = W / 2, cy = H / 2;
  const r = W * 0.33;
  const tone = m.ok === false ? "#f5b301" : C.accent;

  const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.35);
  if (C.additive) {
    glow.addColorStop(0, "rgba(255,255,255,0.10)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
  } else {
    glow.addColorStop(0, "rgba(0,0,0,0.34)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
  }
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.35, 0, Math.PI * 2); ctx.fill();

  ctx.setLineDash([W * 0.055, W * 0.042]);
  ctx.strokeStyle = C.haloRule;
  ctx.lineWidth = W * 0.038;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = tone;
  ctx.lineWidth = W * 0.022;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);

  // Fadenkreuz: der Mittelpunkt ist die Stelle, nicht der Ring.
  ctx.strokeStyle = C.haloRule;
  ctx.lineWidth = W * 0.026;
  crosshair(ctx, cx, cy, r * 0.42);
  ctx.strokeStyle = tone;
  ctx.lineWidth = W * 0.012;
  crosshair(ctx, cx, cy, r * 0.42);

  const dwell = Math.min(1, Math.max(0, m.dwell || 0));
  if (dwell > 0) {
    ctx.strokeStyle = C.haloRule;
    ctx.lineWidth = W * 0.046;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.2, -Math.PI / 2, -Math.PI / 2 + dwell * Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = W * 0.03;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.2, -Math.PI / 2, -Math.PI / 2 + dwell * Math.PI * 2);
    ctx.stroke();
  }

  if (m.ok === false) caps(ctx, "Boden", cx, cy + r * 0.82, W * 0.062, C.faint, "center");
  else if (m.distance != null)
    caps(ctx, `${m.distance.toFixed(1)} m`, cx, cy + r * 0.82, W * 0.062, C.ink, "center");
}

/* ================================================================ Armband */

/**
 * Das Armband, wie es in der Brille über dem Papier liegt. Es zeichnet
 * dieselben sechs Felder wie der Druckbogen — nur eben leuchtend, mit der
 * Rückmeldung, die Papier nicht geben kann: welches Feld unter dem Finger
 * liegt und wie weit die Haltezeit ist.
 *
 * Die Marker werden hier **nicht** gezeichnet. Auf dem Papier sind sie die
 * Erkennung; in der Brille kennt die App die Lage des Armbands ohnehin (es
 * hängt am Controller), da wären sie nur Muster ohne Zweck. Stattdessen steht
 * im Feld, was es tut.
 *
 * @param {Array} cells   aus wristband.js, jedes mit {glyph, label, col, row}
 * @param {object} opts   {cols, rows, active, hold}
 */
export function drawPanel(ctx, W, H, cells, opts = {}) {
  const cols = opts.cols || 3;
  const rows = opts.rows || 2;
  ctx.clearRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  const cw = W / cols, ch = H / rows;

  // Das Band liegt auf Papier: auf Passthrough braucht es eine dunkle Unterlage,
  // damit die Felder gegen das Weiß des Ausdrucks stehen. Auf additivem Glas
  // sieht man das Papier ohnehin — dort genügen die leuchtenden Felder.
  if (!C.additive) {
    ctx.fillStyle = "rgba(8,11,15,0.72)";
    ctx.fillRect(0, 0, W, H);
  }

  for (const c of cells) {
    const x = c.col * cw, y = c.row * ch;
    const on = opts.active === c.action;

    ctx.fillStyle = on ? "rgba(124,192,255,0.30)"
                  : C.additive ? "rgba(0,0,0,0)" : "rgba(255,255,255,0.05)";
    ctx.fillRect(x + 3, y + 3, cw - 6, ch - 6);
    ctx.strokeStyle = on ? C.ink : "rgba(255,255,255,0.42)";
    ctx.lineWidth = on ? 4 : 2;
    ctx.strokeRect(Math.round(x) + 4.5, Math.round(y) + 4.5, Math.round(cw) - 9, Math.round(ch) - 9);

    T(ctx, c.glyph, x + cw / 2, y + ch * 0.56, { size: ch * 0.40, weight: 600, align: "center" });
    caps(ctx, c.label, x + cw / 2, y + ch * 0.84, ch * 0.115,
         on ? C.ink : C.faint, "center");

    // Haltebalken am unteren Rand des Feldes: er füllt sich, solange der
    // Finger liegt, und macht damit sichtbar, wann es auslöst.
    if (on && opts.hold > 0) {
      ctx.fillStyle = "rgba(124,192,255,0.9)";
      ctx.fillRect(x + 6, y + ch - 12, (cw - 12) * Math.min(1, opts.hold), 6);
    }
  }
}

function crosshair(ctx, cx, cy, len) {
  ctx.beginPath();
  ctx.moveTo(cx - len, cy); ctx.lineTo(cx + len, cy);
  ctx.moveTo(cx, cy - len); ctx.lineTo(cx, cy + len);
  ctx.stroke();
}

/* =================================================== Anzeige am Patienten */

/**
 * Die kleine Anzeige, die beim Herantreten über dem Marker aufgeht. Sie steht
 * beim Patienten, nicht am Kopf, und ist nicht bedienbar — sie beantwortet nur
 * die Frage, wer da liegt, bevor man ihn öffnet: Nummer, Kategorie, Karte und
 * ob schon etwas festgehalten wurde.
 *
 * Bewusst ohne Entfernungsangabe: die ändert sich mit jedem Schritt und würde
 * die Textur bei jedem Bild neu erzwingen. Wie weit es ist, sieht man.
 *
 * @param {object} m aus workflow.worldTags()
 */
export function drawInfoPopup(ctx, W, H, m) {
  ctx.clearRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  const pad = 26;
  block(ctx, 0, 0, W, H, m.sighted ? m.color : C.accent, "top");

  T(ctx, "#" + m.id, pad, 92, { size: 62, weight: 600 });
  caps(ctx, m.sighted ? m.short : "ungesichtet", W - pad, 88, 26,
       m.sighted ? m.color : C.faint, "right");

  rule(ctx, pad, 116, W - pad * 2, C.ruleSoft);

  T(ctx, m.card != null ? `Karte #${m.card}` : "ohne Karte", pad, 156,
    { size: 26, color: m.card != null ? C.dim : "#f2dfae" });

  const notes = [];
  if (m.findings) notes.push(`${m.findings} Befund${m.findings === 1 ? "" : "e"}`);
  if (m.treatments) notes.push(`${m.treatments} Maßnahme${m.treatments === 1 ? "" : "n"}`);
  if (m.transported) notes.push("abtransportiert");
  if (notes.length) T(ctx, notes.join(" · "), pad, 196, { size: 22, color: C.faint });
}

/* ------------------------------------------------------ flache Lagekarte */

/** Nur die Karte, für die flache Darstellung im DOM (eigenes <canvas>). */
export function drawMapPanel(ctx, W, H, map) {
  ctx.clearRect(0, 0, W, H);
  drawField(ctx, 6, 10, W - 12, H - 56, map);
  T(ctx, map.footer || "", 6, H - 22, { size: 15, weight: 500, color: C.dim });
  T(ctx, map.hint || "", 6, H - 4, { size: 15, color: C.faint });
}

/** Welcher Knopf liegt unter dem Punkt? -1 = keiner. */
export function hitTest(rects, px, py) {
  for (const r of rects)
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return r.index;
  return -1;
}

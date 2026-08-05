/* Die Anzeige — als HUD, nicht als Fenster.
 *
 * Drei getrennte Ebenen, weil sie unterschiedlich im Raum hängen (siehe xr.js):
 *
 *   drawHudLayer  Randinformation, kopffest: Zustand oben links, Zählung oben
 *                 rechts, Lagekarte unten links, Hinweis unten rechts. Die Mitte
 *                 bleibt frei — da schaut man durch.
 *   drawCard      der Handlungsschritt, raumfest beim Patienten: Frage, Antwort,
 *                 Vitalwerte. Liefert die Trefferflächen für den Handstrahl.
 *   drawTag       kleines Schild je Patient, raumfest an seiner Position.
 *
 * Gestaltung: keine Kacheln, keine Rundungen, keine Schlagschatten. Haarlinien,
 * Versalien-Kleinlabels, Tabellenziffern, und Farbe ausschließlich für
 * Sichtungskategorien. Alles Dunkle ist nur so dunkel, dass die Schrift über dem
 * Durchblick lesbar bleibt.
 */

"use strict";

const C = {
  ink: "#ffffff",
  dim: "rgba(255,255,255,0.80)",
  faint: "rgba(255,255,255,0.55)",
  rule: "rgba(255,255,255,0.55)",
  ruleSoft: "rgba(255,255,255,0.30)",
  scrimStrong: "rgba(8,11,15,0.78)",
  accent: "#7cc0ff",
  good: "#8ee2a4",
};

const F = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/* ------------------------------------------------------------- Werkzeug
 *
 * Über dem Durchblick gibt es keinen verlässlichen Hintergrund: dieselbe Schrift
 * steht mal auf Asphalt, mal auf einer weißen Wand. Statt alles auf Kacheln zu
 * legen (was jede Anzeige sofort wie ein Fenster aussehen lässt), bekommt jede
 * Type einen dunklen Saum — so bleibt sie auf jedem Untergrund lesbar und die
 * Fläche dahinter frei. */

function T(ctx, str, x, y, { size = 20, weight = 400, color = C.ink,
                             align = "left", track = 0, caps = false } = {}) {
  const text = caps ? String(str).toUpperCase() : String(str);
  ctx.font = `${weight} ${size}px ${F}`;
  ctx.textAlign = align;
  if (track) ctx.letterSpacing = track + "em";

  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.82)";
  ctx.lineWidth = Math.max(3, size / 6);
  ctx.strokeText(text, x, y);

  ctx.fillStyle = color;
  ctx.fillText(text, x, y);

  if (track) ctx.letterSpacing = "0px";
  ctx.textAlign = "left";
  return ctx.measureText(text).width;
}

/** Kleinlabel in Versalien, gesperrt. */
function caps(ctx, text, x, y, size = 15, color = C.faint, align = "left") {
  return T(ctx, text, x, y, { size, weight: 600, color, align, track: 0.14, caps: true });
}

/** Haarlinie mit dunklem Saum, damit sie auch auf Hellem steht. */
function rule(ctx, x, y, w, color = C.ruleSoft) {
  const yy = Math.round(y) + 0.5;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x, yy + 1, w, 1);
  ctx.fillStyle = color;
  ctx.fillRect(x, yy, w, 1);
}

function scrim(ctx, x, y, w, h, color = C.scrimStrong) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/**
 * Unterlage für einen Anzeigeblock: dunkle Fläche, damit die Schrift über jedem
 * Untergrund trägt, ein Hauch der zugehörigen Farbe darüber und eine kräftige
 * Kante an der Führungsseite. Flach und ungerundet — die Farbe ordnet zu, sie
 * dekoriert nicht.
 */
function block(ctx, x, y, w, h, accent = null, edge = "left") {
  ctx.fillStyle = "rgba(6,9,13,0.58)";
  ctx.fillRect(x, y, w, h);

  if (accent) {
    ctx.globalAlpha = 0.10;
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
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fill();
}

function ring(ctx, x, y, r, color, width = 2) {
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.lineWidth = width + 2.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

/* ============================================================ HUD-Ebene */

/**
 * Kopffeste Randinformation. Die Bildmitte bleibt leer — da schaut man durch.
 * @param {object} screen von workflow.screen()
 * @param {object} map    von workflow.mapModel()
 */
export function drawHudLayer(ctx, W, H, screen, map, diag) {
  ctx.clearRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  const pad = Math.round(W * 0.038);
  topLeft(ctx, pad, pad, screen, diag);
  topRight(ctx, W - pad, pad, map);
  bottomLeft(ctx, pad, H - pad, map);
  bottomRight(ctx, W - pad, H - pad, screen);
}

function topLeft(ctx, x, y, screen, diag) {
  const lines = (screen.progress ? 1 : 0) + (diag ? 2 : 0) + (diag && diag.selects === 0 ? 1 : 0);
  block(ctx, x - 14, y - 12, 520, 62 + lines * 28, C.accent);

  caps(ctx, screen.title || "J.A.R.", x, y + 20, 22, C.dim);
  rule(ctx, x, y + 38, 430, C.rule);

  let ly = y + 74;
  if (screen.progress) {
    const { step, total } = screen.progress;
    caps(ctx, `Schritt ${step}/${total}`, x, ly, 18, C.faint);
    for (let i = 0; i < total; i++) {
      const on = i < step;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(x + 205 + i * 26, ly - 13, 19, 7);
      ctx.fillStyle = on ? C.accent : "rgba(255,255,255,0.28)";
      ctx.fillRect(x + 205 + i * 26, ly - 12, 18, 4);
    }
    ly += 34;
  }

  // Diagnose: was meldet der Browser als Eingabe? Beantwortet aus der Brille
  // heraus die Frage „warum reagiert nichts?".
  if (diag) {
    const zeigt = diag.gaze ? "Blick" : diag.kinds;
    const gelenke = diag.joints ? `Gelenke ${diag.joints}` : "keine Gelenke";
    const spalt = diag.pinchCm == null ? "—" : diag.pinchCm + " cm";
    caps(ctx, `Eingabe ${diag.sources} · ${zeigt} · ${gelenke} · Spalt ${spalt} · Pinch ${diag.selects}`,
         x, ly, 15, diag.gaze ? "#f2dfae" : C.faint);
    caps(ctx, `Handtracking bewilligt: ${diag.granted || "?"} · ${diag.feature || "?"}`,
         x, ly + 24, 14, C.faint);
    if (diag.selects === 0)
      caps(ctx, "Zielen mit dem Blick · Auslösen durch Verweilen", x, ly + 48, 15, "#f2dfae");
  }
}

function topRight(ctx, x, y, map) {
  const c = map.counts;
  const items = [["#e5484d", c.SK1], ["#f5b301", c.SK2], ["#46a758", c.SK3],
                 ["#3e7bfa", c.SK4], ["#9aa4ae", c.DECEASED]];

  block(ctx, x - 456, y - 12, 470, 110, C.accent, "right");
  caps(ctx, `${c.open} offen`, x, y + 20, 22, C.dim, "right");
  rule(ctx, x - 430, y + 38, 430, C.rule);

  // Zählung rechtsbündig: Zahl, davor der Farbpunkt.
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
  drawGrid(ctx, x, y, w, h, map, { compact: true });
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

/** Raster ohne Rahmen: Haarlinien, Punkte, Randbeschriftung. */
function drawGrid(ctx, x, y, w, h, map, { compact = false } = {}) {
  const padL = compact ? 18 : 24, padB = compact ? 18 : 22;
  const fx = x + padL, fy = y;
  const fw = w - padL, fh = h - padB;

  const cols = Math.max(1, map.columns), rows = Math.max(1, map.rows);

  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 2.5;
  gridPath(ctx, fx, fy, fw, fh, cols, rows);
  ctx.stroke();
  ctx.strokeStyle = C.ruleSoft;
  ctx.lineWidth = 1;
  gridPath(ctx, fx, fy, fw, fh, cols, rows);
  ctx.stroke();

  const ls = compact ? 16 : 14;
  for (let c = 0; c < cols; c++)
    caps(ctx, String.fromCharCode(65 + map.minCol + c),
         fx + (fw * (c + 0.5)) / cols, fy + fh + 15, ls, C.faint, "center");
  for (let r = 0; r < rows; r++)
    T(ctx, map.minRow + r, fx - 6, fy + fh - (fh * (r + 0.5)) / rows + 5,
      { size: ls, weight: 600, color: C.faint, align: "right" });

  const toXY = (uv) => ({
    x: fx + Math.max(-0.12, Math.min(1.12, uv.x)) * fw,
    y: fy + fh - Math.max(-0.12, Math.min(1.12, uv.y)) * fh,
  });

  const r = compact ? 9 : 10;
  for (const d of map.dots) {
    const p = toXY(d.uv);
    if (d.target) ring(ctx, p.x, p.y, r + 6, C.accent, 2);
    if (d.sighted) disc(ctx, p.x, p.y, r, d.color);
    else ring(ctx, p.x, p.y, r - 1, d.color, 2);
  }

  if (map.medic) {
    const p = toXY(map.medic.uv);
    const rad = (map.medic.heading * Math.PI) / 180;
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.sin(rad) * 17, p.y - Math.cos(rad) * 17);
    ctx.stroke();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    disc(ctx, p.x, p.y, 4.5, C.ink);
  }
}

function gridPath(ctx, fx, fy, fw, fh, cols, rows) {
  ctx.beginPath();
  for (let c = 0; c <= cols; c++) {
    const gx = Math.round(fx + (fw * c) / cols) + 0.5;
    ctx.moveTo(gx, fy); ctx.lineTo(gx, fy + fh);
  }
  for (let r = 0; r <= rows; r++) {
    const gy = Math.round(fy + (fh * r) / rows) + 0.5;
    ctx.moveTo(fx, gy); ctx.lineTo(fx + fw, gy);
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

  if (screen.vitals && screen.vitals.length) vitalsRow(ctx, pad, H - 236, w, screen.vitals);
  return buttons(ctx, pad, H - 152, w, screen.buttons || [], opts.hover, opts.dwell || 0);
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

/** Knöpfe: Umriss, kein Fond. Gefüllt wird nur, worauf gezeigt wird. */
function buttons(ctx, x, y, w, list, hover, dwell = 0) {
  const rects = [];
  if (!list.length) return rects;

  const gap = 14;
  const bw = (w - gap * (list.length - 1)) / list.length;
  const bh = 104;

  list.forEach((b, i) => {
    const bx = x + i * (bw + gap);
    const on = hover === i;
    const tint = b.tint === "yes" ? "#46a758"
               : b.tint === "no" ? "#e5484d"
               : b.tint === "lna" ? "#3e7bfa"
               : b.tint === "primary" ? C.accent
               : "rgba(255,255,255,0.55)";

    ctx.fillStyle = on ? "rgba(255,255,255,0.20)" : "rgba(8,11,15,0.42)";
    ctx.fillRect(bx, y, bw, bh);
    ctx.strokeStyle = on ? "#ffffff" : tint;
    ctx.lineWidth = on ? 3 : 1.5;
    ctx.strokeRect(Math.round(bx) + 0.5, Math.round(y) + 0.5, Math.round(bw), bh);

    // Verweil-Anzeige: füllt sich, wenn der Zeiger auf dem Knopf liegt. Sie ist
    // der Ersatz für den Pinch, falls das Gerät kein `select` schickt.
    if (on && dwell > 0) {
      ctx.fillStyle = "rgba(124,192,255,0.85)";
      ctx.fillRect(bx + 2, y + bh - 8, (bw - 4) * Math.min(1, dwell), 6);
    }

    const size = list.length > 2 ? 26 : 32;
    ctx.font = `600 ${size}px ${F}`;
    const lines = wrap(ctx, b.label, bw - 28).slice(0, 2);
    lines.forEach((line, li) =>
      T(ctx, line, bx + bw / 2, y + bh / 2 + 10 + (li - (lines.length - 1) / 2) * 28,
        { size, weight: 600, align: "center" }));

    rects.push({ x: bx, y, w: bw, h: bh, index: i });
  });
  return rects;
}

/* ======================================================= Patientenschild */

/**
 * Kleines raumfestes Schild an einem Patienten. Es muss auch aus zehn Metern
 * lesbar sein, deshalb hier — anders als auf der Karte — eine schmale Fläche.
 * @param {object} tag {id, cell, short, color, sighted}
 */
export function drawTag(ctx, W, H, tag) {
  ctx.clearRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  const h = H - 44;
  scrim(ctx, 0, 0, W, h);
  ctx.fillStyle = tag.color;
  ctx.fillRect(0, 0, 7, h);

  // Führungslinie nach unten: das Schild schwebt über dem Patienten.
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(W / 2, h); ctx.lineTo(W / 2, H - 4);
  ctx.stroke();
  ctx.strokeStyle = C.rule;
  ctx.lineWidth = 2;
  ctx.stroke();

  T(ctx, "#" + tag.id, 24, 60, { size: 44, weight: 600 });
  caps(ctx, tag.cell, W - 22, 34, 16, C.faint, "right");
  caps(ctx, tag.sighted ? tag.short : "offen", W - 22, 66, 20,
       tag.sighted ? tag.color : C.dim, "right");
}

/* ------------------------------------------------------ flache Lagekarte */

/** Nur die Karte, für die flache Darstellung im DOM (eigenes <canvas>). */
export function drawMapPanel(ctx, W, H, map) {
  ctx.clearRect(0, 0, W, H);
  drawGrid(ctx, 6, 10, W - 12, H - 56, map);
  T(ctx, map.footer || "", 6, H - 22, { size: 15, weight: 500, color: C.dim });
  T(ctx, map.hint || "", 6, H - 4, { size: 15, color: C.faint });
}

/** Welcher Knopf liegt unter dem Punkt? -1 = keiner. */
export function hitTest(rects, px, py) {
  for (const r of rects)
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return r.index;
  return -1;
}

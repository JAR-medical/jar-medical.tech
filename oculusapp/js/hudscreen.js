/* Der AR-Schirm: Lagekarte links, Ablaufschritt rechts, auf eine Canvas-Textur.
 *
 * Gegenstück zu hudcanvas.js (das die Patientenakte zeichnet). Hier wird die
 * Beschreibung gezeichnet, die workflow.js liefert — dieselbe Beschreibung, die
 * im flachen Modus als DOM erscheint.
 *
 *   drawScreen(ctx, W, H, screen, map, opts) → Trefferflächen der Knöpfe
 *
 * Die zurückgegebenen Rechtecke sind Canvas-Pixel; xr.js rechnet den Handstrahl
 * auf dieselben Koordinaten um und weiß so, worauf gezeigt wird. Gezeichnet wird
 * nur — entschieden wird in workflow.js.
 *
 * Farbwelt wie im Lagebild der Einsatzleitung: dunkle Fläche, dünne Linien,
 * Farbe nur dort, wo sie Bedeutung trägt (Sichtungskategorien).
 */

"use strict";

const COL = {
  panel: "rgba(13,18,28,0.94)",
  header: "rgba(22,29,40,0.96)",
  border: "rgba(255,255,255,0.14)",
  line: "rgba(255,255,255,0.10)",
  text: "#eef2f6",
  muted: "#93a1b0",
  good: "#7bd696",
  warn: "#f0d9a6",
  accent: "#5aa2e6",
  field: "rgba(255,255,255,0.035)",
  btn: "rgba(255,255,255,0.09)",
  btnHover: "rgba(90,162,230,0.30)",
  btnPrimary: "rgba(90,162,230,0.34)",
  btnYes: "rgba(41,102,66,0.72)",
  btnNo: "rgba(107,43,45,0.72)",
  btnLna: "rgba(38,69,119,0.72)",
  dotOpen: "#6b7581",
};

const FONT = "'Helvetica Neue', Arial, sans-serif";

const TINTS = {
  primary: COL.btnPrimary,
  yes: COL.btnYes,
  no: COL.btnNo,
  lna: COL.btnLna,
  ghost: COL.btn,
};

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
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

function dot(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} screen  von workflow.screen()
 * @param {object} map     von workflow.mapModel()
 * @param {object} [opts]  {hover:number, cursor:{x,y,pressed}}
 * @returns {Array<{x,y,w,h,index}>} Trefferflächen der Knöpfe
 */
export function drawScreen(ctx, W, H, screen, map, opts = {}) {
  ctx.clearRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  const M = 12;
  ctx.fillStyle = COL.panel;
  rr(ctx, M, M, W - 2 * M, H - 2 * M, 26);
  ctx.fill();
  ctx.strokeStyle = COL.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  drawHeader(ctx, W, screen);

  const mapW = 330;
  const left = M + 22;
  const right = left + mapW + 34;
  const rightW = W - M - 22 - right;

  // Unter dem Farbband beginnen, sonst streicht es die Überschrift durch.
  drawMap(ctx, left, 152, mapW, 464, map);
  drawMapLegend(ctx, left, 640, mapW, map);

  const rects = drawBody(ctx, right, 128, rightW, H, screen, opts.hover);

  ctx.font = `400 20px ${FONT}`;
  ctx.fillStyle = COL.muted;
  ctx.textAlign = "center";
  ctx.fillText(screen.status || "", W / 2, H - 34);
  ctx.textAlign = "left";

  if (opts.cursor) drawCursor(ctx, opts.cursor);
  return rects;
}

function drawHeader(ctx, W, screen) {
  const M = 12;
  ctx.save();
  rr(ctx, M, M, W - 2 * M, 88, 26);
  ctx.clip();
  ctx.fillStyle = COL.header;
  ctx.fillRect(M, M, W - 2 * M, 88);
  ctx.restore();

  ctx.font = `600 30px ${FONT}`;
  ctx.fillStyle = COL.text;
  ctx.fillText(screen.title || "J.A.R.", M + 24, 66);

  if (screen.badge) {
    ctx.font = `500 24px ${FONT}`;
    ctx.fillStyle = COL.muted;
    ctx.textAlign = "right";
    ctx.fillText(screen.badge, W - M - 24, 66);
    ctx.textAlign = "left";
  }

  if (screen.band) {
    ctx.fillStyle = screen.band;
    ctx.fillRect(M, M + 88, W - 2 * M, 8);
  }
}

/* ------------------------------------------------------------- Lagekarte */

function drawMap(ctx, x, y, w, h, map) {
  ctx.font = `600 20px ${FONT}`;
  ctx.fillStyle = COL.muted;
  ctx.fillText("LAGEKARTE", x, y - 14);

  ctx.fillStyle = COL.field;
  rr(ctx, x, y, w, h, 10);
  ctx.fill();

  const pad = 22;                       // Platz für A–G / 1–7
  const fx = x + pad, fy = y + 10;
  const fw = w - pad - 12, fh = h - pad - 16;

  const cols = Math.max(1, map.columns), rows = Math.max(1, map.rows);
  ctx.strokeStyle = COL.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 0; c <= cols; c++) {
    const gx = Math.round(fx + (fw * c) / cols) + 0.5;
    ctx.moveTo(gx, fy); ctx.lineTo(gx, fy + fh);
  }
  for (let r = 0; r <= rows; r++) {
    const gy = Math.round(fy + (fh * r) / rows) + 0.5;
    ctx.moveTo(fx, gy); ctx.lineTo(fx + fw, gy);
  }
  ctx.stroke();

  ctx.font = `400 15px ${FONT}`;
  ctx.fillStyle = COL.muted;
  ctx.textAlign = "center";
  for (let c = 0; c < cols; c++) {
    const cx = fx + (fw * (c + 0.5)) / cols;
    ctx.fillText(String.fromCharCode(65 + map.minCol + c), cx, fy + fh + 18);
  }
  ctx.textAlign = "right";
  for (let r = 0; r < rows; r++) {
    // Reihe 1 liegt unten (nah beim Trupp), wie im Feld.
    const cy = fy + fh - (fh * (r + 0.5)) / rows + 5;
    ctx.fillText(String(map.minRow + r), fx - 6, cy);
  }
  ctx.textAlign = "left";

  const toXY = (uv) => ({
    x: fx + Math.max(-0.15, Math.min(1.15, uv.x)) * fw,
    y: fy + fh - Math.max(-0.15, Math.min(1.15, uv.y)) * fh,
  });

  for (const d of map.dots) {
    const p = toXY(d.uv);
    if (d.target) {
      ctx.strokeStyle = COL.accent;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Gefüllt = in dieser Sitzung gesichtet, hohl = steht noch aus. Die Farbe
    // ist immer die eingetragene Sichtungskategorie, damit Karte und Zählung
    // dasselbe sagen.
    if (d.sighted) {
      dot(ctx, p.x, p.y, 13, d.color);
    } else {
      dot(ctx, p.x, p.y, 13, "rgba(13,18,28,0.9)");
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.font = `600 13px ${FONT}`;
    ctx.fillStyle = d.sighted ? "#ffffff" : "rgba(255,255,255,0.72)";
    ctx.textAlign = "center";
    ctx.fillText(String(d.id), p.x, p.y + 5);
    ctx.textAlign = "left";
  }

  if (map.medic) {
    const p = toXY(map.medic.uv);
    const rad = (map.medic.heading * Math.PI) / 180;
    ctx.strokeStyle = COL.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.sin(rad) * 22, p.y - Math.cos(rad) * 22);
    ctx.stroke();
    dot(ctx, p.x, p.y, 9, COL.accent);
    dot(ctx, p.x, p.y, 4, "#0d121c");
  }
}

function drawMapLegend(ctx, x, y, w, map) {
  const c = map.counts;
  const items = [["#e5484d", c.SK1], ["#f5b301", c.SK2], ["#46a758", c.SK3],
                 ["#3e7bfa", c.SK4], ["#9aa4ae", c.DECEASED]];
  let cx = x + 8;
  ctx.font = `500 19px ${FONT}`;
  for (const [color, n] of items) {
    dot(ctx, cx, y, 7, color);
    ctx.fillStyle = COL.text;
    ctx.fillText(String(n), cx + 14, y + 7);
    cx += 34 + ctx.measureText(String(n)).width;
  }

  ctx.fillStyle = COL.muted;
  ctx.fillText(`· ${c.open} offen`, cx, y + 7);

  ctx.font = `500 19px ${FONT}`;
  ctx.fillStyle = COL.text;
  ctx.fillText(map.footer || "", x + 8, y + 38);
  ctx.font = `400 17px ${FONT}`;
  ctx.fillStyle = COL.muted;
  ctx.fillText(map.hint || "", x + 8, y + 62);
}

/* ------------------------------------------------------------ Ablaufteil */

function drawBody(ctx, x, y, w, H, screen, hover) {
  let cy = y + 56;

  ctx.font = `600 44px ${FONT}`;
  ctx.fillStyle = screen.headlineColor || COL.text;
  for (const line of wrap(ctx, screen.headline, w).slice(0, 2)) {
    ctx.fillText(line, x, cy);
    cy += 52;
  }

  cy += 14;
  ctx.font = `400 22px ${FONT}`;
  ctx.fillStyle = COL.muted;
  for (const line of wrap(ctx, screen.hint, w).slice(0, 4)) {
    ctx.fillText(line, x, cy);
    cy += 30;
  }

  if (screen.progress) {
    cy += 18;
    ctx.font = `500 19px ${FONT}`;
    ctx.fillStyle = COL.muted;
    ctx.fillText(`Schritt ${screen.progress.step} von ${screen.progress.total}`, x, cy);
    const px = x + 200;
    for (let i = 0; i < screen.progress.total; i++)
      dot(ctx, px + i * 24, cy - 6, i < screen.progress.step ? 7 : 5,
          i < screen.progress.step ? COL.accent : COL.line);
    cy += 22;
  }

  cy += 26;
  ctx.font = `400 21px ${FONT}`;
  for (const item of screen.body || []) {
    ctx.fillStyle = item.color === "muted" ? COL.muted
                  : item.color === "good" ? COL.good
                  : item.color === "warn" ? COL.warn
                  : item.color === "cat" ? (item.color2 || COL.text)
                  : COL.text;
    for (const line of wrap(ctx, item.text, w).slice(0, 3)) {
      ctx.fillText(line, x, cy);
      cy += 28;
    }
    cy += 6;
  }

  return drawButtons(ctx, x, H - 158, w, screen.buttons || [], hover);
}

function drawButtons(ctx, x, y, w, buttons, hover) {
  const rects = [];
  if (!buttons.length) return rects;

  const gap = 16;
  const bw = (w - gap * (buttons.length - 1)) / buttons.length;
  const bh = 92;

  buttons.forEach((b, i) => {
    const bx = x + i * (bw + gap);
    const isHover = hover === i;

    ctx.fillStyle = isHover ? COL.btnHover : (TINTS[b.tint] || COL.btn);
    rr(ctx, bx, y, bw, bh, 14);
    ctx.fill();
    ctx.strokeStyle = isHover ? COL.accent : COL.border;
    ctx.lineWidth = isHover ? 3 : 1.5;
    ctx.stroke();

    ctx.fillStyle = COL.text;
    ctx.font = `600 ${buttons.length > 2 ? 24 : 30}px ${FONT}`;
    ctx.textAlign = "center";
    const lines = wrap(ctx, b.label, bw - 24).slice(0, 2);
    lines.forEach((line, li) =>
      ctx.fillText(line, bx + bw / 2, y + bh / 2 + 10 + (li - (lines.length - 1) / 2) * 28));
    ctx.textAlign = "left";

    rects.push({ x: bx, y, w: bw, h: bh, index: i });
  });
  return rects;
}

function drawCursor(ctx, cursor) {
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cursor.x, cursor.y, 16, 0, Math.PI * 2);
  ctx.stroke();
  dot(ctx, cursor.x, cursor.y, cursor.pressed ? 10 : 7,
      cursor.pressed ? "#ffffff" : COL.accent);
}

/** Nur die Lagekarte, für die flache Darstellung im DOM (eigenes <canvas>). */
export function drawMapPanel(ctx, W, H, map) {
  ctx.clearRect(0, 0, W, H);
  const legendH = 86;
  const top = 34;                        // Platz für die Überschrift der Karte
  drawMap(ctx, 8, top, W - 16, H - top - legendH - 8, map);
  drawMapLegend(ctx, 8, H - legendH + 20, W - 16, map);
}

/** Welcher Knopf liegt unter dem Punkt? -1 = keiner. */
export function hitTest(rects, px, py) {
  for (const r of rects)
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return r.index;
  return -1;
}

/* Canvas-2D HUD renderer — draws the patient panel onto a 2D canvas so it can be
 * uploaded as a WebGL texture and shown on a quad inside the immersive-ar session.
 *
 * This is the counterpart to hud.js (which emits DOM/HTML for the flat-screen
 * modes). Headset browsers on PICO support immersive-ar but NOT the `dom-overlay`
 * feature that hud.js relies on, so in AR we draw the same information here with
 * the Canvas 2D API — no dom-overlay required. Same information architecture as
 * hud.js: category banner · flags · vitals · tags · meta · protocol.
 *
 * drawHud(ctx, W, H, state) renders one frame. `state` is one of:
 *   { kind: "patient",  patient }      { kind: "unknown", markerId }
 *   { kind: "scanning", hint }
 */

"use strict";

import { CATEGORY_META } from "./data.js";
import { timeAgo } from "./hud.js";

const COL = {
  panel: "rgba(13,18,28,0.94)",
  border: "rgba(255,255,255,0.14)",
  text: "#eef2f6",
  muted: "#93a1b0",
  chip: "rgba(255,255,255,0.07)",
  chipBorder: "rgba(255,255,255,0.12)",
  bad: "#e5484d",
  injuryBg: "rgba(229,72,77,0.18)",
  injuryFg: "#ffb4b6",
  treatBg: "rgba(70,167,88,0.20)",
  treatFg: "#b6e6c2",
};

const FONT = "'Helvetica Neue', Arial, sans-serif";

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

function tri(v) { return v === true ? "ja" : v === false ? "nein" : "—"; }

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

function metaText(p) {
  const bits = [];
  if (p.sex) bits.push(p.sex === "m" ? "männlich" : p.sex === "w" ? "weiblich" : p.sex);
  if (p.age_estimate != null) bits.push(`~${p.age_estimate} J.`);
  if (p.ambulatory === true) bits.push("gehfähig");
  if (p.ambulatory === false) bits.push("nicht gehfähig");
  if (p.location) bits.push("Ablage " + p.location);
  bits.push("aktualisiert " + timeAgo(p.updated_at));
  if (p.last_seen && p.last_seen.by) bits.push(`👁 ${p.last_seen.by} ${timeAgo(p.last_seen.at)}`);
  return bits.join("  ·  ");
}

/** Fill the whole canvas with one HUD frame. */
export function drawHud(ctx, W, H, state) {
  ctx.clearRect(0, 0, W, H);

  const pad = 26;
  const x = pad, y = pad, w = W - pad * 2, h = H - pad * 2;

  // panel
  rr(ctx, x, y, w, h, 26);
  ctx.fillStyle = COL.panel;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = COL.border;
  ctx.stroke();

  if (state.kind === "scanning") { drawScanning(ctx, x, y, w, h, state.hint); return; }

  const isUnknown = state.kind === "unknown";
  const p = state.patient || {};
  const cat = isUnknown ? CATEGORY_META.UNSIGHTED : (CATEGORY_META[p.category] || CATEGORY_META.UNSIGHTED);

  const ix = x + 30;                // inner left
  const iw = w - 60;               // inner width
  let cy = y;                       // running vertical cursor

  // --- banner ---------------------------------------------------------
  const bh = 112;
  ctx.save();
  rr(ctx, x, y, w, bh + 26, 26);   // clip so the coloured banner keeps the top radius
  ctx.clip();
  ctx.fillStyle = cat.color;
  ctx.fillRect(x, y, w, bh);
  ctx.restore();

  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = `700 62px ${FONT}`;
  ctx.fillText(isUnknown ? "UNBEKANNT" : cat.short, ix, y + bh / 2);
  ctx.textAlign = "right";
  ctx.font = `600 34px ${FONT}`;
  ctx.fillText(isUnknown ? `Marker #${state.markerId}` : `Patient #${p.marker_id}`, x + w - 30, y + bh / 2);
  ctx.textAlign = "left";
  cy = y + bh + 30;

  if (isUnknown) {
    ctx.fillStyle = COL.muted;
    ctx.font = `400 30px ${FONT}`;
    const lines = wrap(ctx, "Kein Patient zu diesem Marker im aktuellen Einsatz. Marker prüfen oder neu sichten.", iw);
    for (const ln of lines) { ctx.fillText(ln, ix, cy + 18); cy += 42; }
    return;
  }

  // --- flags ----------------------------------------------------------
  cy = pill2(ctx, ix, cy, [
    { label: "Ansprechbar", val: tri(p.conscious), bad: p.conscious === false },
    { label: "Atemweg frei", val: tri(p.airway_clear), bad: p.airway_clear === false },
  ]);
  cy += 18;

  // --- vitals ---------------------------------------------------------
  cy = vitals(ctx, ix, cy, iw, p.vitals || {});
  cy += 18;

  // --- tags (injuries + treatments) -----------------------------------
  const tags = [];
  for (const i of (p.injuries || [])) tags.push({ text: i, bg: COL.injuryBg, fg: COL.injuryFg });
  for (const t of (p.treatments || [])) tags.push({ text: "✚ " + t, bg: COL.treatBg, fg: COL.treatFg });
  if (!tags.length) tags.push({ text: "keine Einträge", bg: COL.chip, fg: COL.muted });
  cy = tagRow(ctx, ix, cy, iw, tags);
  cy += 14;

  // --- meta line ------------------------------------------------------
  ctx.fillStyle = COL.muted;
  ctx.font = `400 24px ${FONT}`;
  for (const ln of wrap(ctx, metaText(p), iw)) { ctx.fillText(ln, ix, cy + 14); cy += 32; }
  cy += 10;

  // --- protocol -------------------------------------------------------
  ctx.fillStyle = COL.text;
  ctx.font = `600 26px ${FONT}`;
  ctx.fillText(`Protokoll (${(p.protocol || []).length})`, ix, cy + 14);
  cy += 40;
  const entries = (p.protocol || []).slice().reverse().slice(0, 3);
  if (!entries.length) {
    ctx.fillStyle = COL.muted; ctx.font = `400 24px ${FONT}`;
    ctx.fillText("Noch keine Einträge.", ix, cy + 14);
  } else {
    for (const e of entries) {
      if (cy > y + h - 60) break;
      const when = e.timestamp ? new Date(e.timestamp).toLocaleTimeString("de-DE") : "";
      ctx.fillStyle = COL.muted; ctx.font = `600 22px ${FONT}`;
      ctx.fillText(`${when} · ${e.author || e.source || ""}`, ix, cy + 12);
      cy += 30;
      ctx.fillStyle = COL.text; ctx.font = `400 24px ${FONT}`;
      for (const ln of wrap(ctx, e.transcript || "", iw)) {
        if (cy > y + h - 34) break;
        ctx.fillText(ln, ix, cy + 12); cy += 30;
      }
      cy += 8;
    }
  }
}

function pill2(ctx, x, y, items) {
  const h = 52;
  let cx = x;
  ctx.font = `600 26px ${FONT}`;
  for (const it of items) {
    const label = `${it.label}  ${it.val}`;
    const tw = ctx.measureText(label).width + 40;
    rr(ctx, cx, y, tw, h, 12);
    ctx.fillStyle = it.bad ? COL.injuryBg : COL.chip;
    ctx.fill();
    ctx.strokeStyle = it.bad ? "rgba(229,72,77,0.5)" : COL.chipBorder;
    ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = it.bad ? COL.injuryFg : COL.text;
    ctx.textBaseline = "middle"; ctx.textAlign = "left";
    ctx.fillText(label, cx + 20, y + h / 2);
    cx += tw + 14;
  }
  return y + h;
}

function vitals(ctx, x, y, maxW, v) {
  const chips = [
    v.breathing_rate != null ? ["AF", `${v.breathing_rate}`, "/min"] : null,
    v.pulse != null ? ["Puls", `${v.pulse}`, "/min"] : null,
    v.spo2 != null ? ["SpO₂", `${v.spo2}`, "%"] : null,
    v.bp_systolic != null ? ["RR", `${v.bp_systolic}${v.bp_diastolic != null ? "/" + v.bp_diastolic : ""}`, "mmHg"] : null,
    v.gcs != null ? ["GCS", `${v.gcs}`, ""] : null,
  ].filter(Boolean);
  const h = 78;
  if (!chips.length) {
    ctx.fillStyle = COL.muted; ctx.font = `400 26px ${FONT}`;
    ctx.textBaseline = "middle"; ctx.textAlign = "left";
    ctx.fillText("keine Vitalwerte", x, y + h / 2);
    return y + h;
  }
  const gap = 12;
  const cw = Math.floor((maxW - gap * (chips.length - 1)) / chips.length);
  let cx = x;
  for (const [k, val, u] of chips) {
    rr(ctx, cx, y, cw, h, 12);
    ctx.fillStyle = COL.chip; ctx.fill();
    ctx.strokeStyle = COL.chipBorder; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = COL.muted; ctx.font = `600 20px ${FONT}`;
    ctx.fillText(k, cx + cw / 2, y + 26);
    ctx.fillStyle = COL.text; ctx.font = `700 34px ${FONT}`;
    ctx.fillText(val, cx + cw / 2, y + 60);
    if (u) {
      ctx.fillStyle = COL.muted; ctx.font = `400 18px ${FONT}`;
      ctx.fillText(u, cx + cw / 2, y + h - 6);
    }
    cx += cw + gap;
  }
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  return y + h;
}

function tagRow(ctx, x, y, maxW, tags) {
  const h = 44, gap = 10;
  ctx.font = `500 24px ${FONT}`;
  let cx = x, cy = y;
  for (const t of tags) {
    let tw = ctx.measureText(t.text).width + 32;
    if (tw > maxW) tw = maxW;
    if (cx + tw > x + maxW) { cx = x; cy += h + gap; }
    rr(ctx, cx, cy, tw, h, 10);
    ctx.fillStyle = t.bg; ctx.fill();
    ctx.fillStyle = t.fg;
    ctx.textBaseline = "middle"; ctx.textAlign = "left";
    ctx.fillText(t.text, cx + 16, cy + h / 2, tw - 24);
    cx += tw + gap;
  }
  return cy + h;
}

function drawScanning(ctx, x, y, w, h, hint) {
  ctx.fillStyle = COL.text;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 52px ${FONT}`;
  ctx.fillText("J.A.R. AR-Client", x + w / 2, y + h / 2 - 40);
  ctx.fillStyle = COL.muted;
  ctx.font = `400 30px ${FONT}`;
  let cy = y + h / 2 + 30;
  for (const ln of wrap(ctx, hint || "Patient wählen — Sprache, Controller oder Antippen", w - 120)) {
    ctx.fillText(ln, x + w / 2, cy); cy += 44;
  }
  ctx.textAlign = "left";
}

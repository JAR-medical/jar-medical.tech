/* HUD rendering — the patient panel the medic sees in passthrough.
 *
 * Same information architecture as the dashboard's patient detail view
 * (category · vitals · flags · injuries · treatments · protocol), re-laid-out
 * for a head-worn display: large type, high contrast, a bold category banner
 * colour-coded to the triage class. Pure DOM/string helpers — no state here.
 */

"use strict";

import { CATEGORY_META } from "./data.js";
import { regionLabel } from "./body.js";

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
const tri = (v) => (v === true ? "ja" : v === false ? "nein" : "—");

export function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "gerade eben";
  if (s < 3600) return `vor ${Math.floor(s / 60)} min`;
  return `vor ${Math.floor(s / 3600)} h`;
}

function vitalsChips(p) {
  const v = p.vitals || {};
  const chips = [
    v.breathing_rate != null ? ["AF", `${v.breathing_rate}`, "/min"] : null,
    v.pulse != null ? ["Puls", `${v.pulse}`, "/min"] : null,
    v.spo2 != null ? ["SpO₂", `${v.spo2}`, "%"] : null,
    v.bp_systolic != null
      ? ["RR", `${v.bp_systolic}${v.bp_diastolic != null ? "/" + v.bp_diastolic : ""}`, "mmHg"]
      : null,
    v.gcs != null ? ["GCS", `${v.gcs}`, ""] : null,
  ].filter(Boolean);
  if (!chips.length) return '<div class="vitals empty">keine Vitalwerte</div>';
  return `<div class="vitals">${chips
    .map(([k, val, u]) => `<div class="vital"><span class="vk">${k}</span><span class="vv">${esc(val)}</span><span class="vu">${esc(u)}</span></div>`)
    .join("")}</div>`;
}

/* Protokolleinträge tragen `at` (siehe data.js). Vor der Tätigkeitswahl gab es
 * keine Rolle — dann steht dort der Autor. */
function protoWhen(e) {
  const t = e.at ? new Date(e.at) : null;
  return t && !Number.isNaN(t.getTime()) ? t.toLocaleTimeString("de-DE") : "—";
}

function metaLine(p) {
  const bits = [];
  if (p.sex) bits.push(p.sex === "m" ? "männlich" : p.sex === "w" ? "weiblich" : esc(p.sex));
  if (p.age_estimate != null) bits.push(`~${p.age_estimate} J.`);
  if (p.ambulatory === true) bits.push("gehfähig");
  if (p.ambulatory === false) bits.push("nicht gehfähig");
  if (p.location) bits.push("Ablage " + esc(p.location));
  if (p.transported) bits.push("abtransportiert");
  bits.push("aktualisiert " + timeAgo(p.updated_at));
  if (p.last_seen && p.last_seen.by) bits.push(`👁 ${esc(p.last_seen.by)} ${timeAgo(p.last_seen.at)}`);
  return bits.join(" · ");
}

/** Full HTML for a patient HUD panel. */
export function patientHUD(p) {
  const cat = CATEGORY_META[p.category] || CATEGORY_META.UNSIGHTED;
  const proto = (p.protocol || []).slice().reverse().slice(0, 4);
  return `
  <div class="hud-panel cat-${p.category}" style="--cat:${cat.color}">
    <div class="hud-banner">
      <span class="hud-cat">${esc(cat.short)}</span>
      <span class="hud-marker">Patient&nbsp;#${p.marker_id}</span>
    </div>

    <div class="hud-flags">
      <span class="flag ${p.conscious === false ? "bad" : ""}">Ansprechbar <b>${tri(p.conscious)}</b></span>
      <span class="flag ${p.airway_clear === false ? "bad" : ""}">Atemweg frei <b>${tri(p.airway_clear)}</b></span>
    </div>

    ${vitalsChips(p)}

    <div class="hud-tags">
      ${(p.injuries || []).map((i) => `<span class="tag injury">${esc(i.text)} · ${esc(regionLabel(i.region))}</span>`).join("")}
      ${(p.treatments || []).map((t) => `<span class="tag treatment">✚ ${esc(t)}</span>`).join("")}
      ${!(p.injuries || []).length && !(p.treatments || []).length ? '<span class="tag muted">keine Einträge</span>' : ""}
    </div>

    <div class="hud-meta">${metaLine(p)}</div>

    <div class="hud-proto">
      <div class="proto-title">Protokoll (${(p.protocol || []).length})</div>
      ${proto.map((e) => `
        <div class="proto-entry">
          <span class="proto-when">${protoWhen(e)} · ${esc(e.task || e.author || e.source)}</span>
          <span class="proto-text">${esc(e.transcript || "")}</span>
        </div>`).join("") || '<div class="proto-entry muted">Noch keine Einträge.</div>'}
    </div>
  </div>`;
}

/** Panel shown when a scanned marker maps to no known patient. */
export function unknownHUD(markerId) {
  return `
  <div class="hud-panel cat-UNSIGHTED" style="--cat:${CATEGORY_META.UNSIGHTED.color}">
    <div class="hud-banner">
      <span class="hud-cat">UNBEKANNT</span>
      <span class="hud-marker">Marker&nbsp;#${esc(markerId)}</span>
    </div>
    <div class="hud-meta">Kein Patient zu diesem Marker im aktuellen Einsatz. Marker prüfen oder neu sichten.</div>
  </div>`;
}

/* ---- spoken text (the glasses talking back) --------------------------- */

function sexWord(p) {
  return p.sex === "m" ? "männlich" : p.sex === "w" ? "weiblich" : "";
}

export function spokenSummary(p) {
  const cat = CATEGORY_META[p.category] || CATEGORY_META.UNSIGHTED;
  const v = p.vitals || {};
  const parts = [`Patient ${p.marker_id}, Sichtungskategorie ${cat.spoken}.`];
  const person = [sexWord(p), p.age_estimate != null ? `etwa ${p.age_estimate} Jahre` : ""].filter(Boolean).join(", ");
  if (person) parts.push(person + ".");
  parts.push(p.conscious === false ? "Nicht ansprechbar." : p.conscious === true ? "Ansprechbar." : "");
  if (v.pulse != null || v.spo2 != null || v.breathing_rate != null) {
    const vp = [];
    if (v.pulse != null) vp.push(`Puls ${v.pulse}`);
    if (v.spo2 != null) vp.push(`Sauerstoffsättigung ${v.spo2} Prozent`);
    if (v.breathing_rate != null) vp.push(`Atemfrequenz ${v.breathing_rate}`);
    if (v.gcs != null) vp.push(`G C S ${v.gcs}`);
    parts.push(vp.join(", ") + ".");
  }
  if ((p.injuries || []).length)
    parts.push("Befunde: " + p.injuries.map((i) => `${i.text} ${regionLabel(i.region)}`).join(", ") + ".");
  if ((p.treatments || []).length) parts.push("Maßnahmen: " + p.treatments.join(", ") + ".");
  return parts.filter(Boolean).join(" ");
}

export function spokenVitals(p) {
  const v = p.vitals || {};
  if (!Object.keys(v).length) return `Für Patient ${p.marker_id} sind keine Vitalwerte hinterlegt.`;
  const vp = [];
  if (v.breathing_rate != null) vp.push(`Atemfrequenz ${v.breathing_rate}`);
  if (v.pulse != null) vp.push(`Puls ${v.pulse}`);
  if (v.spo2 != null) vp.push(`Sauerstoffsättigung ${v.spo2} Prozent`);
  if (v.bp_systolic != null) vp.push(`Blutdruck ${v.bp_systolic}${v.bp_diastolic != null ? " zu " + v.bp_diastolic : ""}`);
  if (v.gcs != null) vp.push(`G C S ${v.gcs}`);
  return `Patient ${p.marker_id}. ` + vp.join(", ") + ".";
}

/* Standalone live patient window (/patient/<marker_id>).
 * Many of these can be open at once; each stays current via /ws. */

"use strict";

const CATEGORY_META = {
  SK1: { label: "SK I — rot", color: "var(--sk1)" },
  SK2: { label: "SK II — gelb", color: "var(--sk2)" },
  SK3: { label: "SK III — grün", color: "var(--sk3)" },
  SK4: { label: "SK IV — blau", color: "var(--sk4)" },
  DECEASED: { label: "verstorben", color: "var(--deceased)" },
  UNSIGHTED: { label: "ungesichtet", color: "var(--unsighted)" },
};

const markerId = parseInt(location.pathname.split("/").pop(), 10);
document.title = `Patient #${markerId} — TriARge`;
document.getElementById("title").textContent = `Patient #${markerId}`;

const catLabelEl = document.getElementById("cat-label");
const catButtonsEl = document.getElementById("cat-buttons");
const gridEl = document.getElementById("detail-grid");
const protocolTitleEl = document.getElementById("protocol-title");
const protocolListEl = document.getElementById("protocol-list");
const livePill = document.getElementById("live-pill");

function render(p, protocol) {
  const cat = CATEGORY_META[p.category] || CATEGORY_META.UNSIGHTED;
  catLabelEl.textContent = cat.label;
  catLabelEl.style.color = cat.color;

  catButtonsEl.innerHTML = ["SK1", "SK2", "SK3", "SK4", "DECEASED"]
    .map(
      (c) =>
        `<button class="b-${c} ${p.category === c ? "active" : ""}"
          data-cat="${c}">${CATEGORY_META[c].label}</button>`
    )
    .join("");
  for (const btn of catButtonsEl.querySelectorAll("button")) {
    btn.onclick = () => setCategory(btn.dataset.cat);
  }

  const vit = p.vitals || {};
  gridEl.innerHTML = `
    <span class="label">Atemfrequenz</span><span>${vit.breathing_rate ?? "—"} /min</span>
    <span class="label">Puls</span><span>${vit.pulse ?? "—"} /min</span>
    <span class="label">SpO₂</span><span>${vit.spo2 ?? "—"} %</span>
    <span class="label">Blutdruck</span><span>${vit.bp_systolic ?? "—"}${vit.bp_diastolic != null ? "/" + vit.bp_diastolic : ""} mmHg</span>
    <span class="label">GCS</span><span>${vit.gcs ?? "—"}</span>
    <span class="label">Ansprechbar</span><span>${tri(p.conscious)}</span>
    <span class="label">Atemweg frei</span><span>${tri(p.airway_clear)}</span>
    <span class="label">Gehfähig</span><span>${tri(p.ambulatory)}</span>
    <span class="label">Geschlecht / Alter</span><span>${p.sex ?? "—"} / ${p.age_estimate != null ? "~" + p.age_estimate + " J." : "—"}</span>
    <span class="label">Ablageort</span><span>${esc(p.location || "—")}</span>
    <span class="label">Verletzungen</span><span>${(p.injuries || []).map(esc).join(", ") || "—"}</span>
    <span class="label">Maßnahmen</span><span>${(p.treatments || []).map(esc).join(", ") || "—"}</span>`;

  protocolTitleEl.textContent = `Protokoll (${protocol.length})`;
  protocolListEl.innerHTML =
    protocol
      .map(
        (e) => `
      <div class="protocol-entry">
        <div class="meta">${fmtTime(e.timestamp)} · ${esc(e.source)}${e.author ? " · " + esc(e.author) : ""}</div>
        <div>${esc(e.transcript || JSON.stringify(e.structured))}</div>
      </div>`
      )
      .join("") || '<p class="muted">Keine Einträge.</p>';
}

async function load() {
  const [patient, protocol] = await Promise.all([
    fetchJSON(`/api/patients/${markerId}`),
    fetchJSON(`/api/patients/${markerId}/protocol`),
  ]);
  render(patient, protocol);
}

async function setCategory(category) {
  await fetchJSON(`/api/patients/${markerId}?source=dashboard&author=EL`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category }),
  });
  // patient.updated broadcast triggers the re-render
}

function connectWS() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onopen = () => {
    livePill.textContent = "live";
    livePill.classList.add("ok");
    load().catch(showError);
  };
  ws.onclose = () => {
    livePill.textContent = "getrennt";
    livePill.classList.remove("ok");
    setTimeout(connectWS, 2000);
  };
  ws.onmessage = (msg) => {
    const { type, payload } = JSON.parse(msg.data);
    if (type === "session.changed") {
      document.querySelector(".patient-page").innerHTML =
        `<h3>Einsatz gewechselt (jetzt: ${esc(payload.name)}).</h3>
         <p class="muted">Dieses Fenster zeigte einen Patienten aus einer anderen Sitzung — bitte schließen.</p>`;
      return;
    }
    if (payload.marker_id !== markerId) return;
    if (type === "patient.updated" || type === "patient.created") {
      load().catch(showError);
    } else if (type === "patient.deleted") {
      window.close(); // may be blocked if not script-opened; show banner too
      document.querySelector(".patient-page").innerHTML =
        `<h3>Patient #${markerId} wurde gelöscht.</h3>`;
    }
  };
}

document.getElementById("delete-btn").onclick = async () => {
  if (!confirm(`Patient #${markerId} wirklich löschen? Nur für Fehlerkennungen gedacht — das Protokoll wird mit entfernt.`)) {
    return;
  }
  try {
    await fetchJSON(`/api/patients/${markerId}`, { method: "DELETE" });
  } catch (err) {
    alert(`Löschen fehlgeschlagen: ${err.message}`);
  }
};

function showError(err) {
  gridEl.innerHTML = `<span class="label">Fehler</span><span>${esc(err.message)}</span>`;
}

async function fetchJSON(url, options) {
  const resp = await fetch(url, options);
  if (!resp.ok) {
    let detail = resp.statusText;
    try { detail = (await resp.json()).detail || detail; } catch {}
    throw new Error(detail);
  }
  return resp.json();
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function tri(v) {
  return v === true ? "ja" : v === false ? "nein" : "—";
}

function fmtTime(iso) {
  return iso ? new Date(iso).toLocaleTimeString("de-DE") : "";
}

connectWS();

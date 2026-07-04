/* TriARge Einsatzleitung dashboard.
 * Loads state via REST, then stays current via the /ws event stream. */

"use strict";

const CATEGORY_META = {
  SK1: { label: "SK I — rot", color: "var(--sk1)", order: 0 },
  SK2: { label: "SK II — gelb", color: "var(--sk2)", order: 1 },
  SK3: { label: "SK III — grün", color: "var(--sk3)", order: 2 },
  SK4: { label: "SK IV — blau", color: "var(--sk4)", order: 3 },
  DECEASED: { label: "verstorben", color: "var(--deceased)", order: 4 },
  UNSIGHTED: { label: "ungesichtet", color: "var(--unsighted)", order: 5 },
};

const state = {
  patients: new Map(), // marker_id -> patient
  radioRunning: false,
};

const boardEl = document.getElementById("board");
const countsEl = document.getElementById("counts");
const radioLogEl = document.getElementById("radio-log");
const radioBtn = document.getElementById("radio-toggle");
const wsPill = document.getElementById("ws-pill");
const syncPill = document.getElementById("sync-pill");

/* ------------------------------------------------------------- rendering */

function renderBoard() {
  const patients = [...state.patients.values()].sort((a, b) => {
    const co = CATEGORY_META[a.category].order - CATEGORY_META[b.category].order;
    return co !== 0 ? co : a.marker_id - b.marker_id;
  });
  boardEl.innerHTML = "";
  for (const p of patients) boardEl.appendChild(patientCard(p));
  renderCounts(patients);
}

function patientCard(p) {
  const card = document.createElement("article");
  card.className = `card cat-${p.category}`;
  card.dataset.marker = p.marker_id;
  card.onclick = () => openDetail(p.marker_id);

  const vit = p.vitals || {};
  const vitals = [
    vit.breathing_rate != null ? `AF <b>${vit.breathing_rate}</b>` : null,
    vit.pulse != null ? `Puls <b>${vit.pulse}</b>` : null,
    vit.spo2 != null ? `SpO₂ <b>${vit.spo2}%</b>` : null,
    vit.bp_systolic != null
      ? `RR <b>${vit.bp_systolic}${vit.bp_diastolic != null ? "/" + vit.bp_diastolic : ""}</b>`
      : null,
    vit.gcs != null ? `GCS <b>${vit.gcs}</b>` : null,
  ].filter(Boolean);

  card.innerHTML = `
    <div class="card-head">
      <span class="marker">#${p.marker_id}</span>
      <span class="cat-label">${CATEGORY_META[p.category].label}</span>
    </div>
    <div class="vitals">${vitals.join("<span></span>") || '<span class="muted">keine Vitalwerte</span>'}</div>
    <div class="tags">
      ${(p.injuries || []).map((i) => `<span class="tag">${esc(i)}</span>`).join("")}
      ${(p.treatments || []).map((t) => `<span class="tag treatment">✚ ${esc(t)}</span>`).join("")}
    </div>
    <div class="updated">${meta(p)}</div>`;
  return card;
}

function meta(p) {
  const bits = [];
  if (p.sex) bits.push(p.sex === "m" ? "männlich" : p.sex === "w" ? "weiblich" : p.sex);
  if (p.age_estimate != null) bits.push(`~${p.age_estimate} J.`);
  if (p.ambulatory === true) bits.push("gehfähig");
  if (p.ambulatory === false) bits.push("nicht gehfähig");
  bits.push(`aktualisiert ${timeAgo(p.updated_at)}`);
  return bits.join(" · ");
}

function renderCounts(patients) {
  const counts = {};
  for (const p of patients) counts[p.category] = (counts[p.category] || 0) + 1;
  countsEl.innerHTML = Object.entries(CATEGORY_META)
    .filter(([cat]) => counts[cat])
    .map(
      ([cat, m]) =>
        `<span class="count" style="background:${m.color}">${counts[cat]}</span>`
    )
    .join("");
}

function flashCard(markerId) {
  const card = boardEl.querySelector(`[data-marker="${markerId}"]`);
  if (card) {
    card.classList.remove("flash");
    void card.offsetWidth; // restart animation
    card.classList.add("flash");
  }
}

/* --------------------------------------------------------------- details */

function openDetail(markerId) {
  // One dedicated window per patient — reuses the window if already open,
  // so any number of patients can be watched side by side.
  window.open(
    `/patient/${markerId}`,
    `triarge-patient-${markerId}`,
    "width=760,height=880,menubar=no,toolbar=no,location=no"
  );
}

/* ----------------------------------------------------------------- radio */

radioBtn.onclick = async () => {
  const endpoint = state.radioRunning ? "/api/radio/stop" : "/api/radio/start";
  try {
    const status = await fetchJSON(endpoint, { method: "POST" });
    applyRadioStatus(status);
  } catch (err) {
    alert(`Funk-Monitor: ${err.message}`);
  }
};

function applyRadioStatus(status) {
  state.radioRunning = status.running;
  radioBtn.classList.toggle("on", status.running);
  radioBtn.textContent = status.running
    ? `● Funk läuft (${status.device || "Mikrofon"})`
    : "● Funk aus";
}

function addRadioEntry(entry, prepend = true) {
  const placeholder = radioLogEl.querySelector(".muted");
  if (placeholder) placeholder.remove();
  const div = document.createElement("div");
  div.className = "radio-entry";
  div.innerHTML = `
    <div class="meta">
      <span>${fmtTime(entry.timestamp)}</span>
      <span class="refs">${(entry.patient_refs || []).map((r) => "#" + r).join(" ")}</span>
    </div>
    <div>${esc(entry.transcript)}</div>`;
  prepend ? radioLogEl.prepend(div) : radioLogEl.append(div);
  while (radioLogEl.children.length > 200) radioLogEl.lastChild.remove();
}

/* ------------------------------------------------------------- websocket */

function connectWS() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ws`);

  ws.onopen = () => {
    wsPill.textContent = "live";
    wsPill.classList.add("ok");
    loadInitial(); // re-sync full state after every (re)connect
  };
  ws.onclose = () => {
    wsPill.textContent = "getrennt";
    wsPill.classList.remove("ok");
    setTimeout(connectWS, 2000);
  };
  ws.onmessage = (msg) => {
    const { type, payload } = JSON.parse(msg.data);
    switch (type) {
      case "patient.created":
      case "patient.updated":
        state.patients.set(payload.marker_id, payload);
        renderBoard();
        flashCard(payload.marker_id);
        break;
      case "radio.transcript":
        addRadioEntry(payload);
        break;
      case "radio.status":
        applyRadioStatus(payload);
        break;
      case "sync.status":
        applySyncStatus(payload);
        break;
    }
  };
}

function applySyncStatus(s) {
  if (!s.enabled) {
    syncPill.textContent = "lokal";
    syncPill.className = "pill";
  } else if (s.connected) {
    syncPill.textContent = `cloud sync ✓${s.pending ? ` (${s.pending})` : ""}`;
    syncPill.className = "pill ok";
  } else {
    syncPill.textContent = `cloud offline (${s.pending} ausstehend)`;
    syncPill.className = "pill warn";
  }
}

/* --------------------------------------------------------------- loading */

async function loadInitial() {
  const [patients, radioEntries, health] = await Promise.all([
    fetchJSON("/api/patients"),
    fetchJSON("/api/radio/log?limit=50"),
    fetchJSON("/api/health"),
  ]);
  state.patients = new Map(patients.map((p) => [p.marker_id, p]));
  renderBoard();
  radioLogEl.innerHTML = radioEntries.length
    ? ""
    : '<p class="muted">Noch keine Transmissionen.</p>';
  for (const entry of radioEntries.reverse()) addRadioEntry(entry);
  applyRadioStatus(health.radio);
  applySyncStatus(health.sync);
}

/* ----------------------------------------------------------------- utils */

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

function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "gerade eben";
  if (s < 3600) return `vor ${Math.floor(s / 60)} min`;
  return `vor ${Math.floor(s / 3600)} h`;
}

setInterval(renderBoard, 30000); // keep "aktualisiert vor X min" fresh
connectWS();

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
const dialogEl = document.getElementById("patient-dialog");
const detailEl = document.getElementById("patient-detail");

let openDetailMarker = null;

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

async function openDetail(markerId) {
  openDetailMarker = markerId;
  await renderDetail();
  dialogEl.showModal();
}

dialogEl.addEventListener("close", () => (openDetailMarker = null));

async function renderDetail() {
  const p = state.patients.get(openDetailMarker);
  if (!p) return;
  const protocol = await fetchJSON(`/api/patients/${p.marker_id}/protocol`);
  const vit = p.vitals || {};
  detailEl.innerHTML = `
    <div class="detail-head">
      <h3>Patient #${p.marker_id}</h3>
      <span class="cat-label" style="color:${CATEGORY_META[p.category].color};font-weight:700">
        ${CATEGORY_META[p.category].label}
      </span>
    </div>
    <div class="cat-buttons">
      ${["SK1", "SK2", "SK3", "SK4", "DECEASED"]
        .map(
          (c) =>
            `<button class="b-${c} ${p.category === c ? "active" : ""}"
              onclick="setCategory(${p.marker_id}, '${c}')">${CATEGORY_META[c].label}</button>`
        )
        .join("")}
    </div>
    <div class="detail-grid">
      <span class="label">Atemfrequenz</span><span>${vit.breathing_rate ?? "—"} /min</span>
      <span class="label">Puls</span><span>${vit.pulse ?? "—"} /min</span>
      <span class="label">SpO₂</span><span>${vit.spo2 ?? "—"} %</span>
      <span class="label">Blutdruck</span><span>${vit.bp_systolic ?? "—"}${vit.bp_diastolic != null ? "/" + vit.bp_diastolic : ""} mmHg</span>
      <span class="label">GCS</span><span>${vit.gcs ?? "—"}</span>
      <span class="label">Ansprechbar</span><span>${tri(p.conscious)}</span>
      <span class="label">Atemweg frei</span><span>${tri(p.airway_clear)}</span>
      <span class="label">Gehfähig</span><span>${tri(p.ambulatory)}</span>
      <span class="label">Ablageort</span><span>${esc(p.location || "—")}</span>
      <span class="label">Verletzungen</span><span>${(p.injuries || []).map(esc).join(", ") || "—"}</span>
      <span class="label">Maßnahmen</span><span>${(p.treatments || []).map(esc).join(", ") || "—"}</span>
    </div>
    <div class="protocol">
      <h4>Protokoll (${protocol.length})</h4>
      ${protocol
        .map(
          (e) => `
        <div class="protocol-entry">
          <div class="meta">${fmtTime(e.timestamp)} · ${esc(e.source)}${e.author ? " · " + esc(e.author) : ""}</div>
          <div>${esc(e.transcript || JSON.stringify(e.structured))}</div>
        </div>`
        )
        .join("") || '<p class="muted">Keine Einträge.</p>'}
    </div>`;
}

window.setCategory = async (markerId, category) => {
  await fetchJSON(`/api/patients/${markerId}?source=dashboard&author=EL`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category }),
  });
  // patient.updated event handles the re-render
};

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
        if (openDetailMarker === payload.marker_id) renderDetail();
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

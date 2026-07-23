/* TriARge — self-contained browser demo of the Einsatzleitung dashboard.
 *
 * The real product (repo main branch) is a FastAPI "hub" that streams live
 * state to this dashboard over REST + WebSocket. A static site can't run that
 * Python backend, so here the backend is replaced by an in-browser simulation:
 * a scripted MANV (mass-casualty incident — an overturned coach on the A9)
 * plays out in real time, and every control (re-triage, drag-to-place, teams,
 * radio, sessions, map upload) operates on local state.
 *
 * The rendering + interaction functions are the product's own dashboard code,
 * kept as-is; only the data source — the "backend seams" — is swapped for the
 * simulator (`dispatch()` stands in for the WebSocket event stream). No network,
 * no install. Source of the UI: hub/static/{app.js,patient.js} on the main branch.
 */

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
let sessions = [];
let teams = [];
const protocols = new Map(); // marker_id -> [{timestamp, source, author, transcript}]

const boardEl = document.getElementById("board");
const countsEl = document.getElementById("counts");
const radioLogEl = document.getElementById("radio-log");
const radioBtn = document.getElementById("radio-toggle");
const wsPill = document.getElementById("ws-pill");
const syncPill = document.getElementById("sync-pill");
const sessionSelect = document.getElementById("session-select");
const newSessionBtn = document.getElementById("new-session-btn");
const teamListEl = document.getElementById("team-list");
const addTeamBtn = document.getElementById("add-team-btn");
const mapContainer = document.getElementById("map-container");
const mapUnplaced = document.getElementById("map-unplaced");
const mapFileInput = document.getElementById("map-file");
const gridColsInput = document.getElementById("grid-cols");
const gridRowsInput = document.getElementById("grid-rows");

const isoNow = () => new Date().toISOString();

/* ------------------------------------------------------------- rendering */

function renderBoard() {
  const patients = [...state.patients.values()].sort((a, b) => {
    const co = CATEGORY_META[a.category].order - CATEGORY_META[b.category].order;
    return co !== 0 ? co : a.marker_id - b.marker_id;
  });
  boardEl.innerHTML = "";
  for (const p of patients) boardEl.appendChild(patientCard(p));
  renderCounts(patients);
  renderMapChips();
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
  if (p.last_seen && p.last_seen.by) {
    bits.push(`👁 ${esc(p.last_seen.by)} ${timeAgo(p.last_seen.at)}`);
  }
  return bits.join(" · ");
}

function renderCounts(patients) {
  const counts = {};
  for (const p of patients) counts[p.category] = (counts[p.category] || 0) + 1;
  countsEl.innerHTML = Object.entries(CATEGORY_META)
    .filter(([cat]) => counts[cat])
    .map(
      ([cat, m]) =>
        `<span class="count" style="background:${m.color}" title="${m.label}">${counts[cat]}</span>`
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

/* ------------------------------------------------------------ situation map */

let mapMeta = { exists: true, cols: 8, rows: 6, version: 1 };
let mapImage = ""; // data-URI; assigned at boot / on upload

function cellRef(col, row) {
  return String.fromCharCode(65 + col) + (row + 1);
}

function parseCellRef(location) {
  const m = /^([A-Z])(\d{1,2})$/.exec((location || "").trim().toUpperCase());
  if (!m) return null;
  return { col: m[1].charCodeAt(0) - 65, row: parseInt(m[2], 10) - 1 };
}

function renderMapStructure() {
  gridColsInput.value = mapMeta.cols ?? 8;
  gridRowsInput.value = mapMeta.rows ?? 6;
  if (!mapMeta.exists) {
    mapContainer.innerHTML =
      '<p class="muted map-placeholder">Keine Karte — Luftbild oder Lageplan hochladen, das Raster wird automatisch darübergelegt.</p>';
    renderMapChips();
    return;
  }
  mapContainer.innerHTML = `
    <img src="${mapImage}" alt="Lagekarte">
    <div class="map-grid" style="grid-template-columns:repeat(${mapMeta.cols},1fr);grid-template-rows:repeat(${mapMeta.rows},1fr)"></div>`;
  const grid = mapContainer.querySelector(".map-grid");
  for (let row = 0; row < mapMeta.rows; row++) {
    for (let col = 0; col < mapMeta.cols; col++) {
      const ref = cellRef(col, row);
      const cell = document.createElement("div");
      cell.className = "map-cell";
      cell.dataset.cell = ref;
      cell.innerHTML = `<span class="cell-label">${ref}</span>`;
      cell.ondragover = (e) => {
        e.preventDefault();
        cell.classList.add("drop-target");
      };
      cell.ondragleave = () => cell.classList.remove("drop-target");
      cell.ondrop = (e) => {
        e.preventDefault();
        cell.classList.remove("drop-target");
        const markerId = parseInt(e.dataTransfer.getData("text/plain"), 10);
        if (!isNaN(markerId)) placePatient(markerId, ref);
      };
      grid.appendChild(cell);
    }
  }
  renderMapChips();
}

function renderMapChips() {
  mapContainer.querySelectorAll(".patient-chip").forEach((c) => c.remove());
  mapUnplaced.innerHTML = "";

  const unplaced = [];
  for (const p of state.patients.values()) {
    const pos = parseCellRef(p.location);
    const cell =
      pos && pos.col < mapMeta.cols && pos.row < mapMeta.rows && mapMeta.exists
        ? mapContainer.querySelector(`[data-cell="${cellRef(pos.col, pos.row)}"]`)
        : null;
    if (cell) {
      cell.appendChild(patientChip(p));
    } else {
      unplaced.push(p);
    }
  }
  if (unplaced.length) {
    const hint = document.createElement("span");
    hint.className = "hint";
    hint.textContent = "Nicht platziert (auf die Karte ziehen):";
    mapUnplaced.appendChild(hint);
    for (const p of unplaced) mapUnplaced.appendChild(patientChip(p));
  }
}

function patientChip(p) {
  const chip = document.createElement("span");
  chip.className = `patient-chip chip-${p.category}`;
  chip.textContent = `#${p.marker_id}`;
  chip.title = `Patient #${p.marker_id} — ${CATEGORY_META[p.category].label}` +
    (p.location ? ` @ ${p.location}` : "");
  chip.draggable = true;
  chip.ondragstart = (e) => e.dataTransfer.setData("text/plain", String(p.marker_id));
  chip.onclick = () => openDetail(p.marker_id);
  return chip;
}

mapUnplaced.ondragover = (e) => e.preventDefault();
mapUnplaced.ondrop = (e) => {
  e.preventDefault();
  const markerId = parseInt(e.dataTransfer.getData("text/plain"), 10);
  if (!isNaN(markerId)) placePatient(markerId, "");
};

// Local stand-in for PATCH /api/patients/{id} { location }.
function placePatient(markerId, ref) {
  const p = state.patients.get(markerId);
  if (!p) return;
  p.location = ref;
  p.updated_at = isoNow();
  pushProto(markerId, {
    source: "dashboard",
    author: "EL",
    transcript: ref ? `Ablageort gesetzt: ${ref}` : "Ablageort entfernt",
  });
  dispatch("patient.updated", p);
}

mapFileInput.onchange = () => {
  const file = mapFileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    mapImage = reader.result;
    mapMeta = {
      exists: true,
      cols: parseInt(gridColsInput.value, 10) || 8,
      rows: parseInt(gridRowsInput.value, 10) || 6,
      version: (mapMeta.version || 0) + 1,
    };
    dispatch("map.changed", mapMeta);
    mapFileInput.value = "";
  };
  reader.readAsDataURL(file);
};

function applyGridChange() {
  if (!mapMeta.exists) return;
  const cols = parseInt(gridColsInput.value, 10);
  const rows = parseInt(gridRowsInput.value, 10);
  if (!cols || !rows) return;
  mapMeta = { ...mapMeta, cols, rows, version: (mapMeta.version || 0) + 1 };
  dispatch("map.changed", mapMeta);
}
gridColsInput.onchange = applyGridChange;
gridRowsInput.onchange = applyGridChange;

/* -------------------------------------------------------------- sessions */

function renderSessions(list) {
  sessionSelect.innerHTML = list
    .map(
      (s) =>
        `<option value="${esc(s.name)}" ${s.active ? "selected" : ""}>
          ${esc(s.name)}${s.active ? " ●" : ""}</option>`
    )
    .join("");
}

sessionSelect.onchange = () => {
  const name = sessionSelect.value;
  if (!confirm(`Zu Einsatz „${name}" wechseln?\n(Der aktuelle Einsatz bleibt gespeichert.)`)) {
    renderSessions(sessions);
    return;
  }
  sessions = sessions.map((s) => ({ ...s, active: s.name === name }));
  renderSessions(sessions);
  dispatch("session.changed", { name, sessions });
};

newSessionBtn.onclick = () => {
  const name =
    prompt(
      "Neuen Einsatz starten — alle bisherigen Daten bleiben unter dem aktuellen Einsatz gespeichert.\n\nName (leer = automatisch):"
    );
  if (name === null) return;
  const finalName = name.trim() || `Einsatz ${new Date().toLocaleString("de-DE")}`;
  sessions = sessions.map((s) => ({ ...s, active: false }));
  sessions.push({ name: finalName, active: true });
  renderSessions(sessions);
  // A brand-new session starts empty (demo: clear the board but keep the map).
  state.patients.clear();
  protocols.clear();
  renderBoard();
  dispatch("session.changed", { name: finalName, sessions });
};

/* ----------------------------------------------------------------- teams */

function renderTeams(list) {
  if (!list.length) {
    teamListEl.innerHTML = '<p class="muted">Keine Trupps registriert.</p>';
    return;
  }
  teamListEl.innerHTML = "";
  for (const t of list) {
    const row = document.createElement("div");
    row.className = `team-row ${t.online ? "online" : ""}`;
    const status = t.online
      ? t.last_marker != null
        ? `im Einsatz — sieht Patient #${t.last_marker}`
        : "online"
      : t.last_active
        ? `zuletzt aktiv ${timeAgo(t.last_active)}`
        : "noch nie verbunden";
    row.innerHTML = `
      <span class="dot"></span>
      <span class="team-name">${esc(t.name)}</span>
      <span class="team-status">${esc(t.note ? t.note + " · " : "")}${status}</span>
      <button class="team-remove" title="Trupp entfernen">✕</button>`;
    row.querySelector(".team-remove").onclick = () => {
      if (!confirm(`Trupp „${t.name}" aus der Übersicht entfernen?`)) return;
      teams = teams.filter((x) => x.name !== t.name);
      dispatch("teams", teams);
    };
    teamListEl.appendChild(row);
  }
}

addTeamBtn.onclick = () => {
  const name = prompt("Rufname des Trupps (z. B. RTW-3):");
  if (!name || !name.trim()) return;
  const note = prompt("Notiz (optional, z. B. Besatzung/Abschnitt):") || "";
  if (teams.some((t) => t.name === name.trim())) {
    alert("Ein Trupp mit diesem Rufnamen existiert bereits.");
    return;
  }
  teams.push({ name: name.trim(), note, online: true, last_marker: null, last_active: isoNow() });
  dispatch("teams", teams);
};

/* ----------------------------------------------------------------- radio */

radioBtn.onclick = () => {
  state.radioRunning = !state.radioRunning;
  applyRadioStatus({ running: state.radioRunning, device: "AUX / BOS-Funk" });
  if (state.radioRunning) startFunk();
  else stopFunk();
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

/* --------------------------------------------------------- detail dialog
 * In the real client each patient opens in its own window (/patient/<id>).
 * On a static page we use an in-page modal — the CSS already carries the
 * original dialog styling — so board and detail share the same live state. */

const detailDialog = document.getElementById("detail");
let openMarker = null;

function openDetail(markerId) {
  openMarker = markerId;
  renderDetail();
  if (!detailDialog.open) detailDialog.showModal();
}

function renderDetail() {
  if (openMarker == null) return;
  const p = state.patients.get(openMarker);
  if (!p) {
    document.getElementById("d-grid").innerHTML =
      `<span class="label">Hinweis</span><span>Patient #${openMarker} wurde entfernt.</span>`;
    document.getElementById("d-cat-buttons").innerHTML = "";
    document.getElementById("d-protocol-list").innerHTML = "";
    return;
  }
  const cat = CATEGORY_META[p.category] || CATEGORY_META.UNSIGHTED;
  document.getElementById("d-title").textContent = `Patient #${p.marker_id}`;
  const catLabelEl = document.getElementById("d-cat-label");
  catLabelEl.textContent = cat.label;
  catLabelEl.style.color = cat.color;

  const catButtonsEl = document.getElementById("d-cat-buttons");
  catButtonsEl.innerHTML = ["SK1", "SK2", "SK3", "SK4", "DECEASED"]
    .map(
      (c) =>
        `<button class="b-${c} ${p.category === c ? "active" : ""}" data-cat="${c}">${CATEGORY_META[c].label}</button>`
    )
    .join("");
  for (const btn of catButtonsEl.querySelectorAll("button")) {
    btn.onclick = () => setCategory(p.marker_id, btn.dataset.cat);
  }

  const vit = p.vitals || {};
  document.getElementById("d-grid").innerHTML = `
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

  const proto = protocols.get(p.marker_id) || [];
  document.getElementById("d-protocol-title").textContent = `Protokoll (${proto.length})`;
  document.getElementById("d-protocol-list").innerHTML =
    [...proto]
      .reverse()
      .map(
        (e) => `
      <div class="protocol-entry">
        <div class="meta">${fmtTime(e.timestamp)} · ${esc(e.source)}${e.author ? " · " + esc(e.author) : ""}</div>
        <div>${esc(e.transcript || "")}</div>
      </div>`
      )
      .join("") || '<p class="muted">Keine Einträge.</p>';
}

function setCategory(markerId, category) {
  const p = state.patients.get(markerId);
  if (!p) return;
  p.category = category;
  p.updated_at = isoNow();
  pushProto(markerId, {
    source: "dashboard",
    author: "EL",
    transcript: `Sichtungskategorie manuell gesetzt: ${CATEGORY_META[category].label}`,
  });
  dispatch("patient.updated", p);
}

document.getElementById("d-delete").onclick = () => {
  if (openMarker == null) return;
  if (!confirm(`Patient #${openMarker} wirklich löschen? Nur für Fehlerkennungen gedacht — das Protokoll wird mit entfernt.`)) {
    return;
  }
  const id = openMarker;
  protocols.delete(id);
  dispatch("patient.deleted", { marker_id: id });
  detailDialog.close();
};
document.getElementById("d-close").onclick = () => detailDialog.close();
detailDialog.addEventListener("close", () => { openMarker = null; });

/* --------------------------------------------------------------- event bus
 * Stands in for the /ws WebSocket stream: the simulator calls dispatch(),
 * which runs the exact same event handling the real dashboard uses. */

function dispatch(type, payload) {
  switch (type) {
    case "patient.created":
    case "patient.updated":
      state.patients.set(payload.marker_id, payload);
      renderBoard();
      flashCard(payload.marker_id);
      break;
    case "patient.deleted":
      state.patients.delete(payload.marker_id);
      renderBoard();
      break;
    case "patient.seen": {
      const p = state.patients.get(payload.marker_id);
      if (p) {
        p.last_seen = payload;
        renderBoard();
      }
      break;
    }
    case "radio.transcript":
      addRadioEntry(payload);
      break;
    case "radio.status":
      applyRadioStatus(payload);
      break;
    case "sync.status":
      applySyncStatus(payload);
      break;
    case "session.changed":
      renderSessions(payload.sessions || []);
      break;
    case "teams":
      renderTeams(payload);
      break;
    case "map.changed":
      mapMeta = payload;
      renderMapStructure();
      break;
  }
  if (openMarker != null && type.startsWith("patient.")) renderDetail();
}

/* ----------------------------------------------------------------- utils */

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

function pushProto(markerId, entry) {
  const arr = protocols.get(markerId) || [];
  arr.push({ ...entry, timestamp: isoNow() });
  protocols.set(markerId, arr);
}

/* =========================================================================
 *  SIMULATION  —  a scripted MANV (overturned coach on the A9)
 * ========================================================================= */

// Stylised aerial "Lageplan" of the incident, drawn as an inline SVG so the
// map is self-contained (no external image, works offline on a static host).
const MAP_IMAGE =
  "data:image/svg+xml," +
  encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 750'>
  <defs>
    <linearGradient id='ground' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0' stop-color='#2a3a2b'/><stop offset='1' stop-color='#22302a'/>
    </linearGradient>
  </defs>
  <rect width='1200' height='750' fill='url(#ground)'/>
  <g opacity='0.5'>
    <rect x='470' y='60' width='210' height='150' rx='16' fill='#33442f'/>
    <rect x='820' y='300' width='260' height='170' rx='16' fill='#33442f'/>
    <rect x='150' y='560' width='260' height='150' rx='16' fill='#33442f'/>
  </g>
  <!-- BAB A9 carriageway (left) -->
  <g>
    <rect x='36' y='0' width='214' height='750' fill='#3a3f45'/>
    <rect x='36' y='0' width='214' height='750' fill='none' stroke='#4b5158' stroke-width='4'/>
    <line x1='143' y1='0' x2='143' y2='750' stroke='#e7c14b' stroke-width='4' stroke-dasharray='26 22'/>
    <text x='52' y='726' fill='#aeb6bd' font-family='sans-serif' font-size='20' font-weight='700' opacity='0.8'>BAB A9</text>
  </g>
  <!-- overturned coach across the carriageway -->
  <g transform='translate(150 360) rotate(-26)'>
    <rect x='-118' y='-30' width='236' height='60' rx='10' fill='#d9d534' stroke='#15170b' stroke-width='4'/>
    <g fill='#1b1d10' opacity='0.75'>
      <rect x='-104' y='-18' width='26' height='22' rx='3'/>
      <rect x='-70' y='-18' width='26' height='22' rx='3'/>
      <rect x='-36' y='-18' width='26' height='22' rx='3'/>
      <rect x='-2' y='-18' width='26' height='22' rx='3'/>
      <rect x='32' y='-18' width='26' height='22' rx='3'/>
      <rect x='66' y='-18' width='26' height='22' rx='3'/>
    </g>
  </g>
  <g fill='#7c6a3a' opacity='0.85'>
    <circle cx='250' cy='300' r='6'/><circle cx='288' cy='340' r='4'/><circle cx='232' cy='420' r='5'/>
    <circle cx='300' cy='250' r='4'/><circle cx='270' cy='470' r='6'/><circle cx='330' cy='400' r='4'/>
  </g>
  <!-- triage / treatment zones (decor; grid + chips carry the real placement) -->
  <g font-family='sans-serif' font-size='19' font-weight='700'>
    <rect x='300' y='130' width='300' height='240' rx='12' fill='#46a758' fill-opacity='0.15' stroke='#46a758' stroke-width='2' stroke-dasharray='7 6'/>
    <text x='318' y='158' fill='#7bd696'>Patientenablage</text>
    <rect x='600' y='250' width='300' height='250' rx='12' fill='#3e7bfa' fill-opacity='0.14' stroke='#3e7bfa' stroke-width='2' stroke-dasharray='7 6'/>
    <text x='618' y='278' fill='#8fb4ff'>Behandlungsplatz</text>
    <rect x='750' y='500' width='300' height='230' rx='12' fill='#46a758' fill-opacity='0.13' stroke='#46a758' stroke-width='2' stroke-dasharray='7 6'/>
    <text x='768' y='528' fill='#7bd696'>Sammelplatz (gehfähig)</text>
    <rect x='1050' y='120' width='140' height='360' rx='12' fill='#8a97a5' fill-opacity='0.12' stroke='#8a97a5' stroke-width='2' stroke-dasharray='7 6'/>
    <text x='1064' y='146' fill='#c3ccd4' font-size='16'>RTW-Bereit.</text>
  </g>
  <!-- north arrow -->
  <g transform='translate(1140 690)' fill='#cdd4da'>
    <polygon points='0,-26 8,6 0,-2 -8,6'/>
    <text x='-6' y='26' font-family='sans-serif' font-size='16' font-weight='700'>N</text>
  </g>
</svg>`);

// Patient roster for the scenario. `patient` is the record; `protocol` the
// initial field/voice log entries (timestamped at reveal time).
const ROSTER = {
  1: {
    patient: { marker_id: 1, category: "SK1", sex: "m", age_estimate: 45, ambulatory: false,
      conscious: false, airway_clear: false, location: "C2",
      vitals: { breathing_rate: 32, pulse: 130, spo2: 84, bp_systolic: 90, bp_diastolic: 60, gcs: 6 },
      injuries: ["Thoraxtrauma", "Schädel-Hirn-Trauma"], treatments: ["Sauerstoff", "HWS-Immobilisation"] },
    protocol: [
      { source: "client", author: "Trupp-1", transcript: "Männlich, ca. 45, bewusstlos, Schnappatmung, instabiler Thorax — rot." },
    ],
  },
  2: {
    patient: { marker_id: 2, category: "SK1", sex: "w", age_estimate: 31, ambulatory: false,
      conscious: true, airway_clear: true, location: "B3",
      vitals: { breathing_rate: 28, pulse: 124, spo2: 90, bp_systolic: 95, gcs: 13 },
      injuries: ["offene Femurfraktur", "starke Blutung"], treatments: ["Tourniquet", "Druckverband"] },
    protocol: [
      { source: "client", author: "Trupp-2", transcript: "Weiblich, ca. 30, spritzende Blutung Oberschenkel. Tourniquet gesetzt — rot." },
    ],
  },
  3: {
    patient: { marker_id: 3, category: "SK2", sex: "m", age_estimate: 52, ambulatory: false,
      conscious: true, airway_clear: true, location: "D3",
      vitals: { breathing_rate: 18, pulse: 96, spo2: 96, bp_systolic: 130, bp_diastolic: 85, gcs: 15 },
      injuries: ["Unterschenkelfraktur geschlossen"], treatments: ["Vakuumschiene", "Analgesie"] },
    protocol: [
      { source: "client", author: "Trupp-1", transcript: "Männlich, ca. 50, Unterschenkel deformiert, ansprechbar, kreislaufstabil — gelb." },
    ],
  },
  4: {
    patient: { marker_id: 4, category: "SK2", sex: "w", age_estimate: 24, ambulatory: false,
      conscious: true, airway_clear: true, location: "D4",
      vitals: { breathing_rate: 20, pulse: 104, spo2: 95, bp_systolic: 110, bp_diastolic: 70, gcs: 14 },
      injuries: ["V. a. Beckentrauma", "Abdomen druckschmerzhaft"], treatments: ["Beckenschlinge"] },
    protocol: [
      { source: "client", author: "Trupp-2", transcript: "Weiblich, ca. 25, Beckenschmerz, Abdomen gespannt — gelb, engmaschig beobachten." },
    ],
  },
  5: {
    patient: { marker_id: 5, category: "SK3", sex: "m", age_estimate: 19, ambulatory: true,
      conscious: true, airway_clear: true, location: "F6",
      vitals: { breathing_rate: 16, pulse: 82, spo2: 99, bp_systolic: 125, gcs: 15 },
      injuries: ["Schürfwunden", "Prellungen"], treatments: [] },
    protocol: [
      { source: "client", author: "Trupp-2", transcript: "Männlich, jung, gehfähig, nur Schürfwunden — grün, zum Sammelplatz." },
    ],
  },
  6: {
    patient: { marker_id: 6, category: "SK3", sex: "w", age_estimate: 38, ambulatory: true,
      conscious: true, airway_clear: true, location: "G6",
      vitals: { breathing_rate: 15, pulse: 78, spo2: 99, gcs: 15 },
      injuries: ["HWS-Distorsion"], treatments: [] },
    protocol: [
      { source: "client", author: "Trupp-2", transcript: "Weiblich, ca. 40, Nackenschmerz, gehfähig, stabil — grün." },
    ],
  },
  7: {
    patient: { marker_id: 7, category: "SK2", sex: "m", age_estimate: 60, ambulatory: false,
      conscious: true, airway_clear: true, location: "E3",
      vitals: { breathing_rate: 22, pulse: 110, spo2: 93, bp_systolic: 150, bp_diastolic: 95, gcs: 15 },
      injuries: ["thorakaler Druck", "kardiale Vorerkrankung"], treatments: ["Sauerstoff", "Monitoring"] },
    protocol: [
      { source: "client", author: "Trupp-1", transcript: "Männlich, ca. 60, Thoraxschmerz, bekannte KHK — gelb, EKG anfordern." },
    ],
  },
  8: {
    patient: { marker_id: 8, category: "SK1", sex: "w", age_estimate: 8, ambulatory: false,
      conscious: false, airway_clear: true, location: "C3",
      vitals: { breathing_rate: 30, pulse: 140, spo2: 88, gcs: 8 },
      injuries: ["Schädel-Hirn-Trauma", "Platzwunde"], treatments: ["Sauerstoff", "Wärmeerhalt"] },
    protocol: [
      { source: "client", author: "Trupp-1", transcript: "Kind, ca. 8, somnolent, GCS 8, Kopfplatzwunde — rot, NEF dringend." },
    ],
  },
  9: {
    patient: { marker_id: 9, category: "SK3", sex: "m", age_estimate: 27, ambulatory: true,
      conscious: true, airway_clear: true, location: "F5",
      vitals: { breathing_rate: 16, pulse: 80, spo2: 99, gcs: 15 },
      injuries: ["oberflächliche Schnittwunden"], treatments: [] },
    protocol: [
      { source: "client", author: "Trupp-2", transcript: "Männlich, gehfähig, kleine Schnittwunden am Arm — grün." },
    ],
  },
  10: {
    patient: { marker_id: 10, category: "SK2", sex: "w", age_estimate: 44, ambulatory: false,
      conscious: true, airway_clear: true, location: "E4",
      vitals: { breathing_rate: 21, pulse: 100, spo2: 94, bp_systolic: 120, gcs: 15 },
      injuries: ["Klavikulafraktur", "Rippenserienfraktur"], treatments: ["Analgesie", "Sauerstoff"] },
    protocol: [
      { source: "client", author: "Trupp-1", transcript: "Weiblich, ca. 45, Rippenserie links, atemabhängiger Schmerz — gelb." },
    ],
  },
  11: {
    patient: { marker_id: 11, category: "DECEASED", sex: "m", age_estimate: 70, ambulatory: false,
      conscious: false, airway_clear: false, location: "A2",
      vitals: {}, injuries: ["keine Lebenszeichen"], treatments: [] },
    protocol: [
      { source: "client", author: "Trupp-1", transcript: "Männlich, ca. 70, keine Atmung, keine Reaktion, keine Zeichen — schwarz." },
    ],
  },
  12: {
    patient: { marker_id: 12, category: "SK4", sex: "m", age_estimate: 66, ambulatory: false,
      conscious: false, airway_clear: false, location: "B2",
      vitals: { breathing_rate: 8, pulse: 40, spo2: 70, gcs: 3 },
      injuries: ["schwerstes Polytrauma"], treatments: ["Sauerstoff", "betreuende Maßnahmen"] },
    protocol: [
      { source: "client", author: "LNA", transcript: "Männlich, ca. 65, infauste Prognose, Behandlung nachrangig — SK IV (blau)." },
    ],
  },
};

/* --- simulator primitives ------------------------------------------------ */

let timers = [];
let ambient = null;
let funkTimer = null;

function reveal(id) {
  const tpl = ROSTER[id];
  const p = JSON.parse(JSON.stringify(tpl.patient));
  p.updated_at = isoNow();
  protocols.set(id, tpl.protocol.map((e) => ({ ...e, timestamp: isoNow() })));
  dispatch("patient.created", p);
}

function revealUnsighted(id) {
  // Marker detected by a Trupp's camera before triage is entered.
  const p = { marker_id: id, category: "UNSIGHTED", location: ROSTER[id].patient.location,
    vitals: {}, injuries: [], treatments: [], updated_at: isoNow() };
  protocols.set(id, [{ source: "client", author: "AR-Client", transcript: "Marker erkannt — Sichtung ausstehend.", timestamp: isoNow() }]);
  dispatch("patient.created", p);
}

function update(id, patch, proto) {
  const p = state.patients.get(id);
  if (!p) return;
  const vitals = patch.vitals ? { ...(p.vitals || {}), ...patch.vitals } : p.vitals;
  Object.assign(p, patch, { vitals, updated_at: isoNow() });
  if (proto) pushProto(id, proto);
  dispatch("patient.updated", p);
}

function seePatient(id, by) {
  const at = isoNow();
  const t = teams.find((x) => x.name === by);
  if (t) { t.last_marker = id; t.online = true; t.last_active = at; dispatch("teams", teams); }
  dispatch("patient.seen", { marker_id: id, by, at });
}

function radio(transcript, refs = []) {
  dispatch("radio.transcript", { timestamp: isoNow(), transcript, patient_refs: refs });
}

function at(t, fn) { timers.push(setTimeout(fn, t)); }

/* --- the scripted timeline ---------------------------------------------- */

function runScript() {
  radio("Leitstelle Oberbayern von Einsatzleitung: MANV bestätigt — Reisebus mit ca. 30 Insassen auf der A9, AS Allershausen, verunglückt. LNA/OrgL vor Ort. Nachforderung 5 RTW, 2 NEF, RTH.");

  at(1000, () => { revealUnsighted(1); seePatient(1, "Trupp-1"); });
  at(1400, () => radio("Trupp-1: Marker 1 erkannt, beginne Sichtung.", [1]));
  at(2600, () => { update(1, ROSTER[1].patient, ROSTER[1].protocol[0]);
    radio("Trupp-1: Patient 1 — rot. Thoraxtrauma, bewusstlos. Notarzt an die Ablage!", [1]); });

  at(3600, () => { reveal(2); seePatient(2, "Trupp-2");
    radio("Trupp-2: Patient 2, starke Blutung Oberschenkel — Tourniquet gesetzt, rot.", [2]); });

  at(5000, () => { reveal(5); radio("Trupp-2: Gehfähige werden zum Sammelplatz geführt.", [5]); });
  at(5700, () => reveal(6));

  at(6800, () => { revealUnsighted(3); seePatient(3, "Trupp-1"); });
  at(7600, () => radio("Einsatzleitung: Sichtung läuft — Lage wird laufend aktualisiert.", []));
  at(8000, () => update(3, ROSTER[3].patient, ROSTER[3].protocol[0]));

  at(9000, () => { reveal(8);
    radio("Trupp-1: Patient 8 — Kind, ca. 8, Schädel-Hirn-Trauma, rot. NEF dringend!", [8]); });

  at(9600, () => { applySyncStatus({ enabled: true, connected: true, pending: 0 });
    radio("Netz verfügbar — Hybrid-Sync aktiv, Lagebild wird in die Cloud repliziert.", []); });

  at(10600, () => reveal(4));
  at(11600, () => { reveal(7); radio("Trupp-1: Patient 7 — Thoraxschmerz, kardiale Vorgeschichte, gelb.", [7]); });

  at(12600, () => { teams.push({ name: "NEF-1", note: "Notarzt", online: true, last_marker: null, last_active: isoNow() });
    dispatch("teams", teams);
    radio("NEF-1 an Einsatzleitung: eingetroffen, übernehme die Roten.", []); });
  at(13200, () => { seePatient(8, "NEF-1"); });

  at(14200, () => reveal(10));
  at(15200, () => reveal(9));

  at(16200, () => { reveal(11);
    radio("Trupp-1: Patient 11 — keine Lebenszeichen. Kennzeichnung schwarz gesetzt.", [11]); });
  at(17600, () => { reveal(12);
    radio("LNA: Patient 12 — schwerstes Polytrauma, infaust, Behandlung nachrangig (SK IV).", [12]); });

  // ongoing treatment / deterioration
  at(19200, () => { seePatient(1, "NEF-1");
    update(1, { vitals: { spo2: 91, pulse: 118 }, treatments: ["Sauerstoff", "HWS-Immobilisation", "Thoraxentlastung"] },
      { source: "client", author: "NEF-1", transcript: "Entlastungspunktion rechts, SpO2 steigt auf 91 %." });
    radio("NEF-1: Patient 1 — Thorax entlastet, SpO2 91 %, transportfähig in Kürze.", [1]); });

  at(21500, () => update(8, { vitals: { spo2: 96, breathing_rate: 16 }, airway_clear: true, treatments: ["Narkose", "Intubation", "Wärmeerhalt"] },
    { source: "client", author: "NEF-1", transcript: "Kind narkotisiert und intubiert, SpO2 96 %." }));

  at(23500, () => update(7, { vitals: { spo2: 95 }, treatments: ["Sauerstoff", "Monitoring", "ASS/Heparin"] },
    { source: "dashboard", author: "EL", transcript: "12-Kanal-EKG angefordert, Kardiologie voranmelden." }));

  at(26000, () => { update(4, { category: "SK1", vitals: { pulse: 122, spo2: 92, bp_systolic: 90 }, treatments: ["Beckenschlinge", "Volumen", "Tranexamsäure"] },
      { source: "client", author: "Trupp-2", transcript: "Kreislauf verschlechtert sich — Beckenblutung, jetzt rot." });
    radio("Trupp-2: Patient 4 verschlechtert — jetzt rot, Beckenblutung, Schockraum voranmelden.", [4]); });

  at(28500, () => { seePatient(2, "Trupp-2"); });
  at(30000, () => radio("Einsatzleitung: Lagebild — 4× rot, 3× gelb, 3× grün, 1× SK IV, 1× schwarz. Abtransport der Roten läuft.", []));
  at(33000, () => radio("Abschnitt Transport: erster RTW mit Patient 2 Richtung Klinikum abgefahren.", [2]));
}

/* --- ambient liveliness (keeps the board feeling live after the arc) ----- */

const FUNK_POOL = [
  { t: "RTW 71/1 an Leitstelle: Patient {ref} übernommen, Transport in die Zielklinik.", cat: ["SK1", "SK2"] },
  { t: "Behandlungsplatz an EL: Patient {ref} transportbereit.", cat: ["SK1", "SK2"] },
  { t: "NEF-1: Reevaluation Patient {ref} — Kreislauf stabil.", cat: ["SK1", "SK2"] },
  { t: "Sammelplatz: Patient {ref} betreut, keine Verschlechterung.", cat: ["SK3"] },
  { t: "Abschnitt Transport: nächster RTW in zwei Minuten frei.", cat: null },
  { t: "EL an alle Trupps: Vollzähligkeit prüfen — Businsassen abgleichen.", cat: null },
];

function randomPatientId(cats) {
  const pool = [...state.patients.values()].filter((p) => !cats || cats.includes(p.category));
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)].marker_id;
}

function startFunk() {
  if (funkTimer) return;
  funkTimer = setInterval(() => {
    const line = FUNK_POOL[Math.floor(Math.random() * FUNK_POOL.length)];
    const ref = line.cat ? randomPatientId(line.cat) : null;
    if (line.cat && ref == null) return;
    radio(line.t.replace("{ref}", ref), ref != null ? [ref] : []);
  }, 4500);
}
function stopFunk() {
  if (funkTimer) { clearInterval(funkTimer); funkTimer = null; }
}

function ambientTick() {
  const ids = [...state.patients.values()].filter(
    (p) => p.category !== "DECEASED" && p.category !== "UNSIGHTED" && p.vitals && p.vitals.pulse != null
  );
  if (!ids.length) return;
  const p = ids[Math.floor(Math.random() * ids.length)];
  const jitter = (v, d, lo, hi) => Math.max(lo, Math.min(hi, v + Math.round((Math.random() * 2 - 1) * d)));
  update(p.marker_id, {
    vitals: {
      pulse: jitter(p.vitals.pulse, 4, 40, 160),
      spo2: p.vitals.spo2 != null ? jitter(p.vitals.spo2, 2, 70, 100) : undefined,
    },
  });
  // occasionally a Trupp re-sights a patient via AR
  if (Math.random() < 0.4) {
    const t = teams.filter((x) => x.online)[0];
    if (t) seePatient(p.marker_id, t.name);
  }
}

/* --- boot / replay ------------------------------------------------------- */

function clearSim() {
  timers.forEach(clearTimeout);
  timers = [];
  if (ambient) { clearInterval(ambient); ambient = null; }
  stopFunk();
}

function boot() {
  clearSim();
  if (detailDialog.open) detailDialog.close();

  sessions = [{ name: "Einsatz A9 · Reisebus", active: true }];
  teams = [
    { name: "Trupp-1", note: "Florian 71/1", online: true, last_marker: null, last_active: isoNow() },
    { name: "Trupp-2", note: "Florian 71/2", online: true, last_marker: null, last_active: isoNow() },
  ];
  state.patients.clear();
  state.radioRunning = false;
  protocols.clear();
  mapImage = MAP_IMAGE;
  mapMeta = { exists: true, cols: 8, rows: 6, version: 1 };

  wsPill.textContent = "live";
  wsPill.classList.add("ok");
  applyRadioStatus({ running: false });
  applySyncStatus({ enabled: false });
  renderSessions(sessions);
  renderTeams(teams);
  renderMapStructure();
  renderBoard();
  radioLogEl.innerHTML = '<p class="muted">Noch keine Transmissionen.</p>';

  runScript();
  ambient = setInterval(ambientTick, 6500);
}

document.getElementById("demo-replay").onclick = boot;

// keep the "aktualisiert vor X min" labels fresh (mirrors the real dashboard)
setInterval(renderBoard, 30000);

boot();

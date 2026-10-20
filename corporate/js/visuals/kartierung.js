// Visuals for the "Civil protection (3D mapping)" course.
//   map-three-sources  satellite, drone and AR glasses map one terrain
//   map-stitching      partial maps → gravity alignment → floor removal →
//                      4-DoF yaw search → one map (one headset stays unaligned)
//   map-prediction     flood / fire simulation on the fused 3D model
// All three share one isometric terrain drawn on canvas. Text lives in HTML
// with fixed pixel sizes. Built with el()/svg() only (never innerHTML).
import { el } from "../ui.js";
import { L, injectStyle, animate, prefersReducedMotion, clamp, lerp, ease } from "./kit.js";

// ---------------------------------------------------------------------------
// Terrain model: a valley with a river along x, a village on both banks,
// a hill in the north-east (treatment area) and AR-scanned basements.
const NX = 28;
const NZ = 20;
export function height(x, z) {
  const valley = 0.11 * Math.pow(Math.abs(z - 10.5), 1.3);
  const hill = 2.2 * Math.exp(-((x - 23) ** 2 + (z - 3.5) ** 2) / 14);
  const ripple = 0.18 * Math.sin(x * 0.45) + 0.12 * Math.cos(z * 0.7 + x * 0.2);
  return valley + hill + ripple;
}
// Houses: [x, z, w, d, h, basement?]
const HOUSES = [
  [5, 5.2, 1.6, 1.4, 0.9, true], [8, 4.8, 1.4, 1.4, 0.8, false], [11, 5.4, 1.8, 1.3, 1.0, true],
  [14, 5.0, 1.4, 1.5, 0.8, false], [6, 14.6, 1.5, 1.4, 0.8, true], [9.5, 15.0, 1.6, 1.3, 0.9, false],
  [13, 14.8, 1.4, 1.4, 0.8, true], [17, 15.0, 1.8, 1.4, 1.1, false], [18, 4.6, 1.4, 1.3, 0.8, false],
  [21, 15.2, 1.4, 1.4, 0.8, false],
];
// The building the AR glasses scan from inside.
const SCANNED = 2;

function tokens(node) {
  const cs = getComputedStyle(node);
  const v = (n, f) => cs.getPropertyValue(n).trim() || f;
  return {
    mint: v("--brand-mint", "#8ec7b8"), teal: v("--brand-teal", "#317f71"), accent: v("--accent", "#8ec7b8"),
    red: v("--sig-red", "#f0776e"), amber: v("--sig-amber", "#f2b84b"), green: v("--sig-green", "#6fd38f"),
    ink: v("--ink", "#ffffff"), soft: v("--ink-soft", "#b9c0d4"), faint: v("--ink-faint", "#8b93ac"),
    bg: v("--bg-deep", "#14132f"), raise: v("--bg-raise-2", "#25244a"),
  };
}

function rgba(color, a) {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  const m = /^rgba?\(([^)]+)\)$/i.exec(color);
  if (m) { const [r, g, b] = m[1].split(",").map((s) => s.trim()); return `rgba(${r},${g},${b},${a})`; }
  return color;
}

// Canvas sized to its box at device pixel ratio; returns a fit() that keeps
// W/H current and an iso projection fitted to the terrain bounds.
function isoCanvas(canvas, { pad = 14, top = 10, lift = 0.75 } = {}) {
  const ctx = canvas.getContext("2d");
  const view = { W: 0, H: 0, s: 1, ox: 0, oy: 0 };
  function fit() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (w === view.W && h === view.H) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Bounds of the terrain in unit iso space (heights up to ~3.5).
    const minX = -NZ * 0.866, maxX = NX * 0.866, minY = -3.6 * lift, maxY = (NX + NZ) * 0.5;
    const s = Math.min((w - 2 * pad) / (maxX - minX), (h - top - pad) / (maxY - minY));
    Object.assign(view, { W: w, H: h, s, ox: pad - minX * s + (w - 2 * pad - (maxX - minX) * s) / 2, oy: top - minY * s });
  }
  const P = (x, y, z) => [view.ox + (x - z) * 0.866 * view.s, view.oy + (x + z) * 0.5 * view.s - y * view.s * lift];
  return { ctx, view, fit, P };
}

// Draws the terrain cells back to front. cellColor(x, z, h) → fill or null.
function drawTerrain(ctx, P, cellColor, stroke) {
  for (let d = 0; d < NX + NZ; d++) {
    for (let x = 0; x < NX; x++) {
      const z = d - x;
      if (z < 0 || z >= NZ) continue;
      const h00 = height(x, z), h10 = height(x + 1, z), h11 = height(x + 1, z + 1), h01 = height(x, z + 1);
      const fill = cellColor(x, z, (h00 + h10 + h11 + h01) / 4);
      if (!fill) continue;
      ctx.beginPath();
      ctx.moveTo(...P(x, h00, z)); ctx.lineTo(...P(x + 1, h10, z)); ctx.lineTo(...P(x + 1, h11, z + 1)); ctx.lineTo(...P(x, h01, z + 1));
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.6; ctx.stroke(); }
    }
  }
}

// Draws an extruded box (house) with three visible faces.
function drawBox(ctx, P, [x, z, w, d, hgt], base, colors) {
  const y0 = base, y1 = base + hgt;
  const face = (pts, c) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = colors.edge; ctx.lineWidth = 0.8; ctx.stroke(); };
  face([P(x, y0, z + d), P(x + w, y0, z + d), P(x + w, y1, z + d), P(x, y1, z + d)], colors.left);
  face([P(x + w, y0, z), P(x + w, y0, z + d), P(x + w, y1, z + d), P(x + w, y1, z)], colors.right);
  face([P(x, y1, z), P(x + w, y1, z), P(x + w, y1, z + d), P(x, y1, z + d)], colors.top);
}

const houseBase = ([x, z, w, d]) => Math.max(height(x, z), height(x + w, z), height(x, z + d), height(x + w, z + d));

// Houses sorted back to front for the painter's algorithm.
const HOUSE_ORDER = HOUSES.map((h, i) => i).sort((a, b) => (HOUSES[a][0] + HOUSES[a][1]) - (HOUSES[b][0] + HOUSES[b][1]));

const CSS = `
.vk-card { border: 1px solid var(--line); border-radius: var(--r-lg); background: var(--bg-raise); padding: var(--sp-5); margin: var(--sp-5) 0; }
.vk-kicker { font-family: var(--font-mono); font-size: var(--t-micro); letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); margin: 0 0 var(--sp-1); }
.vk-title { font-size: 1.15rem; font-weight: 600; color: var(--ink); margin: 0 0 var(--sp-1); line-height: 1.3; }
.vk-sub { color: var(--ink-soft); font-size: var(--t-small); margin: 0 0 var(--sp-4); line-height: 1.5; }
.vk-stage { position: relative; aspect-ratio: 16 / 10; border-radius: var(--r-md); overflow: hidden; background: var(--bg-deep); border: 1px solid var(--line); }
.vk-stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.vk-cap { position: absolute; left: 10px; top: 10px; z-index: 2; font-family: var(--font-mono); font-size: 12px; color: var(--ink); background: rgba(12, 11, 31, 0.78); border: 1px solid var(--line-strong); border-radius: var(--r-md); padding: 6px 10px; max-width: calc(100% - 20px); line-height: 1.4; }
.vk-tabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin-top: var(--sp-3); }
.vk-tabs.is-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.vk-tab { border: 1px solid var(--line); border-radius: var(--r-sm); padding: 8px 10px; font-size: 12px; line-height: 1.35; color: var(--ink-faint); background: transparent; text-align: left; cursor: pointer; font-family: inherit; }
.vk-tab b { display: block; font-family: var(--font-mono); font-size: 11px; color: var(--accent); }
.vk-tab.is-on { color: var(--ink); border-color: var(--accent); background: var(--surface-tint); }
.vk-info { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--sp-2); margin-top: var(--sp-3); }
.vk-cell { border: 1px solid var(--line); border-radius: var(--r-md); padding: 10px 12px; background: var(--bg-deep); min-width: 0; }
.vk-cell span { display: block; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--ink-faint); }
.vk-cell b { display: block; font-size: 14px; color: var(--ink); line-height: 1.35; margin-top: 3px; font-weight: 600; }
.vk-bar { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-top: var(--sp-3); align-items: center; }
.vk-note { font-size: 12px; color: var(--ink-faint); margin: var(--sp-3) 0 0; line-height: 1.5; }
.vk-layers { display: inline-flex; flex-wrap: wrap; gap: 6px; }
.vk-layers button[aria-pressed="true"] { border-color: var(--accent); color: var(--ink); background: var(--surface-tint); }
.vk-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--sp-2); margin-top: var(--sp-3); }
.vk-stat { border: 1px solid var(--line); border-radius: var(--r-md); padding: 10px 12px; background: var(--bg-deep); min-width: 0; }
.vk-stat b { display: block; font-family: var(--font-mono); font-size: 1.05rem; color: var(--ink); }
.vk-stat span { display: block; font-size: 12px; color: var(--ink-soft); line-height: 1.35; margin-top: 2px; }
.vk-range { display: flex; align-items: center; gap: var(--sp-3); flex: 1 1 260px; font-size: 13px; color: var(--ink-soft); }
.vk-range input { flex: 1; accent-color: var(--brand-mint); }
.vk-warn { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.vk-warn li { font-size: 13px; line-height: 1.4; color: var(--ink-soft); border-left: 3px solid var(--line-strong); padding-left: 10px; }
.vk-warn li.is-red { border-color: var(--sig-red); color: var(--ink); }
.vk-warn li.is-amber { border-color: var(--sig-amber); color: var(--ink); }
.vk-warn li.is-ok { border-color: var(--sig-green); }
@media (max-width: 560px) {
  .vk-card { padding: var(--sp-4); }
  .vk-stage { aspect-ratio: 4 / 3; }
  .vk-cap { position: static; margin-top: var(--sp-2); max-width: none; }
  .vk-tabs, .vk-tabs.is-5, .vk-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .vk-info { grid-template-columns: 1fr; }
}
`;

function card(lang, kicker, title, sub) {
  injectStyle("vk-styles", CSS);
  return el("figure", { class: "vk-card" },
    el("p", { class: "vk-kicker" }, L(lang, kicker)),
    el("h3", { class: "vk-title" }, L(lang, title)),
    sub ? el("p", { class: "vk-sub" }, L(lang, sub)) : null);
}

function button(label, onclick, extra = {}) {
  return el("button", { class: "btn btn-outline btn-small", type: "button", onclick, ...extra }, label);
}

const PAUSE = { de: "Pause", en: "Pause" };
const PLAY = { de: "Abspielen", en: "Play" };
function playToggle(lang, state) {
  const btn = button(L(lang, state.playing ? PAUSE : PLAY), () => {
    state.playing = !state.playing;
    btn.textContent = L(lang, state.playing ? PAUSE : PLAY);
  });
  return btn;
}

// On phones the caption sits below the stage instead of covering it.
function placeCaption(stage, cap) {
  const narrow = globalThis.matchMedia?.("(max-width: 560px)");
  const place = () => { if (narrow?.matches) stage.after(cap); else stage.append(cap); };
  place();
  narrow?.addEventListener?.("change", place);
}

function houseColors(k, highlight) {
  return highlight
    ? { left: rgba(k.mint, 0.55), right: rgba(k.mint, 0.75), top: rgba(k.mint, 0.95), edge: rgba(k.bg, 0.8) }
    : { left: rgba(k.soft, 0.22), right: rgba(k.soft, 0.32), top: rgba(k.soft, 0.48), edge: rgba(k.bg, 0.8) };
}

// ---------------------------------------------------------------------------
// 1 · Three sources map one terrain
const T_SRC = {
  kicker: { de: "Drei Quellen · eine Karte", en: "Three sources · one map" },
  title: { de: "Orbit, Luft und Boden sehen Verschiedenes", en: "Orbit, air and ground see different things" },
  sub: {
    de: "Kein Sensor sieht bei einer Großschadenslage alles. Der Satellit überblickt das Tal, die Drohne liefert Details von Straßen und Trümmern, nur die AR-Brille blickt in Gebäude und Keller.",
    en: "No single sensor sees everything in a major incident. The satellite covers the valley, the drone delivers street and debris detail, and only the AR glasses look inside buildings and basements.",
  },
  tabs: [
    { de: "Satellit", en: "Satellite" },
    { de: "Drohne", en: "Drone" },
    { de: "AR-Brille", en: "AR glasses" },
    { de: "Zusammen", en: "Combined" },
  ],
  caps: [
    { de: "Satellit: ganzes Tal, grob, Stand vor dem Ereignis", en: "Satellite: whole valley, coarse, pre-event state" },
    { de: "Drohne: fliegt Bahnen, jede Bahn erweitert die Karte", en: "Drone: flies lanes, every lane extends the map" },
    { de: "AR-Brille: kartiert beim Gehen das Gebäudeinnere", en: "AR glasses: map the interior while walking" },
    { de: "Gemeinsame 3D-Karte mit Patientenposition", en: "Shared 3D map with patient position" },
  ],
  info: [
    [
      { de: "Sieht", en: "Sees" }, { de: "Gelände, Gebäude (LoD-2), Radar auch durch Wolken", en: "terrain, buildings (LoD-2), radar even through clouds" },
      { de: "Fläche", en: "Footprint" }, { de: "ganzes Flusstal", en: "entire river valley" },
      { de: "Detail", en: "Detail" }, { de: "grob · Referenz vor dem Ereignis", en: "coarse · pre-event reference" },
    ],
    [
      { de: "Sieht", en: "Sees" }, { de: "Straßen, Trümmer, Wasser, Wärmesignaturen", en: "streets, debris, water, heat signatures" },
      { de: "Fläche", en: "Footprint" }, { de: "Ortsteil, Bahn für Bahn", en: "district, lane by lane" },
      { de: "Detail", en: "Detail" }, { de: "zentimetergenau · nach dem Ereignis", en: "centimetre-level · post-event" },
    ],
    [
      { de: "Sieht", en: "Sees" }, { de: "Räume, Keller, Unterführungen, Patienten", en: "rooms, basements, underpasses, patients" },
      { de: "Fläche", en: "Footprint" }, { de: "Räume und Stockwerke", en: "rooms and floors" },
      { de: "Detail", en: "Detail" }, { de: "Patient mit Stockwerk im 3D-Raum verankert", en: "patient anchored in 3D with floor level" },
    ],
    [
      { de: "Ergebnis", en: "Result" }, { de: "ein Lagebild von außen nach innen", en: "one operating picture from outside to inside" },
      { de: "Für Trupps", en: "For teams" }, { de: "3D-Orientierung bis zum Patienten", en: "3D orientation right to the patient" },
      { de: "Für die Leitung", en: "For command" }, { de: "Überblick und Vorhersage auf einer Karte", en: "overview and prediction on one map" },
    ],
  ],
  layers: [
    { de: "Optisch", en: "Optical" }, { de: "Thermal", en: "Thermal" }, { de: "Gelände", en: "Terrain" }, { de: "3D", en: "3D" },
  ],
  layerLabel: { de: "Drohnen-Ebene:", en: "Drone layer:" },
  note: { de: "Schematische Darstellung nach dem DLR-Beispiel „Drohnenkartierung“ (Optisch, Thermal, Gelände, 3D).", en: "Schematic illustration following the DLR “drone mapping” example (optical, thermal, terrain, 3D)." },
  aria: {
    de: "Animiertes 3D-Gelände mit Fluss und Häusern, nacheinander erfasst von Satellit, Drohne und AR-Brille, am Ende als gemeinsame Karte.",
    en: "Animated 3D terrain with river and houses, captured in turn by satellite, drone and AR glasses, finally shown as one shared map.",
  },
};

const SRC_PHASE = 6; // seconds per source; combined view gets the same
const isRiver = (x, z) => Math.abs(z + 0.5 - 10.5) < 1.3;

function renderMapThreeSources(block, lang) {
  const root = card(lang, T_SRC.kicker, T_SRC.title, T_SRC.sub);
  const state = { playing: !prefersReducedMotion(), time: 0, layer: 0 };
  if (!state.playing) state.time = 3 * SRC_PHASE + 1;
  const canvas = el("canvas", { role: "img", "aria-label": L(lang, T_SRC.aria) });
  const cap = el("p", { class: "vk-cap" });
  const stage = el("div", { class: "vk-stage" }, canvas);
  const tabs = T_SRC.tabs.map((t, i) => el("button", { class: "vk-tab", type: "button", onclick: () => { state.time = i * SRC_PHASE + 0.01; } },
    el("b", {}, String(i + 1)), L(lang, t)));
  const info = el("div", { class: "vk-info" });
  const layerBtns = T_SRC.layers.map((l, i) => button(L(lang, l), () => {
    state.layer = i;
    layerBtns.forEach((b, j) => b.setAttribute("aria-pressed", String(j === i)));
    if (Math.floor(state.time / SRC_PHASE) % 4 !== 1) state.time = SRC_PHASE + 0.01;
  }, { "aria-pressed": String(i === 0) }));
  root.append(stage, el("div", { class: "vk-tabs" }, tabs), info,
    el("div", { class: "vk-bar" }, playToggle(lang, state), el("span", { class: "vk-layers" }, el("span", { class: "vk-note", style: "margin:0;align-self:center" }, L(lang, T_SRC.layerLabel)), layerBtns)),
    el("p", { class: "vk-note" }, L(lang, T_SRC.note)));
  placeCaption(stage, cap);

  const { ctx, view, fit, P } = isoCanvas(canvas, { top: 46 });
  let shownPhase = -1;

  // Drone lawnmower path over the village; returns ground point at time u ∈ [0,1].
  const LANES = [4, 7.5, 11, 14.5];
  const droneAt = (u) => {
    const f = clamp(u, 0, 0.9999) * LANES.length, lane = Math.floor(f), w = f - lane;
    const x = lane % 2 ? lerp(22, 2, w) : lerp(2, 22, w);
    return [x, LANES[lane]];
  };

  function frame(t) {
    fit();
    const k = tokens(stage);
    const { W, H } = view;
    ctx.clearRect(0, 0, W, H);
    const phase = Math.floor(t / SRC_PHASE) % 4;
    const u = (t % SRC_PHASE) / SRC_PHASE;
    if (phase !== shownPhase) {
      shownPhase = phase;
      tabs.forEach((b, i) => b.classList.toggle("is-on", i === phase));
      const rows = T_SRC.info[phase];
      info.replaceChildren(...[0, 2, 4].map((i) => el("div", { class: "vk-cell" }, el("span", {}, L(lang, rows[i])), el("b", {}, L(lang, rows[i + 1])))));
    }
    cap.textContent = L(lang, T_SRC.caps[phase]);

    const sat = phase === 0 || phase === 3;
    const drone = phase === 1 || phase === 3;
    const ar = phase === 2 || phase === 3;
    const droneU = phase === 1 ? u : 1;
    const covered = (x, z) => {
      // Cells already flown over (lane by lane) carry the drone layer.
      for (let i = 0; i < LANES.length; i++) {
        const laneStart = i / LANES.length, laneEnd = (i + 1) / LANES.length;
        if (droneU < laneStart) break;
        const done = clamp((droneU - laneStart) / (laneEnd - laneStart), 0, 1);
        const x0 = i % 2 ? lerp(22, 2, done) : 2, x1 = i % 2 ? 22 : lerp(2, 22, done);
        if (Math.abs(z + 0.5 - LANES[i]) <= 1.9 && x + 0.5 >= Math.min(x0, x1) - 1 && x + 0.5 <= Math.max(x0, x1) + 1) return true;
      }
      return false;
    };
    const layer = state.layer;
    drawTerrain(ctx, P, (x, z, h) => {
      const river = isRiver(x, z);
      if (drone && covered(x, z)) {
        if (layer === 1) return river ? "#1d2350" : rgba(k.bg, 1);
        if (layer === 2) { const v = clamp(h / 3, 0, 1); return `rgba(${Math.round(lerp(60, 230, v))},${Math.round(lerp(140, 200, v))},${Math.round(lerp(160, 90, v))},0.95)`; }
        if (layer === 3) return rgba(k.bg, 1);
        return river ? "#3a6f86" : `rgba(${Math.round(110 + h * 20)},${Math.round(125 + h * 18)},${Math.round(90 + h * 6)},0.95)`;
      }
      if (sat) {
        // Coarse 4×4 blocks: what the orbit view resolves.
        const bx = Math.floor(x / 4) * 4 + 2, bz = Math.floor(z / 4) * 4 + 2;
        const v = clamp(height(bx, bz) / 3, 0, 1);
        const riverBlock = Math.abs(bz - 10.5) < 2.1;
        const checker = ((bx + bz) / 4) % 2 ? 0.1 : 0;
        return riverBlock ? rgba(k.teal, 0.45 + checker) : rgba(k.soft, 0.14 + checker + v * 0.28);
      }
      return river ? rgba(k.teal, 0.35) : rgba(k.soft, 0.12 + clamp(h / 3, 0, 1) * 0.18);
    }, drone && layer === 3 ? rgba(k.mint, 0.7) : rgba(k.bg, 0.6));

    // Houses; thermal layer adds heat spots, AR view cuts the scanned house open.
    HOUSE_ORDER.forEach((i) => {
      const hs = HOUSES[i];
      const base = houseBase(hs);
      if (ar && i === SCANNED) {
        // Interior mesh: floor + walls as wireframe, patient inside, basement below.
        const [x, z, w, d, hgt] = hs;
        ctx.strokeStyle = k.mint; ctx.lineWidth = 1.4;
        const box = (y0, y1, dash) => {
          ctx.setLineDash(dash ? [4, 3] : []);
          const c = [[x, z], [x + w, z], [x + w, z + d], [x, z + d]];
          ctx.beginPath(); c.forEach(([cx, cz], j) => (j ? ctx.lineTo(...P(cx, y0, cz)) : ctx.moveTo(...P(cx, y0, cz)))); ctx.closePath(); ctx.stroke();
          ctx.beginPath(); c.forEach(([cx, cz], j) => (j ? ctx.lineTo(...P(cx, y1, cz)) : ctx.moveTo(...P(cx, y1, cz)))); ctx.closePath(); ctx.stroke();
          c.forEach(([cx, cz]) => { ctx.beginPath(); ctx.moveTo(...P(cx, y0, cz)); ctx.lineTo(...P(cx, y1, cz)); ctx.stroke(); });
        };
        const reveal = phase === 2 ? ease(clamp(u * 1.6, 0, 1)) : 1;
        box(base - 0.9, base, true); // basement
        if (reveal > 0) box(base, base + hgt * reveal, false);
        ctx.setLineDash([]);
        // Patient in the basement corner.
        const [px, py] = P(x + w * 0.35, base - 0.75, z + d * 0.6);
        const pulse = 1 + 0.25 * Math.sin(t * 5);
        ctx.fillStyle = k.red; ctx.beginPath(); ctx.arc(px, py, 5 * pulse, 0, Math.PI * 2); ctx.fill();
        // Callout: the AR anchor carries the floor level.
        const text = L(lang, { de: "JAR-P01 · Keller (UG 1)", en: "JAR-P01 · basement (level −1)" });
        ctx.font = "600 12px system-ui, sans-serif";
        const tw = ctx.measureText(text).width;
        const lx = px + 16, ly = py + 26;
        ctx.strokeStyle = k.red; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(lx, ly - 5); ctx.stroke();
        ctx.fillStyle = "rgba(12,11,31,0.82)"; ctx.fillRect(lx, ly - 13, tw + 10, 18);
        ctx.fillStyle = k.ink; ctx.fillText(text, lx + 5, ly);
        // Paramedic walking in with a small scan cone.
        const walk = phase === 2 ? clamp(u * 1.3, 0, 1) : 1;
        const [mx, my] = P(lerp(x - 2.2, x + w * 0.5, walk), base + 0.1, z + d + 0.4);
        ctx.fillStyle = rgba(k.mint, 0.18);
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.arc(mx, my, view.s * 2.2, -Math.PI * 0.95, -Math.PI * 0.35); ctx.closePath(); ctx.fill();
        ctx.fillStyle = k.accent; ctx.beginPath(); ctx.arc(mx, my - 4, 5, 0, Math.PI * 2); ctx.fill();
      } else {
        drawBox(ctx, P, hs, base, houseColors(k, false));
        if (drone && layer === 1 && covered(hs[0], hs[1])) {
          const [hx, hy] = P(hs[0] + hs[2] / 2, base + hs[4] + 0.05, hs[1] + hs[3] / 2);
          const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, view.s * 1.2);
          g.addColorStop(0, rgba(k.amber, 0.95)); g.addColorStop(1, rgba(k.red, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hx, hy, view.s * 1.2, 0, Math.PI * 2); ctx.fill();
        }
      }
    });

    // Satellite: orbit track and footprint over the whole valley.
    if (sat) {
      const sx = lerp(W * 0.6, W * 0.95, phase === 0 ? u : 0.5), sy = 26;
      const corners = [P(0, 0, 0), P(NX, 0, 0), P(NX, 0, NZ), P(0, 0, NZ)];
      ctx.strokeStyle = rgba(k.mint, phase === 0 ? 0.55 : 0.25); ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
      corners.forEach(([cx, cy]) => { ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(cx, cy); ctx.stroke(); });
      ctx.setLineDash([]);
      ctx.fillStyle = k.ink; ctx.fillRect(sx - 6, sy - 4, 12, 8);
      ctx.fillStyle = k.mint; ctx.fillRect(sx - 18, sy - 2, 10, 4); ctx.fillRect(sx + 8, sy - 2, 10, 4);
    }
    // Drone: position, altitude line and camera footprint.
    if (drone) {
      const [gx, gz] = droneAt(droneU);
      const alt = 5.2;
      const [dx, dy] = P(gx, alt, gz);
      const g0 = height(gx, gz);
      const fp = [[gx - 1.6, gz - 1.9], [gx + 1.6, gz - 1.9], [gx + 1.6, gz + 1.9], [gx - 1.6, gz + 1.9]].map(([x, z]) => P(x, height(x, z), z));
      ctx.fillStyle = rgba(k.mint, 0.16); ctx.strokeStyle = rgba(k.mint, 0.9); ctx.lineWidth = 1.2;
      ctx.beginPath(); fp.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.closePath(); ctx.fill(); ctx.stroke();
      fp.forEach(([fx, fy]) => { ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(fx, fy); ctx.strokeStyle = rgba(k.mint, 0.35); ctx.stroke(); });
      ctx.strokeStyle = rgba(k.ink, 0.35); ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(...P(gx, g0, gz)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = k.ink; ctx.beginPath(); ctx.arc(dx, dy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = k.ink; ctx.lineWidth = 2;
      [[-9, -5], [9, -5], [-9, 5], [9, 5]].forEach(([ox, oy]) => { ctx.beginPath(); ctx.arc(dx + ox, dy + oy, 3.5, 0, Math.PI * 2); ctx.stroke(); });
    }
  }

  animate(stage, (elapsed, dt, still) => {
    if (!still && state.playing) state.time = (state.time + dt) % (4 * SRC_PHASE);
    frame(state.time);
  });
  return root;
}

// ---------------------------------------------------------------------------
// 2 · Stitching satellite terrain, drone mesh and headset room scans
const T_ST = {
  kicker: { de: "Hub-Stitcher", en: "Hub stitcher" },
  title: { de: "Aus Teilkarten wird eine 3D-Karte", en: "Partial maps become one 3D map" },
  sub: {
    de: "Jede Brille startet in eigenen Koordinaten, dort, wo sie eingeschaltet wurde. Der Hub richtet alle Teile an der Schwerkraft aus, entfernt den Boden und sucht dann nur noch Drehwinkel und Verschiebung.",
    en: "Every headset starts in its own coordinates, wherever it was switched on. The hub aligns all parts to gravity, removes the floor and then only searches for yaw and shift.",
  },
  steps: [
    { de: "Eigene Koordinaten", en: "Own frames" },
    { de: "Schwerkraft (+Y)", en: "Gravity (+Y)" },
    { de: "Boden entfernen", en: "Remove floor" },
    { de: "Drehwinkel + Anker", en: "Yaw + anchors" },
    { de: "Eine Karte", en: "One map" },
  ],
  caps: [
    { de: "Satellit, Drohne und drei Brillen liefern Teilkarten, jede verdreht und versetzt.", en: "Satellite, drone and three headsets deliver partial maps, each rotated and shifted." },
    { de: "+Y zeigt immer nach oben: Neigung entfällt, nur 4 Freiheitsgrade bleiben.", en: "+Y always points up: tilt drops out, only 4 degrees of freedom remain." },
    { de: "Boden raus: Ein flacher Boden passt in jedem Winkel, auch 180° verdreht.", en: "Floor out: a flat floor fits at any angle, even rotated 180°." },
    { de: "Wände und gemeinsame Anker legen Drehung und Verschiebung fest.", en: "Walls and shared anchors fix rotation and shift." },
    { de: "Ausgerichtet: eine Karte. Brille 3 hat zu wenig Überlappung und bleibt getrennt.", en: "Aligned: one map. Headset 3 lacks overlap and stays separate." },
  ],
  names: [
    { de: "Satellit", en: "Satellite" }, { de: "Drohnen-Mesh", en: "Drone mesh" },
    { de: "Brille 1", en: "Headset 1" }, { de: "Brille 2", en: "Headset 2" }, { de: "Brille 3", en: "Headset 3" },
  ],
  unaligned: { de: "nicht ausgerichtet", en: "unaligned" },
  stats: [
    { v: "18–20 / 20", de: "Brillen im Live-Lauf ausgerichtet", en: "headsets aligned in live runs" },
    { v: "5,5–5,7 mm", vEn: "5.5–5.7 mm", de: "Median-Fehler der Ausrichtung", en: "median alignment error" },
    { v: "0", de: "falsche Zusammenführungen", en: "false accepts" },
    { v: "93 %", de: "Überlappung eines 180° falsch gedrehten Raums, solange der Boden drin ist", en: "overlap of a room rotated 180° the wrong way while the floor stays in" },
  ],
  aria: {
    de: "Animation: Satellitengelände, Drohnen-Mesh und Raumscans dreier Brillen werden ausgerichtet; Brille 3 bleibt mangels Überlappung getrennt.",
    en: "Animation: satellite terrain, drone mesh and three headsets' room scans are aligned; headset 3 stays separate for lack of overlap.",
  },
};

const ST_T = [0, 3, 6, 9, 13];
const ST_LOOP = 18;
// Parts: kind, footprint and its initial (wrong) pose.
const ST_PARTS = [
  { kind: "sat", x0: 0, x1: NX, z0: 0, z1: NZ, step: 4, yaw: 0, t: [0, 0, 0], tilt: 0 },
  { kind: "drone", x0: 3, x1: 21, z0: 4, z1: 16, step: 1, yaw: 24, t: [2.5, 1.4, -2.2], tilt: 9 },
  { kind: "room", house: 2, yaw: 62, t: [3.5, 2.2, 3.0], tilt: -12 },
  { kind: "room", house: 0, yaw: -48, t: [-3.0, 2.6, 2.0], tilt: 10 },
  { kind: "room", house: 6, yaw: 130, t: [4.5, 3.0, 4.2], tilt: 14, unaligned: true },
];

function renderMapStitching(block, lang) {
  const root = card(lang, T_ST.kicker, T_ST.title, T_ST.sub);
  const state = { playing: !prefersReducedMotion(), time: 0 };
  if (!state.playing) state.time = ST_LOOP - 1;
  const canvas = el("canvas", { role: "img", "aria-label": L(lang, T_ST.aria) });
  const cap = el("p", { class: "vk-cap" });
  const stage = el("div", { class: "vk-stage" }, canvas);
  const tabs = T_ST.steps.map((s, i) => el("button", { class: "vk-tab", type: "button", onclick: () => { state.time = ST_T[i] + 0.01; } },
    el("b", {}, String(i + 1)), L(lang, s)));
  const stats = el("div", { class: "vk-stats" }, T_ST.stats.map((s) =>
    el("div", { class: "vk-stat" }, el("b", {}, lang === "en" && s.vEn ? s.vEn : s.v), el("span", {}, L(lang, s)))));
  root.append(stage, el("div", { class: "vk-tabs is-5" }, tabs),
    el("div", { class: "vk-bar" }, playToggle(lang, state)), stats);
  placeCaption(stage, cap);
  const { ctx, view, fit, P } = isoCanvas(canvas, { top: 52, lift: 0.75 });

  const k01 = (t, a, b) => ease(clamp((t - a) / (b - a), 0, 1));
  function pose(part, t) {
    const tilt = part.tilt * (1 - k01(t, ST_T[1], ST_T[2]));
    const s = k01(t, ST_T[3], ST_T[4]);
    const keep = part.unaligned ? 0.65 : 0; // unaligned part only partly corrects
    const wobble = s > 0 && s < 1 ? Math.sin(s * Math.PI * 3) * 14 * (1 - s) : 0;
    return { tilt, yaw: part.yaw * (keep + (1 - keep) * (1 - s)) + wobble, t: part.t.map((v) => v * (keep + (1 - keep) * (1 - s))) };
  }
  function centre(part) {
    if (part.kind === "room") { const [x, z, w, d] = HOUSES[part.house]; return [x + w / 2, z + d / 2]; }
    return [(part.x0 + part.x1) / 2, (part.z0 + part.z1) / 2];
  }
  function tf(part, p, x, y, z) {
    const [cx, cz] = centre(part);
    let X = x - cx, Y = y, Z = z - cz;
    const a = (p.tilt * Math.PI) / 180;
    [Y, Z] = [Y * Math.cos(a) - Z * Math.sin(a), Y * Math.sin(a) + Z * Math.cos(a)];
    const b = (p.yaw * Math.PI) / 180;
    [X, Z] = [X * Math.cos(b) + Z * Math.sin(b), -X * Math.sin(b) + Z * Math.cos(b)];
    return P(X + cx + p.t[0], Y + p.t[1], Z + cz + p.t[2]);
  }

  function frame(t) {
    fit();
    const k = tokens(stage);
    ctx.clearRect(0, 0, view.W, view.H);
    const phase = ST_T.reduce((acc, s, i) => (t >= s ? i : acc), 0);
    tabs.forEach((b, i) => b.classList.toggle("is-on", i === phase));
    cap.textContent = L(lang, T_ST.caps[phase]);
    const merged = k01(t, ST_T[4], ST_T[4] + 1.2);
    const floorFade = 1 - k01(t, ST_T[2], ST_T[2] + 1.5);
    const colors = [rgba(k.soft, 0.7), k.mint, k.amber, k.red, rgba(k.ink, 0.85)];

    ST_PARTS.forEach((part, pi) => {
      const p = pose(part, t);
      let color = colors[pi];
      if (merged > 0 && !part.unaligned && pi > 0) color = k.mint;
      ctx.strokeStyle = color;
      ctx.lineWidth = part.kind === "room" ? 1.8 : 1;
      if (part.kind !== "room") {
        const line = (pts) => { ctx.beginPath(); pts.forEach(([x, z], i) => { const q = tf(part, p, x, height(x, z), z); i ? ctx.lineTo(...q) : ctx.moveTo(...q); }); ctx.stroke(); };
        for (let z = part.z0; z <= part.z1; z += part.step) { const pts = []; for (let x = part.x0; x <= part.x1; x += 1) pts.push([x, z]); line(pts); }
        for (let x = part.x0; x <= part.x1; x += part.step) { const pts = []; for (let z = part.z0; z <= part.z1; z += 1) pts.push([x, z]); line(pts); }
      } else {
        const hs = HOUSES[part.house];
        const base = houseBase(hs);
        // Rooms drawn enlarged (schematic) so walls and floors stay legible.
        const R = 2.3;
        const w = hs[2] * R, d = hs[3] * R, hgt = hs[4] * 1.8;
        const x = hs[0] + hs[2] / 2 - w / 2, z = hs[1] + hs[3] / 2 - d / 2;
        const c = [[x, z], [x + w, z], [x + w, z + d], [x, z + d]];
        ctx.setLineDash(part.unaligned && phase === 4 ? [5, 4] : []);
        // Walls (kept for matching).
        c.forEach(([cx, cz], i) => {
          const [nx, nz] = c[(i + 1) % 4];
          ctx.beginPath();
          ctx.moveTo(...tf(part, p, cx, base, cz)); ctx.lineTo(...tf(part, p, nx, base, nz));
          ctx.lineTo(...tf(part, p, nx, base + hgt, nz)); ctx.lineTo(...tf(part, p, cx, base + hgt, cz)); ctx.closePath();
          ctx.stroke();
        });
        ctx.setLineDash([]);
        // Floor points: visible until removed in phase 3.
        if (floorFade > 0) {
          ctx.fillStyle = rgba(color, floorFade);
          for (let fx = 0.15; fx < 1; fx += 0.22) for (let fz = 0.15; fz < 1; fz += 0.22) {
            const [qx, qy] = tf(part, p, x + w * fx, base + 0.02, z + d * fz);
            ctx.fillRect(qx - 1.5, qy - 1.5, 3, 3);
          }
        }
        // Shared anchor (a door corner) once the search runs.
        if (phase >= 3 && !part.unaligned) {
          const [ax, ay] = tf(part, p, x, base + hgt * 0.6, z + d);
          ctx.fillStyle = k.ink;
          ctx.beginPath(); ctx.moveTo(ax, ay - 5); ctx.lineTo(ax + 5, ay); ctx.lineTo(ax, ay + 5); ctx.lineTo(ax - 5, ay); ctx.closePath(); ctx.fill();
        }
      }
      // Label at the part's centre.
      if (pi > 0 && (merged < 1 || part.unaligned)) {
        // Drone label at its far corner, room labels above the room.
        const [cx, cz] = part.kind === "room" ? centre(part) : [part.x1 - 1, part.z0 + 0.5];
        const base = part.kind === "room" ? houseBase(HOUSES[part.house]) + HOUSES[part.house][4] * 1.8 + 0.5 : height(cx, cz) + 0.6;
        const [lx, ly] = tf(part, p, cx, base, cz);
        const text = part.unaligned && phase === 4 ? `${L(lang, T_ST.names[pi])} · ${L(lang, T_ST.unaligned)}` : L(lang, T_ST.names[pi]);
        ctx.font = "600 12px system-ui, sans-serif";
        const tw = ctx.measureText(text).width;
        ctx.fillStyle = "rgba(12,11,31,0.75)"; ctx.fillRect(lx - tw / 2 - 5, ly - 13, tw + 10, 18);
        ctx.fillStyle = part.unaligned && phase === 4 ? k.amber : color;
        ctx.fillText(text, lx - tw / 2, ly);
      }
    });
  }

  animate(stage, (elapsed, dt, still) => {
    if (!still && state.playing) state.time = (state.time + dt) % ST_LOOP;
    frame(state.time);
  });
  return root;
}

// ---------------------------------------------------------------------------
// 3 · Prediction on the fused model: flood and fire
const T_PR = {
  kicker: { de: "Vorhersage auf der 3D-Karte", en: "Prediction on the 3D map" },
  title: { de: "Was passiert, wenn das Wasser steigt?", en: "What happens when the water rises?" },
  sub: {
    de: "Liegen Gelände, Gebäude, Keller und Patienten in einer Karte, lässt sich rechnen: welche Keller wann volllaufen, ob die Patientenablage verlegt werden muss und welcher Weg zum Patienten trocken bleibt.",
    en: "With terrain, buildings, basements and patients in one map, the system can calculate which basements flood when, whether the casualty collection point must move and which route to a patient stays dry.",
  },
  flood: { de: "Hochwasser", en: "Flood" },
  fire: { de: "Brand", en: "Fire" },
  auto: { de: "Automatisch ablaufen", en: "Run automatically" },
  stop: { de: "Anhalten", en: "Stop" },
  levelLabel: { de: "Pegel über Normal", en: "Level above normal" },
  timeLabel: { de: "Zeit seit Brandausbruch", en: "Time since ignition" },
  warnTitle: { de: "Berechnete Warnungen", en: "Calculated warnings" },
  basement: { de: "JAR-P01 (SK I) im Keller (AR-Scan): Wasser erreicht den Keller bei +{h} m", en: "JAR-P01 (T1) in basement (AR scan): water reaches the basement at +{h} m" },
  pa: { de: "Patientenablage am Ufer läuft bei +{h} m voll: rechtzeitig verlegen", en: "Casualty collection point on the bank floods at +{h} m: relocate in time" },
  bhp: { de: "Behandlungsplatz auf der Anhöhe bleibt trocken bis +{h} m", en: "Treatment area on the hill stays dry up to +{h} m" },
  routeOk: { de: "Weg zu JAR-P02 (SK II): frei, {n} Felder", en: "Route to JAR-P02 (T2): clear, {n} cells" },
  routeNo: { de: "Weg zu JAR-P02 (SK II): kein trockener Weg mehr, Boot anfordern", en: "Route to JAR-P02 (T2): no dry route left, request a boat" },
  fireFront: { de: "Brandfront: {n} Häuser betroffen, Rauch zieht mit dem Wind nach Osten", en: "Fire front: {n} houses affected, smoke drifts east with the wind" },
  fireP3: { de: "JAR-P03 (SK III) liegt in der Rauchfahne: zuerst verlegen", en: "JAR-P03 (T3) lies in the smoke plume: move first" },
  fireP3ok: { de: "JAR-P03 (SK III) außerhalb der Rauchfahne", en: "JAR-P03 (T3) outside the smoke plume" },
  routeFireOk: { de: "Weg zu JAR-P02: frei, {n} Felder", en: "Route to JAR-P02: clear, {n} cells" },
  routeFireNo: { de: "Weg zu JAR-P02 durch den Brand versperrt", en: "Route to JAR-P02 blocked by the fire" },
  labels: {
    bhp: { de: "Behandlungsplatz", en: "Treatment area" },
    pa: { de: "Patientenablage", en: "Collection point" },
    team: { de: "Trupp", en: "Team" },
  },
  note: { de: "Simulation auf schematischem Gelände; Pegel und Zeiten sind beispielhaft. Echte Berechnungen nutzen Drohnen-Geländemodell, LoD-2-Gebäude und AR-Kellerscans.", en: "Simulation on schematic terrain; levels and times are examples. Real calculations use the drone terrain model, LoD-2 buildings and AR basement scans." },
  aria: {
    de: "Interaktive 3D-Karte: Mit steigendem Pegel laufen Ufer, Keller und Patientenablage voll; der Weg des Trupps zum Patienten passt sich an. Im Brand-Modus breitet sich ein Feuer mit Rauchfahne aus.",
    en: "Interactive 3D map: as the level rises, banks, basements and the collection point flood; the team's route to the patient adapts. In fire mode a fire with a smoke plume spreads.",
  },
};

const WATER0 = 0.35; // normal water surface
const BASEMENT = 0.45; // water this far below the ground floor already enters the basement
const MAXLEVEL = 1.6;
const FIRE_MAX = 20; // minutes (example)
const PR_PATIENTS = [
  { id: "JAR-P01", cat: 1, x: 5.8, z: 5.9, basement: 0 },
  { id: "JAR-P02", cat: 2, x: 9.5, z: 5.8 },
  { id: "JAR-P03", cat: 3, x: 20, z: 15.9 },
];
const PA = [15.5, 6.0];
const BHP = [23, 3.5];
const TEAM = [26, 1.5];

function renderMapPrediction(block, lang) {
  const root = card(lang, T_PR.kicker, T_PR.title, T_PR.sub);
  const state = { mode: "flood", value: 0.6, auto: !prefersReducedMotion() };
  const canvas = el("canvas", { role: "img", "aria-label": L(lang, T_PR.aria) });
  const stage = el("div", { class: "vk-stage" }, canvas);
  const rangeLabel = el("span", {});
  const rangeValue = el("b", { style: "font-family:var(--font-mono);min-width:5.5em;text-align:right" });
  const range = el("input", { type: "range", min: 0, max: 1000, value: 250, "aria-label": L(lang, T_PR.levelLabel) });
  range.addEventListener("input", () => { state.value = (Number(range.value) / 1000) * (state.mode === "flood" ? MAXLEVEL : FIRE_MAX); setAuto(false); });
  const modeBtns = [["flood", T_PR.flood], ["fire", T_PR.fire]].map(([m, lbl]) => button(L(lang, lbl), () => {
    state.mode = m;
    state.value = m === "flood" ? 0.6 : 4;
    modeBtns.forEach((b, i) => b.setAttribute("aria-pressed", String(["flood", "fire"][i] === m)));
    range.setAttribute("aria-label", L(lang, m === "flood" ? T_PR.levelLabel : T_PR.timeLabel));
  }, { "aria-pressed": String(m === "flood") }));
  const autoBtn = button("", () => setAuto(!state.auto));
  function setAuto(on) { state.auto = on; autoBtn.textContent = L(lang, on ? T_PR.stop : T_PR.auto); }
  setAuto(state.auto);
  const warn = el("ul", { class: "vk-warn", "aria-live": "polite" });
  root.append(stage,
    el("div", { class: "vk-bar" }, el("span", { class: "vk-layers" }, modeBtns), autoBtn),
    el("div", { class: "vk-bar" }, el("label", { class: "vk-range" }, rangeLabel, range, rangeValue)),
    el("div", { class: "vk-cell", style: "margin-top:var(--sp-3)" }, el("span", { style: "margin-bottom:8px" }, L(lang, T_PR.warnTitle)), warn),
    el("p", { class: "vk-note" }, L(lang, T_PR.note)));
  const { ctx, view, fit, P } = isoCanvas(canvas, { top: 16 });

  const cellH = (x, z) => (height(x, z) + height(x + 1, z) + height(x + 1, z + 1) + height(x, z + 1)) / 4;
  const floodAt = (h) => Math.max(0, h - WATER0); // level at which height h floods
  const fmt = (v) => (lang === "en" ? v.toFixed(1) : v.toFixed(1).replace(".", ","));
  const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k2) => vars[k2] ?? "");

  // Fire cells: distance from ignition stretched downwind (+x).
  const IGN = [17.5, 14];
  const fireCell = (x, z, minutes) => {
    const dx = x + 0.5 - IGN[0], dz = z + 0.5 - IGN[1];
    const r = minutes * 0.32;
    return (dx > 0 ? dx / 1.7 : dx) ** 2 + dz ** 2 < r * r;
  };
  const inPlume = (x, z, minutes) => {
    const dx = x - IGN[0], dz = z - IGN[1];
    return dx > 0 && dx < minutes * 0.9 && Math.abs(dz) < 1 + dx * 0.35;
  };

  // Breadth-first route over the cell grid avoiding blocked cells.
  function route(blocked, from, to) {
    const key = (x, z) => z * NX + x;
    const start = [Math.floor(from[0]), Math.floor(from[1])], goal = [Math.floor(to[0]), Math.floor(to[1])];
    const prev = new Map([[key(...start), null]]);
    const q = [start];
    while (q.length) {
      const [x, z] = q.shift();
      if (x === goal[0] && z === goal[1]) {
        const path = [];
        for (let c = [x, z]; c; c = prev.get(key(...c))) path.unshift(c);
        return path;
      }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= NX || nz >= NZ || prev.has(key(nx, nz))) continue;
        if (blocked(nx, nz) && !(nx === goal[0] && nz === goal[1])) continue;
        prev.set(key(nx, nz), [x, z]);
        q.push([nx, nz]);
      }
    }
    return null;
  }

  let lastWarnKey = "";
  function frame(t, dt) {
    fit();
    const k = tokens(stage);
    ctx.clearRect(0, 0, view.W, view.H);
    const flood = state.mode === "flood";
    const max = flood ? MAXLEVEL : FIRE_MAX;
    if (state.auto) state.value = (state.value + dt * max / 12) % max;
    range.value = String(Math.round((state.value / max) * 1000));
    rangeLabel.textContent = L(lang, flood ? T_PR.levelLabel : T_PR.timeLabel);
    rangeValue.textContent = flood ? `+${fmt(state.value)} m` : `${Math.round(state.value)} min`;
    const water = WATER0 + (flood ? state.value : 0);
    const minutes = flood ? 0 : state.value;

    const wet = (x, z) => flood && cellH(x, z) < water;
    const burning = (x, z) => !flood && fireCell(x, z, minutes);
    drawTerrain(ctx, P, (x, z, h) => {
      if (wet(x, z)) return rgba("#3f8fc4", 0.55 + clamp((water - h) / 2, 0, 0.35));
      if (burning(x, z)) return rgba(k.red, 0.55 + 0.25 * Math.sin(t * 6 + x + z));
      return rgba(k.soft, 0.12 + clamp(h / 3, 0, 1) * 0.2);
    }, rgba(k.bg, 0.55));

    // Houses: basements flood before the street, burning houses glow.
    let housesOnFire = 0;
    HOUSE_ORDER.forEach((i) => {
      const hs = HOUSES[i];
      const base = houseBase(hs);
      const onFire = !flood && fireCell(Math.floor(hs[0] + hs[2] / 2), Math.floor(hs[1] + hs[3] / 2), minutes);
      if (onFire) housesOnFire++;
      if (hs[5]) {
        const bFlooded = flood && water > base - BASEMENT;
        const [x, z, w, d] = hs;
        ctx.strokeStyle = bFlooded ? "#6fb7e6" : rgba(k.mint, 0.5); ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
        ctx.beginPath(); [[x, z], [x + w, z], [x + w, z + d], [x, z + d], [x, z]].forEach(([cx, cz], j) => (j ? ctx.lineTo(...P(cx, base - 0.8, cz)) : ctx.moveTo(...P(cx, base - 0.8, cz)))); ctx.stroke();
        ctx.setLineDash([]);
      }
      drawBox(ctx, P, hs, base, onFire
        ? { left: rgba(k.red, 0.6), right: rgba(k.red, 0.75), top: rgba(k.amber, 0.9), edge: rgba(k.bg, 0.8) }
        : houseColors(k, false));
    });

    // Smoke plume drifting east.
    if (!flood && minutes > 1) {
      for (let s = 0; s < 14; s++) {
        const f = (s / 14 + t * 0.08) % 1;
        const dx = f * minutes * 0.9;
        const [sx, sy] = P(IGN[0] + dx, height(IGN[0], IGN[1]) + 1.5 + f * 2.5, IGN[1] + Math.sin(s * 1.7) * dx * 0.25);
        ctx.fillStyle = rgba(k.soft, 0.22 * (1 - f));
        ctx.beginPath(); ctx.arc(sx, sy, view.s * (0.6 + f * 1.8), 0, Math.PI * 2); ctx.fill();
      }
    }

    // Team route to JAR-P02.
    const blocked = (x, z) => wet(x, z) || burning(x, z);
    const path = route(blocked, TEAM, [PR_PATIENTS[1].x, PR_PATIENTS[1].z]);
    if (path) {
      ctx.strokeStyle = k.ink; ctx.lineWidth = 2.5; ctx.setLineDash([7, 5]); ctx.lineDashOffset = -t * 20;
      ctx.beginPath();
      path.forEach(([x, z], i) => { const q = P(x + 0.5, cellH(x, z) + 0.15, z + 0.5); i ? ctx.lineTo(...q) : ctx.moveTo(...q); });
      ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
    }

    // Pins: treatment area, collection point, team, patients.
    const pin = (x, z, color, text, lift = 0.9) => {
      const h = height(x, z);
      const [bx, by] = P(x, h, z), [tx, ty] = P(x, h + lift, z);
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(tx, ty, 6, 0, Math.PI * 2); ctx.fill();
      if (text) {
        ctx.font = "600 12px system-ui, sans-serif";
        const tw = ctx.measureText(text).width;
        // Flip the label to the left near the right edge so it is never clipped.
        const lx = tx + tw + 24 > view.W ? tx - tw - 16 : tx + 8;
        ctx.fillStyle = "rgba(12,11,31,0.78)"; ctx.fillRect(lx, ty - 9, tw + 8, 17);
        ctx.fillStyle = k.ink; ctx.fillText(text, lx + 4, ty + 4);
      }
    };
    const paWet = flood && height(...PA) < water;
    const bhpWet = flood && height(...BHP) < water;
    pin(BHP[0], BHP[1], bhpWet ? k.red : k.green, L(lang, T_PR.labels.bhp), 1.2);
    pin(PA[0], PA[1], paWet ? k.red : k.amber, L(lang, T_PR.labels.pa));
    pin(TEAM[0], TEAM[1], k.accent, L(lang, T_PR.labels.team));
    PR_PATIENTS.forEach((p) => {
      const color = [null, k.red, k.amber, k.green][p.cat];
      const lift = p.basement != null ? -0.4 : 0.6;
      pin(p.x, p.z, color, p.id, lift);
    });

    // Warnings, computed from the same model.
    const items = [];
    if (flood) {
      const bLevel = floodAt(houseBase(HOUSES[0]) - BASEMENT);
      const paLevel = floodAt(height(...PA));
      const bhpLevel = floodAt(height(...BHP));
      items.push([state.value >= bLevel ? "is-red" : "is-amber", fill(L(lang, T_PR.basement), { h: fmt(bLevel) })]);
      items.push([state.value >= paLevel ? "is-red" : state.value >= paLevel - 0.4 ? "is-amber" : "is-ok", fill(L(lang, T_PR.pa), { h: fmt(paLevel) })]);
      items.push([state.value >= bhpLevel ? "is-red" : "is-ok", fill(L(lang, T_PR.bhp), { h: fmt(bhpLevel) })]);
      items.push(path ? ["is-ok", fill(L(lang, T_PR.routeOk), { n: path.length })] : ["is-red", L(lang, T_PR.routeNo)]);
    } else {
      items.push([housesOnFire ? "is-red" : "is-ok", fill(L(lang, T_PR.fireFront), { n: housesOnFire })]);
      const p3 = PR_PATIENTS[2];
      items.push(inPlume(p3.x, p3.z, minutes) ? ["is-amber", L(lang, T_PR.fireP3)] : ["is-ok", L(lang, T_PR.fireP3ok)]);
      items.push(path ? ["is-ok", fill(L(lang, T_PR.routeFireOk), { n: path.length })] : ["is-red", L(lang, T_PR.routeFireNo)]);
    }
    const key = items.map((i) => i.join("|")).join("/");
    if (key !== lastWarnKey) {
      lastWarnKey = key;
      warn.replaceChildren(...items.map(([cls, text]) => el("li", { class: cls }, text)));
    }
  }

  animate(stage, (elapsed, dt, still) => {
    if (still) state.auto = false;
    frame(elapsed, still ? 0 : dt);
  });
  return root;
}

export const VISUALS = {
  "map-three-sources": renderMapThreeSources,
  "map-stitching": renderMapStitching,
  "map-prediction": renderMapPrediction,
};

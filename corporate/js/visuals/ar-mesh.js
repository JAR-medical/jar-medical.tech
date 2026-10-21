// Visuals for the "Civil protection (AR): the AR glasses mesh" course.
//   ar-scan-sequence  jacket scanner reads patient tags; fail-closed without tag
//   ar-hud-mock       AR HUD illustration that fills while the paramedic speaks
//   ar-mesh-network   headset mesh + hub: heartbeats, live triage sync, spool
// Graphics are SVG (scaled with the card); every text sits in HTML overlays
// with fixed pixel sizes so it stays readable from 375 px up. Built with
// el()/svg() only (never innerHTML). Strings are { de, en }.
import { el } from "../ui.js";
import { L, svg, injectStyle, animate, prefersReducedMotion, clamp, lerp, ease } from "./kit.js";

// Scene coordinates: every SVG uses viewBox 0 0 1000 560; HTML overlays are
// positioned in percent of that box.
const VW = 1000;
const VH = 560;
const px = (x) => `${(x / VW) * 100}%`;
const py = (y) => `${(y / VH) * 100}%`;

const TRIAGE = {
  1: { cls: "va-sk1", de: "SK I · rot", en: "T1 · red" },
  2: { cls: "va-sk2", de: "SK II · gelb", en: "T2 · yellow" },
  3: { cls: "va-sk3", de: "SK III · grün", en: "T3 · green" },
};

const CSS = `
.va-card { border: 1px solid var(--line); border-radius: var(--r-lg); background: var(--bg-raise); padding: var(--sp-5); margin: var(--sp-5) 0; }
.va-kicker { font-family: var(--font-mono); font-size: var(--t-micro); letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); margin: 0 0 var(--sp-1); }
.va-title { font-size: 1.15rem; font-weight: 600; color: var(--ink); margin: 0 0 var(--sp-1); line-height: 1.3; }
.va-sub { color: var(--ink-soft); font-size: var(--t-small); margin: 0 0 var(--sp-4); line-height: 1.5; }
.va-scene { position: relative; aspect-ratio: 1000 / 560; border-radius: var(--r-md); overflow: hidden; background: var(--bg-deep); border: 1px solid var(--line); }
.va-scene > svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.va-lbl { position: absolute; transform: translate(-50%, -50%); font-size: 12px; line-height: 1.25; color: var(--ink-soft); white-space: nowrap; pointer-events: none; font-family: var(--font-mono); }
.va-lbl.is-strong { color: var(--ink); font-weight: 600; }
.va-bar { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-top: var(--sp-3); align-items: center; }
.va-note { font-size: 12px; color: var(--ink-faint); margin: var(--sp-3) 0 0; line-height: 1.5; }
.va-split { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--sp-3); }
.va-panel-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sp-4); }
.va-panel { border: 1px solid var(--line); border-radius: var(--r-md); background: var(--bg-deep); padding: 12px 14px; min-width: 0; }
.va-panel h4 { margin: 0 0 8px; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-faint); font-weight: 500; }
.va-state { font-size: 15px; font-weight: 600; color: var(--ink); line-height: 1.3; margin: 0 0 4px; }
.va-state.is-ok { color: var(--sig-green); }
.va-state.is-warn { color: var(--sig-amber); }
.va-detail { font-size: 13px; color: var(--ink-soft); line-height: 1.45; margin: 0; }
.va-log { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.va-log li { font-size: 12px; line-height: 1.4; color: var(--ink-soft); border-left: 2px solid var(--line-strong); padding-left: 8px; }
.va-log li.is-new { border-color: var(--accent); color: var(--ink); }
.va-steps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-top: var(--sp-3); }
.va-step { border: 1px solid var(--line); border-radius: var(--r-sm); padding: 8px 10px; font-size: 12px; line-height: 1.35; color: var(--ink-faint); }
.va-step b { display: block; font-family: var(--font-mono); font-size: 11px; color: var(--accent); }
.va-step.is-on { color: var(--ink); border-color: var(--accent); background: var(--surface-tint); }
.va-chip { display: inline-block; padding: 2px 8px; border-radius: var(--r-pill); font-size: 12px; font-weight: 600; border: 1px solid currentColor; }
.va-sk1 { color: var(--sig-red); }
.va-sk2 { color: var(--sig-amber); }
.va-sk3 { color: var(--sig-green); }
.va-data { color: var(--brand-mint); }
.va-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--sp-2); margin-top: var(--sp-3); }
.va-stat { border: 1px solid var(--line); border-radius: var(--r-md); padding: 10px 12px; background: var(--bg-deep); min-width: 0; }
.va-stat b { display: block; font-family: var(--font-mono); font-size: 1.05rem; color: var(--ink); }
.va-stat span { display: block; font-size: 12px; color: var(--ink-soft); line-height: 1.35; margin-top: 2px; }
@media (max-width: 560px) {
  .va-card { padding: var(--sp-4); }
  .va-panel-row { grid-template-columns: 1fr; }
  .va-lbl { font-size: 10px; }
  .va-lbl.is-hide-narrow { display: none; }
  .va-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;

function card(lang, kicker, title, sub) {
  injectStyle("va-styles", CSS);
  return el("figure", { class: "va-card" },
    el("p", { class: "va-kicker" }, L(lang, kicker)),
    el("h3", { class: "va-title" }, L(lang, title)),
    sub ? el("p", { class: "va-sub" }, L(lang, sub)) : null);
}

function button(label, onclick) {
  return el("button", { class: "btn btn-outline btn-small", type: "button", onclick }, label);
}

function label(x, y, text, extra = "") {
  return el("span", { class: "va-lbl " + extra, style: `left:${px(x)};top:${py(y)}` }, text);
}

const PAUSE = { de: "Pause", en: "Pause" };
const PLAY = { de: "Abspielen", en: "Play" };

// A playing/paused toggle bound to a state object { playing }.
function playToggle(lang, state) {
  const btn = button(L(lang, state.playing ? PAUSE : PLAY), () => {
    state.playing = !state.playing;
    btn.textContent = L(lang, state.playing ? PAUSE : PLAY);
  });
  return btn;
}

// Lying patient seen from above: head + body capsule, rotated by `angle`.
function patientShape(x, y, angle, scale = 1.6) {
  return svg("g", { transform: `translate(${x} ${y}) rotate(${angle}) scale(${scale})` },
    svg("rect", { x: -42, y: -15, width: 70, height: 30, rx: 15, fill: "var(--bg-raise-2)", stroke: "var(--line-strong)", "stroke-width": 2 }),
    svg("circle", { cx: 40, cy: 0, r: 13, fill: "var(--bg-raise-2)", stroke: "var(--line-strong)", "stroke-width": 2 }));
}

// ---------------------------------------------------------------------------
// 1 · Jacket scanner → patient record
const T_SCAN = {
  kicker: { de: "Patienten-ID per Jacken-Scanner", en: "Patient ID via jacket scanner" },
  title: { de: "Hingehen, Tag lesen, sprechen", en: "Walk up, read the tag, speak" },
  sub: {
    de: "Jeder Patient trägt einen passiven RFID/NFC-Tag an der Sichtungskarte. Der kleine Scanner an der Jacke liest ihn beim Herantreten; erst dann öffnet die Brille genau diese Akte.",
    en: "Every patient wears a passive RFID/NFC tag on the triage card. The small scanner on the jacket reads it as the paramedic steps up; only then do the glasses open exactly that record.",
  },
  hud: { de: "AR-Brille (HUD)", en: "AR glasses (HUD)" },
  idle: { de: "Suche Patienten-Tag …", en: "Looking for a patient tag …" },
  idleD: { de: "Keine Akte geöffnet.", en: "No record open." },
  locked: { de: "Akte {id} geöffnet", en: "Record {id} open" },
  lockedD: { de: "Tag gelesen (ca. 180 Byte, ohne Batterie). Alles Gesagte landet nur in dieser Akte.", en: "Tag read (about 180 bytes, no battery). Everything said goes into this record only." },
  saved: { de: "{id}: {cat} gespeichert", en: "{id}: {cat} saved" },
  fail: { de: "Kein Tag erkannt: keine Akte", en: "No tag detected: no record" },
  failD: { de: "Fail-closed: J.A.R. rät nie, welcher Patient gemeint ist. Erst Sichtungskarte mit Tag anbringen.", en: "Fail-closed: J.A.R. never guesses which patient is meant. Attach a triage card with tag first." },
  noTag: { de: "ohne Tag", en: "no tag" },
  you: { de: "Einsatzkraft · Scanner an der Jacke", en: "Paramedic · scanner on jacket" },
  steps: [
    { de: "Herantreten, Scanner sucht", en: "Step up, scanner searches" },
    { de: "Tag gelesen → Akte fest zugeordnet", en: "Tag read → record locked" },
    { de: "Sprechen → in dieser Akte gespeichert", en: "Speak → saved to this record" },
  ],
  speech: [
    { de: "„Atemfrequenz 24, Radialispuls tastbar.“", en: "“Respiratory rate 24, radial pulse present.”" },
    { de: "„Kein Radialispuls, starke Blutung.“", en: "“No radial pulse, heavy bleeding.”" },
    { de: "„Gehfähig, Schürfwunden.“", en: "“Walking, abrasions only.”" },
  ],
  note: { de: "Schematische Darstellung. Heute RFID/NFC; künftig sollen die Brillen optische ArUco-Marker direkt lesen.", en: "Schematic illustration. RFID/NFC today; later the glasses are meant to read optical ArUco markers directly." },
  aria: {
    de: "Animation: Eine Einsatzkraft geht von Patient zu Patient; der Jacken-Scanner liest die Tags und öffnet die passende Akte; beim Patienten ohne Tag wird keine Akte geöffnet.",
    en: "Animation: a paramedic walks from patient to patient; the jacket scanner reads the tags and opens the matching record; for the patient without a tag no record is opened.",
  },
};

const SCAN_PATIENTS = [
  { id: "JAR-P01", x: 230, y: 170, a: -12, tag: true, cat: 2, speech: 0, stand: [300, 245] },
  { id: "JAR-P02", x: 470, y: 400, a: 20, tag: true, cat: 1, speech: 1, stand: [540, 320] },
  { id: "JAR-P03", x: 700, y: 150, a: 8, tag: false, stand: [640, 230] },
  { id: "JAR-P04", x: 840, y: 410, a: -25, tag: true, cat: 3, speech: 2, stand: [770, 340] },
];

// Builds the loop timeline: walk → scan → lock → speak (or fail) per patient.
function scanTimeline() {
  const segs = [];
  let at = [90, 480];
  let t = 0;
  const push = (seg) => { segs.push({ ...seg, t0: t, t1: t + seg.dur }); t += seg.dur; };
  SCAN_PATIENTS.forEach((p, i) => {
    push({ kind: "walk", from: at, to: p.stand, dur: 1.8 });
    at = p.stand;
    if (p.tag) {
      push({ kind: "scan", p: i, dur: 0.9 });
      push({ kind: "lock", p: i, dur: 1.2 });
      push({ kind: "speak", p: i, dur: 2.4 });
    } else {
      push({ kind: "scan", p: i, dur: 1.4 });
      push({ kind: "fail", p: i, dur: 2.2 });
    }
  });
  push({ kind: "walk", from: at, to: [90, 480], dur: 1.8 });
  push({ kind: "rest", dur: 0.8 });
  return { segs, total: t };
}

function renderArScanSequence(block, lang) {
  const root = card(lang, T_SCAN.kicker, T_SCAN.title, T_SCAN.sub);
  const { segs, total } = scanTimeline();
  const state = { playing: !prefersReducedMotion(), time: 0 };

  const grid = [];
  for (let x = 50; x < VW; x += 50) grid.push(svg("line", { x1: x, y1: 0, x2: x, y2: VH, stroke: "var(--line)", "stroke-width": 1 }));
  for (let y = 40; y < VH; y += 50) grid.push(svg("line", { x1: 0, y1: y, x2: VW, y2: y, stroke: "var(--line)", "stroke-width": 1 }));

  const rings = [], tags = [];
  const patients = SCAN_PATIENTS.map((p, i) => {
    const ring = svg("circle", { cx: p.x, cy: p.y, r: 84, fill: "none", stroke: "currentColor", "stroke-width": 6, class: p.cat ? TRIAGE[p.cat].cls : "", opacity: 0 });
    rings.push(ring);
    const tag = p.tag
      ? svg("rect", { x: p.x - 9, y: p.y - 9, width: 18, height: 18, rx: 3, fill: "var(--brand-mint)", opacity: 0.85 })
      : svg("rect", { x: p.x - 9, y: p.y - 9, width: 18, height: 18, rx: 3, fill: "none", stroke: "var(--sig-amber)", "stroke-dasharray": "4 3", "stroke-width": 2 });
    tags.push(tag);
    return svg("g", {}, patientShape(p.x, p.y, p.a), ring, tag);
  });
  const range = svg("circle", { r: 40, fill: "var(--brand-mint)", "fill-opacity": 0.08, stroke: "var(--brand-mint)", "stroke-width": 2 });
  const link = svg("line", { stroke: "var(--brand-mint)", "stroke-width": 3, "stroke-dasharray": "8 6", opacity: 0 });
  const medic = svg("g", {},
    svg("circle", { r: 20, fill: "var(--accent)" }),
    svg("rect", { x: -14, y: -6, width: 28, height: 8, rx: 4, fill: "var(--bg-deep)" }),
    svg("circle", { cx: 12, cy: 12, r: 6, fill: "var(--brand-mint)", stroke: "var(--bg-deep)", "stroke-width": 2 }));
  const scene = svg("svg", { viewBox: `0 0 ${VW} ${VH}`, "aria-hidden": "true" }, grid, patients, link, range, medic);

  const labels = SCAN_PATIENTS.map((p) => label(p.x, p.y + 78, p.tag ? p.id : `${p.id} · ${L(lang, T_SCAN.noTag)}`, "is-strong"));
  const youLbl = label(200, 530, L(lang, T_SCAN.you), "is-hide-narrow");
  const bubble = el("span", { class: "va-lbl is-strong", style: "opacity:0;white-space:normal;width:86%;text-align:center;left:50%;top:7%;font-size:14px;font-family:var(--font-sans)" });
  const stage = el("div", { class: "va-scene", role: "img", "aria-label": L(lang, T_SCAN.aria) }, scene, labels, youLbl, bubble);

  const stateEl = el("p", { class: "va-state" });
  const detailEl = el("p", { class: "va-detail" });
  const log = el("ul", { class: "va-log" });
  const panel = el("div", { class: "va-panel va-panel-row", "aria-live": "polite" },
    el("div", {}, el("h4", {}, L(lang, T_SCAN.hud)), stateEl, detailEl), log);
  const stepEls = T_SCAN.steps.map((s, i) => el("div", { class: "va-step" }, el("b", {}, String(i + 1)), L(lang, s)));

  root.append(el("div", { class: "va-split" }, stage, panel),
    el("div", { class: "va-steps" }, stepEls),
    el("div", { class: "va-bar" }, playToggle(lang, state)),
    el("p", { class: "va-note" }, L(lang, T_SCAN.note)));

  const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
  let lastKey = "";
  const logged = new Set();
  function addLog(key, text) {
    if (logged.has(key)) return;
    logged.add(key);
    log.querySelectorAll("li").forEach((li) => li.classList.remove("is-new"));
    log.prepend(el("li", { class: "is-new" }, text));
    while (log.children.length > 4) log.lastChild.remove();
  }

  function frame(t) {
    const seg = segs.find((s) => t >= s.t0 && t < s.t1) || segs[segs.length - 1];
    const u = clamp((t - seg.t0) / seg.dur, 0, 1);
    if (t < 0.05 && logged.size) { logged.clear(); log.replaceChildren(); }
    // Paramedic position.
    let pos = seg.kind === "walk" ? [lerp(seg.from[0], seg.to[0], ease(u)), lerp(seg.from[1], seg.to[1], ease(u))] : null;
    if (!pos) pos = SCAN_PATIENTS[seg.p]?.stand ?? [90, 480];
    medic.setAttribute("transform", `translate(${pos[0]} ${pos[1]})`);
    range.setAttribute("cx", pos[0]);
    range.setAttribute("cy", pos[1]);
    const pulse = (t * 1.4) % 1;
    range.setAttribute("r", seg.kind === "scan" ? 30 + 110 * pulse : 34);
    range.setAttribute("stroke-opacity", seg.kind === "scan" ? 1 - pulse : 0.5);

    // Triage rings: assigned once their "speak" segment is reached.
    SCAN_PATIENTS.forEach((p, i) => {
      const done = segs.some((s) => s.kind === "speak" && s.p === i && t >= s.t0 + s.dur * 0.6);
      rings[i].setAttribute("opacity", done ? 1 : 0);
      const active = seg.p === i && (seg.kind === "lock" || seg.kind === "speak");
      tags[i].setAttribute("opacity", active ? 0.5 + 0.5 * Math.sin(t * 10) ** 2 : p.tag ? 0.85 : 1);
    });

    const p = SCAN_PATIENTS[seg.p];
    const showLink = p && (seg.kind === "lock" || seg.kind === "speak");
    link.setAttribute("opacity", showLink ? 1 : 0);
    if (p) { link.setAttribute("x1", pos[0]); link.setAttribute("y1", pos[1]); link.setAttribute("x2", p.x); link.setAttribute("y2", p.y); }

    // Speech bubble above the paramedic.
    if (seg.kind === "speak") {
      bubble.textContent = L(lang, T_SCAN.speech[p.speech]);
      bubble.style.opacity = String(clamp(u * 4, 0, 1));
    } else bubble.style.opacity = "0";

    // HUD panel + steps.
    let key = "idle", step = 0;
    if (seg.kind === "scan") { key = "scan" + seg.p; step = 0; }
    if (seg.kind === "lock") { key = "lock" + seg.p; step = 1; }
    if (seg.kind === "speak") { key = "speak" + seg.p; step = 2; }
    if (seg.kind === "fail") { key = "fail" + seg.p; step = 0; }
    stepEls.forEach((s, i) => s.classList.toggle("is-on", seg.kind !== "walk" && seg.kind !== "rest" && seg.kind !== "fail" && i === step));
    if (key !== lastKey) {
      lastKey = key;
      stateEl.className = "va-state";
      if (seg.kind === "lock" || seg.kind === "speak") {
        stateEl.classList.add("is-ok");
        stateEl.textContent = fill(L(lang, T_SCAN.locked), { id: p.id });
        detailEl.textContent = L(lang, T_SCAN.lockedD);
        if (seg.kind === "lock") addLog(key, fill(L(lang, T_SCAN.locked), { id: p.id }));
      } else if (seg.kind === "fail") {
        stateEl.classList.add("is-warn");
        stateEl.textContent = L(lang, T_SCAN.fail);
        detailEl.textContent = L(lang, T_SCAN.failD);
        addLog(key, `${p.id}: ${L(lang, T_SCAN.fail)}`);
      } else {
        stateEl.textContent = L(lang, T_SCAN.idle);
        detailEl.textContent = L(lang, T_SCAN.idleD);
      }
    }
    if (seg.kind === "speak" && u > 0.6) addLog("saved" + seg.p, fill(L(lang, T_SCAN.saved), { id: p.id, cat: L(lang, TRIAGE[p.cat]) }));
  }

  animate(stage, (elapsed, dt, still) => {
    if (still) {
      // Static end state: every tagged patient triaged, P03 refused.
      state.time = total - 0.9;
      SCAN_PATIENTS.forEach((p, i) => { if (p.tag) addLog("saved" + i, fill(L(lang, T_SCAN.saved), { id: p.id, cat: L(lang, TRIAGE[p.cat]) })); else addLog("fail" + i, `${p.id}: ${L(lang, T_SCAN.fail)}`); });
    } else if (state.playing) state.time = (state.time + dt) % total;
    frame(state.time);
  });
  return root;
}

// ---------------------------------------------------------------------------
// 2 · AR HUD: speaking fills the record
const T_HUD = {
  kicker: { de: "AR-Ansicht · Illustration", en: "AR view · illustration" },
  title: { de: "Sprechen statt schreiben", en: "Speak instead of write" },
  sub: {
    de: "So sieht die Einsatzkraft den Patienten durch die Brille: Jeder Satz wird transkribiert, als Befund mit Zitatbeleg erkannt und sofort eingeblendet. Beide Hände bleiben am Patienten. In der echten AR-Brille wirkt das HUD noch deutlich nahtloser: Die Einblendungen schweben räumlich im Blickfeld und bleiben am Patienten verankert, statt flach auf einem Bild zu liegen.",
    en: "This is what the paramedic sees through the glasses: every sentence is transcribed, recognised as a finding backed by a quote and shown at once. Both hands stay on the patient. In the real AR glasses the HUD is far more seamless: the overlays float in the field of view and stay anchored to the patient instead of sitting flat on an image.",
  },
  mesh: { de: "Mesh · synchron", en: "Mesh · synced" },
  rec: { de: "Spracheingabe", en: "Voice input" },
  body: { de: "13-Regionen-Körpermodell", en: "13-region body model" },
  quote: { de: "Zitat belegt", en: "quote verified" },
  fields: {
    id: { de: "Patient", en: "Patient" },
    b: { de: "Atmung (B)", en: "Breathing (B)" },
    c: { de: "Kreislauf (C)", en: "Circulation (C)" },
    m: { de: "Maßnahmen", en: "Measures" },
    a: { de: "Allergien", en: "Allergies" },
  },
  script: [
    { say: { de: "Patient JAR-P07, männlich, etwa vierzig.", en: "Patient JAR-P07, male, about forty." }, field: "id", value: { de: "JAR-P07 · m · ca. 40", en: "JAR-P07 · m · approx. 40" } },
    { say: { de: "Atemfrequenz 32, angestrengt.", en: "Respiratory rate 32, laboured." }, field: "b", value: { de: "32/min · angestrengt", en: "32/min · laboured" } },
    { say: { de: "Radialispuls 124, schwach.", en: "Radial pulse 124, weak." }, field: "c", value: { de: "124/min · schwach", en: "124/min · weak" } },
    { say: { de: "Starke Blutung linker Oberschenkel, Tourniquet angelegt.", en: "Heavy bleeding left thigh, tourniquet applied." }, field: "m", value: { de: "Tourniquet li. Oberschenkel", en: "Tourniquet left thigh" }, region: "lThigh" },
    { say: { de: "Keine Allergien bekannt.", en: "No known allergies." }, field: "a", value: { de: "keine · verneint", en: "none · negated" } },
    { say: { de: "Sichtung rot.", en: "Triage red." }, triage: 1 },
  ],
  aria: {
    de: "Illustration der AR-Ansicht: Während die Einsatzkraft spricht, füllen sich Patienten-ID, Atmung, Kreislauf, Maßnahmen, Allergien, Körpermodell und Sichtungskategorie.",
    en: "Illustration of the AR view: as the paramedic speaks, patient ID, breathing, circulation, measures, allergies, body model and triage category fill in.",
  },
};

const HUD_CSS = `
.va-hud { position: relative; border-radius: var(--r-md); overflow: hidden; border: 1px solid var(--line); background: var(--bg-deep); }
.va-hud > svg.va-hud-bg { position: absolute; inset: 0; width: 100%; height: 100%; }
.va-hud-grid { position: relative; display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.8fr) minmax(0, 0.75fr); grid-template-rows: auto 1fr auto; gap: 10px; padding: 12px; min-height: 380px; }
.va-hud-box { background: rgba(10, 20, 24, 0.62); border: 1px solid rgba(142, 199, 184, 0.55); border-radius: 10px; padding: 10px 12px; color: #e8f6f1; backdrop-filter: blur(2px); min-width: 0; }
.va-hud-top { grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
.va-hud-id { font-family: var(--font-mono); font-size: 14px; font-weight: 600; }
.va-hud-mesh { font-family: var(--font-mono); font-size: 12px; color: #9fe3cf; }
.va-hud-fields { grid-column: 1; display: grid; gap: 8px; align-content: start; }
.va-hud-field { display: grid; gap: 1px; }
.va-hud-field span { font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: #9fb8b1; font-family: var(--font-mono); }
.va-hud-field b { font-size: 14px; font-weight: 600; color: #ffffff; min-height: 1.3em; transition: color 0.3s; }
.va-hud-field b.is-empty { color: #5d7a73; font-weight: 400; }
.va-hud-field.is-flash b { color: #9fe3cf; }
.va-hud-field i { font-style: normal; font-size: 11px; color: #9fe3cf; }
.va-hud-body { grid-column: 3; grid-row: 2; display: grid; justify-items: center; align-content: start; gap: 4px; }
.va-hud-body svg { width: 100%; max-width: 110px; height: auto; }
.va-hud-body span { font-size: 11px; color: #9fb8b1; text-align: center; font-family: var(--font-mono); }
.va-hud-say { grid-column: 1 / -1; display: flex; gap: 10px; align-items: center; font-size: 14px; }
.va-hud-mic { flex: none; width: 10px; height: 10px; border-radius: 50%; background: var(--sig-red); box-shadow: 0 0 0 0 rgba(240, 119, 110, 0.6); animation: va-mic 1.2s infinite; }
@keyframes va-mic { 70% { box-shadow: 0 0 0 8px rgba(240, 119, 110, 0); } 100% { box-shadow: 0 0 0 0 rgba(240, 119, 110, 0); } }
.va-hud-say small { display: block; font-size: 11px; color: #9fb8b1; font-family: var(--font-mono); }
.va-hud-chip { font-size: 13px; font-weight: 700; padding: 3px 10px; border-radius: var(--r-pill); border: 2px solid currentColor; }
.va-hud-chip.is-empty { color: #5d7a73; font-weight: 400; border-style: dashed; }
@media (max-width: 560px) {
  .va-hud-grid { grid-template-columns: minmax(0, 1.4fr) minmax(0, 0.8fr); min-height: 0; }
  .va-hud-body { grid-column: 2; }
  .va-hud-field b { font-size: 13px; }
  .va-hud-mic { animation: none; }
}
@media (prefers-reduced-motion: reduce) { .va-hud-mic { animation: none; } }
`;

// 13 regions: head, neck, chest, abdomen, pelvis, arms (upper/fore ×2), legs (thigh/lower ×2).
// Front view: the patient's left side is on the viewer's right.
const BODY_REGIONS = {
  head: ["ellipse", { cx: 50, cy: 16, rx: 12, ry: 14 }],
  neck: ["rect", { x: 45, y: 30, width: 10, height: 8, rx: 2 }],
  chest: ["rect", { x: 32, y: 39, width: 36, height: 30, rx: 6 }],
  abdomen: ["rect", { x: 34, y: 70, width: 32, height: 22, rx: 5 }],
  pelvis: ["rect", { x: 33, y: 93, width: 34, height: 16, rx: 6 }],
  rUpperArm: ["rect", { x: 18, y: 40, width: 12, height: 30, rx: 5 }],
  lUpperArm: ["rect", { x: 70, y: 40, width: 12, height: 30, rx: 5 }],
  rForearm: ["rect", { x: 14, y: 72, width: 12, height: 32, rx: 5 }],
  lForearm: ["rect", { x: 74, y: 72, width: 12, height: 32, rx: 5 }],
  rThigh: ["rect", { x: 34, y: 111, width: 14, height: 40, rx: 6 }],
  lThigh: ["rect", { x: 52, y: 111, width: 14, height: 40, rx: 6 }],
  rLowerLeg: ["rect", { x: 35, y: 153, width: 12, height: 42, rx: 5 }],
  lLowerLeg: ["rect", { x: 53, y: 153, width: 12, height: 42, rx: 5 }],
};

function renderArHudMock(block, lang) {
  injectStyle("va-hud-styles", HUD_CSS);
  const root = card(lang, T_HUD.kicker, T_HUD.title, T_HUD.sub);
  const state = { playing: !prefersReducedMotion(), time: 0 };
  const STEP = 3.2;
  const total = T_HUD.script.length * STEP + 3;

  // Background: the patient on the ground, seen through the visor.
  const rubble = [[60, 420, 180, 470], [760, 90, 930, 140], [820, 430, 980, 500], [40, 60, 160, 110]].map(([x1, y1, x2, y2]) =>
    svg("polygon", { points: `${x1},${y2} ${(x1 + x2) / 2},${y1} ${x2},${y2}`, fill: "var(--bg-raise-2)", opacity: 0.7 }));
  const bg = svg("svg", { class: "va-hud-bg", viewBox: `0 0 ${VW} ${VH}`, preserveAspectRatio: "xMidYMid slice", "aria-hidden": "true" },
    svg("rect", { width: VW, height: VH, fill: "var(--bg-deep)" }),
    rubble,
    svg("g", { transform: "translate(560 300) scale(2.6)" }, patientShape(0, 0, -8, 1)),
    svg("circle", { cx: 560, cy: 300, r: 150, fill: "none", stroke: "rgba(142,199,184,0.5)", "stroke-width": 2, "stroke-dasharray": "10 8" }));

  const fieldEls = {};
  const fields = Object.entries(T_HUD.fields).filter(([k]) => k !== "id").map(([k, lbl]) => {
    const value = el("b", { class: "is-empty" }, "—");
    const quote = el("i", { hidden: true }, "✓ " + L(lang, T_HUD.quote));
    const node = el("div", { class: "va-hud-field" }, el("span", {}, L(lang, lbl)), value, quote);
    fieldEls[k] = { node, value, quote };
    return node;
  });
  const idEl = el("span", { class: "va-hud-id" }, "JAR-P07");
  const chip = el("span", { class: "va-hud-chip is-empty" }, L(lang, { de: "Sichtung offen", en: "Triage pending" }));
  const regions = {};
  const body = svg("svg", { viewBox: "0 0 100 200", "aria-hidden": "true" },
    Object.entries(BODY_REGIONS).map(([k, [tag, attrs]]) => (regions[k] = svg(tag, { ...attrs, fill: "rgba(142,199,184,0.18)", stroke: "rgba(142,199,184,0.7)", "stroke-width": 1.2 }))));
  const sayText = el("span", {});
  const hud = el("div", { class: "va-hud", role: "img", "aria-label": L(lang, T_HUD.aria) }, bg,
    el("div", { class: "va-hud-grid" },
      el("div", { class: "va-hud-box va-hud-top" }, idEl, chip, el("span", { class: "va-hud-mesh" }, "◉ " + L(lang, T_HUD.mesh))),
      el("div", { class: "va-hud-box va-hud-fields" }, fields),
      el("div", { class: "va-hud-box va-hud-body" }, body, el("span", {}, L(lang, T_HUD.body))),
      el("div", { class: "va-hud-box va-hud-say" }, el("span", { class: "va-hud-mic" }),
        el("div", {}, el("small", {}, L(lang, T_HUD.rec)), sayText))));

  root.append(hud, el("div", { class: "va-bar" }, playToggle(lang, state)));

  function frame(t) {
    const idx = Math.min(T_HUD.script.length - 1, Math.floor(t / STEP));
    const u = (t - idx * STEP) / STEP;
    const line = L(lang, T_HUD.script[idx].say);
    // Typing effect for the current utterance, finished at 55 % of the step.
    sayText.textContent = t >= T_HUD.script.length * STEP ? line : line.slice(0, Math.ceil(line.length * clamp(u / 0.55, 0, 1)));
    T_HUD.script.forEach((s, i) => {
      const done = t >= i * STEP + STEP * 0.6;
      const flash = done && t < i * STEP + STEP * 0.95;
      if (s.field && s.field !== "id") {
        const f = fieldEls[s.field];
        f.value.textContent = done ? L(lang, s.value) : "—";
        f.value.classList.toggle("is-empty", !done);
        f.quote.hidden = !done;
        f.node.classList.toggle("is-flash", flash);
      }
      if (s.field === "id") idEl.textContent = done ? L(lang, s.value) : "JAR-P07";
      if (s.region) regions[s.region].setAttribute("fill", done ? "var(--sig-red)" : "rgba(142,199,184,0.18)");
      if (s.triage) {
        chip.className = "va-hud-chip " + (done ? TRIAGE[s.triage].cls : "is-empty");
        chip.textContent = done ? L(lang, TRIAGE[s.triage]) : L(lang, { de: "Sichtung offen", en: "Triage pending" });
      }
    });
  }

  animate(hud, (elapsed, dt, still) => {
    if (still) state.time = total - 0.1;
    else if (state.playing) state.time = (state.time + dt) % total;
    frame(state.time);
  });
  return root;
}

// ---------------------------------------------------------------------------
// 3 · Mesh network: heartbeats, live triage sync, offline spool
const T_MESH = {
  kicker: { de: "Lokales Mesh · ohne Mobilfunk", en: "Local mesh · no mobile network" },
  title: { de: "Eine Änderung, sofort auf allen Brillen", en: "One change, instantly on every headset" },
  sub: {
    de: "Brillen und tragbare Recheneinheiten verbinden sich untereinander und mit dem Hub im Einsatzleitfahrzeug. Über dieses Mesh laufen auch alle erfassten Daten: Transkripte, Befunde und Vitalwerte wandern von Brille zu Brille bis zum Hub. Ändert ein Trupp eine Sichtung, sehen es alle anderen Trupps und die Einsatzleitung live.",
    en: "Headsets and wearable compute units link to each other and to the hub in the command vehicle. All collected data travels over this mesh too: transcripts, findings and vitals hop from headset to headset to the hub. When one team changes a triage category, every other team and incident command see it live.",
  },
  hub: { de: "Hub · Einsatzleitfahrzeug", en: "Hub · command vehicle" },
  cut: { de: "Funkverbindung trennen", en: "Cut radio link" },
  restore: { de: "Verbindung wiederherstellen", en: "Restore link" },
  dash: { de: "Dashboard der Einsatzleitung", en: "Incident command dashboard" },
  spool: { de: "Offline-Spool (Brillen ohne Hub-Verbindung)", en: "Offline spool (headsets without hub link)" },
  spoolIdle: { de: "Alle Brillen verbunden, Spool leer.", en: "All headsets connected, spool empty." },
  spoolFill: { de: "{n} Transkript-Segmente gepuffert · 0 verworfen", en: "{n} transcript segments buffered · 0 dropped" },
  spoolDrain: { de: "Verbindung zurück: {n} Segmente werden nachgesendet", en: "Link restored: sending {n} buffered segments" },
  updateRow: { de: "{id} · von Brille {h}", en: "{id} · from headset {h}" },
  dataRow: { de: "{id} · {what} · von Brille {h}", en: "{id} · {what} · from headset {h}" },
  dataChip: { de: "Daten", en: "Data" },
  legend: [
    { de: "Heartbeat", en: "Heartbeat", kind: "beat" },
    { de: "Daten: Transkript, Befund, Vitalwerte", en: "Data: transcript, finding, vitals", kind: "data" },
    { de: "Sichtungs-Update an alle", en: "Triage update to all", kind: "triage" },
  ],
  stats: [
    { v: "UDP 45454", de: "Hub-Beacon alle 2 s, Brillen finden den Hub selbst", en: "hub beacon every 2 s, headsets find the hub themselves" },
    { v: "5 s", de: "Heartbeat: Akku, CPU, Temperatur, Tracking, ASR-Modell, Spool", en: "heartbeat: battery, CPU, temperature, tracking, ASR model, spool" },
    { v: "≤ 20", de: "Brillen pro Hub im Einsatzabschnitt", en: "headsets per hub in a sector" },
    { v: "100.000", vEn: "100,000", de: "Transkript-Segmente Spool (+ 2 GiB Raumgeometrie); Transkripte werden nie verworfen", en: "transcript segments in the spool (+ 2 GiB room geometry); transcripts are never dropped" },
  ],
  aria: {
    de: "Animation eines Mesh-Netzes aus AR-Brillen und Hub: Heartbeats und erfasste Daten laufen über die Brillen zum Hub, ein Sichtungs-Update verbreitet sich an alle Brillen; bei getrennter Verbindung bleiben die Daten im Offline-Spool.",
    en: "Animation of a mesh of AR headsets and a hub: heartbeats and collected data hop via the headsets to the hub, a triage update spreads to every headset; when the link is cut, the data waits in the offline spool.",
  },
};

const MESH_NODES = [
  [140, 110], [300, 70], [470, 120], [640, 80], [820, 120],
  [210, 250], [390, 230], [570, 250], [760, 260], [900, 330],
  [120, 380], [320, 380],
];
const HUB = [560, 440];
const CUT_X = 680; // headsets right of this line lose their link while "cut"
// Data records sent to the hub in turn: [headset index, patient, what].
const DATA = [
  [3, "JAR-P07", { de: "AF 32/min", en: "RR 32/min" }],
  [1, "JAR-P11", { de: "Tourniquet li. Oberschenkel", en: "Tourniquet left thigh" }],
  [8, "JAR-P03", { de: "Radialispuls 124", en: "Radial pulse 124" }],
  [5, "JAR-P05", { de: "Allergien: keine (verneint)", en: "Allergies: none (negated)" }],
  [10, "JAR-P08", { de: "gehfähig", en: "walking" }],
  [9, "JAR-P02", { de: "SpO₂ 89 %", en: "SpO₂ 89 %" }],
];
const DATA_EVERY = 2.3; // s between records
const DATA_TRAVEL = 1.6; // s from headset to hub
const UPDATES = [
  { id: "JAR-P03", cat: 1, from: 6 },
  { id: "JAR-P11", cat: 2, from: 1 },
  { id: "JAR-P08", cat: 3, from: 11 },
];

function renderArMeshNetwork(block, lang) {
  const root = card(lang, T_MESH.kicker, T_MESH.title, T_MESH.sub);
  const state = { playing: !prefersReducedMotion(), time: 0, cut: false, spool: 0, draining: 0 };
  const pts = [...MESH_NODES, HUB];
  const H = pts.length - 1;
  const d2 = (a, b) => Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]);
  const edges = [];
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) if (d2(i, j) < (j === H || i === H ? 300 : 230)) edges.push([i, j]);
  const isCut = (i) => i !== H && pts[i][0] > CUT_X;
  const edgeUp = ([a, b]) => !state.cut || isCut(a) === isCut(b);

  // Breadth-first hop distances / parents from a source over live edges.
  function bfs(src) {
    const dist = new Array(pts.length).fill(Infinity), parent = new Array(pts.length).fill(-1);
    dist[src] = 0;
    const q = [src];
    while (q.length) {
      const v = q.shift();
      for (const e of edges) {
        if (!edgeUp(e)) continue;
        const w = e[0] === v ? e[1] : e[1] === v ? e[0] : -1;
        if (w >= 0 && dist[w] === Infinity) { dist[w] = dist[v] + 1; parent[w] = v; q.push(w); }
      }
    }
    return { dist, parent };
  }

  const edgeEls = edges.map(([a, b]) => svg("line", { x1: pts[a][0], y1: pts[a][1], x2: pts[b][0], y2: pts[b][1], stroke: "var(--line-strong)", "stroke-width": 2 }));
  const nodeEls = MESH_NODES.map(([x, y]) => svg("circle", { cx: x, cy: y, r: 16, fill: "var(--bg-raise-2)", stroke: "var(--brand-mint)", "stroke-width": 3 }));
  const beacon = svg("circle", { cx: HUB[0], cy: HUB[1], r: 30, fill: "none", stroke: "var(--brand-mint)", "stroke-width": 2 });
  const hubEl = svg("rect", { x: HUB[0] - 34, y: HUB[1] - 22, width: 68, height: 44, rx: 8, fill: "var(--accent)" });
  const cutLine = svg("line", { x1: CUT_X, y1: 20, x2: CUT_X, y2: 540, stroke: "var(--sig-red)", "stroke-width": 3, "stroke-dasharray": "12 10", opacity: 0 });
  const packetLayer = svg("g", {});
  const scene = svg("svg", { viewBox: `0 0 ${VW} ${VH}`, "aria-hidden": "true" }, edgeEls, cutLine, beacon, nodeEls, hubEl, packetLayer);
  const nodeLabels = MESH_NODES.map(([x, y], i) => label(x, y, String(i + 1).padStart(2, "0"), "is-strong"));
  const stage = el("div", { class: "va-scene", role: "img", "aria-label": L(lang, T_MESH.aria) }, scene, nodeLabels,
    label(HUB[0], HUB[1] + 46, L(lang, T_MESH.hub), "is-strong"));

  const dashList = el("ul", { class: "va-log" });
  const spoolEl = el("p", { class: "va-detail" }, L(lang, T_MESH.spoolIdle));
  const panel = el("div", { class: "va-panel va-panel-row", "aria-live": "polite" },
    el("div", {}, el("h4", {}, L(lang, T_MESH.dash)), dashList),
    el("div", {}, el("h4", {}, L(lang, T_MESH.spool)), spoolEl));
  const cutBtn = button(L(lang, T_MESH.cut), () => {
    state.cut = !state.cut;
    cutBtn.textContent = L(lang, state.cut ? T_MESH.restore : T_MESH.cut);
    if (!state.cut && state.spool > 0) { state.draining = state.spool; drainStart = state.time; }
  });
  const stats = el("div", { class: "va-stats" }, T_MESH.stats.map((s) =>
    el("div", { class: "va-stat" }, el("b", {}, lang === "en" && s.vEn ? s.vEn : s.v), el("span", {}, L(lang, s)))));
  const legendMark = (kind) => kind === "data"
    ? el("span", { "aria-hidden": "true", style: "display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--brand-mint);margin-right:6px" })
    : el("span", { "aria-hidden": "true", style: `display:inline-block;width:10px;height:10px;border-radius:50%;background:${kind === "beat" ? "var(--ink-soft)" : "var(--sig-red)"};margin-right:6px` });
  const legend = el("p", { class: "va-note", style: "margin-top:var(--sp-2);display:flex;flex-wrap:wrap;gap:6px 18px" },
    T_MESH.legend.map((l) => el("span", {}, legendMark(l.kind), L(lang, l))));
  root.append(el("div", { class: "va-split" }, el("div", {}, stage, legend), panel), el("div", { class: "va-bar" }, playToggle(lang, state), cutBtn), stats);

  const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
  let drainStart = 0;
  let lastUpdate = -1;
  let lastData = -1;
  let lastSpoolTick = 0;

  function dot(x, y, color, r = 7) {
    packetLayer.append(svg("circle", { cx: x, cy: y, r, fill: color }));
  }
  function square(x, y, opacity = 1) {
    packetLayer.append(svg("rect", { x: x - 7, y: y - 7, width: 14, height: 14, rx: 2, fill: "var(--brand-mint)", stroke: "var(--bg-deep)", "stroke-width": 2, opacity }));
  }
  function logRow(chipClass, chipText, text) {
    dashList.querySelectorAll("li").forEach((li) => li.classList.remove("is-new"));
    dashList.prepend(el("li", { class: "is-new" }, el("span", { class: "va-chip " + chipClass }, chipText), " ", text));
    while (dashList.children.length > 4) dashList.lastChild.remove();
  }
  // Point at fraction u along a hop path (array of node indices).
  function along(path, u) {
    const segs = path.length - 1;
    if (segs < 1) return pts[path[0]];
    const f = clamp(u, 0, 0.9999) * segs, k = Math.floor(f), w = f - k;
    const a = pts[path[k]], b = pts[path[k + 1]];
    return [lerp(a[0], b[0], w), lerp(a[1], b[1], w)];
  }

  function frame(t) {
    packetLayer.replaceChildren();
    edgeEls.forEach((e, i) => { const up = edgeUp(edges[i]); e.setAttribute("stroke", up ? "var(--line-strong)" : "var(--sig-red)"); e.setAttribute("stroke-opacity", up ? 1 : 0.35); });
    cutLine.setAttribute("opacity", state.cut ? 0.8 : 0);
    const b = (t % 2) / 2; // hub beacon every 2 s
    beacon.setAttribute("r", 30 + 160 * b);
    beacon.setAttribute("stroke-opacity", 1 - b);

    // Heartbeats: every node every 5 s, staggered, along its path to the hub.
    const toHub = bfs(H);
    MESH_NODES.forEach((_, i) => {
      const phase = ((t + i * 0.41) % 5) / 1.6;
      if (phase > 1 || toHub.dist[i] === Infinity) return;
      const path = [i];
      while (path[path.length - 1] !== H && toHub.parent[path[path.length - 1]] >= 0) path.push(toHub.parent[path[path.length - 1]]);
      const [x, y] = along(path, phase);
      dot(x, y, "var(--ink-soft)", 5);
    });

    // Data records: hop along the mesh to the hub; cut-off headsets keep them.
    const dcycle = Math.floor(t / DATA_EVERY);
    const [src, pid, what] = DATA[dcycle % DATA.length];
    const du = (t - dcycle * DATA_EVERY) / DATA_TRAVEL;
    if (toHub.dist[src] !== Infinity) {
      if (du <= 1) {
        const path = [src];
        while (path[path.length - 1] !== H && toHub.parent[path[path.length - 1]] >= 0) path.push(toHub.parent[path[path.length - 1]]);
        const [x, y] = along(path, du);
        square(x, y);
      } else if (lastData !== dcycle) {
        lastData = dcycle;
        logRow("va-data", L(lang, T_MESH.dataChip), fill(L(lang, T_MESH.dataRow), { id: pid, what: L(lang, what), h: String(src + 1).padStart(2, "0") }));
      }
    } else {
      const [x, y] = MESH_NODES[src];
      square(x + 18, y - 18, 0.6 + 0.4 * Math.sin(t * 6) ** 2);
    }

    // Triage update flooding the mesh every 7 s.
    const cycle = Math.floor(t / 7), u = t % 7;
    const upd = UPDATES[cycle % UPDATES.length];
    const flood = bfs(upd.from);
    const spread = u / 0.45; // hops reached so far
    nodeEls.forEach((n, i) => {
      const reached = flood.dist[i] <= spread && u < 4.5;
      n.setAttribute("stroke", reached ? `var(--sig-${["", "red", "amber", "green"][upd.cat]})` : isCut(i) && state.cut ? "var(--sig-red)" : "var(--brand-mint)");
      n.setAttribute("stroke-width", reached ? 5 : 3);
    });
    if (u < 4.5) {
      edges.forEach(([a, c], i) => {
        if (!edgeUp(edges[i])) return;
        const [s, e] = flood.dist[a] < flood.dist[c] ? [a, c] : [c, a];
        const w = spread - flood.dist[s];
        if (flood.dist[e] === flood.dist[s] + 1 && w > 0 && w < 1) {
          const [x, y] = along([s, e], w);
          dot(x, y, `var(--sig-${["", "red", "amber", "green"][upd.cat]})`);
        }
      });
    }
    // Dashboard row once the update reached the hub.
    if (flood.dist[H] <= spread && lastUpdate !== cycle) {
      lastUpdate = cycle;
      logRow(TRIAGE[upd.cat].cls, L(lang, TRIAGE[upd.cat]), fill(L(lang, T_MESH.updateRow), { id: upd.id, h: String(upd.from + 1).padStart(2, "0") }));
    }

    // Spool: cut-off headsets buffer one segment per 1.2 s each; drain on restore.
    const cutCount = MESH_NODES.filter((_, i) => isCut(i)).length;
    if (state.cut && t - lastSpoolTick > 1.2) { state.spool += cutCount; lastSpoolTick = t; }
    if (state.cut) spoolEl.textContent = fill(L(lang, T_MESH.spoolFill), { n: state.spool });
    else if (state.draining > 0) {
      const left = Math.max(0, Math.round(state.draining * (1 - (t - drainStart) / 3)));
      spoolEl.textContent = left > 0 ? fill(L(lang, T_MESH.spoolDrain), { n: left }) : L(lang, T_MESH.spoolIdle);
      MESH_NODES.forEach(([x, y], i) => { if (isCut(i) && left > 0) { const k = ((t * 1.5 + i * 0.3) % 1); square(lerp(x, HUB[0], k), lerp(y, HUB[1], k)); } });
      if (left === 0) { state.draining = 0; state.spool = 0; }
    } else spoolEl.textContent = L(lang, T_MESH.spoolIdle);
  }

  animate(stage, (elapsed, dt, still) => {
    if (still) state.time = 0.45 * 4 + 0.2;
    else if (state.playing) state.time += dt;
    frame(state.time);
  });
  return root;
}

export const VISUALS = {
  "ar-scan-sequence": renderArScanSequence,
  "ar-hud-mock": renderArHudMock,
  "ar-mesh-network": renderArMeshNetwork,
};

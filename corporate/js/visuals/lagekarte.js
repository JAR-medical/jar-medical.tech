// Visuals for the "Demo: situation map from four drones" course.
//   lagekarte-viewer  interactive map of a simulated four-drone survey over
//                     Neubiberg: base images, model reports, flight data and
//                     a seam check between two drones, each switchable
//   lagebild-video    the same run as a video with German captions
// Data and images in assets/lagekarte/ are exported from the TriARge repo
// (lagebild/demo.py, seed 2026), so map and video show the same run.
// Built with el()/svg() only (never innerHTML). Strings are { de, en }.
import { el, replace } from "../ui.js";
import { L, svg, injectStyle, prefersReducedMotion, clamp } from "./kit.js";

const DIR = "assets/lagekarte/";
// DOM order is the stacking order: the swiped base always sits above 2022.
const IMAGES = {
  before: "before.jpg", osm: "osm.jpg", log: "mosaic_log.jpg", mosaic: "mosaic.jpg",
  cov: "coverage.png", diff: "pixeldiff.png",
};

const S = {
  kicker: { de: "Simulation · Neubiberg", en: "Simulation · Neubiberg" },
  title: { de: "Lagekarte aus vier Drohnen", en: "Situation map from four drones" },
  sub: {
    de: "{side} m × {side} m, {frames} Bilder, ein Mosaik. Ebenen ein- und ausblenden, auf Meldungen tippen.",
    en: "{side} m × {side} m, {frames} images, one mosaic. Switch layers on and off, tap a report.",
  },
  loading: { de: "Lagekarte wird geladen …", en: "Loading the situation map …" },
  failed: { de: "Die Kartendaten konnten nicht geladen werden.", en: "The map data could not be loaded." },
  retry: { de: "Erneut versuchen", en: "Try again" },
  imgLoading: { de: "Luftbild wird geladen …", en: "Loading aerial image …" },
  imgFailed: { de: "Das Luftbild konnte nicht geladen werden.", en: "The aerial image could not be loaded." },
  mapLabel: {
    de: "Lagekarte. Ziehen oder Pfeiltasten verschieben, Plus und Minus zoomen, 0 zeigt das ganze Gebiet.",
    en: "Situation map. Drag or use the arrow keys to pan, plus and minus zoom, 0 shows the whole area.",
  },
  wheelHint: { de: "Zum Zoomen Strg oder ⌘ gedrückt halten", en: "Hold Ctrl or ⌘ to zoom" },
  zoomIn: { de: "Hineinzoomen", en: "Zoom in" },
  zoomOut: { de: "Herauszoomen", en: "Zoom out" },
  zoomFit: { de: "Ganzes Gebiet zeigen", en: "Show the whole area" },
  coordIdle: { de: "UTM 32N · Zeiger über die Karte bewegen", en: "UTM 32N · move the pointer over the map" },
  attribution: {
    de: "Luftbild: Bayerische Vermessungsverwaltung, CC BY 4.0 · Karte: OpenStreetMap-Mitwirkende, ODbL",
    en: "Aerial image: Bayerische Vermessungsverwaltung, CC BY 4.0 · Map: OpenStreetMap contributors, ODbL",
  },
  jump: { de: "Springen zu", en: "Jump to" },
  all: { de: "Gesamt", en: "Whole area" },
  before2022: { de: "Luftbild 2022", en: "2022 aerial" },
  knob: { de: "Regler zwischen vorher und nachher", en: "Before/after slider" },
  hBase: { de: "Untergrund", en: "Base image" },
  hReports: { de: "Meldungen", en: "Reports" },
  hFlight: { de: "Flug", en: "Flight" },
  hSeam: { de: "Naht zwischen zwei Drohnen", en: "Seam between two drones" },
  hSel: { de: "Auswahl", en: "Selection" },
  selEmpty: {
    de: "Auf eine Markierung auf der Karte tippen: Klasse, Fläche, Konfidenz und was OpenStreetMap darunter kennt.",
    en: "Tap a marker on the map: class, area, confidence and what OpenStreetMap knows underneath.",
  },
  swipe: { de: "Vorher-Nachher-Regler", en: "Before/after slider" },
  swipeNote: {
    de: "Links das Luftbild 2022, rechts der gewählte Untergrund. Den weißen Knopf ziehen.",
    en: "Left the 2022 aerial image, right the selected base. Drag the white knob.",
  },
  det: { de: "Erkennung mit Vorher-Bild", en: "Detection with before image" },
  detNote: { de: "Siamesisches Netz vergleicht das Mosaik mit 2022.", en: "A siamese network compares the mosaic with 2022." },
  noref: { de: "Erkennung ohne Vorher-Bild", en: "Detection without before image" },
  norefNote: { de: "Gleiches Netz, sieht nur das Mosaik. Gestrichelt.", en: "Same network, sees only the mosaic. Dashed." },
  look: { de: "Schon 2022 da", en: "Already there in 2022" },
  lookNote: {
    de: "{n} Stellen, die wie ein Einsatz aussehen, aber schon 2022 da waren. Mit Vorher-Bild {ref} gemeldet, ohne {noref}.",
    en: "{n} spots that look like an incident but were already there in 2022. Reported {ref} times with the before image, {noref} without.",
  },
  truth: { de: "Grundwahrheit", en: "Ground truth" },
  truthNote: { de: "Was in die Simulation gemalt wurde, flächig.", en: "What was painted into the simulation, as filled areas." },
  diff: { de: "Pixelvergleich ohne Lernen", en: "Pixel comparison without learning" },
  diffNote: {
    de: "Farbabstand zu 2022, Schwelle wie im Benchmark. Rot ist jede Fläche, die er melden würde.",
    en: "Colour distance to 2022, same threshold as in the benchmark. Red is every area it would report.",
  },
  foot: { de: "Bildflächen", en: "Image footprints" },
  footNote: { de: "Wo jedes Bild nach dem Verbund liegt.", en: "Where each image lies after the joint adjustment." },
  ties: { de: "Verknüpfungen", en: "Tie links" },
  tiesNote: { de: "Bildpaare mit gemeinsamen Punkten. Weiß: zwischen zwei Drohnen.", en: "Image pairs with shared points. White: between two drones." },
  cov: { de: "Welche Drohne liefert das Bild", en: "Which drone supplies the image" },
  covNote: { de: "Farbe der Drohne, deren Bild an der Stelle im Mosaik liegt.", en: "Colour of the drone whose image is used at that spot in the mosaic." },
  frames: { de: "{n} Bilder", en: "{n} images" },
  multicopter: { de: "Multikopter", en: "multicopter" },
  fixedWing: { de: "Starrflügler", en: "fixed-wing" },
  chipTitle: { de: "{found} von {placed} eingesetzten Objekten gefunden, {n} Meldungen", en: "{found} of {placed} placed objects found, {n} reports" },
  chipTitleNone: { de: "{n} Meldungen, nichts eingesetzt", en: "{n} reports, nothing placed" },
  segLabel: { de: "Georeferenzierung", en: "Georeferencing" },
  segLog: { de: "nur Flug-Log", en: "flight log only" },
  segFin: { de: "Verbund", en: "joint adjustment" },
  seamErr: { de: "Lagefehler im Mittel", en: "Mean position error" },
  seamOff: { de: "Versatz zwischen Drohnen", en: "Offset between drones" },
  seamTies: { de: "Bildpaare verknüpft", en: "Linked image pairs" },
  seamTiesVal: { de: "{n} ({inter} zwischen Drohnen)", en: "{n} ({inter} between drones)" },
  seamGo: { de: "Stelle auf der Karte zeigen", en: "Show the spot on the map" },
  seamAlt: { de: "Ein Bild von {a} und eins von {b} übereinander, {how}", en: "One image from {a} and one from {b} overlaid, {how}" },
  srcRef: { de: "Modell mit Vorher-Bild", en: "Model with before image" },
  srcNoref: { de: "Modell ohne Vorher-Bild", en: "Model without before image" },
  conf: { de: "Konfidenz", en: "Confidence" },
  area: { de: "Fläche", en: "Area" },
  osmUnder: { de: "OSM darunter", en: "OSM underneath" },
  pos: { de: "Lage UTM 32N", en: "Position UTM 32N" },
  wgs: { de: "WGS84", en: "WGS84" },
  flagged: { de: "gemeldet", en: "reported" },
  notFlagged: { de: "nicht gemeldet", en: "not reported" },
  lookText: {
    de: "War schon 2022 da und ist es 2024 noch. Richtig ist: nicht melden.",
    en: "Was already there in 2022 and still is in 2024. The right answer: no report.",
  },
  east: { de: "O", en: "E" },
  note: {
    de: "Simulation: Die Einsatzlagen sind in das Luftbild 2024 gemalt, die vier Drohnen fliegen virtuell mit Log-, Lage- und Belichtungsfehlern. Luftbilder: Bayerische Vermessungsverwaltung, geodaten.bayern.de, CC BY 4.0. Kartendaten: OpenStreetMap-Mitwirkende, ODbL. Prototyp für Übungen, kein zertifiziertes Produkt.",
    en: "Simulation: the incidents are painted into the 2024 aerial image, the four drones fly virtually with log, attitude and exposure errors. Aerial images: Bayerische Vermessungsverwaltung, geodaten.bayern.de, CC BY 4.0. Map data: OpenStreetMap contributors, ODbL. Prototype for exercises, not a certified product.",
  },
  videoTitle: { de: "Der Ablauf im Video", en: "The run as a video" },
  videoCaption: {
    de: "Derselbe Lauf wie auf der Lagekarte, 70 Sekunden. Einblendungen auf Deutsch.",
    en: "The same run as on the situation map, 70 seconds. On-screen text in German.",
  },
  videoMissing: { de: "Das Video konnte nicht geladen werden.", en: "The video could not be loaded." },
};

const BASES = [
  ["mosaic", { de: "Drohnen-Mosaik", en: "Drone mosaic" },
    { de: "Verbund aus allen vier Drohnen, 20 cm pro Pixel.", en: "Joint mosaic from all four drones, 20 cm per pixel." }],
  ["log", { de: "Mosaik nur nach Flug-Log", en: "Mosaic from flight log only" },
    { de: "Jede Drohne mit eigenem GPS- und Kompassfehler, eigener Belichtung.", en: "Each drone with its own GPS and compass error and its own exposure." }],
  ["before", { de: "Luftbild 2022 (vorher)", en: "2022 aerial image (before)" },
    { de: "Amtliches Orthofoto, Grundlage für den Vergleich.", en: "Official orthophoto, the reference for the comparison." }],
  ["osm", { de: "Karte aus OpenStreetMap", en: "OpenStreetMap" },
    { de: "Straßen, Gebäude, Gewässer, Wald, als Raster.", en: "Roads, buildings, water, forest, as a raster." }],
];

// Class colours are the lagebild overlay palette, so map and video match.
const CLASSES = {
  person: [{ de: "Person", en: "Person" }, "#ff00ff"],
  vehicle: [{ de: "Fahrzeug (Unfall)", en: "Vehicle (crash)" }, "#ffe600"],
  emergency_vehicle: [{ de: "Einsatzfahrzeug", en: "Emergency vehicle" }, "#008cff"],
  fire_smoke: [{ de: "Feuer/Rauch", en: "Fire/smoke" }, "#ff4600"],
  water: [{ de: "Wasser", en: "Water" }, "#00e6ff"],
  obstacle: [{ de: "Hindernis/Trümmer", en: "Obstacle/debris" }, "#c26a2e"],
  structure: [{ de: "Zelt/Struktur", en: "Tent/structure" }, "#28dc3c"],
};
const OSM = {
  other: { de: "sonstige Fläche", en: "other area" }, road: { de: "Straße", en: "road" },
  building: { de: "Gebäude", en: "building" }, water: { de: "Gewässer", en: "water body" },
  forest: { de: "Wald", en: "forest" }, green: { de: "Grünfläche", en: "green space" },
  rail: { de: "Bahn", en: "railway" }, parking: { de: "Parkplatz", en: "car park" },
};
const LOOKALIKES = {
  rtw: { de: "RTW an der Wache", en: "Ambulance at the station" }, tent: { de: "Zelt", en: "Tent" },
  pond: { de: "Teich", en: "Pond" }, car: { de: "Parkendes Auto", en: "Parked car" },
  tree: { de: "Holzstapel", en: "Woodpile" },
};
const INCIDENTS = {
  manv: { de: "MANV", en: "MCI" }, storm: { de: "Sturm", en: "Storm" },
  flood: { de: "Hochwasser", en: "Flood" }, fire: { de: "Brand", en: "Fire" },
};
// lagebild.overlay.relevance_note writes German; these are its English forms.
const HINTS_EN = {
  "Wasser außerhalb eines OSM-Gewässers: Überflutung": "water outside a mapped water body: flooding",
  "bekanntes Gewässer": "known water body",
  "Hindernis auf OSM-Straße: Zufahrt prüfen": "obstacle on a mapped road: check access",
  "auf der Fahrbahn": "on the road",
  "Feuer oder Rauch": "fire or smoke",
};

const CSS = `
.lk-card { border: 1px solid var(--line); border-radius: var(--r-lg); background: var(--bg-raise); padding: var(--sp-5); margin: var(--sp-5) 0; container-type: inline-size; }
.lk-kicker { font-family: var(--font-mono); font-size: var(--t-micro); letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); margin: 0 0 var(--sp-1); }
.lk-title { font-size: 1.15rem; font-weight: 600; color: var(--ink); margin: 0 0 var(--sp-1); line-height: 1.3; }
.lk-sub { color: var(--ink-soft); font-size: var(--t-small); margin: 0; line-height: 1.5; }
.lk-body { display: grid; gap: var(--sp-3); margin-top: var(--sp-4); }
.lk-body > * { margin: 0; }
.lk-status { color: var(--ink-soft); font-size: var(--t-small); display: flex; flex-wrap: wrap; gap: var(--sp-3); align-items: center; }
.lk-jump { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.lk-jump > span { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-faint); margin-right: 4px; }
.lk-btn { font: 600 13px/1 var(--font-sans); color: var(--ink); background: var(--bg-deep); border: 1px solid var(--line-strong); border-radius: var(--r-pill); padding: 7px 12px; cursor: pointer; }
.lk-btn:hover { border-color: var(--accent); }
.lk-btn[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--bg-deep); }
.lk-map { position: relative; overflow: hidden; width: 100%; aspect-ratio: 1 / 1; max-height: min(78vh, 760px); background: var(--bg-deep); border: 1px solid var(--line); border-radius: var(--r-md); touch-action: none; cursor: grab; user-select: none; -webkit-user-select: none; }
.lk-map.is-dragging { cursor: grabbing; }
.lk-map:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.lk-stage { position: absolute; left: 0; top: 0; transform-origin: 0 0; will-change: transform; }
.lk-stage img, .lk-vec { position: absolute; inset: 0; width: 100%; height: 100%; max-width: none; }
.lk-stage img { pointer-events: none; }
.lk-vec { overflow: visible; }
.lk-vec * { vector-effect: non-scaling-stroke; }
.lk-vec .lk-hit { cursor: pointer; }
.lk-vec .lk-sel { fill: none; stroke: var(--accent); stroke-width: 3; }
.lk-vec .lk-halo { fill: none; stroke: var(--bg-deep); stroke-width: 5; stroke-opacity: 0.7; stroke-linejoin: round; }
.lk-vec .lk-ring { fill: transparent; stroke: var(--ink); stroke-width: 2; stroke-dasharray: 6 5; }
.lk-vec .lk-seambox { fill: none; stroke: var(--ink); stroke-width: 2; stroke-dasharray: 6 4; }
.lk-labels { position: absolute; inset: 0; pointer-events: none; }
.lk-inc { position: absolute; transform: translate(-50%, -130%); pointer-events: auto; font: 700 12px/1 var(--font-sans); letter-spacing: 0.04em; text-transform: uppercase; color: var(--bg-deep); background: var(--ink); padding: 5px 8px; border: 0; border-radius: var(--r-sm); cursor: pointer; white-space: nowrap; }
.lk-inc::after { content: ""; position: absolute; left: 50%; bottom: -6px; margin-left: -6px; border: 6px solid transparent; border-bottom: 0; border-top-color: var(--ink); }
.lk-inc:hover { background: var(--accent); }
.lk-inc:hover::after { border-top-color: var(--accent); }
.lk-swipe { position: absolute; top: 0; bottom: 0; width: 0; border-left: 2px solid var(--ink); pointer-events: none; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4); }
.lk-knob { position: absolute; top: 50%; left: -19px; width: 36px; height: 36px; margin-top: -18px; border-radius: 50%; background: var(--ink); color: var(--bg-deep); border: 0; pointer-events: auto; cursor: ew-resize; font: 600 14px/1 var(--font-mono); touch-action: none; }
.lk-tag { position: absolute; top: 48px; font: 600 12px/1 var(--font-mono); color: var(--ink); background: rgba(12, 11, 31, 0.78); padding: 5px 8px; border-radius: var(--r-sm); white-space: nowrap; }
.lk-tag-l { right: 10px; }
.lk-tag-r { left: 10px; }
.lk-zoom { position: absolute; right: 10px; top: 10px; display: grid; gap: 1px; background: var(--line-strong); border: 1px solid var(--line-strong); border-radius: var(--r-sm); overflow: hidden; }
.lk-zoom button { width: 34px; height: 34px; background: var(--bg-raise); color: var(--ink); border: 0; font: 600 17px/1 var(--font-mono); cursor: pointer; }
.lk-zoom button:hover { background: var(--bg-raise-2); }
.lk-hud { position: absolute; pointer-events: none; font: 500 11.5px/1.3 var(--font-mono); color: var(--ink); }
.lk-chip { background: rgba(12, 11, 31, 0.78); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 4px 8px; }
.lk-hud-tl { left: 10px; top: 10px; max-width: calc(100% - 66px); }
.lk-hud-bl { left: 10px; bottom: 10px; }
.lk-scale { display: flex; align-items: center; gap: 8px; }
.lk-scale i { display: block; height: 4px; background: var(--ink); }
.lk-hud-br { right: 10px; bottom: 10px; max-width: calc(100% - 150px); text-align: right; font-size: 10px; color: var(--ink-soft); }
.lk-hint, .lk-wait { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); pointer-events: none; font: 600 13px/1.3 var(--font-sans); color: var(--ink); background: rgba(12, 11, 31, 0.86); border: 1px solid var(--line-strong); border-radius: var(--r-md); padding: 10px 14px; text-align: center; max-width: calc(100% - 40px); }
.lk-hint { opacity: 0; transition: opacity var(--dur-fast, 0.15s) ease-out; }
.lk-hint.is-on { opacity: 1; }
.lk-info { background: var(--bg-deep); border: 1px solid var(--line); border-radius: var(--r-md); padding: 12px 14px; min-width: 0; }
.lk-info p { margin: 0; color: var(--ink-soft); font-size: var(--t-small); line-height: 1.5; }
.lk-info-head { display: flex; align-items: center; gap: 8px; font-size: 1.05rem; font-weight: 600; color: var(--ink); margin: 0 0 4px; }
.lk-h { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-faint); margin: 0 0 6px; }
.lk-sw { display: inline-block; width: 10px; height: 10px; flex: none; }
.lk-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: var(--sp-3); }
.lk-box { background: var(--bg-deep); border: 1px solid var(--line); border-radius: var(--r-md); padding: 12px 14px; min-width: 0; }
.lk-opt { display: grid; grid-template-columns: 18px minmax(0, 1fr) auto; gap: 2px 8px; align-items: start; padding: 6px 4px; cursor: pointer; border-radius: var(--r-sm); color: var(--ink); font-size: 14px; line-height: 1.35; }
.lk-opt:hover { background: var(--bg-raise); }
.lk-opt:focus-within { outline: 2px solid var(--accent); outline-offset: 1px; }
.lk-opt input { margin: 2px 0 0; accent-color: var(--accent); width: 15px; height: 15px; }
.lk-opt b { font-weight: 600; }
.lk-opt small { grid-column: 2 / -1; color: var(--ink-faint); font-size: 12.5px; line-height: 1.4; }
.lk-n { font: 500 12px/1.6 var(--font-mono); color: var(--ink-soft); font-variant-numeric: tabular-nums; }
.lk-chips { display: flex; flex-wrap: wrap; gap: 5px; padding: 2px 4px 6px 30px; transition: opacity var(--dur-fast, 0.15s) ease-out; }
.lk-chips.is-off { opacity: 0.4; }
.lk-cls { font: 500 12.5px/1 var(--font-sans); color: var(--ink); background: transparent; border: 1px solid var(--line-strong); border-radius: var(--r-pill); padding: 5px 9px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.lk-cls i { width: 9px; height: 9px; display: inline-block; }
.lk-cls span { font: 500 11px var(--font-mono); color: var(--ink-soft); }
.lk-cls[aria-pressed="false"] { opacity: 0.45; }
.lk-cls[aria-pressed="false"] i { background: transparent !important; outline: 1px solid var(--ink-faint); }
.lk-drone { display: grid; grid-template-columns: 18px 14px minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 5px 4px; cursor: pointer; border-radius: var(--r-sm); color: var(--ink); font-size: 14px; }
.lk-drone:hover { background: var(--bg-raise); }
.lk-drone input { margin: 0; accent-color: var(--accent); width: 15px; height: 15px; }
.lk-drone i { width: 14px; height: 4px; display: block; }
.lk-seg { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--line-strong); border-radius: var(--r-sm); overflow: hidden; margin-bottom: 8px; }
.lk-seg button { font: 600 13px/1 var(--font-sans); padding: 8px 6px; background: var(--bg-raise); color: var(--ink-soft); border: 0; cursor: pointer; }
.lk-seg button[aria-pressed="true"] { background: var(--ink); color: var(--bg-deep); }
.lk-seamimg { width: 100%; max-width: 100%; aspect-ratio: 1; display: block; border: 1px solid var(--line); border-radius: var(--r-sm); }
.lk-kv { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; margin: 10px 0 0; font-size: 13.5px; }
.lk-kv dt { color: var(--ink-faint); }
.lk-kv dd { margin: 0; font: 500 13px var(--font-mono); color: var(--ink); font-variant-numeric: tabular-nums; text-align: right; }
.lk-link { background: none; border: 0; padding: 0; margin-top: 10px; color: var(--accent); font: inherit; font-size: var(--t-small); cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
.lk-note { font-size: 12px; color: var(--ink-faint); line-height: 1.5; }
.lk-video { display: block; width: 100%; aspect-ratio: 16 / 9; background: var(--bg-deep); border: 1px solid var(--line); border-radius: var(--r-md); }
.lk-card button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
@container (max-width: 520px) {
  .lk-hud-br { display: none; }
  .lk-tag { font-size: 11px; }
}
@media (max-width: 560px) {
  .lk-card { padding: var(--sp-3); }
}
/* The coordinate readout follows a hovering pointer; touch screens have none. */
@media (hover: none) {
  .lk-hud-tl { display: none; }
  .lk-tag { top: 12px; }
}
`;

// Fill {name} placeholders.
const fill = (text, vars = {}) => text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));

let dataPromise = null;
function loadData() {
  if (!dataPromise) {
    dataPromise = fetch(DIR + "data.json").then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
    dataPromise.catch(() => { dataPromise = null; });
  }
  return dataPromise;
}

let instances = 0;

function lagekarteViewer(_block, lang) {
  injectStyle("visual-lagekarte", CSS);
  const T = (key, vars) => fill(L(lang, S[key]), vars);
  const sub = el("p", { class: "lk-sub" });
  const body = el("div", { class: "lk-body" });
  const card = el("section", { class: "lk-card", "aria-label": T("title") },
    el("p", { class: "lk-kicker" }, T("kicker")),
    el("p", { class: "lk-title" }, T("title")),
    sub, body);

  const attempt = () => {
    replace(body, el("p", { class: "lk-status", role: "status" }, T("loading")));
    loadData()
      .then((data) => buildViewer(data, lang, body, sub))
      .catch((e) => {
        console.error("lagekarte: data failed", e);
        replace(body, el("p", { class: "lk-status", role: "alert" }, T("failed"),
          el("button", { class: "lk-btn", type: "button", onclick: attempt }, T("retry"))));
      });
  };
  attempt();
  return card;
}

function buildViewer(D, lang, body, sub) {
  const T = (key, vars) => fill(L(lang, S[key]), vars);
  const num = (x, digits = 0) => new Intl.NumberFormat(lang === "en" ? "en-GB" : "de-DE",
    { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(x);
  const A = D.aoi_px, GSD = D.gsd, ST = D.stats;
  const reduce = prefersReducedMotion();
  const uid = "lk" + ++instances;
  const show = (node, on) => { node.style.display = on ? "" : "none"; };

  sub.textContent = T("sub", { side: num(A * GSD), frames: num(ST.frames) });

  // ── Map skeleton ─────────────────────────────────────────────────────────
  const imgs = {};
  for (const key of Object.keys(IMAGES)) imgs[key] = el("img", { alt: "", decoding: "async", draggable: "false", hidden: true });
  const showImg = (key, on) => {
    const img = imgs[key];
    if (on && !img.getAttribute("src")) img.src = DIR + IMAGES[key];
    img.hidden = !on;
  };
  const vec = svg("svg", { class: "lk-vec", viewBox: `0 0 ${A} ${A}`, "aria-hidden": "true" });
  const stage = el("div", { class: "lk-stage", style: `width:${A}px;height:${A}px` }, Object.values(imgs), vec);
  const labels = el("div", { class: "lk-labels" });
  const swipeR = el("span", { class: "lk-tag lk-tag-r" });
  const knob = el("button", { class: "lk-knob", type: "button", "aria-label": T("knob") }, "⇆");
  const swipe = el("div", { class: "lk-swipe", hidden: true },
    el("span", { class: "lk-tag lk-tag-l" }, T("before2022")), swipeR, knob);
  const zoomBtn = (label, text, fn) => el("button", { type: "button", "aria-label": label, title: label, onclick: fn }, text);
  const scaleBar = el("i");
  const scaleLabel = el("span");
  const coord = el("div", { class: "lk-chip" }, T("coordIdle"));
  const hint = el("div", { class: "lk-hint", "aria-hidden": "true" }, T("wheelHint"));
  const wait = el("div", { class: "lk-wait", role: "status" }, T("imgLoading"));
  const map = el("div", { class: "lk-map", tabindex: "0", role: "region", "aria-label": T("mapLabel") },
    stage, labels, swipe,
    el("div", { class: "lk-zoom" },
      zoomBtn(T("zoomIn"), "+", () => zoomCenter(1.6)),
      zoomBtn(T("zoomOut"), "−", () => zoomCenter(1 / 1.6)),
      zoomBtn(T("zoomFit"), "⤢", () => go("all"))),
    el("div", { class: "lk-hud lk-hud-tl" }, coord),
    el("div", { class: "lk-hud lk-hud-bl" }, el("div", { class: "lk-chip lk-scale" }, scaleBar, scaleLabel)),
    el("div", { class: "lk-hud lk-hud-br" }, el("span", { class: "lk-chip" }, T("attribution"))),
    hint, wait);
  imgs.mosaic.addEventListener("load", () => wait.remove(), { once: true });
  imgs.mosaic.addEventListener("error", () => { wait.textContent = T("imgFailed"); }, { once: true });

  // ── Vector layers ────────────────────────────────────────────────────────
  const G = {};
  for (const id of ["truth", "ties", "foot", "tracks", "noref", "det", "look", "seam", "sel"]) vec.append(G[id] = svg("g"));
  const markers = []; // small things get a ring of constant screen size
  const ringPath = (rings) => rings.map((r) => "M" + r.map((p) => p[0] + " " + p[1]).join("L") + "Z").join("");

  for (const d of D.truth) {
    const col = CLASSES[d.cls]?.[1] ?? "#ffffff";
    G.truth.append(svg("path", { d: ringPath(d.rings), fill: col, "fill-opacity": 0.45, stroke: col, "stroke-width": 1 }));
  }

  const droneColor = Object.fromEntries(D.drones.map((d) => [d.name, d.color]));
  const tiePaths = {};
  for (const t of D.ties) {
    const key = t[4] || "inter";
    tiePaths[key] = (tiePaths[key] || "") + `M${t[0]} ${t[1]}L${t[2]} ${t[3]}`;
  }
  for (const [key, d] of Object.entries(tiePaths)) {
    const inter = key === "inter";
    G.ties.append(svg("path", { d, fill: "none", "stroke-width": 1, stroke: inter ? "#ffffff" : droneColor[key], "stroke-opacity": inter ? 0.38 : 0.55 }));
  }

  const trackG = {};
  const footG = {};
  for (const d of D.drones) {
    footG[d.name] = svg("g", {}, svg("path", {
      d: d.footprints.map((f) => "M" + f.map((p) => p.join(" ")).join("L") + "Z").join(""),
      fill: "none", stroke: d.color, "stroke-width": 1.2, "stroke-opacity": 0.8,
    }));
    const pts = "M" + d.track.map((p) => p.join(" ")).join("L");
    const start = svg("circle", { cx: d.track[0][0], cy: d.track[0][1], fill: d.color, stroke: "#ffffff", "stroke-width": 2 });
    trackG[d.name] = svg("g", {},
      svg("path", { d: pts, class: "lk-halo" }),
      svg("path", { d: pts, fill: "none", stroke: d.color, "stroke-width": 2, "stroke-opacity": 0.9, "stroke-linejoin": "round" }),
      start);
    markers.push({ node: start, px: 6 });
    G.foot.append(footG[d.name]);
    G.tracks.append(trackG[d.name]);
  }

  function addReports(list, group, dashed, source) {
    const byCls = {};
    list.forEach((d, i) => {
      const col = CLASSES[d.cls]?.[1] ?? "#ffffff";
      const g = byCls[d.cls] || (byCls[d.cls] = group.appendChild(svg("g")));
      g.append(svg("path", {
        d: ringPath(d.rings), class: "lk-hit", "data-sel": source + ":" + i,
        fill: col, "fill-opacity": dashed ? 0 : 0.16, stroke: col, "stroke-width": dashed ? 2 : 2.2, "stroke-dasharray": dashed ? "5 4" : null,
      }));
      const [x, y, w, h] = d.box;
      if (Math.max(w, h) < 30) {
        const ring = svg("circle", {
          cx: x + w / 2, cy: y + h / 2, class: "lk-hit", "data-sel": source + ":" + i,
          fill: "transparent", stroke: col, "stroke-width": 2.2, "stroke-dasharray": dashed ? "4 3" : null,
        });
        g.append(ring);
        markers.push({ node: ring, px: dashed ? 13 : 9 });
      }
    });
    return byCls;
  }
  const detByCls = addReports(D.detections, G.det, false, "det");
  addReports(D.detections_noref, G.noref, true, "noref");

  D.lookalikes.forEach((o, i) => {
    const ring = svg("circle", { cx: o.x, cy: o.y, class: "lk-ring lk-hit", "data-sel": "look:" + i });
    G.look.append(ring);
    markers.push({ node: ring, px: 14, min: o.r + 6 });
  });

  const sb = D.seam.box;
  G.seam.append(svg("rect", { x: sb[0], y: sb[1], width: sb[2] - sb[0], height: sb[3] - sb[1], class: "lk-seambox" }));
  show(G.seam, false);

  // ── View transform ───────────────────────────────────────────────────────
  let k = 1;
  let tx = 0;
  let ty = 0;
  let kFit = 1;
  let fitted = false;
  let raf = 0;
  let anim = 0;
  const size = () => { const r = map.getBoundingClientRect(); return [r.width, r.height]; };
  function fitView() {
    const [w, h] = size();
    kFit = Math.min(w, h) / A;
    return { k: kFit, x: (w - A * kFit) / 2, y: (h - A * kFit) / 2 };
  }
  function clampView(v) {
    const [w, h] = size();
    v.k = clamp(v.k, kFit * 0.9, 3);
    const m = 80;
    const s = A * v.k;
    v.x = s + 2 * m < w ? (w - s) / 2 : clamp(v.x, w - s - m, m);
    v.y = s + 2 * m < h ? (h - s) / 2 : clamp(v.y, h - s - m, m);
    return v;
  }
  function apply() {
    stage.style.transform = `translate(${tx}px,${ty}px) scale(${k})`;
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; refresh(); });
  }
  function set(v) {
    if (!fitted) return;
    v = clampView(v);
    k = v.k; tx = v.x; ty = v.y;
    apply();
  }
  function zoomAt(cx, cy, f) {
    const nk = clamp(k * f, kFit * 0.9, 3);
    f = nk / k;
    set({ k: nk, x: cx - (cx - tx) * f, y: cy - (cy - ty) * f });
  }
  function zoomCenter(f) {
    const [w, h] = size();
    zoomAt(w / 2, h / 2, f);
  }
  function flyTo(v) {
    if (!fitted) return;
    v = clampView(v);
    cancelAnimationFrame(anim);
    if (reduce) return set(v);
    const a = { k, x: tx, y: ty };
    const t0 = performance.now();
    const step = (now) => {
      const u = Math.min(1, (now - t0) / 650);
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      // Interpolate the centre and the log of the zoom, so the path stays smooth.
      const kk = Math.exp(Math.log(a.k) * (1 - e) + Math.log(v.k) * e);
      const [w, h] = size();
      const ca = [(w / 2 - a.x) / a.k, (h / 2 - a.y) / a.k];
      const cb = [(w / 2 - v.x) / v.k, (h / 2 - v.y) / v.k];
      k = kk;
      tx = w / 2 - (ca[0] + (cb[0] - ca[0]) * e) * kk;
      ty = h / 2 - (ca[1] + (cb[1] - ca[1]) * e) * kk;
      apply();
      if (u < 1 && map.isConnected) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }
  function viewOn(cx, cy, widthPx) {
    const [w, h] = size();
    const kk = Math.min(w, h) / widthPx;
    return { k: kk, x: w / 2 - cx * kk, y: h / 2 - cy * kk };
  }

  // ── Screen-space parts: markers, labels, scale, swipe ────────────────────
  const incLabels = Object.entries(D.incidents).map(([kind, p]) => {
    const b = el("button", { class: "lk-inc", type: "button", onclick: () => go(kind) }, L(lang, INCIDENTS[kind]) || kind);
    labels.append(b);
    return { b, p };
  });
  function refresh() {
    for (const m of markers) m.node.setAttribute("r", Math.max(m.px / k, m.min || 0));
    for (const { b, p } of incLabels) {
      b.style.left = tx + p[0] * k + "px";
      b.style.top = ty + p[1] * k + "px";
    }
    const target = (130 / k) * GSD;
    const nice = [5, 10, 20, 25, 50, 100, 200, 250, 500].find((v) => v >= target * 0.6) || 500;
    scaleBar.style.width = (nice / GSD) * k + "px";
    scaleLabel.textContent = nice + " m";
    updateSwipe();
  }

  let base = "mosaic";
  let swipeOn = false;
  let swipeX = null;
  const topBase = () => (base === "before" ? "mosaic" : base);
  function updateSwipe() {
    swipe.hidden = !swipeOn;
    for (const key of ["mosaic", "log", "before", "osm"]) imgs[key].style.clipPath = "";
    if (!swipeOn) return;
    const [w] = size();
    swipeX = clamp(swipeX ?? w / 2, 0, w);
    swipe.style.left = swipeX + "px";
    imgs[topBase()].style.clipPath = `inset(0 0 0 ${clamp((swipeX - tx) / k, 0, A)}px)`;
  }
  function showBase() {
    const top = topBase();
    for (const [key] of BASES) showImg(key, swipeOn ? key === "before" || key === top : key === base);
    swipeR.textContent = L(lang, BASES.find((b) => b[0] === top)[1]);
    updateSwipe();
  }

  // ── Panel ────────────────────────────────────────────────────────────────
  function option(type, name, checked, title, note, count, onChange) {
    const input = el("input", { type, name, checked });
    input.addEventListener("change", () => onChange(input.checked));
    return el("label", { class: "lk-opt" }, input, el("span", {}, el("b", {}, title)),
      el("span", { class: "lk-n" }, count ?? ""), note ? el("small", {}, note) : null);
  }
  const toggle = (key, checked, count, onChange, note) => {
    onChange(checked);
    return option("checkbox", null, checked, T(key), note ?? T(key + "Note"), count, onChange);
  };

  const baseBox = el("section", { class: "lk-box" }, el("p", { class: "lk-h" }, T("hBase")),
    BASES.map(([key, name, note]) => option("radio", uid + "-base", key === base, L(lang, name), L(lang, note), null,
      () => { base = key; showBase(); })),
    option("checkbox", null, false, T("swipe"), T("swipeNote"), null, (on) => {
      swipeOn = on;
      swipeX = size()[0] / 2;
      showBase();
    }));

  const perClass = ST.per_class || {};
  const detCount = {};
  for (const d of D.detections) detCount[d.cls] = (detCount[d.cls] || 0) + 1;
  const chips = el("div", { class: "lk-chips" });
  for (const [cls, [name, col]] of Object.entries(CLASSES)) {
    const pc = perClass[cls];
    const n = detCount[cls] || 0;
    if (!n && !pc) continue;
    const b = el("button", {
      class: "lk-cls", type: "button", "aria-pressed": "true",
      title: pc ? T("chipTitle", { found: pc[0], placed: pc[1], n }) : T("chipTitleNone", { n }),
    }, el("i", { style: `background:${col}` }), L(lang, name), el("span", {}, pc ? `${pc[0]}/${pc[1]}` : "–"));
    b.addEventListener("click", () => {
      const on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", String(on));
      if (detByCls[cls]) show(detByCls[cls], on);
    });
    chips.append(b);
  }
  const reportBox = el("section", { class: "lk-box" }, el("p", { class: "lk-h" }, T("hReports")),
    toggle("det", true, num(D.detections.length), (on) => { show(G.det, on); chips.classList.toggle("is-off", !on); }),
    chips,
    toggle("noref", false, num(D.detections_noref.length), (on) => show(G.noref, on)),
    toggle("look", true, num(ST.look_n), (on) => show(G.look, on),
      T("lookNote", { n: num(ST.look_n), ref: num(ST.look_ref), noref: num(ST.look_noref) })),
    toggle("truth", false, num(D.truth.length), (on) => show(G.truth, on)),
    toggle("diff", false, num(ST.pixeldiff_regions), (on) => showImg("diff", on)));

  const flightBox = el("section", { class: "lk-box" }, el("p", { class: "lk-h" }, T("hFlight")),
    D.drones.map((d) => {
      const input = el("input", { type: "checkbox", checked: true });
      input.addEventListener("change", () => { show(trackG[d.name], input.checked); show(footG[d.name], input.checked); });
      const type = d.type === "Starrflügler" ? T("fixedWing") : T("multicopter");
      return el("label", { class: "lk-drone" }, input, el("i", { style: `background:${d.color}` }),
        el("span", {}, el("b", {}, d.name), ` ${type}, ${num(d.alt)} m`), el("span", { class: "lk-n" }, T("frames", { n: num(d.frames) })));
    }),
    toggle("foot", false, num(ST.frames), (on) => show(G.foot, on)),
    toggle("ties", false, num(ST.ties), (on) => show(G.ties, on)),
    toggle("cov", false, null, (on) => showImg("cov", on)));

  const seamImg = el("img", { class: "lk-seamimg", alt: "", decoding: "async" });
  const segLog = el("button", { type: "button" }, T("segLog"));
  const segFin = el("button", { type: "button" }, T("segFin"));
  function seam(fin) {
    segLog.setAttribute("aria-pressed", String(!fin));
    segFin.setAttribute("aria-pressed", String(fin));
    seamImg.src = DIR + (fin ? "seam_fin.jpg" : "seam_log.jpg");
    seamImg.alt = T("seamAlt", { a: D.seam.pair[0], b: D.seam.pair[1], how: fin ? T("segFin") : T("segLog") });
  }
  segLog.addEventListener("click", () => seam(false));
  segFin.addEventListener("click", () => seam(true));
  seam(false);
  const kv = (pairs) => el("dl", { class: "lk-kv" }, pairs.map(([dt, dd]) => [el("dt", {}, dt), el("dd", {}, dd)]));
  const seamBox = el("section", { class: "lk-box" }, el("p", { class: "lk-h" }, T("hSeam")),
    el("div", { class: "lk-seg", role: "group", "aria-label": T("segLabel") }, segLog, segFin),
    seamImg,
    kv([
      [T("seamErr"), `${num(ST.err_log, 2)} → ${num(ST.err_fin, 2)} m`],
      [T("seamOff"), `${num(ST.seam_log, 2)} → ${num(ST.seam_fin, 2)} m`],
      [T("seamTies"), T("seamTiesVal", { n: num(ST.ties), inter: num(ST.ties_inter) })],
    ]),
    el("button", { class: "lk-link", type: "button", onclick: () => {
      show(G.seam, true);
      flyTo(viewOn((sb[0] + sb[2]) / 2, (sb[1] + sb[3]) / 2, (sb[2] - sb[0]) * 2.2));
      map.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
    } }, T("seamGo")));

  // ── Jumps ────────────────────────────────────────────────────────────────
  const jumpButtons = [["all", T("all")], ...Object.keys(D.incidents).map((kind) => [kind, L(lang, INCIDENTS[kind]) || kind])]
    .map(([key, name]) => el("button", { class: "lk-btn", type: "button", "aria-pressed": "false", dataset: { k: key }, onclick: () => go(key) }, name));
  let pendingJump = "all"; // a jump asked for before the map had a size
  function go(key) {
    for (const b of jumpButtons) b.setAttribute("aria-pressed", String(b.dataset.k === key));
    if (!fitted) { pendingJump = key; return; }
    if (key === "all") return flyTo(fitView());
    const p = D.incidents[key];
    flyTo(viewOn(p[0], p[1], key === "manv" ? 520 : 760));
  }

  // ── Selection ────────────────────────────────────────────────────────────
  const info = el("div", { class: "lk-info", "aria-live": "polite" });
  let selNode = null;
  const utm = (px, py) => [D.west + px * GSD, D.north - py * GSD];
  function latlon(px, py) {
    const u = px / A;
    const v = py / A;
    const c = D.corners;
    const mix = (a, b, t) => a + (b - a) * t;
    return [0, 1].map((i) => mix(mix(c.nw[i], c.ne[i], u), mix(c.sw[i], c.se[i], u), v));
  }
  const fmtUtm = (e, n) => `${num(Math.round(e))} E · ${num(Math.round(n))} N`;
  const fmtLl = ([lat, lon]) => `${num(lat, 5)}° N, ${num(lon, 5)}° ${T("east")}`;
  function select(key) {
    selNode?.remove();
    selNode = null;
    if (!key) {
      replace(info, el("p", { class: "lk-h" }, T("hSel")), el("p", {}, T("selEmpty")));
      return;
    }
    const [src, i] = key.split(":");
    if (src === "look") {
      const o = D.lookalikes[Number(i)];
      selNode = G.sel.appendChild(svg("circle", { cx: o.x, cy: o.y, r: Math.max(o.r + 10, 18 / k), class: "lk-sel" }));
      replace(info, el("p", { class: "lk-h" }, T("hSel")),
        el("p", { class: "lk-info-head" }, el("span", { class: "lk-sw", style: "background:#ffffff" }), L(lang, LOOKALIKES[o.kind]) || o.kind),
        el("p", {}, T("lookText")),
        kv([
          [T("srcRef"), o.flag_ref ? T("flagged") : T("notFlagged")],
          [T("srcNoref"), o.flag_noref ? T("flagged") : T("notFlagged")],
          [T("pos"), fmtUtm(...utm(o.x, o.y))],
        ]));
      return;
    }
    const d = (src === "det" ? D.detections : D.detections_noref)[Number(i)];
    const [x, y, w, h] = d.box;
    const cx = x + w / 2;
    const cy = y + h / 2;
    selNode = G.sel.appendChild(svg("rect", { x: x - 8, y: y - 8, width: w + 16, height: h + 16, class: "lk-sel" }));
    const relevance = d.hint ? (lang === "en" ? HINTS_EN[d.hint] ?? d.hint : d.hint) : "";
    const [name, col] = CLASSES[d.cls] ?? [d.cls, "#ffffff"];
    replace(info, el("p", { class: "lk-h" }, T("hSel")),
      el("p", { class: "lk-info-head" }, el("span", { class: "lk-sw", style: `background:${col}` }), L(lang, name)),
      el("p", {}, src === "det" ? T("srcRef") : T("srcNoref"), relevance ? " · " + relevance : ""),
      kv([
        [T("conf"), num(d.conf, 2)],
        [T("area"), `${num(d.m2, 1)} m²`],
        [T("osmUnder"), L(lang, OSM[d.osm]) || d.osm],
        [T("pos"), fmtUtm(...utm(cx, cy))],
        [T("wgs"), fmtLl(latlon(cx, cy))],
      ]));
  }
  select(null);

  // ── Input ────────────────────────────────────────────────────────────────
  const pointers = new Map();
  let moved = 0;
  let pinch = null;
  map.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    map.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = 0;
    cancelAnimationFrame(anim);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k };
    }
    map.classList.add("is-dragging");
  });
  map.addEventListener("pointermove", (e) => {
    const r = map.getBoundingClientRect();
    const px = (e.clientX - r.left - tx) / k;
    const py = (e.clientY - r.top - ty) / k;
    if (px >= 0 && py >= 0 && px <= A && py <= A) {
      coord.textContent = `UTM 32N ${fmtUtm(...utm(px, py))} · ${fmtLl(latlon(px, py))}`;
    }
    if (!pointers.has(e.pointerId)) return;
    const p = pointers.get(e.pointerId);
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved += Math.abs(dx) + Math.abs(dy);
    if (pointers.size === 1) set({ k, x: tx + dx, y: ty + dy });
    else if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, (pinch.k * d) / pinch.d / k);
      set({ k, x: tx + dx / 2, y: ty + dy / 2 });
    }
  });
  const end = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!pointers.size) map.classList.remove("is-dragging");
    if (moved < 6 && e.type === "pointerup") {
      const hit = document.elementsFromPoint(e.clientX, e.clientY).find((n) => n.dataset?.sel);
      select(hit ? hit.dataset.sel : null);
    }
  };
  map.addEventListener("pointerup", end);
  map.addEventListener("pointercancel", end);
  // The map sits in a scrolling lesson: a plain wheel scrolls the page, Ctrl
  // or ⌘ zooms (a trackpad pinch arrives as a Ctrl wheel).
  let hintTimer = 0;
  map.addEventListener("wheel", (e) => {
    if (!e.ctrlKey && !e.metaKey) {
      hint.classList.add("is-on");
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => hint.classList.remove("is-on"), 1400);
      return;
    }
    e.preventDefault();
    const r = map.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)));
  }, { passive: false });
  map.addEventListener("keydown", (e) => {
    if (e.target !== map) return;
    const step = 80;
    if (e.key === "ArrowLeft") set({ k, x: tx + step, y: ty });
    else if (e.key === "ArrowRight") set({ k, x: tx - step, y: ty });
    else if (e.key === "ArrowUp") set({ k, x: tx, y: ty + step });
    else if (e.key === "ArrowDown") set({ k, x: tx, y: ty - step });
    else if (e.key === "+" || e.key === "=") zoomCenter(1.6);
    else if (e.key === "-" || e.key === "_") zoomCenter(1 / 1.6);
    else if (e.key === "0") go("all");
    else return;
    e.preventDefault();
  });
  knob.addEventListener("pointerdown", (e) => { e.stopPropagation(); knob.setPointerCapture(e.pointerId); });
  knob.addEventListener("pointermove", (e) => {
    if (!knob.hasPointerCapture(e.pointerId)) return;
    swipeX = e.clientX - map.getBoundingClientRect().left;
    updateSwipe();
  });
  knob.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    swipeX += e.key === "ArrowLeft" ? -24 : 24;
    updateSwipe();
    e.preventDefault();
  });

  // ── Start ────────────────────────────────────────────────────────────────
  showBase();
  replace(body,
    el("div", { class: "lk-jump", role: "group", "aria-label": T("jump") }, el("span", { "aria-hidden": "true" }, T("jump")), jumpButtons),
    map, info,
    el("div", { class: "lk-grid" }, baseBox, reportBox, flightBox, seamBox),
    el("p", { class: "lk-note" }, T("note")));

  // Fit once the map has a size; afterwards keep the view on resize.
  const onResize = () => {
    if (!map.isConnected) return observer?.disconnect();
    const [w, h] = size();
    if (!w || !h) return;
    if (!fitted) {
      fitted = true;
      set(fitView());
      if (pendingJump !== "all") go(pendingJump);
      else jumpButtons[0].setAttribute("aria-pressed", "true");
      return;
    }
    const keep = { k, x: tx, y: ty };
    fitView();
    set(keep.k < kFit ? fitView() : keep);
  };
  const observer = "ResizeObserver" in globalThis ? new ResizeObserver(onResize) : null;
  if (observer) observer.observe(map);
  else requestAnimationFrame(onResize);
}

function lagebildVideo(_block, lang) {
  injectStyle("visual-lagekarte", CSS);
  const T = (key) => L(lang, S[key]);
  const video = el("video", {
    class: "lk-video", src: DIR + "lagebild-demo.mp4", poster: DIR + "lagebild-demo.jpg",
    controls: true, preload: "none", playsinline: true, "aria-label": T("videoTitle"),
  });
  const caption = el("p", { class: "lk-note" }, T("videoCaption"));
  video.addEventListener("error", () => { caption.textContent = T("videoMissing"); });
  return el("figure", { class: "lk-card" },
    el("p", { class: "lk-kicker" }, T("kicker")),
    el("p", { class: "lk-title" }, T("videoTitle")),
    el("div", { class: "lk-body" }, video, caption));
}

export const VISUALS = {
  "lagekarte-viewer": lagekarteViewer,
  "lagebild-video": lagebildVideo,
};

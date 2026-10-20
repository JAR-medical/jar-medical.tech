// Visuals for the course "transkription-modell" (CSS prefix vt-).
//   asr-pipeline-cards    five connected module cards; a packet travels through
//                         them and the payload morphs stage by stage
//   syllable-window       3-syllable window → word model vs. J.A.R. → anchor
//                         lexicon and Levenshtein gate
//   model-size-chart      the same pipeline split across edge unit and hub,
//                         switched by set_asr_model (schematic)
//   diarization-timeline  three speaker lanes; only the responder's lane feeds
//                         the clinical extractor
//
// Scenes are drawn on canvas in CSS pixels, so labels keep their size at any
// column width (no viewBox scaling). Text-heavy parts are HTML. Every visible
// string lives in a { de, en } object and is picked with L(lang, …).
import { el } from "../ui.js";
import { injectStyle, animate, hiDpiCanvas, L, prefersReducedMotion, clamp, lerp, ease } from "./kit.js";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const UI = {
  play: { de: "Abspielen", en: "Play" },
  pause: { de: "Pause", en: "Pause" },
  prev: { de: "Zurück", en: "Back" },
  next: { de: "Weiter", en: "Next" },
  schematic: { de: "Schematische Darstellung", en: "Schematic illustration" },
  failed: { de: "Diese Visualisierung konnte nicht geladen werden.", en: "This visualization could not be loaded." },
};

function warnBox(lang, name, reason) {
  console.warn(`visual ${name}:`, reason);
  return el("div", { class: "callout callout-warn", role: "note" }, el("p", {}, L(lang, UI.failed)));
}

// Validates the block, normalises the language and turns a throwing renderer
// into a readable callout instead of a broken lesson.
function guarded(name, render) {
  return (block, lang) => {
    const lg = lang === "en" ? "en" : "de";
    if (!block || typeof block !== "object" || block.type !== name) return warnBox(lg, name, "invalid block");
    try {
      ensureStyles();
      return render(block, lg);
    } catch (e) {
      return warnBox(lg, name, e);
    }
  };
}

// Token values as the canvas sees them (the page re-points tokens inside
// .theme-dark, so they are read from the canvas itself, not from :root).
function palette(node) {
  const cs = getComputedStyle(node);
  const v = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
  return {
    bg: v("--bg-deep", "#14132f"),
    raise: v("--bg-raise", "#23224f"),
    raise2: v("--bg-raise-2", "#2b2a5c"),
    ink: v("--ink", "#ffffff"),
    soft: v("--ink-soft", "#b9c0d4"),
    faint: v("--ink-faint", "#8b93ac"),
    line: v("--line", "rgba(255,255,255,0.12)"),
    lineStrong: v("--line-strong", "rgba(255,255,255,0.26)"),
    accent: v("--accent", "#8ec7b8"),
    mint: v("--brand-mint", "#8ec7b8"),
    teal: v("--brand-teal", "#317f71"),
    red: v("--sig-red", "#f0776e"),
    amber: v("--sig-amber", "#f0b45c"),
    green: v("--sig-green", "#5cc08f"),
    sans: v("--font-sans", "sans-serif"),
    mono: v("--font-mono", "monospace"),
  };
}

// "#rrggbb" or "rgb(a)(…)" → rgba() with the given alpha.
function rgba(color, a) {
  const c = String(color).trim();
  let r = 0, g = 0, b = 0;
  if (c[0] === "#") {
    const h = c.length === 4 ? [...c.slice(1)].map((x) => x + x).join("") : c.slice(1, 7);
    r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16);
  } else {
    const m = c.match(/[\d.]+/g);
    if (m && m.length >= 3) [r, g, b] = m.map(Number);
  }
  return `rgba(${r},${g},${b},${a})`;
}

function font(P, size, { weight = 400, mono = false } = {}) {
  return `${weight} ${size}px ${mono ? P.mono : P.sans}`;
}

// Draws one line of text; returns its width.
function txt(ctx, P, s, x, y, { size = 13, color = P.ink, align = "left", base = "middle", weight = 400, mono = false } = {}) {
  ctx.font = font(P, size, { weight, mono });
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  ctx.fillText(s, x, y);
  return ctx.measureText(s).width;
}

function measure(ctx, P, s, size = 13, opts = {}) {
  ctx.font = font(P, size, opts);
  return ctx.measureText(s).width;
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (w < 0) { x += w; w = -w; }
  if (h < 0) { y += h; h = -h; }
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
  else ctx.rect(x, y, w, h);
}

// Text on a rounded plate. align: left | center | right relative to x.
function chip(ctx, P, s, x, y, { size = 12, color = P.ink, fill = P.raise, stroke = null, align = "left", mono = false, weight = 500, padX = 7, h = 22 } = {}) {
  const w = measure(ctx, P, s, size, { mono, weight }) + padX * 2;
  const x0 = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
  rrect(ctx, x0, y - h / 2, w, h, 6);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  txt(ctx, P, s, x0 + padX, y + 0.5, { size, color, mono, weight });
  return w;
}

// Splits text into lines that fit maxW.
function wrapLines(ctx, P, s, maxW, size = 13, opts = {}) {
  ctx.font = font(P, size, opts);
  const words = String(s).split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

const seg01 = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

// Deterministic pseudo-random numbers so every render looks the same.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// A looping timeline bound to animate(): play/pause/seek, redraws on demand.
// With reduced motion it draws `stillT` once; pressing play starts it anyway.
function makePlayer(stage, { duration, stillT = 0, draw }) {
  const reduced = prefersReducedMotion();
  const st = { t: 0, playing: !reduced, dirty: true, live: !reduced };
  const subs = [];
  const frame = (_, dt, still) => {
    if (still) { st.t = stillT; draw(st.t); return; }
    if (st.playing && dt) { st.t = (st.t + dt) % duration; st.dirty = true; }
    if (st.dirty) { st.dirty = false; draw(st.t); }
  };
  let loop = animate(stage, frame);
  const emit = () => subs.forEach((fn) => fn());
  return {
    get t() { return st.t; },
    get playing() { return st.playing; },
    redraw() {
      if (st.live) st.dirty = true;
      else if (stage.isConnected) draw(st.t);
    },
    seek(t) {
      st.t = ((t % duration) + duration) % duration;
      this.redraw();
      emit();
    },
    play() {
      st.playing = true;
      if (!st.live) { st.live = true; loop.stop(); loop = animate(stage, frame, { still: false }); }
      emit();
    },
    pause() { st.playing = false; emit(); },
    toggle() { if (st.playing) this.pause(); else this.play(); },
    onChange(fn) { subs.push(fn); },
  };
}

function button(label, onClick, extra = {}) {
  return el("button", { class: "btn btn-outline btn-small", type: "button", onclick: onClick, ...extra }, label);
}

function playButton(player, lang) {
  const b = button("", () => player.toggle());
  const sync = () => { b.textContent = L(lang, player.playing ? UI.pause : UI.play); };
  player.onChange(sync);
  sync();
  return b;
}

// Segmented control: returns { node, set(i) }.
function segmented(labels, onPick, ariaLabel) {
  const btns = labels.map((label, i) => el("button", { type: "button", class: "vt-seg-btn", "aria-pressed": "false", onclick: () => onPick(i) }, label));
  const node = el("div", { class: "vt-seg", role: "group", "aria-label": ariaLabel }, btns);
  return {
    node,
    set(i) { btns.forEach((b, j) => { b.setAttribute("aria-pressed", String(i === j)); b.classList.toggle("is-on", i === j); }); },
  };
}

// Card frame: eyebrow + title + controls, then the body parts.
function frame(lang, { eyebrow, title, label, controls = [] }, ...body) {
  return el("figure", { class: "vt", "aria-label": label },
    el("div", { class: "vt-head" },
      el("div", { class: "vt-head-text" },
        el("span", { class: "vt-eyebrow" }, eyebrow),
        el("p", { class: "vt-title" }, title)),
      controls.length ? el("div", { class: "vt-controls" }, controls) : null),
    ...body);
}

function canvasStage(className, ariaLabel, onResize) {
  const cv = hiDpiCanvas("vt-canvas " + className, onResize);
  cv.canvas.setAttribute("role", "img");
  cv.canvas.setAttribute("aria-label", ariaLabel);
  return cv;
}

function ensureStyles() {
  injectStyle("vt-styles", `
.vt { margin: var(--sp-5) 0 var(--sp-6); padding: clamp(0.75rem, 2.4vw, 1.25rem); background: var(--bg-raise); border-radius: var(--r-md); box-shadow: inset 0 0 0 1px var(--line); color: var(--ink); font-size: var(--t-small); line-height: 1.45; min-width: 0; }
.vt-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: var(--sp-3) var(--sp-4); margin-bottom: var(--sp-4); }
.vt-head-text { min-width: 0; flex: 1 1 16rem; }
.vt-eyebrow { display: block; font-family: var(--font-mono); font-size: var(--t-micro); letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
.vt-title { margin: 2px 0 0; font-size: 1.06rem; font-weight: 600; letter-spacing: -0.01em; line-height: 1.3; color: var(--ink); }
.vt-controls { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
.vt-canvas { display: block; width: 100%; border-radius: var(--r-sm); background: var(--bg-deep); box-shadow: inset 0 0 0 1px var(--line); touch-action: pan-y; }
.vt-note { margin-top: var(--sp-3); font-family: var(--font-mono); font-size: var(--t-micro); letter-spacing: 0.04em; color: var(--ink-faint); }
.vt-seg { display: flex; flex-wrap: wrap; gap: 4px; padding: 3px; margin-bottom: var(--sp-3); border-radius: var(--r-pill); box-shadow: inset 0 0 0 1px var(--line); width: fit-content; max-width: 100%; }
.vt-seg-btn { padding: 0.35rem 0.8rem; border-radius: var(--r-pill); font-size: 0.82rem; font-weight: 500; color: var(--ink-soft); }
.vt-seg-btn:hover { color: var(--ink); }
.vt-seg-btn.is-on { background: var(--surface-tint); color: var(--ink); box-shadow: inset 0 0 0 1px var(--line-mint); }
.vt-quote { margin: 0 0 var(--sp-3); font-family: var(--font-mono); font-size: 0.82rem; color: var(--ink-soft); }
.vt-quote b { color: var(--ink); font-weight: 500; }

/* Pipeline cards */
.vt-track { position: relative; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: var(--sp-2); padding-top: 26px; margin-bottom: var(--sp-3); }
.vt-rail { position: absolute; left: 0; right: 0; top: 10px; height: 2px; background: var(--line-strong); border-radius: 2px; }
.vt-rail-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: var(--accent); border-radius: 2px; }
.vt-packet { position: absolute; left: 0; top: 0; width: 18px; height: 18px; margin: -8px 0 0 -9px; border-radius: 50%; background: var(--brand-mint); box-shadow: 0 0 0 4px var(--surface-tint), 0 0 18px var(--brand-mint); pointer-events: none; will-change: transform; }
.vt-card { position: relative; display: flex; flex-direction: column; gap: 3px; min-width: 0; padding: var(--sp-3); border-radius: var(--r-sm); background: var(--bg-deep); box-shadow: inset 0 0 0 1px var(--line); text-align: left; color: var(--ink); transition: box-shadow var(--dur) var(--ease-out), background-color var(--dur) var(--ease-out); }
.vt-card::before { content: ""; position: absolute; top: -21px; left: 50%; width: 10px; height: 10px; margin-left: -5px; border-radius: 50%; background: var(--bg-raise); box-shadow: inset 0 0 0 2px var(--line-strong); }
.vt-card.is-done::before { box-shadow: inset 0 0 0 5px var(--accent); }
.vt-card:hover { background: var(--bg-raise-2); }
.vt-card.is-active { background: var(--surface-tint); box-shadow: inset 0 0 0 1px var(--line-mint), 0 0 0 1px var(--line-mint); }
.vt-card.is-picked { box-shadow: inset 0 0 0 2px var(--accent); }
.vt-card-num { font-family: var(--font-mono); font-size: var(--t-micro); color: var(--accent); }
.vt-card-name { font-size: 0.88rem; font-weight: 600; line-height: 1.25; overflow-wrap: anywhere; }
.vt-card-tech { font-size: 0.76rem; line-height: 1.3; color: var(--ink-soft); overflow-wrap: anywhere; }
.vt-payload { height: 236px; }
.vt-inspect { min-height: 8.6em; margin-top: var(--sp-3); padding: var(--sp-3) var(--sp-4); border-radius: var(--r-sm); background: var(--bg-deep); box-shadow: inset 2px 0 0 var(--accent), inset 0 0 0 1px var(--line); }
.vt-inspect-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--sp-1) var(--sp-3); margin-bottom: var(--sp-2); }
.vt-inspect-title { font-weight: 600; color: var(--ink); }
.vt-inspect-tech { font-family: var(--font-mono); font-size: var(--t-micro); color: var(--accent); }
.vt-inspect ul { display: grid; gap: 4px; }
.vt-inspect li { position: relative; padding-left: 16px; color: var(--ink-soft); }
.vt-inspect li::before { content: ""; position: absolute; left: 0; top: 0.7em; width: 8px; height: 1px; background: var(--accent); }
@media (max-width: 560px) {
  .vt-track { grid-template-columns: 1fr; padding-top: 0; padding-left: 30px; gap: 6px; }
  .vt-rail { left: 11px; right: auto; top: 0; bottom: 0; width: 2px; height: auto; }
  .vt-rail-fill { width: 100%; height: 0; }
  .vt-card { flex-direction: row; flex-wrap: wrap; align-items: baseline; gap: 2px 8px; padding: var(--sp-2) var(--sp-3); }
  .vt-card::before { top: 50%; left: -24px; margin: -5px 0 0; }
  .vt-card-tech { flex-basis: 100%; }
  .vt-payload { height: 268px; }
  .vt-inspect { min-height: 13.5em; }
}

.vt-syl { height: 272px; }
.vt-size { height: 330px; }
.vt-diar { height: 196px; }
@media (max-width: 560px) {
  .vt-syl { height: 340px; }
  .vt-size { height: 352px; }
  .vt-diar { height: 200px; }
}

/* Diarization transcript */
.vt-rows { display: grid; gap: 6px; margin-top: var(--sp-3); }
.vt-row { display: grid; grid-template-columns: auto auto 1fr auto; align-items: baseline; gap: 4px 10px; padding: 6px 10px; border-radius: var(--r-sm); background: var(--bg-deep); box-shadow: inset 0 0 0 1px var(--line); opacity: 0.28; transition: opacity var(--dur) var(--ease-out); }
.vt-row.is-on { opacity: 1; }
.vt-row-time { font-family: var(--font-mono); font-size: var(--t-micro); color: var(--ink-faint); white-space: nowrap; }
.vt-spk { font-size: var(--t-micro); font-weight: 600; letter-spacing: 0.02em; padding: 1px 8px; border-radius: var(--r-pill); white-space: nowrap; }
.vt-spk-0 { color: var(--accent); box-shadow: inset 0 0 0 1px var(--line-mint); }
.vt-spk-1 { color: var(--sig-amber); box-shadow: inset 0 0 0 1px var(--sig-amber); }
.vt-spk-2 { color: var(--ink-soft); box-shadow: inset 0 0 0 1px var(--line-strong); }
.vt-row-text { color: var(--ink); min-width: 0; }
.vt-out { font-family: var(--font-mono); font-size: var(--t-micro); white-space: nowrap; color: var(--ink-faint); }
.vt-out-take { color: var(--sig-green); }
.vt-out-neg { color: var(--sig-amber); }
@media (max-width: 560px) {
  .vt-row { grid-template-columns: auto 1fr; }
  .vt-row-text { grid-column: 1 / -1; }
  .vt-out { grid-column: 1 / -1; white-space: normal; }
}
`);
}

// ---------------------------------------------------------------------------
// 1. asr-pipeline-cards
// ---------------------------------------------------------------------------

const MODULES = [
  {
    name: { de: "Audio-Frontend", en: "Audio frontend" },
    tech: "DeepFilterNet3 / GTCRN · Silero-VAD",
    short: "DeepFilterNet3 · VAD",
    facts: {
      de: ["Entrauscht jeden 20-ms-Frame in unter 3 ms.", "Nahfeld-Gate unter 250 Hz: Martinshorn, Motor und Wind fallen weg.", "Silero-VAD lässt nur Sprachabschnitte weiter."],
      en: ["Denoises every 20 ms frame in under 3 ms.", "Near-field gate below 250 Hz: siren, engine and wind are removed.", "Silero-VAD passes on speech segments only."],
    },
  },
  {
    name: { de: "Phoneme & Silben", en: "Phonemes & syllables" },
    tech: "wav2vec2 S2P · CTC",
    short: "wav2vec2 · CTC",
    facts: {
      de: ["Sprache direkt zu IPA-Phonemen (CTC), ohne Wortlexikon.", "Blank-Frames ab 80 ms markieren Wortgrenzen.", "Deterministischer Silbentrenner (Sonorität + Maximal-Onset): genau ein Vokalkern pro Silbe."],
      en: ["Speech straight to IPA phonemes (CTC), no word lexicon.", "Blank frames of 80 ms or more mark word boundaries.", "Deterministic syllabifier (sonority + maximal onset): exactly one vowel nucleus per syllable."],
    },
  },
  {
    name: { de: "Silben-Transducer", en: "Syllable transducer" },
    tech: "ByT5-Small · 3-syllable window",
    short: "ByT5-Small",
    facts: {
      de: ["Fenster [links | Ziel | rechts] → Buchstaben der mittleren Silbe.", "Alle Silben parallel in 5–8 ms.", "Sieht nie mehr als 15–20 Phoneme: kein Satzkontext zum Erfinden."],
      en: ["Window [left | target | right] → letters of the middle syllable.", "All syllables in parallel in 5–8 ms.", "Never sees more than 15–20 phonemes: no sentence context to invent from."],
    },
  },
  {
    name: { de: "Refiner & Gate", en: "Refiner & gate" },
    tech: "medical_lexicon.txt · Levenshtein gate",
    short: { de: "Lexikon · Gate", en: "lexicon · gate" },
    facts: {
      de: ["Fügt Komposita an Fugen (-s-, -ungs-, -ions-) zusammen.", "Anker-Lexikon korrigiert ab 82 % IPA-Ähnlichkeit.", "Jede Änderung zurück in IPA: über 20 % Abweichung wird blockiert; Konfidenz unter 0,45 → [UNSICHER: …]."],
      en: ["Joins German compounds at linking morphemes (-s-, -ungs-, -ions-).", "Anchor lexicon corrects at 82 % IPA similarity or more.", "Every edit back to IPA: more than 20 % deviation is blocked; confidence below 0.45 → [UNCERTAIN: …]."],
    },
  },
  {
    name: { de: "Klinischer Extraktor", en: "Clinical extractor" },
    tech: "GBNF grammar · source_quote",
    short: { de: "GBNF-Grammatik", en: "GBNF grammar" },
    facts: {
      de: ["Filtert Gesprächsrauschen heraus.", "Extrahiert Vitalwerte, Medikamente und cABCDE-Befunde.", "Jeder Befund mit wörtlichem source_quote; Verneinungen als verneint markiert."],
      en: ["Filters out chatter.", "Extracts vitals, medications and cABCDE findings.", "Every finding carries a verbatim source_quote; negations are flagged as negated."],
    },
  },
];

// The first term of the example utterance, phone by phone, grouped into
// syllables (sonority + maximal onset) with the written syllable each yields.
const TERM = {
  de: {
    syl: [["ʃ", "p", "a"], ["n", "ʊ", "ŋ", "s"], ["p", "n", "ɔʏ"], ["m", "o"], ["t", "o"], ["ʁ", "a", "k", "s"]],
    written: ["Span", "nungs", "pneu", "mo", "tho", "rax"],
    boundaryAfter: -1,
    word: "Spannungspneumothorax",
    link: [5, 9], // highlight the linking morpheme "-ungs-"
  },
  en: {
    syl: [["t", "ɛ", "n"], ["ʃ", "ə", "n"], ["n", "j", "uː"], ["m", "oʊ"], ["θ", "ɔː"], ["r", "æ", "k", "s"]],
    written: ["ten", "sion", "pneu", "mo", "tho", "rax"],
    boundaryAfter: 1,
    word: "tension pneumothorax",
    link: null,
  },
};
const VOWELS = new Set(["a", "ʊ", "ɔʏ", "o", "ɛ", "ə", "uː", "oʊ", "ɔː", "æ", "ɪ", "eɪ", "iː", "e", "u", "i"]);

const PIPE = {
  eyebrow: { de: "ASR-Pipeline · 5 Module", en: "ASR pipeline · 5 modules" },
  title: { de: "Ein Funkspruch wandert durch die Pipeline", en: "One utterance travels through the pipeline" },
  label: {
    de: "Animation: Ein Audiopaket wandert durch fünf verbundene Module. Die Nutzlast wandelt sich von verrauschter Wellenform über saubere Wellenform, IPA-Phoneme und Silben zum geschriebenen Wort und zum JSON-Befund mit source_quote.",
    en: "Animation: an audio packet travels through five connected modules. The payload turns from a noisy waveform into a clean waveform, IPA phonemes, syllables, the written word and finally a JSON finding with source_quote.",
  },
  utterLabel: { de: "Beispiel:", en: "Example:" },
  utter: { de: "„Spannungspneumothorax links, Atemfrequenz 32“", en: "“Tension pneumothorax left, respiratory rate 32”" },
  cardHint: { de: "Karte antippen für Details", en: "Tap a card for details" },
  stage: [
    { de: "Eingang · Helm-Mikrofon", en: "Input · helmet microphone" },
    { de: "Nach Modul 1 · sauberes Audio", en: "After module 1 · clean audio" },
    { de: "Nach Modul 2 · IPA-Phoneme", en: "After module 2 · IPA phonemes" },
    { de: "Nach Modul 2 · Silben", en: "After module 2 · syllables" },
    { de: "Nach Modul 3 · Buchstaben je Silbe", en: "After module 3 · letters per syllable" },
    { de: "Nach Modul 4 · geprüftes Wort", en: "After module 4 · verified word" },
    { de: "Nach Modul 5 · strukturierter Befund", en: "After module 5 · structured finding" },
  ],
  speech: { de: "Sprache", en: "speech" },
  siren: { de: "Martinshorn", en: "siren" },
  engine: { de: "Motor", en: "engine" },
  gate: { de: "< 250 Hz entfernt", en: "< 250 Hz removed" },
  frames: { de: "20-ms-Frames · < 3 ms je Frame", en: "20 ms frames · < 3 ms per frame" },
  vad: { de: "VAD: Sprache", en: "VAD: speech" },
  excerpt: { de: "Ausschnitt: erstes Wort", en: "Excerpt: first term" },
  boundary: { de: "Blank ≥ 80 ms → Wortgrenze", en: "blank ≥ 80 ms → word boundary" },
  nucleus: { de: "ein Vokalkern je Silbe", en: "one vowel nucleus per syllable" },
  parallel: { de: "alle Fenster parallel · 5–8 ms", en: "all windows in parallel · 5–8 ms" },
  merged: { de: "Fuge -ungs- verbunden", en: "syllables joined into words" },
  anchor: { de: "Anker ≥ 82 % ✓", en: "anchor ≥ 82 % ✓" },
  gateOk: { de: "Gate ≤ 20 % ✓", en: "gate ≤ 20 % ✓" },
  json: {
    de: [
      ["{", ""], ['  "finding": ', '"Spannungspneumothorax",'], ['  "side": ', '"links",'], ['  "source_quote": ', '"Spannungspneumothorax links"'], ["}, {", ""],
      ['  "vital": ', '"respiratory_rate",'], ['  "value": ', "32,"], ['  "source_quote": ', '"Atemfrequenz 32"'], ["}", ""],
    ],
    en: [
      ["{", ""], ['  "finding": ', '"tension pneumothorax",'], ['  "side": ', '"left",'], ['  "source_quote": ', '"Tension pneumothorax left"'], ["}, {", ""],
      ['  "vital": ', '"respiratory_rate",'], ['  "value": ', "32,"], ['  "source_quote": ', '"respiratory rate 32"'], ["}", ""],
    ],
  },
};

const PHASE = 3.8; // seconds per stage
const PHASES = 6; // input + 5 module outputs (module 2 shows two sub-steps)

function renderAsrPipelineCards(block, lang) {
  const term = TERM[lang];
  let picked = -1;

  const rail = el("div", { class: "vt-rail" }, el("div", { class: "vt-rail-fill" }));
  const packet = el("div", { class: "vt-packet", "aria-hidden": "true" });
  const cards = MODULES.map((m, i) => el("button", {
    type: "button",
    class: "vt-card",
    "aria-label": `${String(i + 1).padStart(2, "0")} ${L(lang, m.name)}`,
    onclick: () => pick(i),
  },
  el("span", { class: "vt-card-num" }, String(i + 1).padStart(2, "0")),
  el("span", { class: "vt-card-name" }, L(lang, m.name)),
  el("span", { class: "vt-card-tech" }, L(lang, m.short))));
  const track = el("div", { class: "vt-track" }, rail, cards, packet);

  const inspectTitle = el("span", { class: "vt-inspect-title" });
  const inspectTech = el("span", { class: "vt-inspect-tech" });
  const inspectList = el("ul");
  const inspect = el("div", { class: "vt-inspect", "aria-live": "polite" },
    el("div", { class: "vt-inspect-head" }, inspectTitle, inspectTech), inspectList);
  let shownModule = -1;
  const showModule = (i) => {
    if (i === shownModule) return;
    shownModule = i;
    const m = MODULES[i];
    inspectTitle.textContent = `${String(i + 1).padStart(2, "0")} · ${L(lang, m.name)}`;
    inspectTech.textContent = m.tech;
    inspectList.replaceChildren(...L(lang, m.facts).map((f) => el("li", {}, f)));
  };

  let P = null;
  let player = null;
  const cv = canvasStage("vt-payload", L(lang, PIPE.label), () => { P = null; player?.redraw(); });

  // Phase k = 0 input, 1..5 = output of module k. Module 2 also groups into
  // syllables during the second half of its phase.
  function draw(t) {
    const { w, h } = cv.size();
    const ctx = cv.ctx;
    if (!P) P = palette(cv.canvas);
    ctx.clearRect(0, 0, w, h);
    const k = Math.floor(t / PHASE) % PHASES;
    const u = (t % PHASE) / PHASE; // 0..1 within the phase

    // Packet position and card states (HTML).
    const travel = k === 0 ? 0 : ease(seg01(u, 0, 0.22));
    const from = k === 0 ? -1 : k - 2;
    const to = k - 1;
    positionPacket(from, to, travel, k);
    const arrived = k > 0 && u >= 0.22;
    cards.forEach((c, i) => {
      c.classList.toggle("is-active", arrived && i === k - 1);
      c.classList.toggle("is-done", i < k - 1 || (arrived && i === k - 1));
      c.classList.toggle("is-picked", i === picked);
    });
    showModule(picked >= 0 ? picked : Math.max(0, k - 1));

    // Payload header.
    const narrow = w < 520;
    const pad = narrow ? 12 : 16;
    let stageLabel = k === 2 && u > 0.55 ? PIPE.stage[3] : PIPE.stage[k <= 2 ? k : k + 1];
    txt(ctx, P, L(lang, stageLabel), pad, 18, { size: 12, color: P.accent, mono: true });
    if (k >= 2 && k <= 4 && !narrow) txt(ctx, P, L(lang, PIPE.excerpt), w - pad, 18, { size: 12, color: P.faint, align: "right", mono: true });

    const p = ease(seg01(u, 0.2, 0.75));
    const area = { x: pad, y: 36, w: w - pad * 2, h: h - 36 - pad };
    if (k <= 1) drawWave(ctx, area, t, k === 0 ? 0 : p, narrow);
    else if (k === 2) drawPhonemes(ctx, area, seg01(u, 0.1, 0.5), ease(seg01(u, 0.55, 0.85)), narrow);
    else if (k === 3) drawSyllablesToLetters(ctx, area, p, narrow);
    else if (k === 4) drawMerged(ctx, area, p, narrow);
    else drawJson(ctx, area, seg01(u, 0.1, 0.8), narrow);
  }

  function positionPacket(from, to, f, k) {
    const narrow = globalThis.matchMedia?.("(max-width: 560px)").matches === true;
    const center = (i) => {
      if (i < 0) {
        const c = cards[0];
        return narrow ? { x: 12, y: c.offsetTop - 8 } : { x: c.offsetLeft - 4, y: 11 };
      }
      const c = cards[i];
      return narrow ? { x: 12, y: c.offsetTop + c.offsetHeight / 2 } : { x: c.offsetLeft + c.offsetWidth / 2, y: 11 };
    };
    const a = center(from);
    const b = center(to < 0 ? -1 : to);
    const x = lerp(a.x, b.x, f);
    const y = lerp(a.y, b.y, f);
    packet.style.transform = `translate(${x}px, ${y}px)`;
    const fill = rail.firstChild;
    if (narrow) { fill.style.height = `${Math.max(0, y)}px`; fill.style.width = ""; }
    else { fill.style.width = `${Math.max(0, x)}px`; fill.style.height = ""; }
    packet.style.opacity = k === 0 ? "0.75" : "1";
  }

  // Noisy → clean waveform. clean = 0..1 sweeps left to right like 20 ms
  // frames being processed; left of the sweep the noise is gone.
  function drawWave(ctx, a, t, clean, narrow) {
    const mid = a.y + a.h * 0.5;
    const amp = a.h * 0.3;
    const sweepX = a.x + a.w * clean;
    const words = [[0.03, 0.36], [0.42, 0.52], [0.6, 0.8], [0.84, 0.97]];
    const env = (f) => {
      for (const [s0, e0] of words) if (f > s0 && f < e0) return Math.sin(Math.PI * (f - s0) / (e0 - s0)) ** 0.7;
      return 0;
    };
    const speech = (f) => env(f) * (0.6 * Math.sin(f * 260 + t * 2) * (0.6 + 0.4 * Math.sin(f * 31)) + 0.25 * Math.sin(f * 610 + 1.3));
    const noise = (f) => 0.38 * Math.sin(f * (70 + 18 * Math.sin(t * 1.2)) * 2 + t * 5) + 0.32 * Math.sin(f * 16 + t * 7) + 0.1 * Math.sin(f * 1400 + t * 30);
    // frame grid + VAD boxes on the cleaned part
    if (clean > 0) {
      ctx.strokeStyle = rgba(P.ink, 0.05);
      ctx.lineWidth = 1;
      for (let x = a.x; x < sweepX; x += 8) { ctx.beginPath(); ctx.moveTo(x, a.y + 24); ctx.lineTo(x, a.y + a.h - 22); ctx.stroke(); }
      for (const [s0, e0] of words) {
        const x0 = a.x + s0 * a.w;
        const x1 = Math.min(a.x + e0 * a.w, sweepX);
        if (x1 <= x0) continue;
        ctx.fillStyle = rgba(P.mint, 0.1);
        ctx.fillRect(x0, mid - amp - 4, x1 - x0, amp * 2 + 8);
      }
    }
    const n = Math.max(60, Math.floor(a.w / 1.5));
    const path = (from, to, withNoise) => {
      ctx.beginPath();
      let first = true;
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        const x = a.x + f * a.w;
        if (x < from || x > to) continue;
        const y = mid - amp * (speech(f) + (withNoise ? noise(f) : 0));
        if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
      }
    };
    // noisy remainder (right of the sweep): speech buried in siren + engine
    path(sweepX, a.x + a.w, true);
    ctx.strokeStyle = rgba(P.red, 0.75);
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // cleaned part
    if (clean > 0) {
      path(a.x, sweepX, false);
      ctx.strokeStyle = P.mint;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    if (clean > 0 && clean < 1) {
      ctx.strokeStyle = P.accent;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sweepX, a.y + 20); ctx.lineTo(sweepX, a.y + a.h - 20); ctx.stroke();
    }
    const by = a.y + a.h - 6;
    if (clean < 1) {
      let x = a.x + a.w;
      x -= chip(ctx, P, L(lang, PIPE.engine), x, by, { align: "right", color: P.red, fill: rgba(P.red, 0.14) }) + 6;
      chip(ctx, P, L(lang, PIPE.siren), x, by, { align: "right", color: P.red, fill: rgba(P.red, 0.14) });
    }
    if (clean === 0) chip(ctx, P, L(lang, PIPE.speech) + " + " + L(lang, PIPE.siren) + " + " + L(lang, PIPE.engine), a.x, a.y + 8, { color: P.soft, fill: rgba(P.ink, 0.06), h: 20 });
    else chip(ctx, P, L(lang, PIPE.vad), a.x, a.y + 8, { color: P.mint, fill: rgba(P.mint, 0.12), h: 20 });
    if (clean > 0) {
      if (clean >= 1) {
        const x = chip(ctx, P, L(lang, PIPE.gate), a.x, by, { color: P.green, fill: rgba(P.green, 0.14) });
        if (!narrow) chip(ctx, P, L(lang, PIPE.frames), a.x + x + 8, by, { color: P.soft, fill: rgba(P.ink, 0.06) });
      } else if (!narrow) chip(ctx, P, L(lang, PIPE.frames), a.x, by, { color: P.soft, fill: rgba(P.ink, 0.06) });
    }
  }

  // Lays out phone tokens in rows that fit the width; rows only break
  // between syllables so a syllable frame never spans two rows.
  function tokenLayout(ctx, a, size, gapSyl) {
    const tw = (ph) => Math.max(size * 1.15, measure(ctx, P, ph, size, { mono: true }) + 10);
    const out = [];
    const rowsW = [0];
    let x = 0, row = 0;
    term.syl.forEach((syl, si) => {
      const widths = syl.map(tw);
      const sylW = widths.reduce((s0, v) => s0 + v, 0) + 3 * (syl.length - 1);
      const lead = si === 0 ? 0 : gapSyl + (term.boundaryAfter === si - 1 ? gapSyl * 1.6 + 6 : 0);
      if (x > 0 && x + lead + sylW > a.w) { row++; x = 0; rowsW.push(0); } else x += lead;
      syl.forEach((ph, pi) => {
        out.push({ ph, si, pi, x, row, w: widths[pi] });
        x += widths[pi] + (pi < syl.length - 1 ? 3 : 0);
      });
      rowsW[row] = x;
    });
    return { tokens: out, rowsW };
  }

  function drawPhonemes(ctx, a, appear, group, narrow) {
    const size = narrow ? 14 : 17;
    const gap = lerp(0, narrow ? 10 : 16, group);
    const { tokens, rowsW } = tokenLayout(ctx, a, size, gap);
    const rowH = size + 22;
    const rows = rowsW.length;
    const top = a.y + (a.h - rows * rowH) / 2 - 6;
    // syllable frames
    if (group > 0) {
      term.syl.forEach((_, si) => {
        const ts = tokens.filter((tk) => tk.si === si);
        const r = ts[0].row;
        const ox = a.x + (a.w - rowsW[r]) / 2;
        const x0 = ox + ts[0].x - 4;
        const x1 = ox + ts[ts.length - 1].x + ts[ts.length - 1].w + 4;
        rrect(ctx, x0, top + r * rowH - 4, x1 - x0, size + 16, 8);
        ctx.strokeStyle = rgba(P.mint, 0.7 * group);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    }
    tokens.forEach((tk, i) => {
      const vis = clamp(appear * tokens.length - i, 0, 1);
      if (vis <= 0) return;
      const ox = a.x + (a.w - rowsW[tk.row]) / 2;
      const x = ox + tk.x;
      const y = top + tk.row * rowH;
      const vowel = VOWELS.has(tk.ph);
      ctx.globalAlpha = vis;
      rrect(ctx, x, y, tk.w, size + 8, 5);
      ctx.fillStyle = group > 0 && vowel ? rgba(P.amber, 0.22) : rgba(P.ink, 0.07);
      ctx.fill();
      txt(ctx, P, tk.ph, x + tk.w / 2, y + (size + 8) / 2 + 1, { size, color: group > 0 && vowel ? P.amber : P.ink, align: "center", mono: true });
      ctx.globalAlpha = 1;
    });
    // word boundary marker
    if (term.boundaryAfter >= 0 && appear > 0.5) {
      const last = tokens.filter((tk) => tk.si === term.boundaryAfter).pop();
      const ox = a.x + (a.w - rowsW[last.row]) / 2;
      const bx = ox + last.x + last.w + gap * 1.3 + 4;
      ctx.strokeStyle = P.amber;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(bx, top + last.row * rowH - 8); ctx.lineTo(bx, top + last.row * rowH + size + 14); ctx.stroke();
      ctx.setLineDash([]);
    }
    const by = a.y + a.h - 4;
    if (group > 0.5) chip(ctx, P, L(lang, PIPE.nucleus), a.x, by, { color: P.amber, fill: rgba(P.amber, 0.14) });
    else if (term.boundaryAfter >= 0) chip(ctx, P, L(lang, PIPE.boundary), a.x, by, { color: P.amber, fill: rgba(P.amber, 0.14) });
    else chip(ctx, P, "wav2vec2 · CTC", a.x, by, { color: P.soft, fill: rgba(P.ink, 0.06), mono: true });
  }

  // Syllable boxes (IPA) on top, written letters appear beneath — all at once.
  function syllableColumns(ctx, a, narrow) {
    const n = term.syl.length;
    const gap = narrow ? 4 : 8;
    const extra = term.boundaryAfter >= 0 ? (narrow ? 8 : 14) : 0;
    const colW = (a.w - gap * (n - 1) - extra) / n;
    return term.syl.map((s, i) => ({ x: a.x + i * (colW + gap) + (i > term.boundaryAfter && term.boundaryAfter >= 0 ? extra : 0), w: colW }));
  }

  function drawSyllablesToLetters(ctx, a, p, narrow) {
    const cols = syllableColumns(ctx, a, narrow);
    const size = narrow ? 13 : 16;
    const y1 = a.y + 10;
    const y2 = a.y + a.h * 0.56;
    cols.forEach((c, i) => {
      const ipa = term.syl[i].join("");
      rrect(ctx, c.x, y1, c.w, size + 14, 7);
      ctx.strokeStyle = rgba(P.mint, 0.7);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      txt(ctx, P, ipa, c.x + c.w / 2, y1 + (size + 14) / 2 + 1, { size, color: P.ink, align: "center", mono: true });
      // all windows fire together
      const flash = Math.sin(clamp(p * 1.6, 0, 1) * Math.PI);
      ctx.strokeStyle = rgba(P.accent, 0.25 + 0.6 * flash);
      ctx.beginPath();
      ctx.moveTo(c.x + c.w / 2, y1 + size + 18);
      ctx.lineTo(c.x + c.w / 2, y2 - 6);
      ctx.stroke();
      const q = clamp(p * 1.4 - 0.25, 0, 1);
      const word = term.written[i];
      const shown = word.slice(0, Math.round(q * word.length));
      rrect(ctx, c.x, y2, c.w, size + 16, 7);
      ctx.fillStyle = rgba(P.mint, 0.08 + 0.1 * q);
      ctx.fill();
      txt(ctx, P, shown, c.x + c.w / 2, y2 + (size + 16) / 2 + 1, { size: size + 1, color: P.ink, align: "center", weight: 600 });
    });
    const by = a.y + a.h - 4;
    chip(ctx, P, L(lang, PIPE.parallel), a.x, by, { color: P.accent, fill: rgba(P.mint, 0.12) });
  }

  function drawMerged(ctx, a, p, narrow) {
    const size = narrow ? 22 : 30;
    const cy = a.y + a.h * 0.42;
    // syllables slide together into the word
    ctx.font = font(P, size, { weight: 600 });
    const full = term.word;
    const fullW = ctx.measureText(full).width;
    const fit = Math.min(1, (a.w - 8) / fullW);
    const sz = Math.max(16, Math.floor(size * fit));
    ctx.font = font(P, sz, { weight: 600 });
    const wordW = ctx.measureText(full).width;
    const startX = a.x + (a.w - wordW) / 2;
    let offset = 0;
    let charIdx = 0;
    const spread = (1 - p) * (narrow ? 8 : 16);
    term.written.forEach((s, i) => {
      // the written syllables, letter case as in the final word
      const piece = full.slice(charIdx, charIdx + s.length + (full[charIdx + s.length] === " " ? 1 : 0));
      const pw = ctx.measureText(piece).width;
      const x = startX + offset + (i - (term.written.length - 1) / 2) * spread;
      ctx.fillStyle = P.ink;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(piece, x, cy);
      if (p < 1 && i < term.written.length - 1) {
        ctx.fillStyle = rgba(P.accent, 1 - p);
        ctx.fillText("·", x + pw + spread / 2 - 3, cy);
      }
      offset += pw;
      charIdx += piece.length;
    });
    // linking morpheme highlight (German)
    if (term.link && p > 0.6) {
      const [s, e] = term.link;
      const x0 = startX + ctx.measureText(full.slice(0, s)).width;
      const x1 = startX + ctx.measureText(full.slice(0, e)).width;
      ctx.strokeStyle = rgba(P.amber, seg01(p, 0.6, 1));
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0, cy + sz * 0.62); ctx.lineTo(x1, cy + sz * 0.62); ctx.stroke();
    }
    const by = a.y + a.h - 4;
    if (p > 0.5) {
      const op = seg01(p, 0.5, 1);
      ctx.globalAlpha = op;
      let x = a.x;
      x += chip(ctx, P, L(lang, PIPE.merged), x, by, { color: P.amber, fill: rgba(P.amber, 0.14) }) + 6;
      if (narrow) {
        chip(ctx, P, L(lang, PIPE.anchor), a.x, by - 28, { color: P.green, fill: rgba(P.green, 0.14) });
        chip(ctx, P, L(lang, PIPE.gateOk), a.x + measure(ctx, P, L(lang, PIPE.anchor), 12, { weight: 500 }) + 20, by - 28, { color: P.green, fill: rgba(P.green, 0.14) });
      } else {
        x += chip(ctx, P, L(lang, PIPE.anchor), x, by, { color: P.green, fill: rgba(P.green, 0.14) }) + 6;
        chip(ctx, P, L(lang, PIPE.gateOk), x, by, { color: P.green, fill: rgba(P.green, 0.14) });
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawJson(ctx, a, p, narrow) {
    const size = narrow ? 12 : 13;
    const lineH = size + 6;
    let lines = L(lang, PIPE.json);
    // On narrow canvases a long value moves onto its own line.
    const flat = [];
    for (const [k, v] of lines) {
      const wk = measure(ctx, P, k + v, size, { mono: true });
      if (wk > a.w - 8 && v) { flat.push([k, ""]); flat.push(["    ", v]); } else flat.push([k, v]);
    }
    const shown = Math.ceil(p * flat.length);
    const total = flat.length * lineH;
    const top = a.y + Math.max(0, (a.h - total) / 2) - 2;
    flat.slice(0, shown).forEach(([k, v], i) => {
      const y = top + i * lineH + lineH / 2;
      const kw = txt(ctx, P, k, a.x, y, { size, color: k.includes("source_quote") ? P.amber : P.soft, mono: true });
      txt(ctx, P, v, a.x + kw, y, { size, color: P.ink, mono: true });
    });
  }

  function pick(i) {
    picked = i;
    player.pause();
    // Jump to the moment the module's output is fully built.
    const k = i + 1;
    player.seek(k * PHASE + PHASE * (k === 2 ? 0.95 : 0.9));
  }

  player = makePlayer(cv.canvas, { duration: PHASE * PHASES, stillT: PHASE * 5 + PHASE * 0.9, draw });
  player.onChange(() => { if (player.playing) picked = -1; });

  const step = (dir) => {
    const k = Math.floor(player.t / PHASE);
    const next = (k + dir + PHASES) % PHASES;
    picked = next >= 1 ? next - 1 : -1;
    player.pause();
    player.seek(next * PHASE + PHASE * 0.9);
  };
  const controls = [
    button("◀", () => step(-1), { "aria-label": L(lang, UI.prev) }),
    playButton(player, lang),
    button("▶", () => step(1), { "aria-label": L(lang, UI.next) }),
  ];

  return frame(lang, { eyebrow: L(lang, PIPE.eyebrow), title: L(lang, PIPE.title), label: L(lang, PIPE.label), controls },
    el("p", { class: "vt-quote" }, L(lang, PIPE.utterLabel), " ", el("b", {}, L(lang, PIPE.utter))),
    track,
    cv.canvas,
    inspect,
    el("p", { class: "vt-note" }, L(lang, PIPE.cardHint)));
}

// ---------------------------------------------------------------------------
// 2. syllable-window
// ---------------------------------------------------------------------------

const SYL = {
  eyebrow: { de: "Silben statt Wörter", en: "Syllables, not words" },
  title: { de: "Drei Silben Kontext – nie ein ganzer Satz", en: "Three syllables of context, never a whole sentence" },
  label: {
    de: "Animation in drei Akten: Ein 3-Silben-Fenster gleitet über den Silbenstrom und schreibt die mittlere Silbe; ein Wortmodell halluziniert, J.A.R. baut den Begriff aus Silben; Anker-Lexikon (82 %) und Levenshtein-Gate (20 %) prüfen jede Korrektur.",
    en: "Animation in three acts: a 3-syllable window slides over the syllable stream and writes the middle syllable; a word model hallucinates while J.A.R. rebuilds the term from syllables; the anchor lexicon (82 %) and the Levenshtein gate (20 %) check every correction.",
  },
  acts: [
    { de: "1 · Fenster", en: "1 · Window" },
    { de: "2 · Wortmodell vs. J.A.R.", en: "2 · Word model vs. J.A.R." },
    { de: "3 · Anker & Gate", en: "3 · Anchor & gate" },
  ],
  actsLabel: { de: "Akt wählen", en: "Choose act" },
  stream: { de: "Silbenstrom (IPA)", en: "Syllable stream (IPA)" },
  left: { de: "links", en: "left" },
  target: { de: "Ziel", en: "target" },
  right: { de: "rechts", en: "right" },
  model: "ByT5-Small",
  out: { de: "geschrieben", en: "written" },
  sees: { de: "Fenster sieht {n} Phoneme · Grenze 15–20", en: "window sees {n} phonemes · limit 15–20" },
  parallel: { de: "Im Einsatz laufen alle Fenster parallel: 5–8 ms", en: "In the field all windows run in parallel: 5–8 ms" },
  heard: { de: "gehörte Phoneme", en: "heard phonemes" },
  wordModel: { de: "Wortmodell (mT5)", en: "Word model (mT5)" },
  jar: { de: "J.A.R. · Silben", en: "J.A.R. · syllables" },
  halluc: { de: "✕ halluziniert", en: "✕ hallucinated" },
  rebuilt: { de: "✓ aus Silben gebaut", en: "✓ built from syllables" },
  cases: {
    de: [
      { ipa: "/tʊʁniˈkeː/", wrong: "Toni", syl: ["Tour", "ni", "quet"], right: "Tourniquet" },
      { ipa: "/paˈtsi̯ɛnt/", wrong: "Pazifischer Ozean", syl: ["Pa", "ti", "ent"], right: "Patient" },
      { ipa: "/ˈbluːtdʁʊk/", wrong: "Bruno", syl: ["Blut", "druck"], right: "Blutdruck" },
    ],
    en: [
      { ipa: "/ˈtʊənɪkeɪ/", wrong: "Tony", syl: ["tour", "ni", "quet"], right: "tourniquet" },
      { ipa: "/ˈpeɪʃənt/", wrong: "Pacific Ocean", syl: ["pa", "tient"], right: "patient" },
      { ipa: "/blʌd ˈprɛʃə/", wrong: "Bruno", syl: ["blood", "pres", "sure"], right: "blood pressure" },
    ],
  },
  anchorTitle: { de: "Anker-Lexikon · medical_lexicon.txt", en: "Anchor lexicon · medical_lexicon.txt" },
  sim: { de: "IPA-Ähnlichkeit", en: "IPA similarity" },
  dev: { de: "Gate: Abweichung nach Rück-Konvertierung in IPA", en: "Gate: deviation after converting back to IPA" },
  conf: { de: "akustische Konfidenz", en: "acoustic confidence" },
  accepted: { de: "✓ übernommen", en: "✓ accepted" },
  blocked: { de: "✕ blockiert – Original bleibt", en: "✕ blocked – original kept" },
  flagged: { de: "markiert, nicht geraten", en: "flagged, not guessed" },
  editFrom: { de: "Änderungsvorschlag", en: "Proposed edit" },
  fixes: {
    de: [
      { kind: "fix", from: "Turnikee", to: "Tourniquet" },
      { kind: "fix", from: "Amjodaron", to: "Amiodaron" },
      { kind: "block", from: "Tourniquet", to: "Toni" },
      { kind: "unsure", from: "300 mg", to: "[UNSICHER: 300 mg]" },
    ],
    en: [
      { kind: "fix", from: "turnikit", to: "tourniquet" },
      { kind: "fix", from: "amyodarone", to: "amiodarone" },
      { kind: "fix", from: "takicardia", to: "tachycardia" },
      { kind: "block", from: "tourniquet", to: "Tony" },
      { kind: "unsure", from: "300 mg", to: "[UNCERTAIN: 300 mg]" },
    ],
  },
  dec: { de: "0,45", en: "0.45" },
  note: {
    de: "Schematische Darstellung: Balkenlängen illustrativ; die Schwellen 82 %, 20 % und 0,45 sind die des Systems.",
    en: "Schematic illustration: bar lengths are illustrative; the thresholds 82 %, 20 % and 0.45 are the system's.",
  },
};

const ACT = [10, 10.5, 0]; // act 3 length depends on the number of cases
const CASE_T = 3.4;

function renderSyllableWindow(block, lang) {
  const term = TERM[lang];
  const fixes = L(lang, SYL.fixes);
  const durs = [ACT[0], ACT[1], fixes.length * CASE_T];
  const starts = [0, durs[0], durs[0] + durs[1]];
  const total = durs[0] + durs[1] + durs[2];

  let P = null;
  let player = null;
  const cv = canvasStage("vt-syl", L(lang, SYL.label), () => { P = null; player?.redraw(); });
  const seg = segmented(L(lang, { de: SYL.acts.map((a) => a.de), en: SYL.acts.map((a) => a.en) }), (i) => { player.seek(starts[i] + 0.01); }, L(lang, SYL.actsLabel));
  let act = -1;

  function draw(t) {
    const { w, h } = cv.size();
    const ctx = cv.ctx;
    if (!P) P = palette(cv.canvas);
    ctx.clearRect(0, 0, w, h);
    const a = t < starts[1] ? 0 : t < starts[2] ? 1 : 2;
    if (a !== act) { act = a; seg.set(a); }
    const lt = t - starts[a];
    const narrow = w < 520;
    if (a === 0) drawWindow(ctx, w, h, lt, narrow);
    else if (a === 1) drawCompare(ctx, w, h, lt, narrow);
    else drawGate(ctx, w, h, lt, narrow);
  }

  function drawWindow(ctx, w, h, lt, narrow) {
    const pad = narrow ? 10 : 18;
    const items = ["#", ...term.syl.map((s) => s.join("")), "#"];
    const n = items.length;
    const gap = narrow ? 4 : 8;
    const bw = (w - pad * 2 - gap * (n - 1)) / n;
    const size = narrow ? 12 : 15;
    const y = narrow ? 64 : 58;
    const bh = size + 18;
    txt(ctx, P, L(lang, SYL.stream), pad, 20, { size: 12, color: P.accent, mono: true });
    // window position: 0..5 over 6.6 s, then parallel phase
    const stepT = 1.1;
    const parallel = lt > term.syl.length * stepT + 0.4;
    const pos = Math.min(term.syl.length - 1, Math.floor(lt / stepT));
    const slide = ease(seg01(lt % stepT, 0, 0.35));
    const winX = (i) => pad + i * (bw + gap);
    items.forEach((s, i) => {
      const x = winX(i);
      rrect(ctx, x, y, bw, bh, 6);
      ctx.fillStyle = s === "#" ? rgba(P.ink, 0.04) : rgba(P.ink, 0.08);
      ctx.fill();
      txt(ctx, P, s, x + bw / 2, y + bh / 2 + 1, { size, color: s === "#" ? P.faint : P.ink, align: "center", mono: true });
    });
    // Out row
    const oy = narrow ? h - 92 : h - 84;
    txt(ctx, P, L(lang, SYL.out), pad, oy - 14, { size: 12, color: P.faint, mono: true });
    const doneCount = parallel ? term.syl.length : pos + (seg01(lt % stepT, 0.55, 0.9) > 0 ? 1 : 0);
    term.written.forEach((s, i) => {
      const x = winX(i + 1);
      rrect(ctx, x, oy, bw, bh, 6);
      ctx.fillStyle = i < doneCount ? rgba(P.mint, 0.16) : rgba(P.ink, 0.03);
      ctx.fill();
      if (i < doneCount) txt(ctx, P, s, x + bw / 2, oy + bh / 2 + 1, { size: size + 1, color: P.ink, align: "center", weight: 600 });
    });

    if (!parallel) {
      // sliding bracket over [left | target | right]
      const fromX = winX(Math.max(0, pos - 1));
      const toX = winX(pos);
      const x0 = lerp(fromX, toX, pos === 0 ? 1 : slide) - 4;
      const ww = bw * 3 + gap * 2 + 8;
      rrect(ctx, x0, y - 6, ww, bh + 12, 9);
      ctx.strokeStyle = P.accent;
      ctx.lineWidth = 2;
      ctx.stroke();
      // labels above the window
      const lbl = narrow ? [L(lang, SYL.left)[0].toUpperCase(), L(lang, SYL.target), L(lang, SYL.right)[0].toUpperCase()] : [L(lang, SYL.left), L(lang, SYL.target), L(lang, SYL.right)];
      lbl.forEach((s, i) => txt(ctx, P, s, x0 + 4 + i * (bw + gap) + bw / 2, y - 16, { size: 12, color: i === 1 ? P.accent : P.faint, align: "center", weight: i === 1 ? 600 : 400 }));
      // target → model → output
      const tx = x0 + 4 + bw + gap + bw / 2;
      const midY = (y + bh + oy) / 2;
      ctx.strokeStyle = rgba(P.accent, 0.8);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(tx, y + bh + 8); ctx.lineTo(tx, oy - 24); ctx.stroke();
      const cw = chip(ctx, P, SYL.model, tx, midY - 4, { align: "center", mono: true, color: P.ink, fill: P.raise2, stroke: P.accent });
      // phoneme count in the window, counted from the data
      const winPh = [pos - 1, pos, pos + 1].reduce((n2, i) => n2 + (term.syl[i]?.length ?? 0), 0);
      const sees = L(lang, SYL.sees).replace("{n}", String(winPh));
      chip(ctx, P, sees, pad, h - 22, { mono: true, color: P.soft, fill: rgba(P.ink, 0.06) });
      void cw;
    } else {
      // all windows fire at once
      const pp = seg01(lt - (term.syl.length * stepT + 0.4), 0, 0.8);
      for (let i = 0; i < term.syl.length; i++) {
        const x = winX(i + 1) + bw / 2;
        ctx.strokeStyle = rgba(P.accent, 0.3 + 0.6 * Math.sin(pp * Math.PI));
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x, y + bh + 6); ctx.lineTo(x, oy - 6); ctx.stroke();
      }
      const msg = L(lang, SYL.parallel);
      const lines = wrapLines(ctx, P, msg, w - pad * 2 - 20, 13, { weight: 600 });
      const my = (y + bh + oy) / 2 - (lines.length - 1) * 9;
      lines.forEach((ln, i) => chip(ctx, P, ln, w / 2, my + i * 26, { align: "center", size: 13, color: P.ink, fill: P.raise2, stroke: P.accent }));
      // final word
      ctx.globalAlpha = seg01(pp, 0.4, 1);
      txt(ctx, P, term.word, w / 2, h - 26, { size: narrow ? 17 : 20, color: P.mint, align: "center", weight: 700 });
      ctx.globalAlpha = 1;
    }
  }

  function drawCompare(ctx, w, h, lt, narrow) {
    const cases = L(lang, SYL.cases);
    const per = ACT[1] / cases.length;
    const ci = Math.min(cases.length - 1, Math.floor(lt / per));
    const c = cases[ci];
    const u = (lt - ci * per) / per;
    const pad = narrow ? 10 : 18;
    // heard phonemes on top
    txt(ctx, P, L(lang, SYL.heard), w / 2, 20, { size: 12, color: P.faint, align: "center", mono: true });
    chip(ctx, P, c.ipa, w / 2, 46, { align: "center", size: narrow ? 15 : 17, mono: true, color: P.ink, fill: P.raise2, stroke: P.lineStrong, h: 30, padX: 12 });
    const lanes = narrow
      ? [{ x: pad, y: 92, w: w - pad * 2, h: (h - 92 - pad - 10) / 2 }, { x: pad, y: 92 + (h - 92 - pad - 10) / 2 + 10, w: w - pad * 2, h: (h - 92 - pad - 10) / 2 }]
      : [{ x: pad, y: 86, w: (w - pad * 3) / 2, h: h - 86 - pad }, { x: pad * 2 + (w - pad * 3) / 2, y: 86, w: (w - pad * 3) / 2, h: h - 86 - pad }];
    const titles = [L(lang, SYL.wordModel), L(lang, SYL.jar)];
    lanes.forEach((ln, li) => {
      rrect(ctx, ln.x, ln.y, ln.w, ln.h, 10);
      ctx.fillStyle = rgba(P.ink, 0.035);
      ctx.fill();
      ctx.strokeStyle = P.line;
      ctx.stroke();
      txt(ctx, P, titles[li], ln.x + 12, ln.y + 16, { size: 12, color: li === 0 ? P.red : P.accent, weight: 600, mono: true });
      // connector from the heard phonemes
      ctx.strokeStyle = rgba(P.ink, 0.18);
      ctx.beginPath(); ctx.moveTo(w / 2, 62); ctx.lineTo(ln.x + ln.w / 2, ln.y); ctx.stroke();
    });
    const cy0 = lanes[0].y + lanes[0].h / 2 + 8;
    const cy1 = lanes[1].y + lanes[1].h / 2 + 8;
    const big = narrow ? 18 : 22;
    // Word model: whole word guessed at once, wrong
    const p0 = seg01(u, 0.12, 0.45);
    const wrong = c.wrong.slice(0, Math.round(p0 * c.wrong.length));
    txt(ctx, P, wrong, lanes[0].x + lanes[0].w / 2, cy0 - 6, { size: big, color: P.ink, align: "center", weight: 600 });
    if (u > 0.5) chip(ctx, P, L(lang, SYL.halluc), lanes[0].x + lanes[0].w / 2, cy0 + 24, { align: "center", color: P.red, fill: rgba(P.red, 0.14) });
    // J.A.R.: syllable blocks drop in, then join
    const p1 = seg01(u, 0.15, 0.55);
    const join = ease(seg01(u, 0.6, 0.8));
    ctx.font = font(P, big, { weight: 600 });
    const parts = c.syl;
    const gapS = lerp(14, 0, join);
    const widths = parts.map((s) => ctx.measureText(s).width + lerp(16, 0, join));
    const totalW = widths.reduce((s, x) => s + x, 0) + gapS * (parts.length - 1);
    let x = lanes[1].x + (lanes[1].w - totalW) / 2;
    parts.forEach((s, i) => {
      const vis = clamp(p1 * parts.length - i, 0, 1);
      if (vis <= 0) { x += widths[i] + gapS; return; }
      const dy = (1 - ease(vis)) * -18;
      ctx.globalAlpha = vis;
      if (join < 1) {
        rrect(ctx, x, cy1 - 6 - big / 2 - 6 + dy, widths[i], big + 12, 6);
        ctx.fillStyle = rgba(P.mint, 0.14 * (1 - join));
        ctx.fill();
      }
      txt(ctx, P, s, x + widths[i] / 2, cy1 - 6 + dy, { size: big, color: P.ink, align: "center", weight: 600 });
      ctx.globalAlpha = 1;
      x += widths[i] + gapS;
    });
    if (u > 0.8) chip(ctx, P, L(lang, SYL.rebuilt), lanes[1].x + lanes[1].w / 2, cy1 + 24, { align: "center", color: P.green, fill: rgba(P.green, 0.14) });
  }

  function meter(ctx, x, y, w, label, value, threshold, thrLabel, passBelow, prog) {
    txt(ctx, P, label, x, y, { size: 12, color: P.soft });
    const by = y + 14;
    rrect(ctx, x, by, w, 10, 5);
    ctx.fillStyle = rgba(P.ink, 0.08);
    ctx.fill();
    const v = value * prog;
    const pass = passBelow ? v <= threshold : v >= threshold;
    const done = prog >= 1;
    rrect(ctx, x, by, Math.max(2, w * v), 10, 5);
    ctx.fillStyle = done ? (pass ? P.green : P.red) : P.accent;
    ctx.fill();
    const tx = x + w * threshold;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tx, by - 4); ctx.lineTo(tx, by + 14); ctx.stroke();
    txt(ctx, P, thrLabel, tx, by + 26, { size: 12, color: P.ink, align: "center", mono: true, weight: 600 });
    return pass;
  }

  function drawGate(ctx, w, h, lt, narrow) {
    const ci = Math.min(fixes.length - 1, Math.floor(lt / CASE_T));
    const c = fixes[ci];
    const u = (lt - ci * CASE_T) / CASE_T;
    const pad = narrow ? 12 : 18;
    txt(ctx, P, L(lang, SYL.anchorTitle), pad, 20, { size: 12, color: P.accent, mono: true });
    // from → to
    const big = narrow ? 17 : 21;
    const rowY = 62;
    const label = c.kind === "block" ? L(lang, SYL.editFrom) : null;
    if (label) txt(ctx, P, label, pad, 40, { size: 12, color: P.faint });
    const fromW = chip(ctx, P, c.from, pad, rowY, { size: big, h: big + 14, mono: c.kind !== "unsure" ? false : true, color: P.ink, fill: rgba(P.ink, 0.07), weight: 600, padX: 10 });
    const arrowP = seg01(u, 0.1, 0.3);
    const ax = pad + fromW + 10;
    const toX = ax + 30;
    if (narrow && measure(ctx, P, c.to, big, { weight: 600 }) + toX + 20 > w - pad) {
      // second line on narrow canvases
      ctx.globalAlpha = arrowP;
      txt(ctx, P, "↓", pad + 12, rowY + 26, { size: 16, color: P.accent });
      const col = resultColor(c, u);
      chip(ctx, P, c.to, pad + 30, rowY + 34, { size: big, h: big + 14, color: col, fill: rgba(col === P.ink ? P.ink : col, 0.12), weight: 600, padX: 10 });
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = arrowP;
      txt(ctx, P, "→", ax, rowY, { size: 18, color: P.accent });
      const col = resultColor(c, u);
      chip(ctx, P, c.to, toX, rowY, { size: big, h: big + 14, color: col, fill: rgba(col === P.ink ? P.ink : col, 0.12), weight: 600, padX: 10 });
      ctx.globalAlpha = 1;
    }
    const mw = w - pad * 2;
    let my = narrow ? rowY + 80 : rowY + 50;
    let verdict = "";
    let vcol = P.green;
    if (c.kind === "fix") {
      const p1 = ease(seg01(u, 0.25, 0.5));
      meter(ctx, pad, my, mw, L(lang, SYL.sim), 0.93, 0.82, "82 %", false, p1);
      my += 58;
      const p2 = ease(seg01(u, 0.5, 0.75));
      if (p2 > 0) meter(ctx, pad, my, mw, L(lang, SYL.dev), 0.09, 0.2, "20 %", true, p2);
      if (u > 0.78) { verdict = L(lang, SYL.accepted); vcol = P.green; }
    } else if (c.kind === "block") {
      const p2 = ease(seg01(u, 0.25, 0.6));
      meter(ctx, pad, my, mw, L(lang, SYL.dev), 0.68, 0.2, "20 %", true, p2);
      if (u > 0.65) { verdict = L(lang, SYL.blocked); vcol = P.red; }
    } else {
      const p2 = ease(seg01(u, 0.25, 0.6));
      meter(ctx, pad, my, mw, L(lang, SYL.conf), 0.3, 0.45, L(lang, SYL.dec), false, p2);
      if (u > 0.65) { verdict = L(lang, SYL.flagged); vcol = P.amber; }
    }
    if (verdict) {
      chip(ctx, P, verdict, pad, h - 22, { size: 13, color: vcol, fill: rgba(vcol, 0.14), h: 26 });
    }
    // progress dots for the cases
    fixes.forEach((_, i) => {
      ctx.beginPath();
      ctx.arc(w - pad - (fixes.length - 1 - i) * 14, 20, 4, 0, Math.PI * 2);
      ctx.fillStyle = i === ci ? P.accent : rgba(P.ink, 0.2);
      ctx.fill();
    });
  }

  function resultColor(c, u) {
    if (c.kind === "fix") return u > 0.78 ? P.green : P.ink;
    if (c.kind === "block") return u > 0.65 ? P.red : P.ink;
    return u > 0.65 ? P.amber : P.ink;
  }

  player = makePlayer(cv.canvas, { duration: total, stillT: starts[2] + CASE_T * 0.95, draw });
  return frame(lang, {
    eyebrow: L(lang, SYL.eyebrow),
    title: L(lang, SYL.title),
    label: L(lang, SYL.label),
    controls: [playButton(player, lang)],
  }, seg.node, cv.canvas, el("p", { class: "vt-note" }, L(lang, SYL.note)));
}

// ---------------------------------------------------------------------------
// 3. model-size-chart
// ---------------------------------------------------------------------------

const SIZE = {
  eyebrow: { de: "Variable Modellgröße", en: "Variable model size" },
  title: { de: "Dieselbe Pipeline – am Körper oder im Einsatzleitwagen", en: "One pipeline – on the body or in the command vehicle" },
  label: {
    de: "Animiertes Diagramm, schematisch: Die fünf Module verteilen sich je nach Profil auf die tragbare Recheneinheit (kleine Modelle) und den Hub im Einsatzleitwagen (größere Modelle). Der Hub schaltet das aktive ASR-Modell je Headset mit set_asr_model um.",
    en: "Animated schematic chart: depending on the profile, the five modules are split between the wearable compute unit (small models) and the hub in the command vehicle (larger models). The hub switches the active ASR model per headset with set_asr_model.",
  },
  edge: { de: "Edge · am Körper", en: "Edge · on the body" },
  edgeShort: { de: "Edge", en: "Edge" },
  hub: { de: "Hub · Einsatzleitwagen", en: "Hub · command vehicle" },
  hubShort: { de: "Hub", en: "Hub" },
  mods: [
    { de: "1 Frontend", en: "1 Frontend" },
    { de: "2 Phoneme", en: "2 Phonemes" },
    { de: "3 Transducer", en: "3 Transducer" },
    { de: "4 Refiner", en: "4 Refiner" },
    { de: "5 Extraktor", en: "5 Extractor" },
  ],
  profiles: [
    { de: "Alles am Körper", en: "All on the body" },
    { de: "Geteilt", en: "Split" },
    { de: "Größeres Edge-Modell", en: "Larger edge model" },
  ],
  profilesLabel: { de: "Profil wählen", en: "Choose profile" },
  cmd: { de: "Hub → Headset 07", en: "hub → headset 07" },
  legend: { de: "S · M · L = relative Modellgröße", en: "S · M · L = relative model size" },
  note: {
    de: "Schematische Darstellung: Profile und Größen illustrativ, keine Messwerte. Die Module sind austauschbar; set_asr_model wählt das aktive ASR-Modell je Headset.",
    en: "Schematic illustration: profiles and sizes are illustrative, not measurements. The modules are swappable; set_asr_model picks the active ASR model per headset.",
  },
};

// For each profile: [lane (0 edge, 1 hub), size (1 S, 2 M, 3 L)] per module.
const PROFILES = [
  [[0, 1], [0, 1], [0, 1], [0, 1], [0, 1]],
  [[0, 1], [0, 1], [1, 3], [1, 3], [1, 3]],
  [[0, 1], [0, 2], [0, 2], [0, 1], [1, 3]],
];
const PROFILE_T = 6;

function renderModelSizeChart(block, lang) {
  let P = null;
  let player = null;
  const cv = canvasStage("vt-size", L(lang, SIZE.label), () => { P = null; player?.redraw(); });
  const seg = segmented(L(lang, { de: SIZE.profiles.map((p) => p.de), en: SIZE.profiles.map((p) => p.en) }), (i) => player.seek(i * PROFILE_T + 0.01), L(lang, SIZE.profilesLabel));
  let shownProfile = -1;
  const sizeName = ["", "S", "M", "L"];

  function draw(t) {
    const { w, h } = cv.size();
    const ctx = cv.ctx;
    if (!P) P = palette(cv.canvas);
    ctx.clearRect(0, 0, w, h);
    const pi = Math.floor(t / PROFILE_T) % PROFILES.length;
    if (pi !== shownProfile) { shownProfile = pi; seg.set(pi); }
    const prev = PROFILES[(pi + PROFILES.length - 1) % PROFILES.length];
    const cur = PROFILES[pi];
    const u = (t % PROFILE_T) / PROFILE_T;
    // command packet first (0..0.3), then modules move (0.3..0.55)
    const cmdP = seg01(u, 0.02, 0.3);
    const move = ease(seg01(u, 0.3, 0.55));
    const narrow = w < 520;
    const pad = narrow ? 10 : 16;
    const labelW = narrow ? 92 : 128;
    const laneGap = narrow ? 8 : 16;
    const laneW = (w - pad * 2 - labelW - laneGap) / 2;
    const lanes = [pad + labelW, pad + labelW + laneW + laneGap];
    const top = narrow ? 96 : 90;
    const rowH = narrow ? 36 : 38;
    // lane boxes and headers
    [0, 1].forEach((li) => {
      const x = lanes[li];
      rrect(ctx, x, top - 10, laneW, rowH * 5 + 18, 10);
      ctx.fillStyle = li === 0 ? rgba(P.mint, 0.06) : rgba(P.ink, 0.04);
      ctx.fill();
      ctx.strokeStyle = P.line;
      ctx.lineWidth = 1;
      ctx.stroke();
      const name = narrow ? L(lang, li === 0 ? SIZE.edgeShort : SIZE.hubShort) : L(lang, li === 0 ? SIZE.edge : SIZE.hub);
      txt(ctx, P, name, x + laneW / 2, top - 24, { size: 12, color: li === 0 ? P.accent : P.soft, align: "center", weight: 600, mono: true });
    });
    // set_asr_model: an arc from the hub header to the edge header
    const hx = lanes[1] + laneW / 2;
    const ex = lanes[0] + laneW / 2;
    const ay = top - 40;
    const cyArc = 8;
    ctx.strokeStyle = rgba(P.amber, 0.5);
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(hx, ay);
    ctx.quadraticCurveTo((hx + ex) / 2, cyArc, ex, ay);
    ctx.stroke();
    ctx.setLineDash([]);
    const glow = cmdP > 0 && cmdP < 1;
    if (glow) {
      const q = ease(cmdP);
      const qx = (1 - q) * (1 - q) * hx + 2 * (1 - q) * q * ((hx + ex) / 2) + q * q * ex;
      const qy = (1 - q) * (1 - q) * ay + 2 * (1 - q) * q * cyArc + q * q * ay;
      ctx.beginPath(); ctx.arc(qx, qy, 6, 0, Math.PI * 2); ctx.fillStyle = P.amber; ctx.fill();
    }
    chip(ctx, P, "set_asr_model", (hx + ex) / 2, (ay + cyArc) / 2 + 4, { align: "center", mono: true, color: glow ? P.bg : P.amber, fill: glow ? P.amber : P.bg, stroke: rgba(P.amber, 0.6), weight: 600 });
    // modules
    const centers = [];
    for (let m = 0; m < 5; m++) {
      const y = top + m * rowH + rowH / 2 - 2;
      txt(ctx, P, L(lang, SIZE.mods[m]), pad, y, { size: 12, color: P.ink });
      const [l0, s0] = prev[m];
      const [l1, s1] = cur[m];
      const lane = lerp(l0, l1, move);
      const size = lerp(s0, s1, move);
      const bw = (laneW - 16) * (0.3 + 0.7 * (size - 1) / 2);
      const x = lerp(lanes[0], lanes[1], lane) + 8;
      rrect(ctx, x, y - 11, bw, 22, 6);
      ctx.fillStyle = rgba(lane < 0.5 ? P.mint : P.ink, lane < 0.5 ? 0.32 : 0.2);
      ctx.fill();
      ctx.strokeStyle = lane < 0.5 ? P.mint : P.soft;
      ctx.lineWidth = 1;
      ctx.stroke();
      txt(ctx, P, sizeName[Math.round(size)], x + 8, y + 0.5, { size: 12, color: P.ink, weight: 700, mono: true });
      centers.push({ x: x + Math.min(bw, 40) + 6, y });
    }
    // audio data flowing module to module (crosses lanes when split)
    for (let d = 0; d < 3; d++) {
      const f = ((t * 0.45 + d / 3) % 1) * 4;
      const i = Math.floor(f);
      const q = f - i;
      const px = lerp(centers[i].x, centers[i + 1].x, q);
      const py = lerp(centers[i].y, centers[i + 1].y, q);
      ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = P.mint;
      ctx.fill();
    }
    const by = h - 16;
    txt(ctx, P, L(lang, SIZE.cmd) + " · " + L(lang, SIZE.profiles[pi]), pad, by, { size: 12, color: P.soft });
    if (!narrow) txt(ctx, P, L(lang, SIZE.legend), w - pad, by, { size: 12, color: P.faint, align: "right" });
  }

  player = makePlayer(cv.canvas, { duration: PROFILE_T * PROFILES.length, stillT: PROFILE_T + PROFILE_T * 0.9, draw });
  return frame(lang, {
    eyebrow: L(lang, SIZE.eyebrow),
    title: L(lang, SIZE.title),
    label: L(lang, SIZE.label),
    controls: [playButton(player, lang)],
  }, seg.node, cv.canvas, el("p", { class: "vt-note" }, L(lang, SIZE.legend), " · ", L(lang, SIZE.note)));
}

// ---------------------------------------------------------------------------
// 4. diarization-timeline
// ---------------------------------------------------------------------------

const DIAR = {
  eyebrow: { de: "Diarisierung · wer hat was gesagt", en: "Diarization · who said what" },
  title: { de: "Nur die Spur der Einsatzkraft füllt die Akte", en: "Only the responder's lane fills the record" },
  label: {
    de: "Animierte Zeitleiste mit drei Sprecherspuren (Rettungskraft, Patient, Einsatzleitung). Segmente erscheinen mit Zeitstempeln; der klinische Extraktor übernimmt nur Befunde aus der Spur der Rettungskraft, eine Verneinung wird als verneint markiert.",
    en: "Animated timeline with three speaker lanes (paramedic, patient, team lead). Segments appear with timestamps; the clinical extractor takes findings only from the paramedic's lane, and a negation is flagged as negated.",
  },
  lanes: [{ de: "Rettungskraft", en: "Paramedic" }, { de: "Patient", en: "Patient" }, { de: "Einsatzleitung", en: "Team lead" }],
  extractor: { de: "Extraktor", en: "Extractor" },
  seconds: { de: "s", en: "s" },
  segs: [
    { spk: 2, s: 0.0, e: 2.2, text: { de: "Team zwei, übernehmt den Patienten am Auto.", en: "Team two, take the patient by the car." }, out: { de: "– Einsatzfunk, ignoriert", en: "– operational, ignored" }, kind: "skip" },
    { spk: 0, s: 2.4, e: 5.0, text: { de: "Atmung: Frequenz 32, angestrengt.", en: "Breathing: rate 32, laboured." }, out: { de: "B · AF 32 ✓", en: "B · RR 32 ✓" }, kind: "take" },
    { spk: 1, s: 5.2, e: 6.8, text: { de: "Mir tut die Brust weh.", en: "My chest hurts." }, out: { de: "– Patient, kein Befund", en: "– patient, not a finding" }, kind: "skip" },
    { spk: 0, s: 7.0, e: 9.2, text: { de: "Keine äußere Blutung.", en: "No external bleeding." }, out: { de: "c · Blutung: verneint", en: "c · bleeding: negated" }, kind: "neg" },
    { spk: 2, s: 9.4, e: 10.9, text: { de: "RTW in zwei Minuten da.", en: "Ambulance two minutes out." }, out: { de: "– Einsatzfunk, ignoriert", en: "– operational, ignored" }, kind: "skip" },
    { spk: 0, s: 11.1, e: 13.6, text: { de: "Radialispuls 124, Sichtung rot.", en: "Radial pulse 124, triage red." }, out: { de: "C · HF 124 ✓ · SK I ✓", en: "C · HR 124 ✓ · cat. I ✓" }, kind: "take" },
  ],
  note: { de: "Beispielszenario. Zeitstempel und Sprecherlabels kommen aus der Diarisierung, jedes Segment mit Start und Ende.", en: "Example scenario. Timestamps and speaker labels come from diarization, every segment with start and end." },
};
const DIAR_END = 14;
const DIAR_LOOP = 18;

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${String(m).padStart(2, "0")}:${r.toFixed(1).padStart(4, "0")}`;
}

function renderDiarizationTimeline(block, lang) {
  let P = null;
  let player = null;
  const cv = canvasStage("vt-diar", L(lang, DIAR.label), () => { P = null; player?.redraw(); });
  const rows = DIAR.segs.map((s) => el("div", { class: "vt-row" },
    el("span", { class: "vt-row-time" }, `${fmtTime(s.s)}–${fmtTime(s.e)}`),
    el("span", { class: `vt-spk vt-spk-${s.spk}` }, L(lang, DIAR.lanes[s.spk])),
    el("span", { class: "vt-row-text" }, L(lang, s.text)),
    el("span", { class: `vt-out ${s.kind === "take" ? "vt-out-take" : s.kind === "neg" ? "vt-out-neg" : ""}` }, L(lang, s.out))));
  const list = el("div", { class: "vt-rows", "aria-live": "off" }, rows);

  function draw(t) {
    const { w, h } = cv.size();
    const ctx = cv.ctx;
    if (!P) P = palette(cv.canvas);
    ctx.clearRect(0, 0, w, h);
    const now = Math.min(t, DIAR_END);
    const narrow = w < 520;
    const pad = narrow ? 10 : 16;
    const labelW = narrow ? 92 : 116;
    const x0 = pad + labelW;
    const x1 = w - pad;
    const X = (s) => x0 + (s / DIAR_END) * (x1 - x0);
    const laneH = 30;
    const top = 16;
    const colors = [P.mint, P.amber, P.soft];
    // lanes
    DIAR.lanes.forEach((ln, i) => {
      const y = top + i * (laneH + 6);
      rrect(ctx, x0, y, x1 - x0, laneH, 6);
      ctx.fillStyle = rgba(P.ink, 0.04);
      ctx.fill();
      txt(ctx, P, L(lang, ln), pad, y + laneH / 2, { size: 12, color: colors[i], weight: 600 });
    });
    // extractor row
    const ey = top + 3 * (laneH + 6) + 18;
    txt(ctx, P, L(lang, DIAR.extractor), pad, ey + 12, { size: 12, color: P.ink, weight: 600 });
    rrect(ctx, x0, ey, x1 - x0, 24, 6);
    ctx.strokeStyle = P.lineStrong;
    ctx.stroke();
    // segments
    DIAR.segs.forEach((s) => {
      if (now < s.s) return;
      const y = top + s.spk * (laneH + 6);
      const e = Math.min(now, s.e);
      rrect(ctx, X(s.s), y + 4, Math.max(2, X(e) - X(s.s)), laneH - 8, 4);
      ctx.fillStyle = rgba(colors[s.spk], s.spk === 0 ? 0.55 : 0.35);
      ctx.fill();
      // finished responder segments drop a finding into the extractor
      if (now >= s.e && s.spk === 0) {
        const f = seg01(now - s.e, 0, 0.5);
        const cx = (X(s.s) + X(s.e)) / 2;
        const yy = lerp(y + laneH, ey + 12, ease(f));
        ctx.strokeStyle = rgba(s.kind === "neg" ? P.amber : P.green, 0.7);
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(cx, y + laneH - 2); ctx.lineTo(cx, yy); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, yy, 5, 0, Math.PI * 2);
        ctx.fillStyle = s.kind === "neg" ? P.amber : P.green;
        ctx.fill();
      } else if (now >= s.e) {
        // other speakers: blocked at the extractor gate
        const cx = (X(s.s) + X(s.e)) / 2;
        txt(ctx, P, "✕", cx, ey + 12, { size: 12, color: P.faint, align: "center" });
      }
    });
    // time axis
    const ay = h - 12;
    for (let s = 0; s <= DIAR_END; s += narrow ? 7 : 2) {
      txt(ctx, P, `${s} ${L(lang, DIAR.seconds)}`, X(s), ay, { size: 12, color: P.faint, align: s === 0 ? "left" : s === DIAR_END ? "right" : "center", mono: true });
    }
    // playhead
    ctx.strokeStyle = P.accent;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(now), top - 6); ctx.lineTo(X(now), ey + 30); ctx.stroke();
    // transcript rows follow the playhead
    DIAR.segs.forEach((s, i) => rows[i].classList.toggle("is-on", now >= s.e));
  }

  player = makePlayer(cv.canvas, { duration: DIAR_LOOP, stillT: DIAR_END, draw });
  return frame(lang, {
    eyebrow: L(lang, DIAR.eyebrow),
    title: L(lang, DIAR.title),
    label: L(lang, DIAR.label),
    controls: [
      button("↺", () => { player.seek(0); player.play(); }, { "aria-label": L(lang, { de: "Von vorn", en: "Restart" }) }),
      playButton(player, lang),
    ],
  }, cv.canvas, list, el("p", { class: "vt-note" }, L(lang, DIAR.note)));
}

export const VISUALS = {
  "asr-pipeline-cards": guarded("asr-pipeline-cards", renderAsrPipelineCards),
  "syllable-window": guarded("syllable-window", renderSyllableWindow),
  "model-size-chart": guarded("model-size-chart", renderModelSizeChart),
  "diarization-timeline": guarded("diarization-timeline", renderDiarizationTimeline),
};

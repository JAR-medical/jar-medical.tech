// Course B1 visuals: the in-browser recorder demo ("recorder-demo") and the
// animated diagram of where a recording goes ("recorder-architecture", not
// used by a lesson at the moment).
//
// The recorder follows the main site's recording page
// (Website/mitmachen-aufnahme.html, js/record.js): secure-context check,
// getUserMedia, a live level display, the same big pill button. Here the take
// is captured with MediaRecorder, can be played back, and is POSTed to the
// J.A.R. transcription server only when the user presses "Transcribe" AND
// CONFIG.TRANSCRIPTION_ENDPOINT is set (contract and server setup: private
// repo JAR-medical/website_setup). No transcript is ever invented: without a
// server the output field says so.
import { el } from "../ui.js";
import { CONFIG } from "../config.js";
import { L, injectStyle, animate, hiDpiCanvas, clamp, ease } from "./kit.js";

const MAX_SECONDS = 60;
const MIN_SECONDS = 1;
const TIMEOUT_MS = 60000;
const PEAK_EVERY_MS = 50;

// ---------------------------------------------------------------------------
// Strings. Every user-visible text lives here as {de, en}.
// ---------------------------------------------------------------------------
const S = {
  recAria: { de: "Sprachaufnahme mit Transkription und Sprechertrennung", en: "Voice recording with transcription and speaker diarization" },
  title: { de: "Sprechen Sie eine Sichtung ein", en: "Record a triage assessment" },
  serverOff: { de: "Transkriptions-Server: noch nicht verbunden", en: "Transcription server: not connected yet" },
  serverOn: { de: "Transkriptions-Server: eingerichtet", en: "Transcription server: configured" },
  scriptLabel: { de: "Zum Vorlesen, am besten zu zweit", en: "Read aloud, ideally with two people" },
  scriptNext: { de: "Anderer Text", en: "Another script" },
  start: { de: "Aufnahme starten", en: "Start recording" },
  starting: { de: "Mikrofon wird geöffnet …", en: "Opening microphone …" },
  stop: { de: "Aufnahme beenden", en: "Stop recording" },
  left: { de: "noch", en: "left" },
  waveIdle: { de: "Mikrofon aus", en: "Microphone off" },
  waveAria: { de: "Pegelanzeige der Aufnahme", en: "Recording level display" },
  play: { de: "Abspielen", en: "Play" },
  pause: { de: "Pause", en: "Pause" },
  discard: { de: "Verwerfen", en: "Discard" },
  transcribe: { de: "Transkribieren", en: "Transcribe" },
  transcribing: { de: "Wird transkribiert …", en: "Transcribing …" },
  langNote: { de: "Sprache: Deutsch", en: "Language: English" },
  outTitle: { de: "Transkript", en: "Transcript" },
  copy: { de: "Als Text kopieren", en: "Copy as text" },
  copied: { de: "Transkript in die Zwischenablage kopiert.", en: "Transcript copied to the clipboard." },
  copyFail: { de: "Kopieren war nicht möglich. Bitte markieren Sie den Text und kopieren Sie ihn selbst.", en: "Copying did not work. Please select the text and copy it yourself." },
  noServerHead: { de: "Noch kein Transkriptions-Server verbunden.", en: "No transcription server connected yet." },
  readyHead: { de: "Noch kein Transkript.", en: "No transcript yet." },
  busyHead: { de: "Ihre Aufnahme wird transkribiert …", en: "Your recording is being transcribed …" },
  busyBody: { de: "Das kann bis zu einer Minute dauern.", en: "This can take up to a minute." },
  errorHead: { de: "Kein Transkript erhalten.", en: "No transcript received." },
  laneAria: { de: "Zeitachse: wer wann spricht", en: "Timeline: who speaks when" },
  speaker: { de: "Sprecher", en: "Speaker" },
  // Status messages, written for the person in front of the screen.
  insecure: {
    de: "Das Mikrofon funktioniert nur, wenn diese Seite über eine sichere Verbindung (https://) geöffnet ist.",
    en: "The microphone only works when this page is opened over a secure connection (https://).",
  },
  unsupported: {
    de: "Dieser Browser kann hier nicht aufnehmen. Bitte verwenden Sie einen aktuellen Chrome, Edge, Firefox oder Safari.",
    en: "This browser cannot record here. Please use a current version of Chrome, Edge, Firefox or Safari.",
  },
  denied: {
    de: "Kein Zugriff auf das Mikrofon. Bitte erlauben Sie den Zugriff in den Browser-Einstellungen (Symbol links neben der Adresse) und tippen Sie erneut auf „Aufnahme starten“.",
    en: "No access to the microphone. Please allow access in your browser settings (icon to the left of the address) and tap “Start recording” again.",
  },
  noMic: {
    de: "Kein Mikrofon gefunden. Bitte schließen Sie ein Mikrofon an oder wählen Sie es in den Systemeinstellungen aus.",
    en: "No microphone found. Please connect a microphone or select one in your system settings.",
  },
  micBusy: {
    de: "Das Mikrofon wird gerade von einer anderen App verwendet. Bitte schließen Sie diese App und versuchen Sie es erneut.",
    en: "The microphone is being used by another app. Please close that app and try again.",
  },
  startFail: {
    de: "Die Aufnahme konnte nicht gestartet werden. Bitte laden Sie die Seite neu und versuchen Sie es erneut.",
    en: "The recording could not be started. Please reload the page and try again.",
  },
  recording: {
    de: "Aufnahme läuft. Lesen Sie den Text vor und tippen Sie danach auf „Aufnahme beenden“.",
    en: "Recording. Read the script aloud, then tap “Stop recording”.",
  },
  tooShort: { de: "Die Aufnahme war zu kurz. Bitte sprechen Sie mindestens eine Sekunde lang.", en: "The recording was too short. Please speak for at least one second." },
  limit: { de: "Nach 60 Sekunden automatisch beendet.", en: "Stopped automatically after 60 seconds." },
  unplugged: { de: "Das Mikrofon wurde getrennt. Die Aufnahme bis zu diesem Punkt ist gespeichert.", en: "The microphone was disconnected. The recording up to that point has been kept." },
  recFail: { de: "Bei der Aufnahme ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.", en: "Something went wrong while recording. Please try again." },
  done: { de: "Aufnahme fertig ({t}). Hören Sie sie an oder tippen Sie auf „Transkribieren“.", en: "Recording ready ({t}). Listen to it or tap “Transcribe”." },
  discarded: { de: "Aufnahme verworfen.", en: "Recording discarded." },
  playFail: { de: "Die Aufnahme lässt sich in diesem Browser nicht abspielen.", en: "This browser cannot play the recording." },
  notSent: {
    de: "Kein Transkriptions-Server verbunden. Ihre Aufnahme wurde nicht gesendet und bleibt in diesem Browser.",
    en: "No transcription server is connected. Your recording was not sent and stays in this browser.",
  },
  sending: { de: "Ihre Aufnahme wird an den J.A.R.-Transkriptions-Server gesendet …", en: "Sending your recording to the J.A.R. transcription server …" },
  received: { de: "Transkript erhalten: {n} Abschnitte, {k} Sprecher.", en: "Transcript received: {n} segments, {k} speakers." },
  timeout: { de: "Der Server hat nicht innerhalb von 60 Sekunden geantwortet. Bitte versuchen Sie es später erneut.", en: "The server did not answer within 60 seconds. Please try again later." },
  offline: {
    de: "Der Transkriptions-Server ist gerade nicht erreichbar. Bitte prüfen Sie Ihre Internetverbindung oder versuchen Sie es später erneut.",
    en: "The transcription server cannot be reached right now. Please check your internet connection or try again later.",
  },
  tooBig: { de: "Die Aufnahme ist zu groß für den Server. Bitte nehmen Sie einen kürzeren Text auf.", en: "The recording is too large for the server. Please record a shorter text." },
  busy: { de: "Der Server ist gerade ausgelastet. Bitte versuchen Sie es in einer Minute erneut.", en: "The server is busy right now. Please try again in a minute." },
  httpFail: { de: "Der Server konnte die Aufnahme nicht verarbeiten (Fehler {code}). Bitte versuchen Sie es später erneut.", en: "The server could not process the recording (error {code}). Please try again later." },
  badReply: { de: "Der Server hat eine unerwartete Antwort geschickt. Bitte versuchen Sie es später erneut.", en: "The server sent an unexpected reply. Please try again later." },
  noSpeech: { de: "In der Aufnahme wurde keine Sprache erkannt. Bitte sprechen Sie näher am Mikrofon.", en: "No speech was found in the recording. Please speak closer to the microphone." },
  misconfigured: {
    de: "Der Transkriptions-Dienst ist gerade nicht richtig eingerichtet. Bitte melden Sie das an {mail}.",
    en: "The transcription service is not set up correctly at the moment. Please report this to {mail}.",
  },
};

// Read-aloud scripts: short mSTART pre-triage dialogues with two or three voices.
const SCRIPTS = [
  [
    { role: { de: "Einsatzkraft", en: "Responder" }, text: { de: "Hallo, Rettungsdienst. Können Sie mich hören? Bleiben Sie bitte liegen.", en: "Hello, ambulance service. Can you hear me? Please stay lying down." } },
    { role: { de: "Patient", en: "Patient" }, text: { de: "Ja. Mein linkes Bein tut weh, ich kann nicht aufstehen.", en: "Yes. My left leg hurts, I can't get up." } },
    { role: { de: "Einsatzkraft", en: "Responder" }, text: { de: "Nicht gehfähig. Atemfrequenz zweiundzwanzig, Radialispuls tastbar, befolgt Aufforderungen. Sichtungskategorie zwei, gelb.", en: "Not walking. Respiratory rate twenty-two, radial pulse present, follows commands. Triage category two, yellow." } },
  ],
  [
    { role: { de: "Einsatzkraft", en: "Responder" }, text: { de: "Patient vierzehn, Tag gelesen. Starke Blutung am rechten Oberschenkel, Tourniquet angelegt.", en: "Patient fourteen, tag read. Heavy bleeding from the right thigh, tourniquet applied." } },
    { role: { de: "Teamleitung", en: "Team lead" }, text: { de: "Verstanden. Braucht er sofort Transport?", en: "Copy. Does he need transport right away?" } },
    { role: { de: "Einsatzkraft", en: "Responder" }, text: { de: "Ja. Atemfrequenz zweiunddreißig, Rekapillarisierung über zwei Sekunden. Sichtungskategorie eins, rot.", en: "Yes. Respiratory rate thirty-two, capillary refill over two seconds. Triage category one, red." } },
  ],
];

// Speaker colours, assigned in order of first appearance.
const SPEAKER_TONES = ["var(--accent)", "var(--sig-amber)", "var(--sig-green)", "var(--sig-red)", "var(--ink-soft)"];

const fill = (text, vars) => String(text).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : ""));

function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

// 00:00.0 — the segment timestamp format of the output field.
function stamp(seconds) {
  const v = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(v / 60);
  const s = v - m * 60;
  return String(m).padStart(2, "0") + ":" + s.toFixed(1).padStart(4, "0");
}

function cssVar(node, name, fallback) {
  try {
    const v = getComputedStyle(node).getPropertyValue(name).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}

function invalid(lang, type, why) {
  console.warn(`${type}: ${why}`);
  return el("div", { class: "callout callout-warn", role: "note" },
    el("p", {}, L(lang, { de: "Diese Demo konnte nicht angezeigt werden.", en: "This demo could not be shown." })));
}

// ---------------------------------------------------------------------------
// Server contract helpers (exported for tests and README examples)
// ---------------------------------------------------------------------------

// "" = not configured; null = configured but unusable; otherwise the base URL.
export function transcriptionEndpoint(raw = CONFIG.TRANSCRIPTION_ENDPOINT) {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname);
    if (url.protocol === "https:" || (url.protocol === "http:" && local)) {
      return (url.origin + url.pathname).replace(/\/+$/, "");
    }
  } catch { /* falls through */ }
  console.warn("recorder-demo: TRANSCRIPTION_ENDPOINT is not an https URL", value);
  return null;
}

// Strict check of the WhisperX-style reply. Returns the cleaned segments
// sorted by start time or throws an Error whose message says what is wrong.
export function parseTranscript(data) {
  const fail = (why) => { throw new Error("invalid transcript: " + why); };
  if (!data || typeof data !== "object" || Array.isArray(data)) fail("not an object");
  if ("language" in data && typeof data.language !== "string") fail("language is not a string");
  if (!Array.isArray(data.segments)) fail("segments is not an array");
  if (data.segments.length > 5000) fail("too many segments");
  const out = data.segments.map((s, i) => {
    if (!s || typeof s !== "object") fail(`segment ${i} is not an object`);
    const { start, end, speaker, text } = s;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) fail(`segment ${i} has bad start/end`);
    if (typeof speaker !== "string" || !speaker.trim()) fail(`segment ${i} has no speaker`);
    if (typeof text !== "string") fail(`segment ${i} has no text`);
    return { start, end, speaker: speaker.trim().slice(0, 64), text: text.trim().slice(0, 4000) };
  });
  return out.filter((s) => s.text).sort((a, b) => a.start - b.start);
}

// Speaker id → { n: 1-based number in order of appearance, tone }.
function speakerMap(segments) {
  const map = new Map();
  for (const s of segments) {
    if (!map.has(s.speaker)) map.set(s.speaker, { n: map.size + 1, tone: SPEAKER_TONES[map.size % SPEAKER_TONES.length] });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const CSS = `
.vr-card [hidden], .vr-arch [hidden] { display: none !important; }
.vr-card { margin-block: var(--sp-5); padding: var(--sp-5); border: 1px solid var(--line); border-radius: var(--r-lg); background: var(--bg-raise); box-shadow: var(--shadow-card); color: var(--ink); }
.vr-head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: var(--sp-2) var(--sp-4); margin-bottom: var(--sp-4); }
.vr-eyebrow { display: block; font-family: var(--font-mono); font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
.vr-eyebrow + .vr-title { margin-top: 0.2rem; }
.vr-title { margin: 0; font-size: 1.15rem; line-height: 1.25; font-weight: 600; color: var(--ink); }
.vr-chip { display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.3rem 0.7rem; border: 1px solid var(--line-strong); border-radius: var(--r-pill); font-size: 0.75rem; line-height: 1.3; color: var(--ink-soft); }
.vr-chip::before { content: ""; flex: none; width: 0.55rem; height: 0.55rem; border-radius: 50%; background: var(--sig-amber); }
.vr-chip[data-on="true"]::before { background: var(--sig-green); }

/* Read-aloud script, like the main site's prompt card */
.vr-script { margin: 0 0 var(--sp-4); padding: var(--sp-4); border-radius: var(--r-md); background: var(--bg-deep); box-shadow: inset 0 0 0 1px var(--line); transition: box-shadow var(--dur) var(--ease-out); }
.vr-card[data-phase="recording"] .vr-script { box-shadow: inset 0 0 0 2px var(--sig-red); }
.vr-script-top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--sp-2); margin-bottom: var(--sp-3); font-size: 0.75rem; color: var(--ink-faint); }
.vr-script-line { display: grid; grid-template-columns: 7.5rem 1fr; gap: var(--sp-3); margin: 0; padding: 0.35rem 0; font-size: 0.95rem; line-height: 1.5; color: var(--ink); }
.vr-script-role { font-family: var(--font-mono); font-size: 0.75rem; line-height: 2; letter-spacing: 0.04em; color: var(--accent); }

/* The big record button (same build as the main site's .rec__btn) */
.vr-btn { display: flex; align-items: center; gap: var(--sp-4); width: 100%; padding: var(--sp-3) var(--sp-4); border: 0; border-radius: var(--r-pill); background: var(--brand-mint); color: var(--brand-navy); font: inherit; font-size: 1.05rem; font-weight: 600; cursor: pointer; transition: background var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out); }
.vr-btn:active { transform: scale(0.99); }
.vr-btn:focus-visible { outline: 3px solid var(--ink); outline-offset: 3px; }
.vr-btn:disabled { cursor: progress; opacity: 0.7; }
.vr-btn-icon { flex: none; display: grid; place-items: center; width: 2.6rem; height: 2.6rem; border-radius: 50%; background: var(--brand-navy); color: var(--brand-mint); }
.vr-btn-icon svg { width: 1.2rem; height: 1.2rem; }
.vr-btn-stop { display: none; width: 0.9rem; height: 0.9rem; border-radius: 3px; background: currentColor; }
.vr-btn-label { flex: 1; text-align: left; }
.vr-btn-time { font-family: var(--font-mono); font-size: 0.85rem; font-variant-numeric: tabular-nums; opacity: 0.8; }
.vr-card[data-phase="recording"] .vr-btn { background: var(--sig-red); }
.vr-card[data-phase="recording"] .vr-btn-icon { color: var(--sig-red); background: var(--bg-raise); animation: vr-pulse 1.4s var(--ease-in-out) infinite; }
.vr-card[data-phase="recording"] .vr-btn-icon svg { display: none; }
.vr-card[data-phase="recording"] .vr-btn-stop { display: block; }
@keyframes vr-pulse { 0%, 100% { box-shadow: 0 0 0 0 var(--line-strong); } 50% { box-shadow: 0 0 0 8px transparent; } }
@media (prefers-reduced-motion: reduce) { .vr-card[data-phase="recording"] .vr-btn-icon { animation: none; } }

.vr-wave { position: relative; margin-top: var(--sp-3); height: 76px; border-radius: var(--r-md); background: var(--bg-deep); box-shadow: inset 0 0 0 1px var(--line); overflow: hidden; }
.vr-wave-canvas { display: block; width: 100%; height: 100%; cursor: default; }
.vr-wave[data-seek="true"] .vr-wave-canvas { cursor: pointer; }
.vr-wave-label { position: absolute; inset: 0; display: grid; place-items: center; font-size: 0.8rem; color: var(--ink-faint); pointer-events: none; }
.vr-status { min-height: 1.5em; margin: var(--sp-3) 0 0; font-size: 0.875rem; line-height: 1.45; color: var(--ink-soft); }
.vr-status[data-kind="error"] { color: var(--sig-red); }
.vr-status[data-kind="warn"] { color: var(--sig-amber); }
.vr-status[data-kind="ok"] { color: var(--sig-green); }

.vr-take { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2) var(--sp-3); margin-top: var(--sp-3); }
.vr-take[hidden] { display: none; }
.vr-take-time { font-family: var(--font-mono); font-size: 0.8rem; font-variant-numeric: tabular-nums; color: var(--ink-soft); }
.vr-take-gap { flex: 1; }
.vr-lang { font-size: 0.75rem; color: var(--ink-faint); }

/* Output field */
.vr-out { margin-top: var(--sp-5); border: 1px solid var(--line-strong); border-radius: var(--r-md); overflow: hidden; }
.vr-out-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--sp-2); padding: var(--sp-3) var(--sp-4); border-bottom: 1px solid var(--line); background: var(--bg-raise-2); }
.vr-out-title { font-family: var(--font-mono); font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
.vr-out-tools { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
.vr-out-body { padding: var(--sp-4); }
.vr-empty { display: grid; gap: 0.25rem; padding: var(--sp-3) 0; font-size: 0.9rem; line-height: 1.45; color: var(--ink-soft); }
.vr-empty strong { color: var(--ink); font-weight: 600; }
.vr-empty[data-kind="noserver"] strong::before { content: ""; display: inline-block; width: 0.55rem; height: 0.55rem; margin-right: 0.5rem; border-radius: 50%; background: var(--sig-amber); vertical-align: 0.08em; }
.vr-empty[data-kind="error"] strong { color: var(--sig-red); }
.vr-empty.vr-flash { animation: vr-flash 0.9s var(--ease-out); }
@keyframes vr-flash { 0% { background: var(--surface-tint); } 100% { background: transparent; } }
.vr-busybar { height: 3px; margin-top: var(--sp-2); border-radius: var(--r-pill); background: linear-gradient(90deg, transparent, var(--accent), transparent) 0 0 / 40% 100% no-repeat, var(--line); animation: vr-busy 1.2s linear infinite; }
@keyframes vr-busy { from { background-position: -40% 0, 0 0; } to { background-position: 140% 0, 0 0; } }

.vr-lanes { display: grid; gap: 6px; margin-bottom: var(--sp-4); }
.vr-lane { display: grid; grid-template-columns: 6.2rem 1fr; align-items: center; gap: var(--sp-2); }
.vr-lane-name { font-size: 0.75rem; color: var(--ink-soft); white-space: nowrap; }
.vr-lane-track { position: relative; height: 14px; border-radius: var(--r-pill); background: var(--bg-deep); }
.vr-lane-seg { position: absolute; top: 2px; bottom: 2px; border-radius: var(--r-pill); opacity: 0.55; transition: opacity var(--dur-fast); }
.vr-lane-seg.is-on { opacity: 1; }
.vr-lanes-box { position: relative; }
.vr-playhead { position: absolute; top: -4px; bottom: -4px; width: 2px; margin-left: -1px; border-radius: 1px; background: var(--ink); pointer-events: none; }
.vr-playhead[hidden] { display: none; }

.vr-rows { display: grid; gap: 2px; margin: 0; padding: 0; list-style: none; }
.vr-row { display: grid; grid-template-columns: 9.6rem 6.4rem 1fr; align-items: baseline; gap: var(--sp-3); padding: var(--sp-2); border-radius: var(--r-sm); transition: background var(--dur-fast); }
.vr-row.is-on { background: var(--surface-tint); }
.vr-row-time { font-family: var(--font-mono); font-size: 0.75rem; font-variant-numeric: tabular-nums; color: var(--ink-faint); }
.vr-spk { justify-self: start; padding: 0.1rem 0.55rem; border-radius: var(--r-pill); border: 1px solid currentColor; font-size: 0.75rem; font-weight: 600; white-space: nowrap; }
.vr-row-text { font-size: 0.9rem; line-height: 1.45; color: var(--ink); overflow-wrap: anywhere; }

@media (max-width: 560px) {
  .vr-card { padding: var(--sp-4); }
  .vr-script-line { grid-template-columns: 1fr; gap: 0; }
  .vr-script-role { line-height: 1.4; }
  .vr-row { grid-template-columns: auto 1fr; gap: 0.25rem var(--sp-2); }
  .vr-row-text { grid-column: 1 / -1; }
  .vr-lane { grid-template-columns: 5.4rem 1fr; }
}

/* ---- recorder-architecture ---------------------------------------------- */
.vr-arch { margin-block: var(--sp-5); padding: var(--sp-5); border: 1px solid var(--line); border-radius: var(--r-lg); background: var(--bg-raise); box-shadow: var(--shadow-card); color: var(--ink); }
.vr-arch-flow { position: relative; display: grid; grid-template-columns: repeat(3, 1fr); gap: 44px; margin: var(--sp-4) 0; }
.vr-node { position: relative; display: flex; flex-direction: column; gap: 0.3rem; min-width: 0; padding: var(--sp-3); border: 1px solid var(--line-strong); border-radius: var(--r-md); background: var(--bg-deep); transition: border-color var(--dur) var(--ease-out), box-shadow var(--dur) var(--ease-out); }
.vr-node.is-on { border-color: var(--accent); box-shadow: 0 0 0 3px var(--surface-tint); }
.vr-node:not(:last-child)::after { content: ""; position: absolute; top: 50%; left: 100%; width: 44px; border-top: 2px dashed var(--line-strong); }
.vr-node-k { font-family: var(--font-mono); font-size: 0.75rem; letter-spacing: 0.08em; color: var(--accent); }
.vr-node-name { font-size: 0.95rem; line-height: 1.25; font-weight: 600; color: var(--ink); }
.vr-node-sub { font-size: 0.75rem; line-height: 1.35; color: var(--ink-soft); }
.vr-viz { display: flex; align-items: center; gap: 3px; height: 34px; margin-top: 0.25rem; }
.vr-viz-bar { flex: 1; height: 100%; max-width: 6px; border-radius: 2px; background: var(--accent); transform-origin: center; transform: scaleY(0.12); }
.vr-viz-rows { display: grid; align-content: center; gap: 4px; }
.vr-viz-row { height: 7px; border-radius: var(--r-pill); transform-origin: left; transform: scaleX(0); }
.vr-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 0.25rem; }
.vr-tag { padding: 0.12rem 0.45rem; border: 1px solid var(--line-strong); border-radius: var(--r-pill); font-family: var(--font-mono); font-size: 0.75rem; color: var(--ink-soft); transition: color var(--dur-fast), border-color var(--dur-fast), background var(--dur-fast); }
.vr-tag.is-on { color: var(--brand-navy); border-color: var(--accent); background: var(--accent); }
.vr-packet { position: absolute; left: 0; top: 0; z-index: 2; display: flex; align-items: center; gap: 0.35rem; pointer-events: none; transform: translate(-50%, -50%); }
.vr-packet[hidden] { display: none; }
.vr-packet-dot { width: 14px; height: 14px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 4px var(--surface-tint); }
.vr-packet[data-back="true"] .vr-packet-dot { background: var(--sig-green); }
.vr-packet-label { display: none; position: absolute; left: 22px; top: 50%; transform: translateY(-50%); padding: 0.05rem 0.4rem; border-radius: var(--r-sm); background: var(--bg-raise); box-shadow: inset 0 0 0 1px var(--line-strong); font-family: var(--font-mono); font-size: 0.75rem; white-space: nowrap; color: var(--ink); }
.vr-payload { display: grid; gap: 0.25rem; padding: var(--sp-3); border-radius: var(--r-md); background: var(--bg-deep); box-shadow: inset 0 0 0 1px var(--line); }
.vr-payload-step { font-size: 0.8rem; font-weight: 600; color: var(--accent); }
.vr-payload-text { font-size: 0.875rem; line-height: 1.45; color: var(--ink); }
.vr-payload-code { font-family: var(--font-mono); font-size: 0.75rem; line-height: 1.5; color: var(--ink-soft); overflow-wrap: anywhere; }
.vr-arch-ctrl { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2); margin-top: var(--sp-3); }
.vr-steps { display: flex; gap: 6px; margin-left: auto; }
.vr-stepdot { width: 26px; height: 26px; padding: 0; border: 1px solid var(--line-strong); border-radius: 50%; background: transparent; font-family: var(--font-mono); font-size: 0.75rem; color: var(--ink-soft); cursor: pointer; }
.vr-stepdot.is-on { border-color: var(--accent); background: var(--accent); color: var(--brand-navy); }
.vr-arch-cap { margin-top: var(--sp-3); font-size: 0.75rem; line-height: 1.45; color: var(--ink-faint); }
@media (max-width: 560px) {
  .vr-arch { padding: var(--sp-4); }
  .vr-arch-flow { grid-template-columns: 1fr; gap: 40px; }
  .vr-node:not(:last-child)::after { top: 100%; left: 50%; width: 0; height: 40px; border-top: 0; border-left: 2px dashed var(--line-strong); }
  .vr-packet-label { display: block; }
  .vr-steps { margin-left: 0; }
}
`;

// ---------------------------------------------------------------------------
// recorder-architecture: Browser → Cloudflare Tunnel → model computer → JSON
// ---------------------------------------------------------------------------
const ARCH_NODES = [
  { name: { de: "Browser", en: "Browser" }, sub: { de: "jar-medical.tech · Aufnahme mit MediaRecorder", en: "jar-medical.tech · recording with MediaRecorder" } },
  { name: { de: "Cloudflare Tunnel", en: "Cloudflare Tunnel" }, sub: { de: "HTTPS · CORS nur für jar-medical.tech", en: "HTTPS · CORS only for jar-medical.tech" } },
  { name: { de: "J.A.R.-Modellrechner", en: "J.A.R. model computer" }, sub: { de: "WhisperX + pyannote", en: "WhisperX + pyannote" } },
];

// Timeline of one loop. at: node index or [from, to] for a transit leg.
const ARCH_PHASES = [
  { dur: 2.2, at: 0, step: 0 },
  { dur: 1.1, at: [0, 1], step: 1, packet: { de: "Audio + Sprache", en: "audio + language" } },
  { dur: 1.1, at: 1, step: 1 },
  { dur: 1.1, at: [1, 2], step: 1, packet: { de: "Audio + Sprache", en: "audio + language" } },
  { dur: 2.0, at: 2, step: 2 },
  { dur: 2.0, at: 2, step: 3 },
  { dur: 1.0, at: [2, 1], step: 4, back: true, packet: { de: "JSON", en: "JSON" } },
  { dur: 0.5, at: 1, step: 4 },
  { dur: 1.0, at: [1, 0], step: 4, back: true, packet: { de: "JSON", en: "JSON" } },
  { dur: 2.8, at: 0, step: 4, render: true },
];
const ARCH_TOTAL = ARCH_PHASES.reduce((s, p) => s + p.dur, 0);
const ARCH_STEPS = [
  {
    title: { de: "1 · Aufnahme im Browser", en: "1 · Recording in the browser" },
    text: { de: "Das Mikrofon nimmt auf; die Datei bleibt im Browser, bis Sie „Transkribieren“ tippen.", en: "The microphone records; the file stays in the browser until you tap “Transcribe”." },
    code: "Blob · audio/webm | audio/mp4 · ≤ 60 s",
  },
  {
    title: { de: "2 · Upload durch den Tunnel", en: "2 · Upload through the tunnel" },
    text: { de: "Ein HTTPS-Request erreicht den Modellrechner über einen Cloudflare Tunnel – ohne offenen Port.", en: "One HTTPS request reaches the model computer through a Cloudflare Tunnel – no open port." },
    code: "POST /transcribe · multipart/form-data · audio, language=de|en",
  },
  {
    title: { de: "3 · Transkription (WhisperX)", en: "3 · Transcription (WhisperX)" },
    text: { de: "WhisperX schreibt den Text und richtet jedes Wort zeitlich aus.", en: "WhisperX writes the text and time-aligns every word." },
    code: "text + word timestamps",
  },
  {
    title: { de: "4 · Diarisierung (pyannote)", en: "4 · Diarization (pyannote)" },
    text: { de: "pyannote erkennt, wer wann spricht – Einsatzkraft, Patient, Teamleitung – und vergibt Sprecher-IDs.", en: "pyannote detects who speaks when – responder, patient, team lead – and assigns speaker ids." },
    code: "SPEAKER_00 · SPEAKER_01 · SPEAKER_02",
  },
  {
    title: { de: "5 · Diarisiertes JSON zurück", en: "5 · Diarized JSON back" },
    text: { de: "Der Browser zeigt jedes Segment mit Zeit und Sprecher. Nur die Spur der Einsatzkraft darf Befunde liefern.", en: "The browser shows each segment with time and speaker. Only the responder's track may supply findings." },
    code: '{"start":0.0,"end":2.4,"speaker":"SPEAKER_00","text":"…"}',
  },
];

function renderArchitecture(block, lang) {
  if (block != null && typeof block !== "object") return invalid(lang, "recorder-architecture", "block is not an object");
  injectStyle("vr-styles", CSS);

  const configured = transcriptionEndpoint() !== "";
  const nodes = ARCH_NODES.map((n, i) => el("div", { class: "vr-node" },
    el("span", { class: "vr-node-k" }, String(i + 1).padStart(2, "0")),
    el("span", { class: "vr-node-name" }, L(lang, n.name)),
    el("span", { class: "vr-node-sub" }, L(lang, n.sub))));

  // Mini animations inside the nodes.
  const bars = Array.from({ length: 16 }, () => el("span", { class: "vr-viz-bar" }));
  const rowTones = ["var(--accent)", "var(--sig-amber)", "var(--accent)"];
  const rows = rowTones.map((tone, i) => el("span", { class: "vr-viz-row", style: `background:${tone};width:${[70, 46, 88][i]}%` }));
  const browserViz = el("div", { class: "vr-viz" }, bars);
  const browserRows = el("div", { class: "vr-viz vr-viz-rows", hidden: true }, rows);
  nodes[0].append(browserViz, browserRows);
  const tunnelTag = el("span", { class: "vr-tag" }, "HTTPS");
  nodes[1].append(el("div", { class: "vr-tags" }, tunnelTag, el("span", { class: "vr-tag" }, "CORS")));
  const asrTag = el("span", { class: "vr-tag" }, "WhisperX");
  const diaTag = el("span", { class: "vr-tag" }, "pyannote");
  nodes[2].append(el("div", { class: "vr-tags" }, asrTag, diaTag));

  const packetLabel = el("span", { class: "vr-packet-label" });
  const packet = el("span", { class: "vr-packet", hidden: true }, el("span", { class: "vr-packet-dot" }), packetLabel);
  const flow = el("div", { class: "vr-arch-flow" }, nodes, packet);

  const stepTitle = el("span", { class: "vr-payload-step" });
  const stepText = el("span", { class: "vr-payload-text" });
  const stepCode = el("code", { class: "vr-payload-code" });
  const payload = el("div", { class: "vr-payload", "aria-live": "off" }, stepTitle, stepText, stepCode);

  let playing = true;
  let t = 0;
  let shownStep = -1;
  const playBtn = el("button", { class: "btn btn-outline btn-small", type: "button", "aria-pressed": "false" }, L(lang, S.pause));
  const stepDots = ARCH_STEPS.map((s, i) => el("button", {
    class: "vr-stepdot", type: "button", "aria-label": L(lang, s.title),
    onclick: () => { t = phaseStart(ARCH_PHASES.findIndex((p) => p.step === i)) + 0.01; setPlaying(false); paint(t); },
  }, String(i + 1)));
  const nextBtn = el("button", {
    class: "btn btn-outline btn-small", type: "button",
    onclick: () => {
      const cur = phaseAt(t).step;
      const next = (cur + 1) % ARCH_STEPS.length;
      t = phaseStart(ARCH_PHASES.findIndex((p) => p.step === next)) + 0.01;
      setPlaying(false);
      paint(t);
    },
  }, L(lang, { de: "Nächster Schritt", en: "Next step" }));
  function setPlaying(on) {
    playing = on;
    playBtn.textContent = L(lang, on ? S.pause : S.play);
    playBtn.setAttribute("aria-pressed", on ? "false" : "true");
  }
  playBtn.addEventListener("click", () => setPlaying(!playing));

  const head = el("div", { class: "vr-head" },
    el("div", {},
      el("span", { class: "vr-eyebrow" }, L(lang, { de: "Datenweg einer Aufnahme", en: "Path of a recording" })),
      el("p", { class: "vr-title" }, L(lang, { de: "Vom Mikrofon zum diarisierten Transkript", en: "From microphone to diarized transcript" }))),
    el("span", { class: "vr-chip", "data-on": String(configured) }, L(lang, configured ? S.serverOn : S.serverOff)));

  const root = el("figure", {
    class: "vr-arch", role: "group",
    "aria-label": L(lang, {
      de: "Animiertes Diagramm: Die Aufnahme geht vom Browser über einen Cloudflare Tunnel zum J.A.R.-Modellrechner; WhisperX transkribiert, pyannote trennt die Sprecher, diarisiertes JSON kommt zurück.",
      en: "Animated diagram: the recording goes from the browser through a Cloudflare Tunnel to the J.A.R. model computer; WhisperX transcribes, pyannote separates the speakers, diarized JSON comes back.",
    }),
  },
  head, flow, payload,
  el("div", { class: "vr-arch-ctrl" }, playBtn, nextBtn, el("div", { class: "vr-steps" }, stepDots)),
  el("figcaption", { class: "vr-arch-cap" }, L(lang, {
    de: "Schematische Darstellung. Der Modellrechner ist derzeit noch nicht angebunden.",
    en: "Schematic illustration. The model computer is not connected yet.",
  })));
  if (configured) root.lastChild.textContent = L(lang, { de: "Schematische Darstellung.", en: "Schematic illustration." });

  function phaseStart(index) {
    let s = 0;
    for (let i = 0; i < index; i++) s += ARCH_PHASES[i].dur;
    return s;
  }
  function phaseAt(time) {
    let s = 0;
    for (const p of ARCH_PHASES) {
      if (time < s + p.dur) return { ...p, local: (time - s) / p.dur };
      s += p.dur;
    }
    return { ...ARCH_PHASES[ARCH_PHASES.length - 1], local: 1 };
  }
  function centre(i) {
    const f = flow.getBoundingClientRect();
    const r = nodes[i].getBoundingClientRect();
    return { x: r.left - f.left + r.width / 2, y: r.top - f.top + r.height / 2, r, f };
  }
  // Point on the dashed connector between node a and b (gap only), u in 0..1.
  function legPoint(a, b, u) {
    const A = centre(a);
    const B = centre(b);
    const vertical = Math.abs(A.x - B.x) < 4;
    if (vertical) {
      const y0 = a < b ? A.r.bottom - A.f.top : A.r.top - A.f.top;
      const y1 = a < b ? B.r.top - B.f.top : B.r.bottom - B.f.top;
      return { x: A.x, y: y0 + (y1 - y0) * u };
    }
    const x0 = a < b ? A.r.right - A.f.left : A.r.left - A.f.left;
    const x1 = a < b ? B.r.left - B.f.left : B.r.right - B.f.left;
    return { x: x0 + (x1 - x0) * u, y: A.y };
  }

  function paint(time, still = false) {
    const ph = still ? { ...ARCH_PHASES[ARCH_PHASES.length - 1], local: 1 } : phaseAt(time);
    const active = Array.isArray(ph.at) ? -1 : ph.at;
    nodes.forEach((n, i) => n.classList.toggle("is-on", i === active));
    // Packet in transit
    if (Array.isArray(ph.at)) {
      const p = legPoint(ph.at[0], ph.at[1], ease(ph.local));
      packet.hidden = false;
      packet.style.left = p.x + "px";
      packet.style.top = p.y + "px";
      packet.dataset.back = String(Boolean(ph.back));
      packetLabel.textContent = L(lang, ph.packet);
    } else packet.hidden = true;
    // Browser: live bars while recording, speaker rows when the reply renders
    const recording = ph.at === 0 && !ph.render;
    browserViz.hidden = Boolean(ph.render);
    browserRows.hidden = !ph.render;
    bars.forEach((b, i) => {
      const v = recording ? 0.2 + 0.8 * Math.abs(Math.sin(time * 7 + i * 0.9) * Math.sin(time * 2.3 + i * 0.37)) : 0.12;
      b.style.transform = `scaleY(${v.toFixed(3)})`;
    });
    rows.forEach((r, i) => {
      const v = ph.render ? clamp(ph.local * 3 - i * 0.6, 0, 1) : 0;
      r.style.transform = `scaleX(${ease(v).toFixed(3)})`;
    });
    tunnelTag.classList.toggle("is-on", ph.at === 1 || (Array.isArray(ph.at) && ph.at.includes(1)));
    asrTag.classList.toggle("is-on", ph.at === 2 && ph.step === 2);
    diaTag.classList.toggle("is-on", ph.at === 2 && ph.step === 3);
    if (ph.step !== shownStep) {
      shownStep = ph.step;
      const s = ARCH_STEPS[ph.step];
      stepTitle.textContent = L(lang, s.title);
      stepText.textContent = L(lang, s.text);
      stepCode.textContent = s.code;
      stepDots.forEach((d, i) => d.classList.toggle("is-on", i === ph.step));
    }
  }

  animate(root, (_, dt, still) => {
    if (still) {
      // Reduced motion: the final state; the step buttons still work.
      setPlaying(false);
      playBtn.hidden = true;
      t = phaseStart(ARCH_PHASES.length - 1) + 0.01;
      paint(t, true);
      return;
    }
    if (playing) t = (t + dt) % ARCH_TOTAL;
    paint(t);
  });
  return root;
}

// ---------------------------------------------------------------------------
// recorder-demo
// ---------------------------------------------------------------------------
const MIC_SVG = () => {
  // Built with DOM calls (no markup strings): microphone glyph.
  const ns = "http://www.w3.org/2000/svg";
  const s = document.createElementNS(ns, "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("fill", "none");
  s.setAttribute("stroke", "currentColor");
  s.setAttribute("stroke-width", "2");
  s.setAttribute("stroke-linecap", "round");
  s.setAttribute("aria-hidden", "true");
  const r = document.createElementNS(ns, "rect");
  for (const [k, v] of Object.entries({ x: 9, y: 3, width: 6, height: 11, rx: 3 })) r.setAttribute(k, v);
  const p = document.createElementNS(ns, "path");
  p.setAttribute("d", "M5 11a7 7 0 0 0 14 0M12 18v3");
  s.append(r, p);
  return s;
};

// WebKit (Safari, and every browser on iOS) records AAC in MP4 reliably and
// plays it back; its WebM recording is newer and not always playable there.
const WEBKIT = /Apple/.test(globalThis.navigator?.vendor || "");

function pickMime() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
  const order = WEBKIT
    ? ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"]
    : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  for (const type of order) {
    try { if (MediaRecorder.isTypeSupported(type)) return type; } catch { /* keep looking */ }
  }
  return "";
}

function extFor(type) {
  if (/mp4|m4a|aac/.test(type)) return "m4a";
  if (/ogg/.test(type)) return "ogg";
  if (/wav/.test(type)) return "wav";
  return "webm";
}

function micError(err) {
  const name = err && err.name;
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return S.denied;
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") return S.noMic;
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return S.micBusy;
  return S.startFail;
}

function renderRecorder(block, lang) {
  if (block != null && typeof block !== "object") return invalid(lang, "recorder-demo", "block is not an object");
  injectStyle("vr-styles", CSS);

  const configured = transcriptionEndpoint() !== "";
  const st = {
    phase: "idle",          // idle | starting | recording | stopping
    session: null,          // live recording: { stream, ctx, analyser, rec, chunks, peaks, started, timer, buf }
    take: null,             // { blob, type, url, seconds, peaks }
    audio: null,
    out: configured ? "ready" : "noserver",   // noserver | ready | busy | error | result
    outError: null,
    result: null,
    busy: false,
    abort: null,
    scriptIndex: 0,
  };

  // --- Script card
  const scriptBody = el("div", {});
  const showScript = () => {
    scriptBody.replaceChildren(...SCRIPTS[st.scriptIndex].map((line) => el("p", { class: "vr-script-line" },
      el("span", { class: "vr-script-role" }, L(lang, line.role)),
      el("span", {}, L(lang, line.text)))));
  };
  showScript();
  const scriptBtn = el("button", { class: "btn btn-outline btn-small", type: "button", onclick: () => { st.scriptIndex = (st.scriptIndex + 1) % SCRIPTS.length; showScript(); } }, L(lang, S.scriptNext));
  const script = el("figure", { class: "vr-script", lang },
    el("div", { class: "vr-script-top" }, el("span", {}, L(lang, S.scriptLabel)), scriptBtn), scriptBody);

  // --- Record button
  const btnLabel = el("span", { class: "vr-btn-label" }, L(lang, S.start));
  const btnTime = el("span", { class: "vr-btn-time" }, "0:00 / 1:00");
  const recBtn = el("button", { class: "vr-btn", type: "button", "aria-pressed": "false" },
    el("span", { class: "vr-btn-icon", "aria-hidden": "true" }, MIC_SVG(), el("span", { class: "vr-btn-stop" })),
    btnLabel, btnTime);

  // --- Level / take display
  const cv = hiDpiCanvas("vr-wave-canvas");
  cv.canvas.setAttribute("role", "img");
  cv.canvas.setAttribute("aria-label", L(lang, S.waveAria));
  const waveLabel = el("span", { class: "vr-wave-label" }, L(lang, S.waveIdle));
  const wave = el("div", { class: "vr-wave" }, cv.canvas, waveLabel);

  const status = el("p", { class: "vr-status", role: "status", "aria-live": "polite" });
  const say = (text, kind) => {
    status.textContent = text ? L(lang, text) : "";
    if (kind) status.dataset.kind = kind; else delete status.dataset.kind;
  };

  // --- Take bar: play / discard / transcribe
  const playBtn = el("button", { class: "btn btn-outline btn-small", type: "button" }, L(lang, S.play));
  const takeTime = el("span", { class: "vr-take-time" }, "0:00 / 0:00");
  const discardBtn = el("button", { class: "btn btn-outline btn-small", type: "button" }, L(lang, S.discard));
  const transcribeBtn = el("button", { class: "btn btn-primary btn-small", type: "button" }, L(lang, S.transcribe));
  const take = el("div", { class: "vr-take", hidden: true },
    playBtn, takeTime, discardBtn, el("span", { class: "vr-take-gap" }), el("span", { class: "vr-lang" }, L(lang, S.langNote)), transcribeBtn);

  // --- Output field
  const copyBtn = el("button", { class: "btn btn-outline btn-small", type: "button", hidden: true }, L(lang, S.copy));
  const outBody = el("div", { class: "vr-out-body", "aria-live": "polite" });
  const out = el("section", { class: "vr-out", "aria-label": L(lang, S.outTitle) },
    el("div", { class: "vr-out-head" }, el("span", { class: "vr-out-title" }, L(lang, S.outTitle)), el("div", { class: "vr-out-tools" }, copyBtn)),
    outBody);

  const root = el("div", { class: "vr-card", role: "region", "aria-label": L(lang, S.recAria), "data-phase": "idle" },
    el("div", { class: "vr-head" },
      el("p", { class: "vr-title" }, L(lang, S.title)),
      el("span", { class: "vr-chip", "data-on": String(configured) }, L(lang, configured ? S.serverOn : S.serverOff))),
    script, recBtn, wave, status, take, out);

  // ---------------------------------------------------------------- output
  let view = null; // { segments, map, rows: [], segs: [], head, total }

  function shownSegments() {
    if (st.out === "result" && st.result) return st.result;
    return null;
  }

  function renderOut(flash = false) {
    view = null;
    activeRow = -2;
    const segments = shownSegments();
    copyBtn.hidden = !segments;
    if (!segments) {
      let headText;
      let bodyText;
      const kind = st.out;
      if (kind === "noserver") headText = S.noServerHead;
      else if (kind === "busy") { headText = S.busyHead; bodyText = S.busyBody; }
      else if (kind === "error") { headText = S.errorHead; bodyText = st.outError; }
      else headText = S.readyHead;
      const box = el("div", { class: "vr-empty" + (flash ? " vr-flash" : ""), "data-kind": kind },
        el("strong", {}, L(lang, headText)),
        bodyText ? el("span", {}, typeof bodyText === "string" ? bodyText : L(lang, bodyText)) : null,
        kind === "busy" ? el("div", { class: "vr-busybar", "aria-hidden": "true" }) : null);
      outBody.replaceChildren(box);
      return;
    }
    const map = speakerMap(segments);
    const total = Math.max(1, ...segments.map((s) => s.end)) + 0.2;
    const segNodes = [];
    const lanes = [...map.entries()].map(([id, info]) => {
      const track = el("div", { class: "vr-lane-track" });
      segments.forEach((s, i) => {
        if (s.speaker !== id) return;
        const bar = el("span", { class: "vr-lane-seg", style: `left:${(s.start / total) * 100}%;width:${Math.max(0.6, ((s.end - s.start) / total) * 100)}%;background:${info.tone}` });
        segNodes[i] = bar;
        track.append(bar);
      });
      return el("div", { class: "vr-lane" }, el("span", { class: "vr-lane-name" }, `${L(lang, S.speaker)} ${info.n}`), track);
    });
    const head = el("span", { class: "vr-playhead", hidden: true });
    const lanesBox = el("div", { class: "vr-lanes-box" }, el("div", { class: "vr-lanes", role: "img", "aria-label": L(lang, S.laneAria) }, lanes), head);
    const rowNodes = segments.map((s) => {
      const info = map.get(s.speaker);
      return el("li", { class: "vr-row" },
        el("span", { class: "vr-row-time" }, `${stamp(s.start)}–${stamp(s.end)}`),
        el("span", { class: "vr-spk", style: `color:${info.tone}` }, `${L(lang, S.speaker)} ${info.n}`),
        el("span", { class: "vr-row-text" }, s.text));
    });
    outBody.replaceChildren(
      lanesBox,
      el("ol", { class: "vr-rows" }, rowNodes));
    view = { segments, rows: rowNodes, segs: segNodes, head, total, lanesBox };
  }

  // Playhead: follows the audio while the take plays.
  let activeRow = -2;
  function paintPlayhead() {
    if (!view) return;
    let time = null;
    if (st.audio && !st.audio.paused) time = st.audio.currentTime;
    view.head.hidden = time == null;
    let on = -1;
    if (time != null) {
      // Lane tracks start after the name column; place the head inside them.
      const track = view.lanesBox.querySelector(".vr-lane-track");
      const box = view.lanesBox.getBoundingClientRect();
      const tr = track ? track.getBoundingClientRect() : box;
      view.head.style.left = (tr.left - box.left + (time / view.total) * tr.width) + "px";
      on = view.segments.findIndex((s) => time >= s.start && time <= s.end);
    }
    if (on !== activeRow) {
      activeRow = on;
      view.rows.forEach((r, i) => r.classList.toggle("is-on", i === on));
      view.segs.forEach((b, i) => b && b.classList.toggle("is-on", i === on || on === -1));
    }
  }

  function copyText() {
    const segments = shownSegments();
    if (!segments) return "";
    const map = speakerMap(segments);
    return segments.map((s) => `[${stamp(s.start)}–${stamp(s.end)}] ${L(lang, S.speaker)} ${map.get(s.speaker).n}: ${s.text}`).join("\n");
  }

  copyBtn.addEventListener("click", async () => {
    const text = copyText();
    if (!text) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
      await navigator.clipboard.writeText(text);
      say(S.copied, "ok");
    } catch (e) {
      console.warn("recorder-demo: copy failed", e);
      say(S.copyFail, "warn");
    }
  });

  // ------------------------------------------------------------ UI state
  function sync() {
    const p = st.phase;
    root.dataset.phase = p;
    btnLabel.textContent = L(lang, p === "starting" ? S.starting : p === "recording" || p === "stopping" ? S.stop : S.start);
    recBtn.disabled = p === "starting" || p === "stopping" || st.busy;
    recBtn.setAttribute("aria-pressed", String(p === "recording"));
    scriptBtn.disabled = p !== "idle";
    take.hidden = !st.take || p !== "idle";
    transcribeBtn.disabled = !st.take || st.busy;
    transcribeBtn.textContent = L(lang, st.busy ? S.transcribing : S.transcribe);
    discardBtn.disabled = st.busy;
    wave.dataset.seek = String(Boolean(st.take) && p === "idle");
    waveLabel.hidden = Boolean(st.take) || p !== "idle";
    if (p === "idle") btnTime.textContent = "0:00 / 1:00";
  }

  // --------------------------------------------------------- recording
  function releaseSession(s) {
    if (!s) return;
    clearInterval(s.timer);
    try { s.source?.disconnect(); } catch { /* already gone */ }
    s.stream?.getTracks().forEach((track) => { try { track.stop(); } catch { /* ignore */ } });
    if (s.ctx && s.ctx.state !== "closed") s.ctx.close().catch(() => {});
  }

  function dropTake() {
    stopPlayback();
    if (st.take?.url) URL.revokeObjectURL(st.take.url);
    st.take = null;
    if (st.audio) { st.audio.removeAttribute("src"); st.audio = null; }
    if (st.out === "result" || st.out === "error") { st.out = configured ? "ready" : "noserver"; st.result = null; }
  }

  // Tear everything down (lesson replaced, language switched, page left).
  function teardown() {
    const s = st.session;
    st.session = null;
    if (s?.rec) {
      s.rec.ondataavailable = null;
      s.rec.onstop = null;
      try { if (s.rec.state !== "inactive") s.rec.stop(); } catch { /* ignore */ }
    }
    releaseSession(s);
    st.abort?.abort();
    dropTake();
  }

  async function start() {
    if (st.phase !== "idle" || st.busy) return;
    if (globalThis.isSecureContext === false) return say(S.insecure, "error");
    const md = globalThis.navigator?.mediaDevices;
    if (!md || typeof md.getUserMedia !== "function" || typeof MediaRecorder === "undefined") return say(S.unsupported, "error");

    dropTake();
    renderOut();
    st.phase = "starting";
    say(null);
    sync();

    // AudioContext created inside the click so browsers allow it to run.
    let ctx = null;
    try {
      const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (Ctx) { ctx = new Ctx(); ctx.resume?.().catch(() => {}); }
    } catch (e) { console.warn("recorder-demo: no AudioContext, level display off", e); ctx = null; }

    let stream;
    try {
      stream = await md.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
    } catch (err) {
      console.warn("recorder-demo: getUserMedia failed", err);
      if (ctx && ctx.state !== "closed") ctx.close().catch(() => {});
      st.phase = "idle";
      sync();
      if (root.isConnected) say(micError(err), "error");
      return;
    }
    const s = { stream, ctx, chunks: [], peaks: [], started: 0, timer: 0, stopTimer: 0, elapsed: 0, ended: null };
    if (!root.isConnected) { releaseSession(s); return; }

    if (ctx) {
      // iOS suspends the context while the microphone opens; without this
      // the level display stays flat.
      if (ctx.state !== "running") ctx.resume?.().catch(() => {});
      try {
        s.source = ctx.createMediaStreamSource(stream);
        s.analyser = ctx.createAnalyser();
        s.analyser.fftSize = 1024;
        s.buf = new Float32Array(s.analyser.fftSize);
        s.source.connect(s.analyser);
      } catch (e) { console.warn("recorder-demo: analyser unavailable", e); s.analyser = null; }
    }

    const mime = pickMime();
    try {
      s.rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch (e) {
      try { s.rec = new MediaRecorder(stream); } catch (e2) {
        console.warn("recorder-demo: MediaRecorder failed", e, e2);
        releaseSession(s);
        st.phase = "idle";
        sync();
        say(S.unsupported, "error");
        return;
      }
    }
    s.rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) s.chunks.push(e.data); };
    s.rec.onstop = () => finish(s);
    s.rec.onerror = (e) => {
      console.warn("recorder-demo: MediaRecorder error", e.error || e);
      s.ended = S.recFail;
      stop();
    };
    stream.getAudioTracks().forEach((track) => track.addEventListener("ended", () => {
      if (st.session === s && st.phase === "recording") { s.ended = S.unplugged; stop(); }
    }));

    try {
      // One piece at stop: Safari's MP4 fragments (timeslice) are often unplayable.
      s.rec.start();
    } catch (e) {
      console.warn("recorder-demo: start failed", e);
      releaseSession(s);
      st.phase = "idle";
      sync();
      say(S.startFail, "error");
      return;
    }
    st.session = s;
    s.started = performance.now();
    st.phase = "recording";
    say(S.recording);
    sync();

    // Timer: clock, 60 s limit, level samples, and teardown when the
    // lesson is replaced mid-recording. Runs even while scrolled away.
    s.timer = setInterval(() => {
      if (!root.isConnected) { teardown(); return; }
      s.elapsed = (performance.now() - s.started) / 1000;
      let peak = 0;
      if (s.analyser) {
        s.analyser.getFloatTimeDomainData(s.buf);
        for (let i = 0; i < s.buf.length; i++) { const a = Math.abs(s.buf[i]); if (a > peak) peak = a; }
      }
      s.peaks.push(peak);
      btnTime.textContent = `${L(lang, S.left)} ${clock(MAX_SECONDS - s.elapsed + 0.999)}`;
      drawWave(0);
      if (s.elapsed >= MAX_SECONDS) { s.ended = S.limit; stop(); }
    }, PEAK_EVERY_MS);
  }

  function stop() {
    const s = st.session;
    if (!s || st.phase !== "recording") return;
    st.phase = "stopping";
    sync();
    clearInterval(s.timer);
    s.elapsed = (performance.now() - s.started) / 1000;
    // The microphone stays open until onstop: Safari drops the recording when
    // the track stops before the recorder has handed over its data. finish()
    // releases it; the timer covers a recorder that never fires onstop.
    try {
      if (s.rec.state !== "inactive") {
        s.rec.stop(); // dataavailable, then onstop → finish
        s.stopTimer = setTimeout(() => finish(s), 4000);
      } else finish(s);
    } catch (e) {
      console.warn("recorder-demo: stop failed", e);
      finish(s);
    }
  }

  function finish(s) {
    clearTimeout(s.stopTimer);
    if (st.session !== s) return; // torn down meanwhile
    st.session = null;
    releaseSession(s);
    st.phase = "idle";
    const seconds = Math.min(MAX_SECONDS, s.elapsed);
    const type = (s.rec && s.rec.mimeType) || s.chunks[0]?.type || "audio/webm";
    const blob = new Blob(s.chunks, { type });
    if (!root.isConnected) return;
    if (blob.size === 0 || seconds < MIN_SECONDS) {
      sync();
      say(s.ended === S.recFail ? S.recFail : S.tooShort, "warn");
      return;
    }
    const url = URL.createObjectURL(blob);
    st.take = { blob, type, url, seconds, peaks: s.peaks.slice() };
    st.audio = new Audio();
    st.audio.preload = "auto";
    st.audio.src = url;
    st.audio.addEventListener("ended", () => { playBtn.textContent = L(lang, S.play); });
    st.audio.addEventListener("pause", () => { playBtn.textContent = L(lang, S.play); });
    st.audio.addEventListener("play", () => { playBtn.textContent = L(lang, S.pause); });
    st.audio.addEventListener("timeupdate", () => { if (!root.isConnected) teardown(); else drawWave(0); });
    st.audio.addEventListener("error", () => { if (root.isConnected) say(S.playFail, "warn"); });
    sync();
    drawWave(0);
    const doneText = fill(L(lang, S.done), { t: clock(seconds) });
    const extra = s.ended && s.ended !== S.recFail ? L(lang, s.ended) + " " : "";
    status.textContent = extra + doneText;
    status.dataset.kind = s.ended === S.unplugged ? "warn" : "ok";
  }

  recBtn.addEventListener("click", () => {
    if (st.phase === "recording") stop();
    else start();
  });

  // ---------------------------------------------------------- playback
  function stopPlayback() {
    if (st.audio && !st.audio.paused) st.audio.pause();
  }
  playBtn.addEventListener("click", () => {
    const a = st.audio;
    if (!a) return;
    if (!a.paused) { a.pause(); return; }
    if (st.take && a.currentTime >= st.take.seconds - 0.05) a.currentTime = 0;
    const p = a.play();
    if (p && typeof p.catch === "function") p.catch((e) => { console.warn("recorder-demo: play failed", e); say(S.playFail, "warn"); });
  });
  discardBtn.addEventListener("click", () => {
    dropTake();
    renderOut();
    sync();
    drawWave(0);
    say(S.discarded);
  });
  cv.canvas.addEventListener("click", (e) => {
    if (!st.take || !st.audio || st.phase !== "idle") return;
    const r = cv.canvas.getBoundingClientRect();
    const u = clamp((e.clientX - r.left) / r.width, 0, 1);
    try { st.audio.currentTime = u * st.take.seconds; } catch { /* not seekable yet */ }
  });

  // -------------------------------------------------------- transcribe
  transcribeBtn.addEventListener("click", async () => {
    if (!st.take || st.busy) return;
    const endpoint = transcriptionEndpoint();
    if (endpoint === "") {
      st.out = "noserver";
      renderOut(true);
      say(S.notSent, "warn");
      return;
    }
    if (endpoint === null) {
      st.out = "error";
      st.outError = fill(L(lang, S.misconfigured), { mail: CONFIG.CONTACT_EMAIL || "kontakt@jar-medical.tech" });
      renderOut();
      return;
    }
    const blob = st.take.blob;
    const ctrl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, TIMEOUT_MS);
    st.busy = true;
    st.abort = ctrl;
    st.out = "busy";
    renderOut();
    sync();
    say(S.sending);
    try {
      const form = new FormData();
      form.append("audio", blob, `aufnahme.${extFor(blob.type)}`);
      form.append("language", lang === "en" ? "en" : "de");
      let res;
      try {
        res = await fetch(`${endpoint}/transcribe`, { method: "POST", body: form, signal: ctrl.signal, credentials: "omit", mode: "cors" });
      } catch (e) {
        throw Object.assign(new Error("network"), { userText: timedOut ? S.timeout : S.offline, cause: e });
      }
      if (!res.ok) {
        const userText = res.status === 413 ? S.tooBig : res.status === 429 || res.status === 503 ? S.busy : fill(L(lang, S.httpFail), { code: res.status });
        throw Object.assign(new Error("http " + res.status), { userText });
      }
      let data;
      try { data = await res.json(); } catch (e) {
        throw Object.assign(new Error("json"), { userText: timedOut ? S.timeout : S.badReply, cause: e });
      }
      let segments;
      try { segments = parseTranscript(data); } catch (e) {
        throw Object.assign(e, { userText: S.badReply });
      }
      if (!root.isConnected) return;
      if (!segments.length) throw Object.assign(new Error("empty"), { userText: S.noSpeech });
      st.result = segments;
      st.out = "result";
      renderOut();
      say(fill(L(lang, S.received), { n: segments.length, k: speakerMap(segments).size }), "ok");
    } catch (err) {
      if (!root.isConnected) return;
      console.warn("recorder-demo: transcription failed", err);
      const text = err.userText || S.offline;
      st.out = "error";
      st.outError = typeof text === "string" ? text : L(lang, text);
      renderOut();
      say(st.outError, "error");
    } finally {
      clearTimeout(timer);
      st.busy = false;
      st.abort = null;
      if (root.isConnected) sync();
    }
  });

  // -------------------------------------------------------- the canvas
  const BAR = 4;
  function drawWave(time) {
    const { w, h } = cv.size();
    const ctx = cv.ctx;
    ctx.clearRect(0, 0, w, h);
    const accent = cssVar(root, "--accent", "#8ec7b8");
    const faint = cssVar(root, "--line-strong", "rgba(127,127,127,0.3)");
    const red = cssVar(root, "--sig-red", "#f0776e");
    const ink = cssVar(root, "--ink", "#fff");
    const mid = h / 2;
    const s = st.session;
    const n = Math.floor(w / BAR);
    const bar = (i, v, color) => {
      const hh = Math.max(1.5, clamp(v, 0, 1) * (h - 14));
      ctx.fillStyle = color;
      ctx.fillRect(i * BAR + 0.5, mid - hh / 2, BAR - 1.5, hh);
    };
    // Peak → bar height; sqrt lifts quiet speech so it stays visible.
    const level = (p) => Math.sqrt(clamp(p, 0, 1)) * 1.1;
    if (s && (st.phase === "recording" || st.phase === "stopping")) {
      const peaks = s.peaks;
      const from = Math.max(0, peaks.length - n);
      for (let i = from; i < peaks.length; i++) bar(i - from + (n - (peaks.length - from)), level(peaks[i]), accent);
      // Remaining time along the bottom edge.
      const u = clamp(s.elapsed / MAX_SECONDS, 0, 1);
      ctx.fillStyle = red;
      ctx.fillRect(0, h - 3, w * u, 3);
      return;
    }
    if (st.take) {
      const peaks = st.take.peaks;
      const played = st.audio ? clamp(st.audio.currentTime / st.take.seconds, 0, 1) : 0;
      for (let i = 0; i < n; i++) {
        const a = Math.floor((i / n) * peaks.length);
        const b = Math.max(a + 1, Math.floor(((i + 1) / n) * peaks.length));
        let p = 0;
        for (let j = a; j < b && j < peaks.length; j++) p = Math.max(p, peaks[j]);
        bar(i, level(p), i / n < played ? accent : faint);
      }
      if (st.audio && (played > 0 || !st.audio.paused)) {
        ctx.fillStyle = ink;
        ctx.fillRect(Math.round(played * w) - 1, 4, 2, h - 8);
      }
      if (st.audio) takeTime.textContent = `${clock(st.audio.currentTime || 0)} / ${clock(st.take.seconds)}`;
      return;
    }
    // Idle: a quiet baseline that breathes, nothing that looks like signal.
    for (let i = 0; i < n; i++) {
      const v = 0.03 + 0.02 * Math.sin(time * 1.6 - i * 0.18);
      bar(i, v, faint);
    }
  }

  animate(root, (time, dt, still) => {
    if (!root.isConnected) return;
    drawWave(still ? 0 : time);
    paintPlayhead();
  });

  renderOut();
  sync();
  return root;
}

export const VISUALS = {
  "recorder-architecture": renderArchitecture,
  "recorder-demo": renderRecorder,
};

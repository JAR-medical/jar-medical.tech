/* Voice I/O — "talk to the glasses", and the glasses talk back.
 *
 * Output: SpeechSynthesis (Web Speech API) reads patient summaries and command
 *   confirmations aloud through the headset speakers — de-DE voice preferred.
 * Input:  SpeechRecognition parses spoken commands into structured actions.
 *
 * SpeechSynthesis is broadly available (incl. Meta Quest Browser).
 * SpeechRecognition is NOT guaranteed on Quest — when it is missing, the app
 * falls back to a text command box (see app.js) while TTS still works. Both
 * paths funnel through parseCommand(), so typed and spoken commands behave
 * identically.
 *
 * Grammar (German), matched case-insensitively, substring-tolerant:
 *   "zusammenfassung" | "patient" | "status" | "vorlesen"   -> {summary}
 *   "vitalwerte" | "vitals" | "werte"                        -> {vitals}
 *   "rot"|"gelb"|"grün"|"blau"|"schwarz"|"verstorben"        -> {category, value}
 *   "maßnahme <x>" | "behandlung <x>" | "gegeben <x>"        -> {treatment, value}
 *   "befund <x>" | "verletzung <x>" | "diagnose <x>"         -> {injury, value}
 *   "notiz <x>" | "protokoll <x>" | "vermerk <x>"            -> {note, value}
 *   "nächster" | "weiter" | "scannen" | "scan"               -> {rescan}
 *   "schließen" | "zurück" | "beenden"                       -> {close}
 *   "hilfe" | "kommandos"                                    -> {help}
 */

"use strict";

const CATEGORY_WORDS = [
  [/\b(schwarz|verstorben|tot|exitus)\b/, "DECEASED"], // check before colours
  [/\b(rot|rote|roter)\b/, "SK1"],
  [/\b(gelb|gelbe|gelber)\b/, "SK2"],
  [/\b(gr[üu]n|gr[üu]ne|gr[üu]ner)\b/, "SK3"],
  [/\b(blau|blaue|blauer)\b/, "SK4"],
];

/**
 * Parse a raw utterance/typed string into a command object, or null.
 * @returns {{type:string,value?:string,raw:string}|null}
 */
export function parseCommand(raw) {
  if (!raw) return null;
  const t = String(raw).toLowerCase().trim().replace(/\s+/g, " ");
  const tail = (kw) => t.slice(t.indexOf(kw) + kw.length).trim();

  if (/\b(hilfe|kommandos|befehle|hilf mir)\b/.test(t)) return { type: "help", raw };
  if (/\b(n[äa]chster|weiter|scannen|scan|neuer marker|neu scannen)\b/.test(t)) return { type: "rescan", raw };
  if (/\b(schlie[ßs]en|zur[üu]ck|beenden|abbrechen|fertig)\b/.test(t)) return { type: "close", raw };

  // Argument-taking commands are matched BEFORE the generic summary trigger,
  // because a dictated value may itself contain the word "Patient"
  // (e.g. "Notiz Patient wird transportiert").
  for (const kw of ["maßnahme", "massnahme", "behandlung", "therapie", "gegeben", "durchgeführt", "durchgefuehrt"]) {
    if (t.includes(kw)) { const v = tail(kw); if (v) return { type: "treatment", value: cap(v), raw }; }
  }
  for (const kw of ["befund", "verletzung", "diagnose", "trauma"]) {
    if (t.includes(kw)) { const v = tail(kw); if (v) return { type: "injury", value: cap(v), raw }; }
  }
  for (const kw of ["notiz", "protokoll", "vermerk", "anmerkung"]) {
    if (t.includes(kw)) { const v = tail(kw); if (v) return { type: "note", value: cap(v), raw }; }
  }

  if (/\b(vitalwerte|vitals|werte|vitalzeichen)\b/.test(t)) return { type: "vitals", raw };
  if (/\b(zusammenfassung|vorlesen|status|patient|übersicht|uebersicht|wer ist das)\b/.test(t)) return { type: "summary", raw };

  // Category words come last so "maßnahme rot markieren" is treated as a
  // treatment, not a re-triage. A lone colour word is a re-triage.
  for (const [re, cat] of CATEGORY_WORDS) {
    if (re.test(t)) return { type: "category", value: cat, raw };
  }
  return null;
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

export function synthesisAvailable() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}
export function recognitionAvailable() {
  return typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
}

export class Voice {
  /**
   * @param {object} opts
   * @param {(cmd:object)=>void} opts.onCommand  parsed command
   * @param {(state:object)=>void} [opts.onState] {listening, error, interim}
   * @param {string} [opts.lang="de-DE"]
   */
  constructor({ onCommand, onState, lang = "de-DE" } = {}) {
    this.onCommand = onCommand || (() => {});
    this.onState = onState || (() => {});
    this.lang = lang;
    this.listening = false;
    this._recog = null;
    this._voice = null;
    this._wantListening = false;

    if (synthesisAvailable()) {
      const pick = () => { this._voice = this._pickVoice(); };
      pick();
      // Voice list often loads asynchronously.
      window.speechSynthesis.onvoiceschanged = pick;
    }
    if (recognitionAvailable()) this._initRecognition();
  }

  _pickVoice() {
    const voices = window.speechSynthesis.getVoices() || [];
    return (
      voices.find((v) => v.lang && v.lang.toLowerCase() === "de-de") ||
      voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("de")) ||
      voices[0] || null
    );
  }

  /** Speak text aloud. interrupt=true cancels anything in progress. */
  speak(text, { interrupt = true } = {}) {
    if (!text || !synthesisAvailable()) return;
    if (interrupt) window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = this.lang;
    u.rate = 1.02;
    u.pitch = 1.0;
    if (this._voice) u.voice = this._voice;
    window.speechSynthesis.speak(u);
  }

  stopSpeaking() {
    if (synthesisAvailable()) window.speechSynthesis.cancel();
  }

  _initRecognition() {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new Ctor();
    r.lang = this.lang;
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 3;

    r.onresult = (ev) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res.isFinal) {
          // Try each alternative until one parses to a known command.
          let cmd = null;
          for (let a = 0; a < res.length && !cmd; a++) cmd = parseCommand(res[a].transcript);
          if (cmd) this.onCommand(cmd);
          else this.onState({ listening: true, unrecognized: res[0].transcript.trim() });
        } else {
          interim += res[0].transcript;
        }
      }
      if (interim) this.onState({ listening: true, interim: interim.trim() });
    };
    r.onerror = (ev) => {
      // "no-speech"/"aborted" are benign; report others.
      if (ev.error && !["no-speech", "aborted"].includes(ev.error)) {
        this.onState({ listening: this.listening, error: ev.error });
      }
    };
    r.onend = () => {
      // Chrome auto-stops periodically; restart if the user still wants to listen.
      if (this._wantListening) {
        try { r.start(); } catch (_) { /* already starting */ }
      } else {
        this.listening = false;
        this.onState({ listening: false });
      }
    };
    this._recog = r;
  }

  startListening() {
    if (!this._recog) { this.onState({ listening: false, error: "unsupported" }); return false; }
    this._wantListening = true;
    try { this._recog.start(); } catch (_) { /* already running */ }
    this.listening = true;
    this.onState({ listening: true });
    return true;
  }

  stopListening() {
    this._wantListening = false;
    if (this._recog) { try { this._recog.stop(); } catch (_) {} }
    this.listening = false;
    this.onState({ listening: false });
  }

  toggleListening() {
    return this.listening ? (this.stopListening(), false) : this.startListening();
  }
}

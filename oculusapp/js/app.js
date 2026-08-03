/* J.A.R. AR-Client — orchestration.
 *
 * Wires the four subsystems together into one field workflow:
 *
 *   identify patient ──▶ show HUD in passthrough ──▶ dictate / re-triage by voice
 *
 * Three run modes, chosen on the landing screen by what the device supports:
 *
 *   • AR-Modus     — Meta Quest passthrough (xr.js). The real world shows
 *                    through the cameras; the HUD floats on top. Because the
 *                    Quest 2 does not expose its cameras to apps, patients are
 *                    identified here by voice ("Patient sieben") or by picking
 *                    the marker with the controller — the printed QR still names
 *                    the patient, the medic just reads the number.
 *   • Kamera-Modus — real live QR scanning via the device camera (qr.js). Runs
 *                    on a phone/laptop; the passthrough-camera limit above means
 *                    this is the mode where the scanner genuinely fires.
 *   • Simulation   — no camera/headset; pick a marker to preview the HUD.
 *
 * Voice works in every mode: the glasses read the patient aloud and accept
 * spoken commands (voice.js).
 */

"use strict";

import { MARKER_IDS, CATEGORY_META, resolvePatient, isKnownMarker,
         setCategory, addTreatment, addInjury, pushProtocol, markSeen } from "./data.js";
import { QRScanner, decodeSupported, barcodeDetectorAvailable, jsQRAvailable } from "./qr.js";
import { Voice, parseCommand, recognitionAvailable, synthesisAvailable } from "./voice.js";
import { XRPassthrough, passthroughSupported } from "./xr.js";
import { patientHUD, unknownHUD, spokenSummary, spokenVitals } from "./hud.js";

const $ = (id) => document.getElementById(id);

const el = {
  start: $("start"),
  stage: $("stage"),
  hudOverlay: $("hud-overlay"),
  hud: $("hud"),
  reticle: $("reticle"),
  cameraBg: $("camera-bg"),
  scanCanvas: $("scan-canvas"),
  picker: $("picker"),
  voiceStatus: $("voice-status"),
  toast: $("toast"),
  micBtn: $("mic-btn"),
  cmdForm: $("cmd-form"),
  cmdInput: $("cmd-input"),
  modeLabel: $("mode-label"),
  btnAR: $("mode-ar"),
  btnCam: $("mode-cam"),
  btnSim: $("mode-sim"),
  caps: $("caps"),
};

const app = {
  mode: null,        // 'ar' | 'camera' | 'sim'
  markerId: null,    // currently shown patient
  scanner: null,
  xr: null,
  voice: null,
  announced: new Set(), // markers already read aloud this session
};

/* ---------------------------------------------------------------- toast */

let toastTimer = null;
function toast(msg, kind = "") {
  el.toast.textContent = msg;
  el.toast.className = "toast show " + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.toast.className = "toast"), 3200);
}

function setVoiceStatus(text, on = false) {
  el.voiceStatus.textContent = text;
  el.voiceStatus.classList.toggle("listening", on);
}

/* ------------------------------------------------ capability detection */

function detectCaps() {
  const rows = [
    ["Passthrough-AR (WebXR)", null, "passthrough"],
    ["QR-Decoder", decodeSupported(), barcodeDetectorAvailable() ? "BarcodeDetector" : jsQRAvailable() ? "jsQR" : "—"],
    ["Sprachausgabe", synthesisAvailable(), synthesisAvailable() ? "Web Speech" : "—"],
    ["Spracherkennung", recognitionAvailable(), recognitionAvailable() ? "Web Speech" : "Text-Eingabe"],
  ];
  el.caps.innerHTML = rows
    .map(([name, ok, note]) =>
      `<li data-key="${name}"><span class="cap-dot ${ok === false ? "no" : ok === true ? "yes" : "wait"}"></span>${name}<em>${note ?? "…"}</em></li>`)
    .join("");

  passthroughSupported().then((ok) => {
    const li = el.caps.querySelector('[data-key="Passthrough-AR (WebXR)"]');
    if (li) {
      li.querySelector(".cap-dot").className = "cap-dot " + (ok ? "yes" : "no");
      li.querySelector("em").textContent = ok ? "immersive-ar" : "nicht verfügbar";
    }
    el.btnAR.disabled = !ok;
    el.btnAR.querySelector(".mode-note").textContent = ok
      ? "Quest-Passthrough · Sprache/Controller"
      : "auf diesem Gerät nicht verfügbar";
  });

  el.btnCam.disabled = !decodeSupported();
  el.btnCam.querySelector(".mode-note").textContent = decodeSupported()
    ? "Live-QR über die Gerätekamera"
    : "kein QR-Decoder im Browser";
}

/* -------------------------------------------------------- marker picker */

function buildPicker() {
  el.picker.innerHTML = MARKER_IDS.map((id) => {
    const p = resolvePatient(id);
    const c = CATEGORY_META[p.category] || CATEGORY_META.UNSIGHTED;
    return `<button class="pick" data-id="${id}" style="--cat:${c.color}" title="Patient ${id} — ${c.label}">
      <span class="pick-dot"></span>${id}</button>`;
  }).join("");
  el.picker.querySelectorAll(".pick").forEach((b) => {
    b.onclick = () => loadPatient(Number(b.dataset.id));
  });
}

function highlightPicker() {
  el.picker.querySelectorAll(".pick").forEach((b) =>
    b.classList.toggle("active", Number(b.dataset.id) === app.markerId));
}

/* ----------------------------------------------------- patient display */

function render() {
  if (app.markerId == null) {
    el.hud.innerHTML = "";
    el.hudOverlay.classList.add("scanning");
    if (app.xr && app.xr.active)
      app.xr.setState({ kind: "scanning", hint: "Patient wählen — Sprache, Controller oder Antippen" });
    return;
  }
  const p = resolvePatient(app.markerId);
  el.hud.innerHTML = p ? patientHUD(p) : unknownHUD(app.markerId);
  el.hudOverlay.classList.remove("scanning");
  if (app.xr && app.xr.active)
    app.xr.setState(p ? { kind: "patient", patient: p } : { kind: "unknown", markerId: app.markerId });
  highlightPicker();
}

function loadPatient(markerId) {
  if (!isKnownMarker(markerId)) {
    app.markerId = markerId;
    render();
    toast(`Marker #${markerId} — kein Patient im Einsatz`, "warn");
    return;
  }
  app.markerId = markerId;
  markSeen(markerId, "AR-Client");
  render();
  const p = resolvePatient(markerId);
  toast(`Patient #${markerId} — ${CATEGORY_META[p.category].short}`, "ok");
  if (!app.announced.has(markerId)) {
    app.announced.add(markerId);
    if (app.voice) app.voice.speak(spokenSummary(p));
  }
}

function rescan() {
  app.markerId = null;
  render();
  if (app.mode === "camera") toast("Scanne den nächsten Marker …");
  else toast("Patient wählen — Sprache, Controller oder Antippen");
}

/* --------------------------------------------------------- voice glue */

function applyCommand(cmd) {
  // Global commands (work without a selected patient).
  if (cmd.type === "help") {
    app.voice.speak("Sage: Zusammenfassung, Vitalwerte, rot, gelb, grün, blau, schwarz, Maßnahme, Befund, Notiz, nächster, oder schließen.");
    toast("Kommandos: Zusammenfassung · Vitalwerte · rot/gelb/grün/blau/schwarz · Maßnahme · Befund · Notiz · nächster");
    return;
  }
  if (cmd.type === "rescan") { rescan(); app.voice.speak("Bereit für den nächsten Patienten."); return; }
  if (cmd.type === "close") { app.voice.speak("Schließe."); exitStage(); return; }

  if (app.markerId == null || !isKnownMarker(app.markerId)) {
    toast("Erst einen Patienten identifizieren.", "warn");
    app.voice.speak("Bitte zuerst einen Patienten scannen.");
    return;
  }
  const id = app.markerId;
  const p = resolvePatient(id);

  switch (cmd.type) {
    case "summary": app.voice.speak(spokenSummary(p)); break;
    case "vitals":  app.voice.speak(spokenVitals(p)); break;
    case "category": {
      setCategory(id, cmd.value); render();
      const c = CATEGORY_META[cmd.value];
      toast(`Patient #${id} → ${c.short}`, "ok");
      app.voice.speak(`Patient ${id} auf ${c.spoken} gesetzt.`);
      break;
    }
    case "treatment":
      addTreatment(id, cmd.value); render();
      toast(`Maßnahme: ${cmd.value}`, "ok");
      app.voice.speak(`Maßnahme dokumentiert: ${cmd.value}.`);
      break;
    case "injury":
      addInjury(id, cmd.value); render();
      toast(`Befund: ${cmd.value}`, "ok");
      app.voice.speak(`Befund dokumentiert: ${cmd.value}.`);
      break;
    case "note":
      pushProtocol(id, { transcript: cmd.value }); render();
      toast(`Notiz: ${cmd.value}`, "ok");
      app.voice.speak("Notiz gespeichert.");
      break;
  }
}

function onVoiceState(s) {
  if (s.error === "unsupported") {
    setVoiceStatus("Spracherkennung nicht verfügbar — Textbefehle unten nutzen.");
    return;
  }
  if (s.error) { setVoiceStatus("Sprachfehler: " + s.error); return; }
  if (s.interim) { setVoiceStatus("… " + s.interim, true); return; }
  if (s.unrecognized) { setVoiceStatus(`nicht erkannt: „${s.unrecognized}" — sag „Hilfe"`, true); return; }
  setVoiceStatus(s.listening ? "höre zu … (sprich ein Kommando)" : "Mikrofon aus", s.listening);
  el.micBtn.classList.toggle("on", !!s.listening);
  el.micBtn.textContent = s.listening ? "● Mikro an" : "Mikro";
}

/* ------------------------------------------------------- mode start/stop */

async function startAR() {
  app.mode = "ar";
  showStage("AR-Modus — Passthrough");
  el.cameraBg.classList.add("hidden");
  app.xr = new XRPassthrough({
    onStart: () => { toast("Passthrough aktiv — Patient per Sprache/Controller wählen"); rescan(); },
    onEnd: () => { app.xr = null; backToStart(); },
    onSelect: () => { if (app.markerId != null) app.voice.speak(spokenSummary(resolvePatient(app.markerId))); },
  });
  try {
    await app.xr.start();
  } catch (err) {
    app.xr = null;
    toast(err.message || "AR konnte nicht gestartet werden", "warn");
    backToStart();
  }
}

async function startCamera() {
  app.mode = "camera";
  showStage("Kamera-Modus — Live-QR");
  el.cameraBg.classList.remove("hidden");
  app.scanner = new QRScanner({
    video: el.cameraBg,
    canvas: el.scanCanvas,
    onMarker: (id) => loadPatient(id),
    onError: (e) => toast("Scan-Fehler: " + e.message, "warn"),
  });
  try {
    await app.scanner.start();
    toast("Kamera aktiv — QR-Marker anvisieren");
    rescan();
  } catch (err) {
    app.scanner = null;
    toast(err.message, "warn");
    // Camera unusable (e.g. on the Quest) — stay usable via the picker.
    setVoiceStatus("Keine Kamera — Patient über Auswahl/Sprache identifizieren.");
  }
}

function startSim() {
  app.mode = "sim";
  showStage("Simulation — Marker wählen");
  el.cameraBg.classList.add("hidden");
  rescan();
  toast("Simulation — tippe einen Marker an");
}

function showStage(label) {
  el.modeLabel.textContent = label;
  el.start.classList.add("hidden");
  el.stage.classList.remove("hidden");
  el.hudOverlay.classList.add("scanning");
}

function exitStage() {
  if (app.xr) { app.xr.end(); return; } // onEnd → backToStart
  backToStart();
}

function backToStart() {
  if (app.scanner) { app.scanner.stop(); app.scanner = null; }
  if (app.voice && app.voice.listening) app.voice.stopListening();
  app.voice && app.voice.stopSpeaking();
  app.mode = null;
  app.markerId = null;
  app.announced.clear();
  el.stage.classList.add("hidden");
  el.start.classList.remove("hidden");
  el.hud.innerHTML = "";
  setVoiceStatus(recognitionAvailable() ? "Mikrofon aus" : "Spracherkennung nicht verfügbar — Textbefehle nutzen");
}

/* ------------------------------------------------------------ controls */

function wireControls() {
  $("ctl-rescan").onclick = rescan;
  $("ctl-speak").onclick = () => {
    if (app.markerId != null && isKnownMarker(app.markerId)) app.voice.speak(spokenSummary(resolvePatient(app.markerId)));
    else toast("Kein Patient ausgewählt.", "warn");
  };
  $("ctl-exit").onclick = exitStage;
  el.micBtn.onclick = () => app.voice.toggleListening();

  // Quick-triage buttons.
  $("ctl-cats").querySelectorAll("[data-cat]").forEach((b) => {
    b.onclick = () => applyCommand({ type: "category", value: b.dataset.cat, raw: b.dataset.cat });
  });

  // Typed command fallback (equivalent to speaking).
  el.cmdForm.onsubmit = (e) => {
    e.preventDefault();
    const text = el.cmdInput.value.trim();
    if (!text) return;
    el.cmdInput.value = "";
    // Allow a bare number to load a patient by marker.
    if (/^\d{1,4}$/.test(text)) { loadPatient(Number(text)); return; }
    const cmd = parseCommand(text); // same parser as speech
    if (cmd) applyCommand(cmd);
    else toast(`nicht erkannt: „${text}" — „Hilfe" für Kommandos`, "warn");
  };
}

/* --------------------------------------------------------------- boot */

function boot() {
  detectCaps();
  buildPicker();
  wireControls();

  app.voice = new Voice({ onCommand: applyCommand, onState: onVoiceState });
  setVoiceStatus(recognitionAvailable() ? "Mikrofon aus" : "Spracherkennung nicht verfügbar — Textbefehle nutzen");

  el.btnAR.onclick = () => !el.btnAR.disabled && startAR();
  el.btnCam.onclick = () => startCamera();
  el.btnSim.onclick = () => startSim();

  // Deep link: ?mode=sim|camera|ar[&patient=N] — jump straight into a mode
  // (and optionally a patient) for demos, kiosks and bookmarks.
  const q = new URLSearchParams(location.search);
  const mode = q.get("mode");
  const boot2 = { sim: startSim, camera: startCamera, ar: () => !el.btnAR.disabled && startAR() }[mode];
  if (boot2) {
    Promise.resolve(boot2()).then(() => {
      const pid = Number(q.get("patient"));
      if (pid) loadPatient(pid);
    });
  }
}

boot();

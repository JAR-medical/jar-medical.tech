/* J.A.R. AR-Client — Verdrahtung.
 *
 * Ein Ablauf, drei Betriebsarten:
 *
 *   Tätigkeit wählen ─▶ Lagekarte ─▶ Patient anlegen oder anklicken
 *                    ─▶ was die Tätigkeit vorsieht ─▶ nächster Patient
 *
 *   • AR-Modus     — Passthrough auf PICO/Quest (xr.js). Der Ablaufschirm liegt
 *                    körperfest im Raum, bedient wird er mit Blick oder
 *                    Controller. Nur hier wird die Stelle eines neuen Patienten
 *                    am Boden gezeigt (`pointing`); Kamerazugriff haben
 *                    Headset-Browser meist nicht, dann wird die Karte manuell
 *                    bestätigt.
 *   • Kamera-Modus — dieselben Schirme flach, dazu echtes QR-Scannen über die
 *                    Gerätekamera (qr.js). Das ist die Betriebsart, in der der
 *                    Kartenschritt wirklich scannt.
 *   • Simulation   — dieselben Schirme ohne Kamera und ohne Headset, für
 *                    Vorführungen am Laptop.
 *
 * Der Ablauf selbst steckt in workflow.js und weiß von keiner dieser
 * Darstellungen etwas — hier wird nur verbunden.
 */

"use strict";

import { patientIds, resolvePatient } from "./data.js";
import { QRScanner, decodeSupported, barcodeDetectorAvailable, jsQRAvailable } from "./qr.js";
import { Voice, synthesisAvailable } from "./voice.js";
import { XRPassthrough, passthroughSupported } from "./xr.js";
import { patientHUD } from "./hud.js";
import { Workflow } from "./workflow.js";
import { drawMapPanel } from "./hudscreen.js";
import { BodyView } from "./bodyview.js";
import { regionLabel } from "./body.js";

const $ = (id) => document.getElementById(id);

const el = {
  start: $("start"),
  stage: $("stage"),
  hudOverlay: $("hud-overlay"),
  hud: $("hud"),
  cameraBg: $("camera-bg"),
  scanCanvas: $("scan-canvas"),
  voiceStatus: $("voice-status"),
  toast: $("toast"),
  modeLabel: $("mode-label"),
  btnAR: $("mode-ar"),
  btnCam: $("mode-cam"),
  btnSim: $("mode-sim"),
  caps: $("caps"),
  flow: $("flow"),
  flowMap: $("flow-map"),
  flowCard: $("flow-card"),
  flowActions: $("flow-actions"),
  flowTask: $("flow-task"),
  flowTitle: $("flow-title"),
  flowCardTitle: $("flow-card-title"),
  flowOpen: $("flow-open"),
  flowCounts: $("flow-counts"),
  flowVitals: $("flow-vitals"),
  flowBadge: $("flow-badge"),
  flowBand: $("flow-band"),
  flowHeadline: $("flow-headline"),
  flowHint: $("flow-hint"),
  flowProgress: $("flow-progress"),
  flowBody: $("flow-body"),
  flowButtons: $("flow-buttons"),
  flowStatus: $("flow-status"),
  bodyWrap: $("body-wrap"),
  bodyCanvas: $("body-canvas"),
  bodyLabel: $("body-label"),
};

const app = {
  mode: null,        // 'ar' | 'camera' | 'sim'
  flow: null,
  scanner: null,
  xr: null,
  voice: null,
  screen: null,
  recordOpen: false,
  bodyView: null,
};

const mapCtx = el.flowMap.getContext("2d");

/* ---------------------------------------------------------------- toast */

let toastTimer = null;
function toast(msg, kind = "") {
  el.toast.textContent = msg;
  el.toast.className = "toast show " + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.toast.className = "toast"), 3200);
}

function setVoiceStatus(text) { el.voiceStatus.textContent = text; }

/* ------------------------------------------------ capability detection */

function detectCaps() {
  const rows = [
    ["Passthrough-AR (WebXR)", null, "wird geprüft …"],
    ["QR-Decoder", decodeSupported(), barcodeDetectorAvailable() ? "BarcodeDetector" : jsQRAvailable() ? "jsQR" : "—"],
    ["Sprachausgabe", synthesisAvailable(), synthesisAvailable() ? "Web Speech" : "—"],
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
      ? "Passthrough · Blicksteuerung"
      : "auf diesem Gerät nicht verfügbar";
  });

  el.btnCam.disabled = !decodeSupported();
  el.btnCam.querySelector(".mode-note").textContent = decodeSupported()
    ? "flach, mit echtem QR-Scan der Karte"
    : "kein QR-Decoder im Browser";
}

/* ------------------------------------------------------- Ablaufschirm */

function renderScreen(screen) {
  app.screen = screen;

  el.flowTitle.textContent = screen.title || "J.A.R.";
  el.flowTask.textContent = screen.task || "";
  // In der Lage steht kein Schritt an: dann bleibt die Mitte frei und es gibt
  // nur die kleinen Knöpfe am Rand — flach genauso wie in der Brille.
  el.flowCard.classList.toggle("hidden", screen.showCard === false);
  el.flowCardTitle.textContent = screen.cardTitle || "";
  el.flowBadge.textContent = screen.badge || "";
  el.flowBand.style.background = screen.band || "rgba(255,255,255,.28)";

  el.flowHeadline.textContent = screen.headline || "";
  el.flowHeadline.style.color = screen.headlineColor || "";
  el.flowHint.textContent = screen.hint || "";
  el.flowStatus.textContent = screen.status || "";

  if (screen.progress) {
    const pips = Array.from({ length: screen.progress.total }, (_, i) =>
      `<span class="flow-pip${i < screen.progress.step ? " on" : ""}"></span>`).join("");
    el.flowProgress.innerHTML =
      `<span>Schritt ${screen.progress.step}/${screen.progress.total}</span><span class="flow-pips">${pips}</span>`;
  } else el.flowProgress.innerHTML = "";

  renderBody(screen);
  renderVitals(screen);
  renderCounts();
  renderButtons(el.flowButtons, screen.buttons || [], () => app.screen.buttons);
  renderButtons(el.flowActions, screen.hudActions || [], () => app.screen.hudActions);

  drawMap();
  renderBodyView(screen);
  if (app.xr && app.xr.active) {
    app.xr.setContent(screen, app.flow.mapModel(), app.flow.worldTags(), app.flow.cardAnchor());
    if (!app.flow.cardAnchor()) app.xr.recenter();   // kein Patient → neu vor den Träger
  }
  if (app.recordOpen) renderRecord();
}

/**
 * Das Körpermodell flach: dieselben Regionen wie in der Brille, mit der Maus
 * oder dem Finger drehbar. In AR zeichnet xr.js es raumfest beim Patienten —
 * dann bleibt die flache Fläche leer, sonst stünde dasselbe zweimal da.
 */
function renderBodyView(screen) {
  const bm = screen.bodyModel;
  const show = !!bm && !(app.xr && app.xr.active);
  el.bodyWrap.classList.toggle("hidden", !show);
  if (!show) return;

  if (!app.bodyView) {
    app.bodyView = new BodyView(el.bodyCanvas, (id) => app.flow.pickRegion(id));
    if (!app.bodyView.available) {
      el.bodyWrap.classList.add("hidden");
      return;
    }
  }
  el.bodyLabel.textContent = bm.region ? regionLabel(bm.region) : "Körperregion wählen";
  app.bodyView.setFindings(bm.findings, bm.region);
}

/* Text wird immer per textContent gesetzt — Patientendaten dürfen nie als
 * Markup interpretiert werden. */
function renderBody(screen) {
  el.flowBody.innerHTML = "";
  for (const item of screen.body || []) {
    const div = document.createElement("div");
    if (["muted", "good", "warn"].includes(item.color)) div.className = item.color;
    if (item.color === "cat" && item.color2) div.style.color = item.color2;
    div.textContent = item.text;
    el.flowBody.appendChild(div);
  }
}

function renderVitals(screen) {
  el.flowVitals.innerHTML = "";
  for (const v of screen.vitals || []) {
    const d = document.createElement("div");
    d.className = "flow-vital";
    const s = document.createElement("span");
    s.textContent = v.label;
    const b = document.createElement("strong");
    b.textContent = v.value;
    d.appendChild(s); d.appendChild(b);
    el.flowVitals.appendChild(d);
  }
}

function renderCounts() {
  if (!app.flow) return;
  const c = app.flow.mapModel().counts;
  el.flowOpen.textContent = `${c.total} erfasst`;      // dieselbe Zeile wie in der Brille
  const items = [["#e5484d", c.SK1], ["#f5b301", c.SK2], ["#46a758", c.SK3],
                 ["#3e7bfa", c.SK4], ["#9aa4ae", c.DECEASED]];
  el.flowCounts.innerHTML = "";
  for (const [color, n] of items) {
    const span = document.createElement("span");
    span.className = "flow-count";
    const dot = document.createElement("i");
    dot.style.background = color;
    span.appendChild(dot);
    span.appendChild(document.createTextNode(String(n)));
    el.flowCounts.appendChild(span);
  }
}

/**
 * Knöpfe einer Leiste zeichnen. Ausgelöst wird immer über den **aktuellen**
 * Schirm (`live()`), nie über die Liste von eben — sonst führte ein Klick auf
 * einen Knopf, der gerade neu gezeichnet wurde, die Handlung des alten aus.
 */
function renderButtons(host, list, live) {
  host.innerHTML = "";
  list.forEach((b, i) => {
    const btn = document.createElement("button");
    btn.className = "flow-btn " + (b.tint || "ghost");
    if (b.color) btn.style.borderColor = b.color;
    btn.textContent = b.label;
    btn.onclick = () => {
      const now = live();
      if (now && now[i]) now[i].action();
    };
    host.appendChild(btn);
  });
}

function drawMap() {
  if (!app.flow) return;
  drawMapPanel(mapCtx, el.flowMap.width, el.flowMap.height, app.flow.mapModel());
}

/* `flow.target` ist die Akte selbst, keine Nummer — sie noch einmal
 * aufzulösen lieferte nur `null`, und die Akte blieb leer. */
function renderRecord() {
  const p = app.flow ? app.flow.target : null;
  el.hud.innerHTML = p ? patientHUD(p) : "";
  el.hud.classList.toggle("hidden", !p || !app.recordOpen);
}

/* ------------------------------------------------------------- Ablauf */

function makeFlow({ pointing = false } = {}) {
  const flow = new Workflow({ pointing });
  flow.onScreen = renderScreen;
  flow.onSpeak = (text) => app.voice && app.voice.speak(text);
  flow.onToast = toast;
  return flow;
}

/* ------------------------------------------------------- mode start/stop */

async function startAR() {
  app.mode = "ar";
  showStage("AR-Modus — Passthrough");
  el.cameraBg.classList.add("hidden");

  // Nur hier gibt es einen Zeiger: die Stelle für einen neuen Patienten wird
  // am Boden gewählt, statt am eigenen Standort angenommen zu werden.
  app.flow = makeFlow({ pointing: true });

  app.xr = new XRPassthrough({
    // ?augentest=1 zeichnet je Ansicht ein großes Wort — LINKS bzw. RECHTS.
    eyeTest: new URLSearchParams(location.search).get("augentest") === "1",
    onStart: () => { toast("Passthrough aktiv"); app.flow.start(); },
    onEnd: () => { app.xr = null; backToStart(); },
    onPose: (pos, fwd, floorY) => app.flow.setPose(pos, fwd, floorY),
    onMarkerPick: (id) => app.flow.openPatient(resolvePatient(id)),
    onPlace: (point) => app.flow.placeAt(point),
    onRegionPick: (region) => app.flow.pickRegion(region),
    onStereoIssue: (note) => app.flow.setNotice(note),
    onFrame: () => {
      app.flow.tick();
      // Lagekarte und Schilder leben mit der eigenen Position; xr.js drosselt
      // das Neuzeichnen selbst.
      app.xr.setContent(null, app.flow.mapModel(), app.flow.worldTags(), app.flow.cardAnchor());
    },
  });

  try {
    await app.xr.start();
  } catch (err) {
    app.xr = null;
    toast(err.message || "AR konnte nicht gestartet werden", "warn");
    backToStart();
    return;
  }
  await tryCamera();          // vielleicht gibt das Headset doch eine Kamera her
}

/**
 * Kamera anfordern — auch im Headset. Ob ein Headset-Browser eine hergibt, sagt
 * einem nur das Gerät selbst; vorher stand die Antwort als Annahme im Code und
 * es wurde gar nicht erst versucht. Klappt es, wird die Karte wirklich
 * gescannt; klappt es nicht, steht der Grund unten rechts und die Nummer wird
 * von Hand gewählt.
 */
async function tryCamera() {
  if (!app.flow) return;
  if (!decodeSupported()) { app.flow.cameraLive = false; return; }

  app.scanner = new QRScanner({
    video: el.cameraBg,
    canvas: el.scanCanvas,
    onMarker: (card) => app.flow.onMarker(card),
    onError: (e) => toast("Scan-Fehler: " + e.message, "warn"),
  });
  try {
    await app.scanner.start();
    app.flow.cameraLive = true;
    app.flow.setNotice("");
    toast("Kamera aktiv — Karten können gescannt werden", "ok");
  } catch (err) {
    app.scanner = null;
    app.flow.cameraLive = false;
    app.flow.setNotice(err.message);
  }
}

async function startCamera() {
  app.mode = "camera";
  showStage("Kamera-Modus — Sichtung mit QR-Karte");
  el.cameraBg.classList.remove("hidden");

  app.flow = makeFlow();
  app.flow.start();
  await tryCamera();
}

function startSim() {
  app.mode = "sim";
  showStage("Simulation — Ablauf ohne Kamera");
  el.cameraBg.classList.add("hidden");
  app.flow = makeFlow();
  app.flow.start();
  toast("Simulation — Tätigkeit wählen, dann Patienten anlegen");
}

function showStage(label) {
  el.modeLabel.textContent = label;
  el.start.classList.add("hidden");
  el.stage.classList.remove("hidden");
  app.recordOpen = false;
  el.hud.classList.add("hidden");
}

function exitStage() {
  if (app.xr) { app.xr.end(); return; }   // onEnd → backToStart
  backToStart();
}

function backToStart() {
  if (app.scanner) { app.scanner.stop(); app.scanner = null; }
  app.voice && app.voice.stopSpeaking();
  app.mode = null;
  app.flow = null;
  app.screen = null;
  el.stage.classList.add("hidden");
  el.start.classList.remove("hidden");
  el.bodyWrap.classList.add("hidden");
  el.hud.innerHTML = "";
  setVoiceStatus(synthesisAvailable() ? "Sprachausgabe bereit" : "keine Sprachausgabe");
}

/* ------------------------------------------------------------ controls */

function wireControls() {
  $("ctl-exit").onclick = exitStage;

  $("ctl-record").onclick = () => {
    app.recordOpen = !app.recordOpen;
    renderRecord();
  };

  $("ctl-speak").onclick = () => {
    if (!app.screen) return;
    const parts = [app.screen.headline, app.screen.hint].filter(Boolean);
    app.voice.speak(parts.join(". "));
  };
}

/* --------------------------------------------------------------- boot */

function boot() {
  detectCaps();
  wireControls();

  app.voice = new Voice({ onCommand: () => {}, onState: () => {} });
  setVoiceStatus(synthesisAvailable() ? "Sprachausgabe bereit" : "keine Sprachausgabe");

  el.btnAR.onclick = () => !el.btnAR.disabled && startAR();
  el.btnCam.onclick = () => startCamera();
  el.btnSim.onclick = () => startSim();

  // Deep link: ?mode=sim|camera|ar[&patient=N]
  const q = new URLSearchParams(location.search);
  const mode = q.get("mode");
  const boot2 = { sim: startSim, camera: startCamera, ar: () => !el.btnAR.disabled && startAR() }[mode];
  if (boot2) Promise.resolve(boot2());
}

// Haken für Prüf-/Demoseiten (probe_dom.html); im Betrieb ungenutzt.
window.__jar = app;

boot();

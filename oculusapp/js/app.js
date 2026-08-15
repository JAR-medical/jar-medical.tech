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
import { Voice, synthesisAvailable, recognitionAvailable, onDeviceStatus } from "./voice.js";
import { XRPassthrough, xrSupport } from "./xr.js";
import { watchReducedMotion } from "./motion.js";
import { patientHUD } from "./hud.js";
import { Workflow } from "./workflow.js";
import { drawMapPanel } from "./hudscreen.js";
import { BodyView } from "./bodyview.js";
import { regionLabel } from "./body.js";
import { WristbandScanner, arucoAvailable } from "./arucoscan.js";

const $ = (id) => document.getElementById(id);

// Das Lagebild der Einsatzleitung, dieselbe Live-Demo wie auf der Website.
const LAGEBILD_URL = "../demo/index.html";

// ?perf=1 — Bildrate und Zeichenaufwand im Blickfeld, zum Nachmessen auf dem
// Gerät. Standardmäßig aus: im Einsatz gehört dort nichts hin, was nicht das
// Gerät meldet.
const showPerf = new URLSearchParams(location.search).get("perf") === "1";

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
  lagebild: $("lagebild"),
  lagebildLink: $("lagebild-link"),
  lagebildClose: $("lagebild-close"),
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
  band: null,          // Armband-Erkennung über die Kamera
  bandDetach: null,
  bandState: null,
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

function idleVoiceStatus() {
  return synthesisAvailable() ? "Sprachausgabe bereit" : "keine Sprachausgabe";
}

/**
 * Sagen, woran man ist: die Spracheingabe wird nur benutzt, wenn sie lokal
 * läuft. Steht sie nicht bereit, gehört das in die Geräteliste und nicht in
 * eine Fehlermeldung, die erst beim Drücken kommt.
 */
async function describeSpeech() {
  const li = el.caps.querySelector('[data-key="Spracheingabe"]');
  if (!li) return;
  const status = recognitionAvailable() ? await onDeviceStatus() : "unsupported";
  const ok = status === "available" || status === "downloadable" || status === "downloading";
  const note = { available: "lokal, bereit", downloadable: "lokal, Paket lädt beim Start",
                 downloading: "Paket lädt gerade", unavailable: "nicht für Deutsch",
                 unsupported: "kein lokales Erkennen" }[status] || status;
  li.querySelector(".cap-dot").className = "cap-dot " + (ok ? "yes" : "no");
  li.querySelector("em").textContent = note;
  $("ctl-mic").disabled = !ok;
}

/* ------------------------------------------------ capability detection */

function detectCaps() {
  const rows = [
    ["Passthrough-AR (WebXR)", null, "wird geprüft …"],
    ["QR-Decoder", decodeSupported(), barcodeDetectorAvailable() ? "BarcodeDetector" : jsQRAvailable() ? "jsQR" : "—"],
    ["Sprachausgabe", synthesisAvailable(), synthesisAvailable() ? "Web Speech" : "—"],
    ["Spracheingabe", null, "wird geprüft …"],
  ];
  el.caps.innerHTML = rows
    .map(([name, ok, note]) =>
      `<li data-key="${name}"><span class="cap-dot ${ok === false ? "no" : ok === true ? "yes" : "wait"}"></span>${name}<em>${note ?? "…"}</em></li>`)
    .join("");

  // Was das Gerät anbietet, wird einzeln gefragt. Eine HoloLens 2 meldet je
  // nach Edge-Fassung **kein** `immersive-ar`, zeigt eine `immersive-vr`-
  // Sitzung aber auf demselben durchsichtigen Glas — der Knopf gehört dann
  // nicht gesperrt, sondern beschriftet. Ob das Glas wirklich durchsichtig ist,
  // sagt erst die laufende Sitzung (`environmentBlendMode`); eine geschlossene
  // VR-Brille wird dort abgewiesen, statt hier geraten zu werden.
  xrSupport().then(({ ar, vr, any }) => {
    const li = el.caps.querySelector('[data-key="Passthrough-AR (WebXR)"]');
    if (li) {
      li.querySelector(".cap-dot").className = "cap-dot " + (any ? "yes" : "no");
      li.querySelector("em").textContent =
        ar ? "immersive-ar" : vr ? "nur immersive-vr" : "nicht verfügbar";
    }
    el.btnAR.disabled = !any;
    el.btnAR.querySelector(".mode-note").textContent =
      ar ? "Passthrough · Blick, Hand oder Controller"
    : vr ? "über immersive-vr — nur auf durchsichtigem Glas"
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
  flow.onLagebild = openLagebild;
  return flow;
}

/**
 * Das Lagebild der Einsatzleitung ist eine gewöhnliche Webseite (`../demo/`)
 * und lässt sich nicht in die AR-Ebene legen — dort gibt es nur WebGL. Also:
 * aus der Brille heraus wird die Sitzung beendet und die Seite flach geöffnet.
 * `window.open` gilt ohne Klick oft als Pop-up und wird geblockt; deshalb bleibt
 * die Tafel mit dem Link immer stehen, damit es einen Weg gibt, der sicher geht.
 */
/**
 * Ein Feld des Armbands wurde gedrückt — egal ob am Controller ertastet oder
 * von der Kamera als verdeckter Marker erkannt. Beide Wege enden hier, und von
 * hier aus geht es denselben Weg wie Sprache: durch `handleSpeech`, damit „Ja"
 * am Band und „ja" gesprochen dasselbe bedeuten und es nur eine Stelle gibt,
 * an der das definiert ist.
 */
function panelAction(action) {
  if (!app.flow) return;
  const spoken = { ja: "yes", nein: "no", zurueck: "back" }[action];
  if (spoken) {
    if (!app.flow.handleSpeech({ type: spoken, raw: action })) {
      toast(`„${action}" passt hier nicht`, "warn");
    }
    return;
  }
  if (action === "neu") { app.flow.newPatient(); return; }
  if (action === "taetigkeit") { app.flow.goToAuftrag(); return; }
  if (action === "lagebild") { openLagebild(); return; }
}

function openLagebild() {
  const go = () => {
    el.lagebild.classList.remove("hidden");
    const win = window.open(LAGEBILD_URL, "_blank", "noopener");
    if (win) toast("Lagebild in neuem Tab geöffnet", "ok");
  };
  if (app.xr && app.xr.active) { app.xr.end().then(go, go); return; }
  go();
}

/* ------------------------------------------------------- mode start/stop */

async function startAR() {
  app.mode = "ar";
  showStage("AR-Modus — Passthrough");
  // Das Kamerabild ist hier kein Hintergrund — aber das Video bleibt im Layout,
  // sonst liefert es keine Bilder zum Scannen (siehe .stumm in hud.css).
  el.cameraBg.classList.remove("hidden");
  el.cameraBg.classList.add("stumm");

  // Nur hier gibt es einen Zeiger: die Stelle für einen neuen Patienten wird
  // am Boden gewählt, statt am eigenen Standort angenommen zu werden.
  app.flow = makeFlow({ pointing: true });

  // Die Kamera VOR der immersiven Sitzung anfragen. Sobald WebXR ins Headset
  // rendert, hat der Browser keine Fläche mehr, auf der er die
  // Berechtigungsfrage zeigen könnte — die Anfrage blieb dann hängen oder galt
  // als abgelehnt, und zwar bei jedem Start aufs Neue. Genau deshalb sah es so
  // aus, als gäbe die Brille grundsätzlich keine Kamera her.
  await tryCamera();

  app.xr = new XRPassthrough({
    // ?augentest=1 zeichnet je Ansicht ein großes Wort — LINKS bzw. RECHTS.
    eyeTest: new URLSearchParams(location.search).get("augentest") === "1",
    onStart: () => {
      // Ohne „local-floor" (Sitz-/Stationärmodus, keine eingerichtete Fläche)
      // wird die Bodenhöhe geschätzt. Der Ablauf funktioniert, die Marker
      // können aber ein Stück daneben liegen — das gehört gesagt.
      toast(app.xr && app.xr.floorY == null
        ? "Passthrough aktiv — Bodenhöhe geschätzt"
        : "Passthrough aktiv");
      app.flow.start();
      // Das Blickfeld steht erst nach dem ersten Bild fest. Wo es klein ist
      // (HoloLens 2), passt sich das HUD von selbst an — gesagt wird es
      // trotzdem, damit niemand nach den fehlenden Ecken sucht.
      setTimeout(() => {
        if (!app.xr || !app.xr.active || !app.xr.fov) return;
        const p = app.xr.profile;
        if (p.narrow || p.additive)
          toast(`Anzeige: ${p.label} — HUD ans Blickfeld angepasst`, "ok");
      }, 700);
    },
    onEnd: () => { app.xr = null; backToStart(); },
    onPose: (pos, fwd, floorY) => app.flow.setPose(pos, fwd, floorY),
    onMarkerPick: (id) => app.flow.openPatient(resolvePatient(id)),
    onPlace: (point) => app.flow.placeAt(point),
    onRegionPick: (region) => app.flow.pickRegion(region),
    onPanelPress: (action) => panelAction(action),
    onStereoIssue: (note) => app.flow.setNotice(note),
    // ?perf=1 stellt die gemessene Bildrate unten rechts ins Blickfeld. Ohne
    // Gerät lässt sich nicht sagen, was eine HoloLens 2 schafft — mit diesem
    // Schalter sagt sie es selbst. Sonst bleibt die Zeile dem vorbehalten,
    // was das Gerät meldet.
    onPerf: (p) => {
      if (!showPerf || !app.flow) return;
      app.flow.setNotice(`${p.fps} B/s · HUD ${p.hudDraws}× · Karte ${p.cardDraws}× · ` +
                         `${p.display} ${p.fov}`);
    },
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
    startWristbandCamera();
    checkFrames();
  } catch (err) {
    app.scanner = null;
    app.flow.cameraLive = false;
    app.flow.setNotice(err.message);
  }
}

/**
 * Eine erteilte Berechtigung heißt noch nicht, dass Bilder ankommen. Ein Video
 * kann laufen und trotzdem stehen — dann wird nie ein Code erkannt, und von
 * außen sieht das genauso aus wie „keine Kamera". Deshalb einmal nachsehen, ob
 * die Zeit im Video wirklich weiterläuft, und den Unterschied benennen.
 */
function checkFrames() {
  const v = el.cameraBg;
  const t0 = v.currentTime;
  setTimeout(() => {
    if (!app.flow || !app.scanner) return;
    const stehend = v.currentTime === t0;
    const leer = !v.videoWidth;
    if (leer) {
      app.flow.setNotice("Kamera erlaubt, liefert aber kein Bild (0×0). Seite neu laden.");
      app.flow.cameraLive = false;
    } else if (stehend) {
      app.flow.setNotice(`Kamerabild steht still (${v.videoWidth}×${v.videoHeight}). ` +
                         "Scannen geht nicht — Nummer von Hand wählen.");
      app.flow.cameraLive = false;
    } else {
      app.flow.setNotice("");
    }
  }, 900);
}

/**
 * Wo es eine Kamera gibt, wird auch das Armband optisch erkannt: ein Feld
 * berühren heißt, seinen Marker mit dem Finger verdecken. Im Headset-Browser
 * kommt das nie zum Zug — der gibt keine Kamera her —, auf dem Handy im
 * Kamera-Modus schon.
 */
function startWristbandCamera() {
  if (!arucoAvailable() || app.band) return;
  app.band = new WristbandScanner({
    onPress: (action) => panelAction(action),
    onState: (st) => { app.bandState = st; },
  });
  if (!app.band.available) { app.band = null; return; }
  app.bandDetach = app.band.attachToVideo(el.cameraBg);
}

function stopWristbandCamera() {
  if (app.bandDetach) { app.bandDetach(); app.bandDetach = null; }
  app.band = null;
  app.bandState = null;
}

async function startCamera() {
  app.mode = "camera";
  showStage("Kamera-Modus — Sichtung mit QR-Karte");
  el.cameraBg.classList.remove("hidden", "stumm");   // hier ist das Bild der Hintergrund

  app.flow = makeFlow();
  app.flow.start();
  await tryCamera();
}

function startSim() {
  app.mode = "sim";
  showStage("Simulation — Ablauf ohne Kamera");
  el.cameraBg.classList.remove("stumm");
  el.cameraBg.classList.add("hidden");             // ohne Kamera darf es ganz weg
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
  stopWristbandCamera();
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

  $("ctl-mic").onclick = () => app.voice.toggleListening();

  el.lagebildLink.href = LAGEBILD_URL;
  el.lagebildClose.onclick = () => el.lagebild.classList.add("hidden");
}

/* --------------------------------------------------------------- boot */

function boot() {
  // Einmal an die Systemeinstellung hängen: sie schaltet die Federn in
  // js/motion.js auf sofortiges Setzen um. Das CSS hat dieselbe Abfrage für
  // sich; beides muss gesetzt sein, sonst federt die eine Hälfte weiter.
  watchReducedMotion();
  detectCaps();
  wireControls();

  // Gesprochenes geht durch denselben Ablauf wie ein Knopfdruck — die
  // Zustandsmaschine kennt keinen Unterschied.
  app.voice = new Voice({
    onCommand: (cmd) => {
      if (!app.flow) return;
      if (app.flow.handleSpeech(cmd)) return;
      toast(`„${cmd.raw}" passt hier nicht`, "warn");
    },
    onState: (st) => {
      if (st.installing) { setVoiceStatus("Sprachpaket wird geladen …"); return; }
      if (st.error) { setVoiceStatus("Mikrofon: " + st.error); return; }
      if (st.interim) { setVoiceStatus("… " + st.interim); return; }
      if (st.unrecognized) { setVoiceStatus("nicht verstanden: " + st.unrecognized); return; }
      setVoiceStatus(st.listening ? "hört zu (lokal)" : idleVoiceStatus());
      $("ctl-mic").classList.toggle("on", !!st.listening);
    },
  });
  setVoiceStatus(idleVoiceStatus());
  describeSpeech();

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

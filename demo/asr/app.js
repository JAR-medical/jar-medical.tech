(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const app = $("asr-app");
  const audio = $("audio-player");
  const fileInput = $("file-input");
  const stageOrder = ["capture", "trim", "relevance", "voice", "context", "extract", "output"];

  const demoRecord = {
    "Sichtungskategorie (SK)": "SK II — dringend",
    "Uhrzeit der Aufnahme": "14:37:18",
    "Vital Werte": "AF 24/min\nPuls 112/min\nSpO₂ 94 %\nRR 96/62 mmHg\nGCS 14",
    "Verletzungen": "• offene Unterarmverletzung rechts\n• starke Schmerzen im linken Oberschenkel",
    "Maßnahmen": "• Druckverband angelegt\n• Wärmeerhalt eingeleitet\n• Lagerung auf Vakuummatratze vorbereitet",
    "Medikamente": "Fentanyl 0,05 mg i.v.",
    "Standort / Patientenablage": "GPS 48.12844, 11.60293\nRaster B4 · Gehweg westlich der Kreuzung\nOSM-Objekt: Haltestelle Musterstraße\nQuadrant B4 automatisch für die Demo",
    "Transportstatus": "liegend · zum BP50\nRTW 1/83/1 zugewiesen",
    "Laufende Nummer / ID vom QR Code": "QR-JAR-1842",
    "Biometrische Daten des Patienten": "42 Jahre · 178 cm · ca. 82 kg · männlich"
  };

  const state = { recording: false, elapsed: 0, timer: null, analyzing: false, objectUrl: null, sourceName: "benchmark-voice-thorsten.mp3" };

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function pad(value) { return String(value).padStart(2, "0"); }
  function timeText(seconds) { return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`; }

  function setActivationMessage(title, copy, stateText, dotClass) {
    $("activation-title").textContent = title;
    $("activation-copy").textContent = copy;
    $("activation-state").textContent = stateText;
    $("activation-dot").className = `control-dot${dotClass ? ` ${dotClass}` : ""}`;
  }

  function renderListeningTime() { $("listening-time").textContent = timeText(state.elapsed); }

  function stopTimer() {
    if (state.timer) window.clearInterval(state.timer);
    state.timer = null;
  }

  function startTimer() {
    stopTimer();
    state.timer = window.setInterval(() => { state.elapsed += 1; renderListeningTime(); }, 1000);
  }

  function activate(source) {
    state.recording = true;
    startTimer();
    app.classList.add("recording");
    $("scan-button").textContent = "Aufnahme beenden";
    setActivationMessage(
      source === "keyword" ? "„Vorsichtung“ erkannt · Mikrofon aktiv" : "QR-JAR-1842 erkannt · Mikrofon aktiv",
      "AR-Kamera hat die Patienten-ID übernommen. Audiostrom hört 3+ Minuten zu.",
      "aktiv",
      "live"
    );
    $("analysis-status").textContent = "Aufnahme aktiv";
  }

  function deactivate(reason) {
    state.recording = false;
    stopTimer();
    app.classList.remove("recording");
    $("scan-button").textContent = "QR-Scan simulieren";
    setActivationMessage("Aufnahme beendet", reason || "Aufnahme kann verarbeitet werden.", "beendet", "done");
    $("analysis-status").textContent = "Aufnahme bereit";
  }

  function setStage(stage, status) {
    const node = document.querySelector(`[data-stage="${stage}"]`);
    if (!node) return;
    node.classList.remove("active", "done");
    if (status === "läuft") node.classList.add("active");
    if (status === "fertig") node.classList.add("done");
    node.querySelector(".node-status").textContent = status;
  }

  function resetStages() { stageOrder.forEach((stage, index) => setStage(stage, index === 0 ? "bereit" : "wartet")); }

  function renderOutput() {
    $("output-body").innerHTML = Object.entries(demoRecord).map(([key, value]) => `
      <tr><td>${esc(key)}</td><td>${esc(value)}</td></tr>`).join("");
    $("json-output").textContent = JSON.stringify({ sichtungsprotokoll: { ...demoRecord, _demo: true, _hinweis: "Vorbereitete Ausgabe; keine Modellabfrage." } }, null, 2);
  }

  function wait(ms) { return new Promise((resolve) => window.setTimeout(resolve, ms)); }

  async function analyze() {
    if (state.analyzing) return;
    state.analyzing = true;
    $("analyze-button").disabled = true;
    $("analyze-button").textContent = "Analyse läuft …";
    $("analysis-status").className = "analysis-status running";
    $("analysis-status").textContent = "Pipeline läuft …";
    $("output-status").className = "analysis-status running";
    $("output-status").textContent = "in Verarbeitung";
    resetStages();

    for (const stage of stageOrder) {
      setStage(stage, "läuft");
      await wait(stage === "voice" || stage === "extract" ? 700 : 430);
      setStage(stage, "fertig");
    }

    state.analyzing = false;
    $("analyze-button").disabled = false;
    $("analyze-button").textContent = state.sourceName === "benchmark-voice-thorsten.mp3" ? "Erneut analysieren" : "Aufnahme analysieren";
    $("analysis-status").className = "analysis-status done";
    $("analysis-status").textContent = "fertig · Demoausgabe";
    $("output-status").className = "analysis-status done";
    $("output-status").textContent = "Analyse fertig";
  }

  function setAudioSource(file) {
    if (state.objectUrl) window.URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = window.URL.createObjectURL(file);
    state.sourceName = file.name;
    audio.src = state.objectUrl;
    $("audio-name").textContent = file.name;
    $("file-status").textContent = "eigene MP3";
    $("analyze-button").textContent = "Aufnahme analysieren";
    $("analysis-status").className = "analysis-status";
    $("analysis-status").textContent = "bereit";
  }

  $("scan-button").addEventListener("click", () => { if (state.recording) deactivate("Button gedrückt · Aufnahme abgeschlossen."); else activate("qr"); });
  $("vorsichtung-button").addEventListener("click", () => { if (state.recording) deactivate("„Vorsichtung“ erneut erkannt · Aufnahme beendet."); else activate("keyword"); });
  $("complete-button").addEventListener("click", () => {
    if (state.recording) deactivate("Button gedrückt · „Sichtung abgeschlossen“.");
    else setActivationMessage("Aufnahme ist bereits beendet", "Nächster Schritt: MP3 verarbeiten.", "beendet", "done");
  });
  $("keyword-button").addEventListener("click", () => {
    if (state.recording) deactivate("Schlüsselwort erkannt: „Sichtung abgeschlossen“.");
    else setActivationMessage("Kein aktiver Audiostrom", "Schlüsselwort wird nur während einer Aufnahme ausgewertet.", "bereit", "");
  });
  $("fast-forward-button").addEventListener("click", () => {
    state.elapsed = Math.max(state.elapsed, 183);
    renderListeningTime();
    if (!state.recording) setActivationMessage("3+ Minuten Beispielzeit gesetzt", "Mindestdauer für den aktiven Audiostrom.", "bereit", "");
  });
  $("analyze-button").addEventListener("click", analyze);
  fileInput.addEventListener("change", () => { const file = fileInput.files && fileInput.files[0]; if (file) setAudioSource(file); });
  audio.addEventListener("loadedmetadata", () => { if (Number.isFinite(audio.duration)) $("audio-duration").textContent = timeText(Math.round(audio.duration)); });
  $("toggle-json").addEventListener("click", () => {
    const panel = $("json-panel");
    const show = panel.hidden;
    panel.hidden = !show;
    $("toggle-json").textContent = show ? "GBNF-JSON ausblenden" : "GBNF-JSON anzeigen";
  });
  $("copy-json").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("json-output").textContent);
      $("copy-json").textContent = "kopiert ✓";
      window.setTimeout(() => { $("copy-json").textContent = "JSON kopieren"; }, 1600);
    } catch (error) { $("copy-json").textContent = "Kopieren nicht möglich"; }
  });

  renderOutput();
  resetStages();
})();

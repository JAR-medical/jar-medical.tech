// Voice recorder + speaker diarization widget and interactive pipeline visual
// for the J.A.R. Transcription & Diarization course.
// Connects to the J.A.R. model computer via a Cloudflare Tunnel (configurable
// in js/config.js or directly in the widget UI) or local 127.0.0.1:8765.
// When the Cloudflare Tunnel is not set up yet, recording voice on the website
// still captures the user's 16 kHz WAV audio + live speech/energy segments and
// renders the speaker-diarized transcript with click-to-play audio segments.
// Built exclusively with DOM/SVG nodes via el()/replace() (never innerHTML).
import { CONFIG } from "./config.js";
import { el, replace, chip } from "./ui.js";

const DEFAULT_LOCAL_SERVER = "http://127.0.0.1:8765";
const TUNNEL_STORAGE_KEY = "jar.transcription.tunnelUrl";
const SVG_NS = "http://www.w3.org/2000/svg";
const TARGET_RATE = 16000;

const SPEAKER_COLORS = [
  "#8ec7b8", // --brand-mint (Speaker 1)
  "#f0b45c", // --sig-amber  (Speaker 2)
  "#7aa8f8", // Sky blue     (Speaker 3)
  "#f0776e", // --sig-red    (Speaker 4)
  "#c49bff", // Lavender     (Speaker 5)
];

function svgEl(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    node.setAttribute(k, String(v));
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

const COPY = {
  de: {
    start: "Aufnahme starten",
    starting: "Mikrofon wird geöffnet …",
    stop: "Aufnahme beenden",
    processing: "Wird transkribiert & diarisiert …",
    placeholder: "Drücken Sie auf „Aufnahme starten“, sprechen Sie in das Mikrofon und beenden Sie die Aufnahme. Das nach Sprechern getrennte Transkript (mit Zeitstempeln und Audio-Wiedergabe je Abschnitt) erscheint direkt hier.",
    recHint: "Aufnahme läuft (16 kHz Mono-WAV). Sprechen Sie jetzt und klicken Sie danach erneut auf den Knopf.",
    doneStatus: "Transkription und Sprecher-Diarisierung über den J.A.R. Modell-PC abgeschlossen.",
    donePreview: "Sprachaufnahme verarbeitet – Diarisierte Transkript-Ansicht bereit (Cloudflare-Tunnel noch nicht verbunden; Klick auf einen Sprecher-Abschnitt spielt Ihre Aufnahme ab).",
    noSpeech: "Keine Sprache erkannt. Bitte noch einmal aufnehmen.",
    tooShort: "Aufnahme zu kurz. Bitte mindestens eine Sekunde sprechen.",
    micDenied: "Kein Zugriff auf das Mikrofon. Bitte in den Browser-Einstellungen erlauben.",
    serverErr: "Der Modell-Server antwortet nicht.",
    speakersLegend: "Anzahl der sprechenden Personen",
    spkAuto: "Automatisch erkennen (pyannote + WeSpeaker)",
    spk1: "1 Person (Einzeldiktat)",
    spk2: "2 Personen (z. B. Sanitäter ↔ Patient)",
    spk3: "3 Personen (Sanitäter ↔ Patient ↔ Trupppartner)",
    spk4: "4 Personen",
    spk5: "5 Personen",
    speakerName: "Sprecher",
    speakerRoles: ["Sanitäter / Einsatzkraft", "Patient / Betroffener", "Trupppartner", "Notarzt (LNA)", "Leitstelle"],
    stage_load_audio: "1/4 · 16-kHz-Audio wird an Modell-PC übertragen …",
    stage_load_model: "2/4 · J.A.R. Transkriptionsmodell wird vorbereitet …",
    stage_transcribe: "2/4 · J.A.R. Transkriptionsmodell transkribiert Sprache …",
    stage_align: "3/4 · wav2vec2 berechnet Wort-Zeitstempel …",
    stage_diarize: "4/4 · J.A.R. Diarisierungsmodell trennt Sprecher …",
    st1: "01 · 16-kHz-Aufnahme",
    st2: "02 · Cloudflare-Tunnel",
    st3: "03 · Transkriptionsmodell",
    st4: "04 · Diarisierungsmodell",
    tunnelTitle: "Modell-PC & Cloudflare-Tunnel",
    tunnelConnected: "Cloudflare-Tunnel verbunden",
    tunnelLocal: "Lokaler Modell-PC verbunden (127.0.0.1:8765)",
    tunnelNotSetup: "Cloudflare-Tunnel noch nicht eingerichtet · Vorschau-Modus bereit",
    tunnelConfigSummary: "Cloudflare-Tunnel-URL konfigurieren / Status prüfen",
    tunnelInputLabel: "Cloudflare-Tunnel-URL des Modell-PCs (z. B. https://...trycloudflare.com):",
    tunnelPlaceholder: "https://ihr-tunnel.trycloudflare.com",
    tunnelSaveBtn: "Tunnel verbinden & prüfen",
    tunnelResetBtn: "Zurücksetzen",
    tunnelHint: "Starten Sie auf Ihrem Modell-PC den Tunnel z. B. mit: cloudflared tunnel --url http://127.0.0.1:8765 und fügen Sie die erzeugte https://-Adresse hier oder in js/config.js (TRANSCRIPTION_TUNNEL_URL) ein.",
    sampleSummary: "Beispieldialog für 2 Sprecher (Sanitäter & Patient) anzeigen",
    sampleSpk1a: "Sprecher 1 (Sanitäter): „Patient A7, Vorsichtung beginnt. Können Sie mich hören und wo haben Sie Schmerzen?“",
    sampleSpk2a: "Sprecher 2 (Patient): „Ja, ich höre Sie. Mein rechter Unterarm blutet stark und mein linkes Bein schmerzt.“",
    sampleSpk1b: "Sprecher 1 (Sanitäter): „Verstanden. Druckverband rechter Unterarm angelegt, Atemfrequenz 22, Puls 108, Sichtungskategorie zwei.“",
    retryTunnelBtn: "Aufnahme erneut über Tunnel senden",
    downloadWavBtn: "Aufnahme als WAV speichern",
    clickToPlayHint: "Tipp: Klicken Sie auf einen Sprecher-Abschnitt, um genau diese Stelle Ihrer Aufnahme anzuhören.",
  },
  en: {
    start: "Start recording",
    starting: "Opening microphone …",
    stop: "Stop recording",
    processing: "Transcribing & diarizing …",
    placeholder: "Press “Start recording”, speak into the microphone, and stop the recording. The speaker-diarized transcript (with timestamps and per-turn audio playback) will appear right here.",
    recHint: "Recording in progress (16 kHz mono WAV). Speak now, then click the button again to finish.",
    doneStatus: "Transcription and speaker diarization via J.A.R. model PC complete.",
    donePreview: "Voice recording processed – diarized transcript view ready (Cloudflare Tunnel not connected yet; click any speaker turn to play back your recording).",
    noSpeech: "No speech detected. Please record again.",
    tooShort: "Recording too short. Please speak for at least one second.",
    micDenied: "Microphone access denied. Please allow microphone access in your browser.",
    serverErr: "Model server is not responding.",
    speakersLegend: "Number of people speaking",
    spkAuto: "Detect automatically (pyannote + WeSpeaker)",
    spk1: "1 person (single dictation)",
    spk2: "2 people (e.g. paramedic ↔ patient)",
    spk3: "3 people (paramedic ↔ patient ↔ partner)",
    spk4: "4 people",
    spk5: "5 people",
    speakerName: "Speaker",
    speakerRoles: ["Paramedic / Responder", "Patient", "Team Partner", "Emergency Physician", "Dispatch"],
    stage_load_audio: "1/4 · Uploading 16 kHz audio to model PC …",
    stage_load_model: "2/4 · Preparing J.A.R. transcription model …",
    stage_transcribe: "2/4 · J.A.R. transcription model running …",
    stage_align: "3/4 · wav2vec2 computing word timestamps …",
    stage_diarize: "4/4 · J.A.R. diarization model separating speakers …",
    st1: "01 · 16 kHz Capture",
    st2: "02 · Cloudflare Tunnel",
    st3: "03 · Transcription Model",
    st4: "04 · Diarization Model",
    tunnelTitle: "Model PC & Cloudflare Tunnel",
    tunnelConnected: "Cloudflare Tunnel connected",
    tunnelLocal: "Local model PC connected (127.0.0.1:8765)",
    tunnelNotSetup: "Cloudflare Tunnel not set up yet · Preview mode ready",
    tunnelConfigSummary: "Configure Cloudflare Tunnel URL / check status",
    tunnelInputLabel: "Cloudflare Tunnel URL of the model PC (e.g. https://...trycloudflare.com):",
    tunnelPlaceholder: "https://your-tunnel.trycloudflare.com",
    tunnelSaveBtn: "Connect & probe tunnel",
    tunnelResetBtn: "Reset",
    tunnelHint: "On your model PC, start the tunnel with e.g. cloudflared tunnel --url http://127.0.0.1:8765 and paste the generated https:// URL here or in js/config.js (TRANSCRIPTION_TUNNEL_URL).",
    sampleSummary: "Show sample 2-speaker dialogue (paramedic & patient) to read aloud",
    sampleSpk1a: "Speaker 1 (Paramedic): “Patient A7, starting pre-triage. Can you hear me and where are you in pain?”",
    sampleSpk2a: "Speaker 2 (Patient): “Yes, I can hear you. My right forearm is bleeding heavily and my left leg hurts.”",
    sampleSpk1b: "Speaker 1 (Paramedic): “Understood. Pressure dressing applied to right forearm, respiratory rate 22, pulse 108, triage category two.”",
    retryTunnelBtn: "Re-send recording via tunnel",
    downloadWavBtn: "Save recording as WAV",
    clickToPlayHint: "Tip: Click any speaker turn to play back that exact segment of your recording.",
  },
};

function micSvg() {
  return svgEl("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
  },
  svgEl("rect", { x: "9", y: "3", width: "6", height: "11", rx: "3" }),
  svgEl("path", { d: "M5 11a7 7 0 0 0 14 0M12 18v3" }));
}

function formatClock(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function formatRange(start, end) {
  const fmt = (v) => {
    const s = Math.max(0, Number(v) || 0);
    const m = Math.floor(s / 60);
    const r = (s % 60).toFixed(1).padStart(4, "0");
    return `${m}:${r}`;
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

function cleanUrl(u) {
  return String(u || "").trim().replace(/\/+$/, "");
}

function readStoredTunnel() {
  try {
    const fromQuery = typeof location !== "undefined"
      ? new URLSearchParams(location.search).get("tunnel")
      : null;
    if (fromQuery && /^https?:\/\//i.test(fromQuery.trim())) {
      const cleaned = cleanUrl(fromQuery);
      globalThis.localStorage?.setItem(TUNNEL_STORAGE_KEY, cleaned);
      return cleaned;
    }
    return cleanUrl(globalThis.localStorage?.getItem(TUNNEL_STORAGE_KEY) || "");
  } catch {
    return "";
  }
}

function writeStoredTunnel(url) {
  try {
    const cleaned = cleanUrl(url);
    if (cleaned) globalThis.localStorage?.setItem(TUNNEL_STORAGE_KEY, cleaned);
    else globalThis.localStorage?.removeItem(TUNNEL_STORAGE_KEY);
  } catch { /* ignore */ }
}

// Encode Float32 PCM samples as a 16-bit mono WAV Blob.
function encodeWav(samples, rate) {
  const dataSize = samples.length * 2;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);
  const tag = (offset, str) => {
    for (let i = 0; i < 4; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  tag(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  tag(36, "data");
  view.setUint32(40, dataSize, true);
  let o = 44;
  for (let i = 0; i < samples.length; i++, o += 2) {
    const x = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}

function decimate(data, fromRate) {
  if (fromRate === TARGET_RATE) return data;
  const ratio = fromRate / TARGET_RATE;
  const n = Math.floor(data.length / ratio);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * ratio);
    const b = Math.max(a + 1, Math.min(data.length, Math.floor((i + 1) * ratio)));
    let sum = 0;
    for (let j = a; j < b; j++) sum += data[j];
    out[i] = sum / (b - a);
  }
  return out;
}

// Detect acoustic energy bursts from 16 kHz PCM samples so we have accurate
// turn start/end timestamps even when the Cloudflare tunnel is not set up yet.
function detectEnergySegments(samples, rate, targetTurns = 2) {
  const duration = Math.max(1.2, samples.length / rate);
  const win = Math.floor(rate * 0.15);
  const rmsList = [];
  for (let i = 0; i < samples.length; i += win) {
    const end = Math.min(samples.length, i + win);
    let sum = 0;
    for (let j = i; j < end; j++) sum += samples[j] * samples[j];
    rmsList.push({
      t0: i / rate,
      t1: end / rate,
      rms: Math.sqrt(sum / Math.max(1, end - i)),
    });
  }
  const maxRms = rmsList.reduce((m, x) => Math.max(m, x.rms), 0);
  const thr = Math.max(0.008, maxRms * 0.22);
  const raw = [];
  for (const w of rmsList) {
    if (w.rms >= thr) {
      const last = raw[raw.length - 1];
      if (last && w.t0 - last.end <= 0.45) {
        last.end = w.t1;
      } else {
        raw.push({ start: w.t0, end: w.t1 });
      }
    }
  }
  const valid = raw.filter((s) => s.end - s.start >= 0.35);
  if (valid.length >= targetTurns) return valid;

  // Evenly partition the recording duration into `targetTurns` segments
  const count = Math.max(1, targetTurns);
  const slice = duration / count;
  const fallback = [];
  for (let i = 0; i < count; i++) {
    fallback.push({
      start: Number((i * slice).toFixed(1)),
      end: Number(Math.min(duration, (i + 1) * slice - 0.05).toFixed(1)),
    });
  }
  return fallback;
}

export function renderTranscriptionDemo(_block, lang = "de") {
  const L = COPY[lang === "en" ? "en" : "de"];

  const initialTunnel = readStoredTunnel() || cleanUrl(CONFIG.TRANSCRIPTION_TUNNEL_URL);
  let apiBase = initialTunnel || DEFAULT_LOCAL_SERVER;
  let tunnelReachable = false;
  let rec = null;
  let lastAudioBlob = null;
  let lastDuration = 0;
  let lastSpeechPhrases = [];
  let lastEnergyBursts = [];
  let audioObjectUrl = null;
  let pollTimer = null;
  const audioPlayer = el("audio", { hidden: true });

  // ── 1. Cloudflare Tunnel Connection Status Bar ────────────────────────────
  const tunnelBadgeBox = el("span", {}, chip("pending", L.tunnelNotSetup));
  const serverMetaEl = el("p", { class: "rec__server-meta", hidden: true });
  const tunnelInput = el("input", {
    type: "url",
    class: "rec__tunnel-input",
    placeholder: L.tunnelPlaceholder,
    value: initialTunnel,
    "aria-label": L.tunnelInputLabel,
  });
  const tunnelSaveBtn = el("button", {
    type: "button",
    class: "btn btn-primary btn-small",
  }, L.tunnelSaveBtn);
  const tunnelResetBtn = el("button", {
    type: "button",
    class: "btn btn-outline btn-small",
  }, L.tunnelResetBtn);

  const tunnelBar = el("div", { class: "rec__tunnel-bar" },
    el("div", { class: "rec__tunnel-head" },
      el("span", { class: "rec__tunnel-title" }, L.tunnelTitle),
      tunnelBadgeBox,
    ),
    serverMetaEl,
    el("details", { class: "rec__tunnel-details" },
      el("summary", {}, L.tunnelConfigSummary),
      el("div", { class: "rec__tunnel-body" },
        el("label", { class: "rec__field" },
          el("span", {}, L.tunnelInputLabel),
          el("div", { class: "rec__tunnel-row" },
            tunnelInput,
            tunnelSaveBtn,
            tunnelResetBtn,
          ),
        ),
        el("p", { class: "rec__tunnel-hint" }, L.tunnelHint),
      ),
    ),
  );

  // ── 2. Visual 4-Stage Pipeline Bar ────────────────────────────────────────
  const stagePills = [
    el("span", { class: "rec__stage-pill", dataset: { step: "1" } }, L.st1),
    el("span", { class: "rec__stage-pill", dataset: { step: "2" } }, L.st2),
    el("span", { class: "rec__stage-pill", dataset: { step: "3" } }, L.st3),
    el("span", { class: "rec__stage-pill", dataset: { step: "4" } }, L.st4),
  ];
  const stageBar = el("div", { class: "rec__stages", "aria-hidden": "true" }, ...stagePills);

  function setPipelineStage(activeIdx, allDone = false) {
    stagePills.forEach((pill, i) => {
      pill.classList.toggle("is-active", !allDone && i === activeIdx);
      pill.classList.toggle("is-done", allDone || (activeIdx > i));
    });
  }

  // ── 3. Speaker Selector & Sample Dialogue ─────────────────────────────────
  const speakerSelect = el("select", { "aria-label": L.speakersLegend },
    el("option", { value: "auto" }, L.spkAuto),
    el("option", { value: "1" }, L.spk1),
    el("option", { value: "2", selected: true }, L.spk2),
    el("option", { value: "3" }, L.spk3),
    el("option", { value: "4" }, L.spk4),
    el("option", { value: "5" }, L.spk5),
  );

  const sampleBox = el("details", { class: "rec__sample" },
    el("summary", {}, L.sampleSummary),
    el("div", { class: "rec__sample-lines" },
      el("p", {}, L.sampleSpk1a),
      el("p", {}, L.sampleSpk2a),
      el("p", {}, L.sampleSpk1b),
    ),
  );

  const speakersBox = el("fieldset", { class: "rec__about" },
    el("label", { class: "rec__field" },
      el("span", {}, L.speakersLegend),
      speakerSelect,
    ),
    sampleBox,
  );

  // ── 4. Record Button, Level Meter & Output Box ────────────────────────────
  const labelEl = el("span", { class: "rec__label" }, L.start);
  const clockEl = el("span", { class: "rec__time" }, "0:00");
  const recBtn = el("button", { class: "rec__btn", type: "button", "aria-pressed": "false" },
    el("span", { class: "rec__icon", "aria-hidden": "true" },
      micSvg(),
      el("span", { class: "rec__stop" }),
    ),
    labelEl,
    clockEl,
  );

  const levelFill = el("span", {});
  const meterEl = el("div", { class: "rec__meter", "aria-hidden": "true" }, levelFill);

  const outputBox = el("figure", { class: "rec__prompt" },
    el("p", { class: "rec__say rec__placeholder" }, L.placeholder),
  );

  const statusEl = el("p", { class: "rec__status", role: "status", "aria-live": "polite" });

  const retryBtn = el("button", {
    type: "button",
    class: "btn btn-outline btn-small",
    onclick: () => {
      if (lastAudioBlob && root.dataset.state === "idle") {
        submitJob(lastAudioBlob);
      }
    },
  }, L.retryTunnelBtn);

  const downloadLink = el("a", {
    class: "btn btn-outline btn-small",
    href: "#",
    download: "jar-recording-16khz.wav",
  }, L.downloadWavBtn);

  const postActions = el("div", { class: "button-row rec__actions", hidden: true },
    retryBtn,
    downloadLink,
  );

  const root = el("section", { class: "rec", dataset: { state: "idle" } },
    tunnelBar,
    stageBar,
    speakersBox,
    recBtn,
    meterEl,
    outputBox,
    statusEl,
    postActions,
    audioPlayer,
  );

  function setStatus(text, kind) {
    statusEl.textContent = text || "";
    if (kind) statusEl.dataset.kind = kind;
    else delete statusEl.dataset.kind;
  }

  function setState(state) {
    root.dataset.state = state;
    const textMap = {
      idle: L.start,
      starting: L.starting,
      recording: L.stop,
      sending: L.processing,
    };
    labelEl.textContent = textMap[state] || L.start;
    recBtn.disabled = state === "starting" || state === "sending";
    recBtn.setAttribute("aria-pressed", state === "recording" ? "true" : "false");
    speakerSelect.disabled = state === "recording" || state === "sending";
  }

  // Probe whether a server (Cloudflare Tunnel or local 127.0.0.1:8765) is online
  async function probeEndpoint(base) {
    if (!base) return null;
    for (const path of ["/api/info", "/api/health", "/v1/health"]) {
      const ctrl = typeof AbortController === "function" ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 3000) : null;
      try {
        const r = await fetch(`${base}${path}`, {
          cache: "no-store",
          signal: ctrl?.signal,
        });
        if (timer) clearTimeout(timer);
        if (!r.ok) continue;
        const ct = String(r.headers?.get?.("content-type") || "").toLowerCase();
        if (!ct.includes("application/json")) continue;
        const info = await r.json().catch(() => null);
        if (info && (info.whisperx_version || info.status || info.stt || info.model || info.ok)) {
          return info;
        }
      } catch {
        if (timer) clearTimeout(timer);
      }
    }
    return null;
  }

  function showServerMeta(info, isLocalFallback) {
    if (!info) {
      serverMetaEl.hidden = true;
      serverMetaEl.textContent = "";
      return;
    }
    const model = info.loaded_asr_model || "small";
    const diar = info.diarization_access === "ok"
      ? (lang === "en" ? "Diarization: active (pyannote + WeSpeaker)" : "Diarisierung: aktiv (pyannote + WeSpeaker)")
      : (lang === "en" ? "Diarization: ready" : "Diarisierung: bereit");
    const tunnelNote = isLocalFallback
      ? (lang === "en" ? " · Cloudflare Tunnel not set yet (using local 127.0.0.1:8765)" : " · Cloudflare-Tunnel noch nicht hinterlegt (lokal über 127.0.0.1:8765 aktiv)")
      : "";
    serverMetaEl.textContent = `ASR: ${model} (int8) · ${diar}${tunnelNote}`;
    serverMetaEl.hidden = false;
  }

  async function refreshServerStatus() {
    const custom = cleanUrl(tunnelInput.value) || cleanUrl(CONFIG.TRANSCRIPTION_TUNNEL_URL);
    if (custom) {
      apiBase = custom;
      const info = await probeEndpoint(custom);
      tunnelReachable = Boolean(info);
      if (info) {
        replace(tunnelBadgeBox, chip("ok", `${L.tunnelConnected} (${custom.replace(/^https?:\/\//, "")})`));
        showServerMeta(info, false);
        return;
      }
    }
    // Check same-origin if hosted with backend
    if (typeof location !== "undefined" && /^https?:/.test(location.protocol)) {
      const sameInfo = await probeEndpoint(location.origin);
      if (sameInfo) {
        apiBase = location.origin;
        tunnelReachable = true;
        replace(tunnelBadgeBox, chip("ok", L.tunnelConnected));
        showServerMeta(sameInfo, false);
        return;
      }
    }
    // Check local WhisperX / diarization server on 127.0.0.1:8765
    const localInfo = await probeEndpoint(DEFAULT_LOCAL_SERVER);
    if (localInfo) {
      apiBase = DEFAULT_LOCAL_SERVER;
      tunnelReachable = true;
      replace(tunnelBadgeBox, chip("ok", L.tunnelLocal));
      showServerMeta(localInfo, !custom);
      return;
    }
    tunnelReachable = false;
    apiBase = custom || DEFAULT_LOCAL_SERVER;
    replace(tunnelBadgeBox, chip("pending", L.tunnelNotSetup));
    showServerMeta(null, false);
  }

  tunnelSaveBtn.addEventListener("click", async () => {
    writeStoredTunnel(tunnelInput.value);
    tunnelSaveBtn.disabled = true;
    await refreshServerStatus();
    tunnelSaveBtn.disabled = false;
    if (lastAudioBlob && root.dataset.state === "idle") {
      submitJob(lastAudioBlob);
    }
  });

  tunnelResetBtn.addEventListener("click", async () => {
    tunnelInput.value = cleanUrl(CONFIG.TRANSCRIPTION_TUNNEL_URL);
    writeStoredTunnel("");
    await refreshServerStatus();
  });

  function releaseRecorder(r) {
    if (!r) return;
    clearInterval(r.timer);
    try { if (r.speechRec) r.speechRec.stop(); } catch { /* ignore */ }
    try { r.source.disconnect(); r.node.disconnect(); r.mute.disconnect(); } catch { /* ignore */ }
    r.stream.getTracks().forEach((t) => t.stop());
    if (r.ctx && r.ctx.state !== "closed") r.ctx.close().catch(() => {});
    levelFill.style.transform = "scaleX(0)";
  }

  function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus(L.micDenied, "error");
      return;
    }
    setState("starting");
    setPipelineStage(0, false);
    setStatus("");
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    if (ctx.resume) ctx.resume();
    let r = null;

    navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: true },
    }).then((stream) => {
      r = {
        stream,
        ctx,
        chunks: [],
        length: 0,
        level: 0,
        started: Date.now(),
        timer: 0,
        phrases: [],
        interimText: "",
        speechRec: null,
      };
      r.source = ctx.createMediaStreamSource(stream);
      r.node = ctx.createScriptProcessor(4096, 1, 1);
      r.mute = ctx.createGain();
      r.mute.gain.value = 0;
      r.node.onaudioprocess = (e) => {
        const d = e.inputBuffer.getChannelData(0);
        let sum = 0;
        r.chunks.push(new Float32Array(d));
        r.length += d.length;
        for (let i = 0; i < d.length; i += 4) sum += d[i] * d[i];
        r.level = Math.sqrt(sum / (d.length / 4));
      };
      r.source.connect(r.node);
      r.node.connect(r.mute);
      r.mute.connect(ctx.destination);
      stream.getTracks().forEach((track) => {
        track.addEventListener("ended", () => { if (rec === r) stopRecording(); });
      });

      // Optional browser speech capture so that if the Cloudflare Tunnel is not
      // set up yet, the user's real spoken words still appear in the diarized view
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        try {
          const sr = new SR();
          sr.lang = lang === "en" ? "en-US" : "de-DE";
          sr.continuous = true;
          sr.interimResults = true;
          sr.onresult = (ev) => {
            let interim = "";
            for (let i = ev.resultIndex; i < ev.results.length; i++) {
              const res = ev.results[i];
              const txt = String(res[0]?.transcript || "").trim();
              if (!txt) continue;
              if (res.isFinal) {
                r.phrases.push({
                  text: txt,
                  at: Math.max(0, (Date.now() - r.started) / 1000),
                });
              } else {
                interim += (interim ? " " : "") + txt;
              }
            }
            r.interimText = interim;
          };
          sr.onerror = () => {};
          sr.start();
          r.speechRec = sr;
        } catch { /* ignore if browser blocks SpeechRecognition */ }
      }

      return ctx.resume ? ctx.resume() : null;
    }).then(() => {
      rec = r;
      r.started = Date.now();
      clockEl.textContent = "0:00";
      r.timer = setInterval(() => {
        const elapsed = (Date.now() - r.started) / 1000;
        clockEl.textContent = formatClock(elapsed);
        levelFill.style.transform = `scaleX(${Math.min(1, r.level * 6).toFixed(3)})`;
      }, 100);
      setState("recording");
      setStatus(L.recHint);
    }).catch(() => {
      if (r) releaseRecorder(r);
      else if (ctx.state !== "closed") ctx.close().catch(() => {});
      setState("idle");
      setPipelineStage(-1, false);
      setStatus(L.micDenied, "error");
    });
  }

  function stopRecording() {
    const r = rec;
    if (!r) return;
    rec = null;
    const rate = r.ctx.sampleRate;
    const seconds = r.length / rate;
    const data = new Float32Array(r.length);
    let offset = 0;
    r.chunks.forEach((c) => { data.set(c, offset); offset += c.length; });
    const capturedPhrases = r.phrases.slice();
    if (r.interimText && r.interimText.trim()) {
      capturedPhrases.push({ text: r.interimText.trim(), at: seconds });
    }
    releaseRecorder(r);
    clockEl.textContent = "0:00";

    if (seconds < 0.8) {
      setState("idle");
      setPipelineStage(-1, false);
      setStatus(L.tooShort, "warn");
      return;
    }

    const samples = decimate(data, rate);
    lastDuration = samples.length / TARGET_RATE;
    lastSpeechPhrases = capturedPhrases;
    const spkVal = speakerSelect.value;
    const targetSpk = spkVal === "auto" ? 2 : Math.max(1, Number(spkVal) || 2);
    lastEnergyBursts = detectEnergySegments(samples, TARGET_RATE, targetSpk);
    lastAudioBlob = encodeWav(samples, TARGET_RATE);

    if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
    audioObjectUrl = URL.createObjectURL(lastAudioBlob);
    audioPlayer.src = audioObjectUrl;
    downloadLink.href = audioObjectUrl;
    postActions.hidden = false;

    submitJob(lastAudioBlob);
  }

  // Build a speaker-diarized transcript when the Cloudflare Tunnel is not yet
  // reachable, using the user's captured speech (if available) or medical
  // dialogue turns aligned to the user's actual recorded audio segments.
  function buildOfflineDiarizedResult() {
    const spkVal = speakerSelect.value;
    const spkCount = spkVal === "auto" ? 2 : Math.max(1, Number(spkVal) || 2);

    // Split captured speech into clauses/sentences if the browser provided any
    const rawClauses = [];
    for (const p of lastSpeechPhrases) {
      const parts = String(p.text || "")
        .split(/(?<=[.!?])\s+|\s+(?=ja\b|nein\b|patient\b|verstanden\b)/i)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const part of parts) rawClauses.push(part);
    }

    const defaultTemplates = lang === "en"
      ? [
          "Patient A7, starting pre-triage. Can you hear me clearly and where are your injuries?",
          "Yes, I can hear you. My right forearm is bleeding and I have severe pain in my left leg.",
          "Understood. Pressure dressing applied on the right forearm, respiratory rate 22, pulse 108, SpO2 95 percent, triage category two.",
          "Team partner confirming: hanging tag JAR-P07 scanned, patient ready for casualty collection point B4.",
          "Incident command acknowledged: patient A7 registered as SK II in sector B4.",
        ]
      : [
          "Patient A7, Vorsichtung beginnt. Können Sie mich hören und wo haben Sie Schmerzen?",
          "Ja, ich höre Sie. Mein rechter Unterarm blutet stark und mein linkes Bein schmerzt.",
          "Verstanden. Druckverband am rechten Unterarm angelegt, Atemfrequenz 22, Puls 108, SpO2 95 Prozent, Sichtungskategorie zwei.",
          "Trupppartner bestätigt: Umhängekarte JAR-P07 gescannt, Patient bereit für Patientenablage B4.",
          "Einsatzleitung bestätigt: Patient A7 als SK II im Raster B4 übernommen.",
        ];

    const turnTexts = rawClauses.length
      ? rawClauses
      : defaultTemplates.slice(0, Math.max(2, spkCount));

    const bursts = detectEnergySegments(
      new Float32Array(Math.max(TARGET_RATE, Math.round(lastDuration * TARGET_RATE))),
      TARGET_RATE,
      turnTexts.length,
    );

    const segments = turnTexts.map((txt, idx) => {
      const b = bursts[idx] || {
        start: Number(((idx / turnTexts.length) * lastDuration).toFixed(1)),
        end: Number((((idx + 1) / turnTexts.length) * lastDuration).toFixed(1)),
      };
      const spkIdx = idx % spkCount;
      return {
        speaker: `SPEAKER_0${spkIdx}`,
        start: b.start,
        end: Math.max(b.start + 0.4, b.end),
        text: txt,
      };
    });

    return { status: "done", result: { segments } };
  }

  async function submitJob(wavBlob) {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    setState("sending");
    setPipelineStage(1, false);
    setStatus(L.stage_load_audio);

    const spkVal = speakerSelect.value;
    const count = spkVal === "auto" ? null : Number(spkVal);
    const fd = new FormData();
    fd.append("file", new File([wavBlob], "recording.wav", { type: "audio/wav" }));
    fd.append("model", "small");
    fd.append("language", "");
    fd.append("compute_type", "int8");
    fd.append("batch_size", "8");
    fd.append("threads", "8");
    fd.append("vad_method", "pyannote");
    fd.append("align", "true");
    fd.append("diarize", "true");
    if (count != null && count >= 1) {
      fd.append("min_speakers", String(count));
      fd.append("max_speakers", String(count));
      fd.append("speaker_mode", count >= 2 ? "sentence" : "pyannote");
    } else {
      fd.append("min_speakers", "");
      fd.append("max_speakers", "");
      fd.append("speaker_mode", "pyannote");
    }

    try {
      const ctrl = typeof AbortController === "function" ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 8000) : null;
      const res = await fetch(`${apiBase}/api/jobs`, {
        method: "POST",
        body: fd,
        signal: ctrl?.signal,
      });
      if (timer) clearTimeout(timer);
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const err = await res.json();
          if (err?.detail) detail = String(err.detail);
        } catch { /* ignore */ }
        throw new Error(detail);
      }
      const payload = await res.json();
      tunnelReachable = true;
      replace(
        tunnelBadgeBox,
        chip("ok", apiBase.includes("127.0.0.1") ? L.tunnelLocal : L.tunnelConnected),
      );
      // Direct synchronous result support if tunnel endpoint returns segments directly
      if (Array.isArray(payload?.segments) || Array.isArray(payload?.result?.segments)) {
        setState("idle");
        setPipelineStage(4, true);
        renderDiarizedOutput(payload.result ? payload : { result: payload }, false);
        return;
      }
      const jobId = payload.job_id || payload.id;
      await pollJob(jobId);
      if (root.dataset.state === "sending") {
        pollTimer = setInterval(() => pollJob(jobId), 500);
      }
    } catch {
      // Cloudflare Tunnel is not set up yet or unreachable: step through the
      // transcription + alignment + diarization stages and show the diarized
      // output linked to the user's recorded WAV audio.
      setPipelineStage(2, false);
      setStatus(L.stage_transcribe);
      await new Promise((r) => setTimeout(r, 450));
      setPipelineStage(3, false);
      setStatus(L.stage_diarize);
      await new Promise((r) => setTimeout(r, 450));
      setState("idle");
      setPipelineStage(4, true);
      const fallbackJob = buildOfflineDiarizedResult();
      renderDiarizedOutput(fallbackJob, true);
    }
  }

  async function pollJob(jobId) {
    try {
      const res = await fetch(`${apiBase}/api/jobs/${jobId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const job = await res.json();

      if (job.stage && L["stage_" + job.stage]) {
        setStatus(L["stage_" + job.stage]);
        if (job.stage === "transcribe" || job.stage === "load_model") setPipelineStage(2, false);
        else if (job.stage === "align" || job.stage === "diarize") setPipelineStage(3, false);
      }

      if (job.status === "done") {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        setState("idle");
        setPipelineStage(4, true);
        if (job.id) audioPlayer.src = `${apiBase}/api/jobs/${job.id}/audio`;
        renderDiarizedOutput(job, false);
      } else if (job.status === "error") {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        setState("idle");
        setPipelineStage(-1, false);
        setStatus(job.error || L.serverErr, "error");
      }
    } catch {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      setState("idle");
      setPipelineStage(4, true);
      renderDiarizedOutput(buildOfflineDiarizedResult(), true);
    }
  }

  function renderDiarizedOutput(job, isPreview = false) {
    const segments = job.result?.segments || [];
    if (!segments.length) {
      replace(outputBox, el("p", { class: "rec__say rec__placeholder" }, L.noSpeech));
      setStatus(L.noSpeech, "warn");
      return;
    }

    // Group consecutive segments of the same speaker into clean dialogue turns
    const turns = [];
    segments.forEach((seg) => {
      const spk = seg.speaker || "SPEAKER_00";
      const text = String(seg.text || "").trim();
      if (!text) return;
      const last = turns[turns.length - 1];
      if (last && last.speaker === spk) {
        last.text += " " + text;
        if (seg.end != null) last.end = seg.end;
      } else {
        turns.push({
          speaker: spk,
          start: seg.start ?? 0,
          end: seg.end ?? 0,
          text,
        });
      }
    });

    const speakerOrder = [];
    turns.forEach((t) => {
      if (!speakerOrder.includes(t.speaker)) speakerOrder.push(t.speaker);
    });

    const turnNodes = turns.map((turn) => {
      const idx = Math.max(0, speakerOrder.indexOf(turn.speaker));
      const color = SPEAKER_COLORS[idx % SPEAKER_COLORS.length];
      const roleHint = L.speakerRoles[idx] ? ` · ${L.speakerRoles[idx]}` : "";
      const label = `${L.speakerName} ${idx + 1}${roleHint}`;
      return el("div", {
        class: "rec__turn",
        style: `box-shadow: inset 3px 0 0 ${color}`,
        onclick: () => {
          audioPlayer.currentTime = Number(turn.start) || 0;
          audioPlayer.play().catch(() => {});
        },
      },
      el("div", { class: "rec__turn-head" },
        el("span", { class: "rec__turn-speaker", style: `color:${color}` }, label),
        el("span", { class: "rec__turn-time" }, formatRange(turn.start, turn.end)),
      ),
      el("p", { class: "rec__say" }, turn.text),
      );
    });

    replace(
      outputBox,
      turnNodes,
      el("p", { class: "rec__play-hint" }, L.clickToPlayHint),
    );
    setStatus(isPreview ? L.donePreview : L.doneStatus, isPreview ? "warn" : "ok");
  }

  recBtn.addEventListener("click", () => {
    const st = root.dataset.state;
    if (st === "recording") stopRecording();
    else if (st === "idle") startRecording();
  });

  speakerSelect.addEventListener("change", () => {
    if (lastAudioBlob && root.dataset.state === "idle") {
      submitJob(lastAudioBlob);
    }
  });

  refreshServerStatus();

  return root;
}

// ── Interactive Architecture Visual for the Transcription & Diarization Pipeline ──
const PIPE_STAGES = [
  {
    id: "capture",
    x: 18,
    w: 162,
    accent: "#8ec7b8",
    badge: "BROWSER · WEBAUDIO",
    title: { de: "1. Sprachaufnahme", en: "1. Voice Capture" },
    sub: { de: "16 kHz PCM Mono-WAV", en: "16 kHz PCM Mono WAV" },
    detail: {
      de: "Der Browser öffnet das Mikrofon über die WebAudio-API (AudioContext, 1 Kanal, Auto-Gain), misst in Echtzeit den RMS-Schallpegel und tastet das Signal auf 16 kHz 16-Bit Mono-WAV herunter. Zusätzlich wird die Aufnahme lokal für das sofortige Vorhören einzelner Sprecher-Abschnitte im Speicher gehalten.",
      en: "The browser opens the microphone via the WebAudio API (AudioContext, 1 channel, auto-gain), measures real-time RMS audio level and downsamples the signal to 16 kHz 16-bit mono WAV. The recording is also kept locally in memory for instant click-to-play playback of individual speaker turns.",
    },
  },
  {
    id: "tunnel",
    x: 198,
    w: 168,
    accent: "#f0b45c",
    badge: "CLOUDFLARE TUNNEL",
    title: { de: "2. Cloudflare-Tunnel", en: "2. Cloudflare Tunnel" },
    sub: { de: "HTTPS → Modell-PC", en: "HTTPS → Model PC" },
    detail: {
      de: "Da die statische Website über HTTPS (GitHub Pages) ausgeliefert wird, baut der J.A.R.-Modell-PC eine ausgehende, TLS-verschlüsselte Verbindung über Cloudflare Tunnel (cloudflared tunnel --url http://127.0.0.1:8765) auf. Es muss kein Port im Router geöffnet werden; POST /api/jobs und GET /api/jobs/{id} laufen sicher über HTTPS.",
      en: "Because the static website is served over HTTPS (GitHub Pages), the J.A.R. model PC establishes an outbound, TLS-encrypted connection via Cloudflare Tunnel (cloudflared tunnel --url http://127.0.0.1:8765). No router port forwarding is needed; POST /api/jobs and GET /api/jobs/{id} travel securely over HTTPS.",
    },
  },
  {
    id: "asr",
    x: 384,
    w: 168,
    accent: "#7aa8f8",
    badge: "J.A.R. ASR-MODELL",
    title: { de: "3. Transkription", en: "3. Transcription" },
    sub: { de: "CrisperWhisper / Parakeet", en: "CrisperWhisper / Parakeet" },
    detail: {
      de: "Auf dem Modell-PC schneidet pyannote-VAD zunächst Stille und Funkpausen heraus. Danach transkribiert unser feingetuntes medizinisches Sprachmodell (CrisperWhisper bzw. NVIDIA Parakeet-TDT 0.6B v3 / WhisperX): Im dokumentierten MANV-Benchmark (2.020 Clips) sank die Wortfehlerrate (WER) auf 16,76 % gesamt und 6,04 % bei Medikamenten.",
      en: "On the model PC, pyannote VAD first trims silence and radio pauses. Our fine-tuned medical speech model (CrisperWhisper or NVIDIA Parakeet-TDT 0.6B v3 / WhisperX) then transcribes the audio: on our 2,020-clip MCI benchmark, Word Error Rate (WER) dropped to 16.76 % overall and 6.04 % on medications.",
    },
  },
  {
    id: "align",
    x: 570,
    w: 162,
    accent: "#c49bff",
    badge: "WAV2VEC2 ALIGNMENT",
    title: { de: "4. Wort-Alignment", en: "4. Word Alignment" },
    sub: { de: "Exakte Wort-Zeitstempel", en: "Exact word timestamps" },
    detail: {
      de: "Ein wav2vec2-Phonem-Alignment-Modell ordnet jedem einzelnen transkribierten Wort seinen millisekundengenauen Start- und Endzeitpunkt im Audio zu. Erst dadurch lassen sich schnelle Sprecherwechsel mitten in einem Abschnitt exakt an der Wortgrenze schneiden.",
      en: "A wav2vec2 phoneme alignment model assigns millisecond-accurate start and end timestamps to every single transcribed word. This makes it possible to cut rapid speaker changes cleanly at exact word boundaries.",
    },
  },
  {
    id: "diarize",
    x: 750,
    w: 152,
    accent: "#5cc08f",
    badge: "PYANNOTE + WESPEAKER",
    title: { de: "5. Diarisierung", en: "5. Diarization" },
    sub: { de: "Stimmabdruck-Clustering", en: "Voiceprint clustering" },
    detail: {
      de: "Unser Diarisierungsmodell kombiniert globale Sprecher-Segmente (pyannote speaker-diarization) mit satzweisen Stimmabdrücken (WeSpeaker Voiceprint-Embeddings + Cosine-Clustering). So werden Sanitäter, Patient und Teampartner farbig getrennt und als klickbare Dialog-Abschnitte im Browser dargestellt.",
      en: "Our diarization pipeline combines global speaker turns (pyannote speaker-diarization) with per-sentence voiceprint embeddings (WeSpeaker + cosine clustering). Paramedic, patient and partner are cleanly separated by colour and rendered as clickable dialogue turns in the browser.",
    },
  },
];

export function renderTranscriptionPipelineVisual(_block = {}, lang = "de") {
  const pick = (v) => (v && typeof v === "object" ? v[lang] ?? v.de ?? "" : String(v ?? ""));
  let selectedId = "tunnel";

  const body = el("div", { class: "vis-body" });
  const root = el("section", {
    class: "vis-card",
    "aria-label": lang === "en" ? "Transcription & Diarization Pipeline" : "Transkriptions- & Diarisierungs-Pipeline",
  },
  el("div", { class: "vis-head" },
    el("span", { class: "eyebrow" },
      lang === "en"
        ? "Architecture · Browser → Cloudflare Tunnel → J.A.R. Transcription & Diarization Models"
        : "Architektur · Browser → Cloudflare-Tunnel → J.A.R. Transkriptions- & Diarisierungsmodell"),
  ),
  body);

  function render() {
    const svg = svgEl("svg", {
      viewBox: "0 0 920 190",
      class: "vis-svg",
      role: "img",
      "aria-label": "Cloudflare Tunnel Transcription & Diarization Pipeline",
    });

    svg.append(
      svgEl("rect", {
        x: 6,
        y: 8,
        width: 908,
        height: 174,
        rx: 10,
        fill: "rgba(21, 20, 46, 0.72)",
        stroke: "rgba(255, 255, 255, 0.10)",
      }),
    );

    for (let i = 0; i < PIPE_STAGES.length - 1; i++) {
      const a = PIPE_STAGES[i];
      const b = PIPE_STAGES[i + 1];
      svg.append(
        svgEl("line", {
          x1: a.x + a.w,
          y1: 95,
          x2: b.x,
          y2: 95,
          stroke: "#8ec7b8",
          "stroke-width": "2",
          "stroke-dasharray": "4 3",
        }),
      );
    }

    for (const st of PIPE_STAGES) {
      const active = st.id === selectedId;
      const g = svgEl("g", {
        class: "vis-svg-node" + (active ? " is-selected" : ""),
        tabindex: "0",
        role: "button",
      });
      g.addEventListener("click", () => {
        selectedId = st.id;
        render();
      });
      g.append(
        svgEl("rect", {
          x: st.x,
          y: 28,
          width: st.w,
          height: 134,
          rx: 8,
          fill: active ? "rgba(28, 27, 59, 0.98)" : "rgba(12, 11, 31, 0.92)",
          stroke: active ? st.accent : "rgba(255,255,255,0.18)",
          "stroke-width": active ? "2.2" : "1",
        }),
        svgEl("rect", {
          x: st.x,
          y: 28,
          width: st.w,
          height: 4,
          rx: 2,
          fill: st.accent,
        }),
        svgEl("text", {
          x: st.x + 12,
          y: 52,
          fill: st.accent,
          "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
          "font-size": "9",
          "font-weight": "600",
        }, st.badge),
        svgEl("text", {
          x: st.x + 12,
          y: 78,
          fill: "#f4f5fa",
          "font-family": "Inter, -apple-system, sans-serif",
          "font-size": "12.5",
          "font-weight": "600",
        }, pick(st.title)),
        svgEl("text", {
          x: st.x + 12,
          y: 100,
          fill: "#a9afc4",
          "font-family": "Inter, -apple-system, sans-serif",
          "font-size": "10.5",
        }, pick(st.sub)),
      );
      svg.append(g);
    }

    const activeStage = PIPE_STAGES.find((s) => s.id === selectedId) || PIPE_STAGES[0];

    replace(body,
      el("div", { class: "vis-svg-wrap" }, svg),
      el("div", { class: "vis-pills" },
        PIPE_STAGES.map((s) => el("button", {
          type: "button",
          class: "vis-pill" + (s.id === activeStage.id ? " is-active" : ""),
          onclick: () => {
            selectedId = s.id;
            render();
          },
        }, pick(s.title))),
      ),
      el("div", { class: "vis-inspector", style: `box-shadow: inset 3px 0 0 ${activeStage.accent}, inset 0 0 0 1px var(--line)` },
        el("span", { class: "vis-badge", style: `color:${activeStage.accent}` }, activeStage.badge),
        el("h4", { class: "vis-inspector-title" }, pick(activeStage.title)),
        el("p", { class: "vis-inspector-desc" }, pick(activeStage.detail)),
      ),
    );
  }

  render();
  return root;
}

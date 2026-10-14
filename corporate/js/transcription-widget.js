// Minimal voice recorder + speaker diarization view for "JAR Transcription Demo",
// styled after the website's Contribute recording page (mitmachen-aufnahme.html).
// Built exclusively with DOM nodes via el()/replace() from ./ui.js (never innerHTML).
import { el, replace } from "./ui.js";

const DEFAULT_SERVER = "http://127.0.0.1:8765";
const SVG_NS = "http://www.w3.org/2000/svg";
const TARGET_RATE = 16000;

const SPEAKER_COLORS = [
  "#8ec7b8", // --brand-mint (Speaker 1)
  "#f0b45c", // --sig-amber  (Speaker 2)
  "#7aa8f8", // Sky blue     (Speaker 3)
  "#f0776e", // --sig-red    (Speaker 4)
  "#c49bff", // Lavender     (Speaker 5)
];

const COPY = {
  de: {
    start: "Aufnahme starten",
    starting: "Mikrofon wird geöffnet …",
    stop: "Aufnahme beenden",
    processing: "Wird transkribiert & diarisiert …",
    placeholder: "Drücken Sie auf „Aufnahme starten“, sprechen Sie in das Mikrofon und beenden Sie die Aufnahme. Das nach Sprechern getrennte Transkript erscheint direkt hier.",
    recHint: "Aufnahme läuft. Sprechen Sie jetzt und tippen Sie danach erneut auf den Knopf.",
    doneStatus: "Transkription und Sprecher-Diarisierung abgeschlossen.",
    noSpeech: "Keine Sprache erkannt. Bitte noch einmal aufnehmen.",
    tooShort: "Aufnahme zu kurz. Bitte mindestens eine Sekunde sprechen.",
    micDenied: "Kein Zugriff auf das Mikrofon. Bitte in den Browser-Einstellungen erlauben.",
    serverErr: "Der lokale WhisperX-Server (127.0.0.1:8765) antwortet nicht.",
    speakersLegend: "Anzahl der sprechenden Personen",
    spkAuto: "Automatisch erkennen",
    spk1: "1 Person",
    spk2: "2 Personen",
    spk3: "3 Personen",
    spk4: "4 Personen",
    spk5: "5 Personen",
    speakerName: "Sprecher",
    stage_load_audio: "Audio wird geladen …",
    stage_load_model: "Sprachmodell wird geladen …",
    stage_transcribe: "Sprache wird transkribiert …",
    stage_align: "Wort-Zeitstempel werden berechnet …",
    stage_diarize: "Sprecher werden getrennt …",
  },
  en: {
    start: "Start recording",
    starting: "Opening microphone …",
    stop: "Stop recording",
    processing: "Transcribing & diarizing …",
    placeholder: "Press “Start recording”, speak into the microphone, and stop the recording. The speaker-diarized transcript will appear right here.",
    recHint: "Recording in progress. Speak now, then tap the button again to finish.",
    doneStatus: "Transcription and speaker diarization complete.",
    noSpeech: "No speech detected. Please record again.",
    tooShort: "Recording too short. Please speak for at least one second.",
    micDenied: "Microphone access denied. Please allow microphone access in your browser.",
    serverErr: "Local WhisperX server (127.0.0.1:8765) is not responding.",
    speakersLegend: "Number of people speaking",
    spkAuto: "Detect automatically",
    spk1: "1 person",
    spk2: "2 people",
    spk3: "3 people",
    spk4: "4 people",
    spk5: "5 people",
    speakerName: "Speaker",
    stage_load_audio: "Loading audio …",
    stage_load_model: "Loading speech model …",
    stage_transcribe: "Transcribing speech …",
    stage_align: "Aligning word timestamps …",
    stage_diarize: "Separating speakers …",
  },
};

function micSvg() {
  const svg = document.createElementNS(SVG_NS, "svg");
  for (const [k, v] of Object.entries({
    viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round",
  })) svg.setAttribute(k, v);
  const rect = document.createElementNS(SVG_NS, "rect");
  for (const [k, v] of Object.entries({ x: "9", y: "3", width: "6", height: "11", rx: "3" })) rect.setAttribute(k, v);
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", "M5 11a7 7 0 0 0 14 0M12 18v3");
  svg.append(rect, path);
  return svg;
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

// Encode Float32 PCM samples as a 16-bit mono WAV Blob (same approach as mitmachen-aufnahme.html).
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

export function renderTranscriptionDemo(_block, lang = "de") {
  const L = COPY[lang === "en" ? "en" : "de"];

  let apiBase = DEFAULT_SERVER;
  let rec = null;
  let lastAudioBlob = null;
  let pollTimer = null;
  const audioPlayer = el("audio", { hidden: true });

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

  const speakerSelect = el("select", { "aria-label": L.speakersLegend },
    el("option", { value: "auto" }, L.spkAuto),
    el("option", { value: "1" }, L.spk1),
    el("option", { value: "2", selected: true }, L.spk2),
    el("option", { value: "3" }, L.spk3),
    el("option", { value: "4" }, L.spk4),
    el("option", { value: "5" }, L.spk5),
  );

  const speakersBox = el("fieldset", { class: "rec__about" },
    el("label", { class: "rec__field" },
      el("span", {}, L.speakersLegend),
      speakerSelect,
    ),
  );

  const outputBox = el("figure", { class: "rec__prompt" },
    el("p", { class: "rec__say rec__placeholder" }, L.placeholder),
  );

  const statusEl = el("p", { class: "rec__status", role: "status", "aria-live": "polite" });

  const root = el("section", { class: "rec", dataset: { state: "idle" } },
    speakersBox,
    recBtn,
    meterEl,
    outputBox,
    statusEl,
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

  function releaseRecorder(r) {
    if (!r) return;
    clearInterval(r.timer);
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
    setStatus("");
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    if (ctx.resume) ctx.resume();
    let r = null;

    navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: true },
    }).then((stream) => {
      r = { stream, ctx, chunks: [], length: 0, level: 0, started: Date.now(), timer: 0 };
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
    releaseRecorder(r);
    clockEl.textContent = "0:00";

    if (seconds < 0.8) {
      setState("idle");
      setStatus(L.tooShort, "warn");
      return;
    }

    const samples = decimate(data, rate);
    lastAudioBlob = encodeWav(samples, TARGET_RATE);
    submitJob(lastAudioBlob);
  }

  async function submitJob(wavBlob) {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    setState("sending");
    setStatus(L.processing);

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
      const res = await fetch(`${apiBase}/api/jobs`, { method: "POST", body: fd });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const err = await res.json();
          if (err?.detail) detail = String(err.detail);
        } catch { /* ignore */ }
        throw new Error(detail);
      }
      const { job_id: jobId } = await res.json();
      await pollJob(jobId);
      if (root.dataset.state === "sending") {
        pollTimer = setInterval(() => pollJob(jobId), 500);
      }
    } catch (err) {
      setState("idle");
      setStatus(err.message || L.serverErr, "error");
    }
  }

  async function pollJob(jobId) {
    try {
      const res = await fetch(`${apiBase}/api/jobs/${jobId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const job = await res.json();

      if (job.stage && L["stage_" + job.stage]) {
        setStatus(L["stage_" + job.stage]);
      }

      if (job.status === "done") {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        setState("idle");
        audioPlayer.src = `${apiBase}/api/jobs/${job.id}/audio`;
        renderDiarizedOutput(job);
      } else if (job.status === "error") {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        setState("idle");
        setStatus(job.error || L.serverErr, "error");
      }
    } catch {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      setState("idle");
      setStatus(L.serverErr, "error");
    }
  }

  function renderDiarizedOutput(job) {
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
      const label = `${L.speakerName} ${idx + 1}`;
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

    replace(outputBox, turnNodes);
    setStatus(L.doneStatus, "ok");
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

  // Discover same-origin server if hosted together, otherwise use 127.0.0.1:8765
  (async () => {
    if (typeof location !== "undefined" && /^https?:/.test(location.protocol)) {
      try {
        const r = await fetch(`${location.origin}/api/info`);
        if (r.ok) {
          const info = await r.json();
          if (info?.whisperx_version) apiBase = location.origin;
        }
      } catch { /* use DEFAULT_SERVER */ }
    }
  })();

  return root;
}

import { emit } from "./events.js";
import { apiBase, apiBaseConfigured, apiOrigin, invalidateApiBase, resolveApiBase } from "./api.js";

const TARGET_RATE = 16000;
const MAX_SECONDS = 25;
const MIN_SPEECH_SECONDS = 0.8;
const SILENCE_RMS = 0.01;

export class SpeechClient {
  constructor(baseUrl = null) {
    // null => resolve from window.MEDICRAFT_API_BASE (static hosting) at call time.
    this.baseUrl = baseUrl;
    this.recording = false;
    this.transcribing = false;
    this._chunks = [];
    this._ctx = null;
    this._stream = null;
    this._source = null;
    this._node = null;
    this._gain = null;
    this._autoTimer = null;
    this._recordingToken = 0;
    this._ctxSampleRate = TARGET_RATE;
    this._rate = TARGET_RATE;
    this._recordingContext = {};
    this.lastAudioBlob = null;
    this.lastAudioInfo = null;
  }

  // The base this client actually calls: an explicit constructor argument wins,
  // otherwise whatever config.js set.
  _base() {
    return this.baseUrl ?? apiBase();
  }

  // A misconfigured static deployment and a backend that is genuinely down look
  // identical from a failed fetch. Say which one it was: the first is a missing
  // config.js entry, the second is a server to restart.
  _backendFailureDetail(status = null) {
    const base = this._base();
    const origin = base || apiOrigin();
    if (!base && !apiBaseConfigured() && typeof location !== "undefined" && location.protocol !== "file:") {
      return `Kein Backend konfiguriert — /api/* geht an ${origin}, das keine API hat.`
        + " In config.js muss window.MEDICRAFT_API_BASE auf den Medicraft-Server zeigen.";
    }
    if (status) return `Backend ${origin} antwortet mit HTTP ${status}.`;
    return `Backend ${origin} nicht erreichbar.`;
  }

  async checkHealth() {
    // Re-probe the configured list every time the badge is refreshed, so a
    // backend that came back up is picked up without a page reload.
    if (this.baseUrl === null) await resolveApiBase({ force: true }).catch(() => {});
    try {
      const res = await fetch(`${this._base()}/api/health`);
      // A static host answers /api/health with its own 404 page, so a non-OK
      // response here is a deployment problem, not an STT problem.
      if (!res.ok) {
        emit("stt:status", { state: "unavailable", detail: this._backendFailureDetail(res.status) });
        return false;
      }
      const data = await res.json();
      const ready = data.stt === "ready";
      const state = ready ? "ready" : data.stt || "unavailable";
      const detail = data.detail || (ready ? data.upstream : data.stt) || "unbekannter Status";
      emit("stt:status", { state, detail });
      return ready;
    } catch (err) {
      emit("stt:status", { state: "unavailable", detail: this._backendFailureDetail() });
      return false;
    }
  }

  async startRecording(context = {}) {
    if (this.recording || this.transcribing) {
      // A finished take owns the client until its upload returns. Re-emitting
      // the state repairs any newly opened chart that optimistically changed
      // its record button before it learned that the client was still busy.
      emit("stt:status", { state: this.transcribing ? "transcribing" : "recording" });
      return;
    }
    this._recordingContext = {
      expectedText: String(context.expectedText || "").trim(),
      scenarioId: String(context.scenarioId || "").trim(),
      patientId: String(context.patientId || "").trim(),
      contributionMode: Boolean(context.contributionMode),
      contributionSessionId: String(context.contributionSessionId || "").trim(),
      contributorId: String(context.contributorId || "").trim(),
      consentVersion: String(context.consentVersion || "").trim(),
      promptId: String(context.promptId || "").trim(),
      taskType: String(context.taskType || "").trim(),
      requiredConcepts: Array.isArray(context.requiredConcepts) ? context.requiredConcepts : [],
      idempotencyKey: String(context.idempotencyKey || "").trim(),
      calibration: Boolean(context.calibration),
    };
    const token = ++this._recordingToken;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // Browsers hide mediaDevices entirely outside a secure context, so the
      // hosted game over plain http — and the LAN/phone URL the README prints —
      // lands here and looks like an unsupported browser. Name the real cause.
      const insecure = window.isSecureContext === false;
      const message = insecure
        ? `Mikrofon braucht HTTPS. Diese Seite läuft über ${location.protocol}//${location.host} — `
          + "öffne sie über https:// oder http://localhost. Der getippte Bericht funktioniert weiterhin."
        : "Kein Mikrofon-Zugriff möglich (Browser-API fehlt).";
      emit("stt:error", { message, context: { ...this._recordingContext } });
      emit("stt:status", { state: "error", detail: message });
      return;
    }
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch (err) {
      if (token !== this._recordingToken) return;
      if (stream) {
        for (const track of stream.getTracks()) track.stop();
      }
      const name = String(err?.name || "");
      const message = name === "NotAllowedError" || name === "SecurityError"
        ? "Mikrofonzugriff blockiert — erlaube das Mikrofon für diese Seite."
        : name === "NotFoundError"
          ? "Kein Mikrofon gefunden."
          : "Mikrofon konnte nicht geöffnet werden.";
      emit("stt:error", { message, context: { ...this._recordingContext } });
      emit("stt:status", { state: "error", detail: message });
      return;
    }
    let ctx;
    try {
      ctx = new AudioContext({ sampleRate: TARGET_RATE });
    } catch (err) {
      try {
        ctx = new AudioContext();
      } catch (fallbackErr) {
        if (stream) {
          for (const track of stream.getTracks()) track.stop();
        }
        if (token !== this._recordingToken) return;
        const message = "Audioaufnahme wird von diesem Browser nicht unterstützt.";
        emit("stt:error", { message, context: { ...this._recordingContext } });
        emit("stt:status", { state: "error", detail: message });
        return;
      }
    }
    if (token !== this._recordingToken) {
      for (const track of stream.getTracks()) track.stop();
      await ctx.close().catch(() => {});
      return;
    }
    try {
      if (ctx.state === "suspended") await ctx.resume();
      if (token !== this._recordingToken) {
        for (const track of stream.getTracks()) track.stop();
        await ctx.close().catch(() => {});
        return;
      }
      this._ctxSampleRate = Number(ctx.sampleRate) || TARGET_RATE;
      const source = ctx.createMediaStreamSource(stream);
      const node = ctx.createScriptProcessor(4096, 1, 1);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      this._chunks = [];
      node.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        this._chunks.push(new Float32Array(input));
      };
      source.connect(node);
      node.connect(gain);
      gain.connect(ctx.destination);
      this._ctx = ctx;
      this._stream = stream;
      this._source = source;
      this._node = node;
      this._gain = gain;
      this.recording = true;
      emit("stt:status", { state: "recording" });
      this._autoTimer = setTimeout(() => {
        this.stopRecording().catch(() => {});
      }, MAX_SECONDS * 1000);
    } catch (err) {
      if (stream) {
        for (const track of stream.getTracks()) track.stop();
      }
      ctx.close?.().catch?.(() => {});
      if (token !== this._recordingToken) return;
      const message = "Audioaufnahme konnte nicht gestartet werden.";
      emit("stt:error", { message, context: { ...this._recordingContext } });
      emit("stt:status", { state: "error", detail: message });
    }
  }

  async stopRecording() {
    if (this.transcribing) return;
    if (!this.recording) {
      this._recordingToken++;
      this._recordingContext = {};
      emit("stt:status", { state: "idle" });
      return;
    }
    this._recordingToken++;
    this.recording = false;
    clearTimeout(this._autoTimer);
    this._teardown();
    const merged = this._mergeChunks();
    const rate = Number(this._rate) || TARGET_RATE;
    const kept = this._trimSilence(merged);
    const duration = kept.length / rate;
    if (!merged.length || !kept.length || duration < MIN_SPEECH_SECONDS) {
      const context = { ...this._recordingContext };
      this._recordingContext = {};
      emit("stt:error", { message: "Zu kurz oder keine Sprache erkannt — versuche es erneut.", context });
      emit("stt:status", { state: "idle" });
      return;
    }
    let samples = kept;
    if (rate !== TARGET_RATE) samples = this._downsample(kept, rate, TARGET_RATE);
    const blob = this._encodeWav(samples, TARGET_RATE);
    this.lastAudioBlob = blob;
    this.lastAudioInfo = {
      format: "audio/wav",
      sampleRate: TARGET_RATE,
      channels: 1,
      bytes: blob.size,
      durationSeconds: Number((samples.length / TARGET_RATE).toFixed(3)),
    };
    // Keep the routing data beside this particular WAV. The chart can close —
    // and its mutable currentPatientId can change — while fetch is in flight.
    const recordingContext = { ...this._recordingContext };
    const headers = { "Content-Type": "audio/wav" };
    const addEncodedHeader = (name, value) => {
      const clean = String(value || "").replace(/[\r\n]+/g, " ").trim();
      if (clean) headers[name] = encodeURIComponent(clean);
    };
    addEncodedHeader("X-Medicraft-Expected-Text", recordingContext.expectedText);
    addEncodedHeader("X-Medicraft-Scenario-ID", recordingContext.scenarioId);
    addEncodedHeader("X-Medicraft-Patient-ID", recordingContext.patientId);
    addEncodedHeader("X-Medicraft-Session-ID", recordingContext.contributionSessionId);
    addEncodedHeader("X-Medicraft-Prompt-ID", recordingContext.promptId);
    addEncodedHeader("X-Medicraft-Task-Type", recordingContext.taskType);
    addEncodedHeader("X-Medicraft-Required-Concepts", JSON.stringify(recordingContext.requiredConcepts));
    addEncodedHeader("Idempotency-Key", recordingContext.idempotencyKey);
    this.transcribing = true;
    emit("stt:status", { state: "transcribing", context: recordingContext });
    try {
      // A take is expensive to redo, so if the selected backend has gone away
      // between the health probe and now, fail over and send it once more
      // rather than losing the recording.
      const endpoint = recordingContext.contributionMode ? "/api/clips" : "/api/transcribe";
      const send = () => fetch(`${this._base()}${endpoint}`, {
        method: "POST",
        headers,
        body: blob,
        credentials: "include",
      });
      let res;
      try {
        res = await send();
      } catch (transportError) {
        if (this.baseUrl !== null) throw transportError;
        invalidateApiBase();
        const next = await resolveApiBase({ force: true });
        if (!next && next !== "") throw transportError;
        res = await send();
      }
      const data = await res.json().catch(() => null);
      if (res.ok && data && recordingContext.contributionMode) {
        const detail = {
          clipId: data.clip_id,
          promptId: data.prompt_id || recordingContext.promptId,
          taskType: data.task_type || recordingContext.taskType,
          validationState: data.validation_state,
          basicAccepted: Boolean(data.basic_accepted),
          qc: data.qc || {},
          audioBlob: blob,
          audioInfo: this.lastAudioInfo,
          context: recordingContext,
        };
        if (detail.basicAccepted) {
          emit("stt:clip-accepted", detail);
          this._pollContributionClip(detail.clipId, recordingContext).catch(() => {});
        } else {
          const reason = detail.qc?.reasons?.[0] || "Aufnahme erfüllt die Qualitätsprüfung nicht.";
          emit("stt:clip-rejected", { ...detail, reason });
          emit("stt:error", { message: `${reason} Bitte erneut aufnehmen.`, context: recordingContext, handled: true });
        }
      } else if (res.ok && data) {
        emit("stt:result", {
          text: data.text || "",
          seconds: data.processing_seconds ?? null,
          audioBlob: blob,
          audioInfo: this.lastAudioInfo,
          audioFile: data.audio_file || null,
          verbatim: data.verbatim || data.text || "",
          model: data.model || null,
          modelConfidence: data.model_confidence ?? data.confidence ?? null,
          wordConfidences: Array.isArray(data.word_confidences) ? data.word_confidences : [],
          context: recordingContext,
        });
      } else {
        // Without a JSON body this is not the backend answering — it is
        // whatever host the request actually reached, so say which one.
        emit("stt:error", {
          message: (data && data.detail) || this._backendFailureDetail(res.status),
          context: recordingContext,
        });
      }
    } catch (err) {
      emit("stt:error", { message: this._backendFailureDetail(), context: recordingContext });
    } finally {
      this.transcribing = false;
      this._recordingContext = {};
      emit("stt:status", { state: "idle" });
    }
  }

  async _pollContributionClip(clipId, context) {
    if (!clipId) return;
    const terminal = new Set(["training_ready", "review_required", "rejected", "deleted"]);
    for (let attempt = 0; attempt < 120; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, attempt < 4 ? 750 : 1500));
      let response;
      try {
        response = await fetch(`${this._base()}/api/clips/${encodeURIComponent(clipId)}`, {
          credentials: "include",
          cache: "no-store",
        });
      } catch (error) {
        continue;
      }
      if (!response.ok) return;
      const data = await response.json().catch(() => null);
      if (!data) continue;
      emit("stt:clip-status", {
        clipId,
        validationState: data.validation_state,
        trainingReady: Boolean(data.training_ready),
        contributionUnits: Number(data.contribution_units) || 0,
        qualityScore: Number(data.quality_score) || 0,
        context,
      });
      if (!terminal.has(data.validation_state)) continue;
      emit("stt:result", {
        text: data.transcript || "",
        seconds: null,
        audioBlob: null,
        audioInfo: null,
        audioFile: null,
        verbatim: data.transcript || "",
        model: data.model || null,
        modelConfidence: data.confidence ?? null,
        wordConfidences: [],
        contribution: data,
        context,
      });
      return;
    }
  }

  abort() {
    this._recordingToken++;
    this._recordingContext = {};
    if (!this.recording) return;
    this.recording = false;
    clearTimeout(this._autoTimer);
    this._teardown();
    this._chunks = [];
    emit("stt:status", { state: "idle" });
  }

  _teardown() {
    if (this._node) {
      this._node.onaudioprocess = null;
      this._node.disconnect();
    }
    if (this._source) this._source.disconnect();
    if (this._gain) this._gain.disconnect();
    if (this._stream) {
      for (const track of this._stream.getTracks()) track.stop();
    }
    if (this._ctx) this._ctx.close().catch(() => {});
    this._ctx = null;
    this._stream = null;
    this._source = null;
    this._node = null;
    this._gain = null;
  }

  _mergeChunks() {
    const total = this._chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Float32Array(total);
    let offset = 0;
    for (const chunk of this._chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    this._chunks = [];
    this._rate = this._ctxSampleRate;
    return merged;
  }

  _trimSilence(samples) {
    const chunkSize = 1024;
    let start = 0;
    let end = samples.length;
    while (start < end) {
      let sum = 0;
      const chunkEnd = Math.min(start + chunkSize, end);
      const count = Math.max(1, chunkEnd - start);
      for (let i = start; i < chunkEnd; i++) sum += samples[i] * samples[i];
      if (Math.sqrt(sum / count) >= SILENCE_RMS) break;
      start = chunkEnd;
    }
    while (end > start) {
      let sum = 0;
      const chunkStart = Math.max(start, end - chunkSize);
      const count = Math.max(1, end - chunkStart);
      for (let i = chunkStart; i < end; i++) sum += samples[i] * samples[i];
      if (Math.sqrt(sum / count) >= SILENCE_RMS) break;
      end = chunkStart;
    }
    return samples.slice(start, end);
  }

  _downsample(samples, fromRate, toRate) {
    const ratio = fromRate / toRate;
    const outLength = Math.floor(samples.length / ratio);
    const out = new Float32Array(outLength);
    for (let i = 0; i < outLength; i++) {
      const srcIndex = i * ratio;
      const i0 = Math.floor(srcIndex);
      const frac = srcIndex - i0;
      const s0 = samples[i0] || 0;
      const s1 = samples[Math.min(i0 + 1, samples.length - 1)] || 0;
      out[i] = s0 + (s1 - s0) * frac;
    }
    return out;
  }

  _encodeWav(samples, rate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const writeString = (offset, str) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeString(0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, samples.length * 2, true);
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const clamped = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      offset += 2;
    }
    return new Blob([view], { type: "audio/wav" });
  }
}

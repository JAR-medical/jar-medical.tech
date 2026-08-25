import { emit } from "./events.js";
import { apiBase, apiBaseConfigured, apiOrigin, invalidateApiBase, resolveApiBase } from "./api.js";

const TARGET_RATE = 16000;
const MAX_SECONDS = 90;
const MIN_SPEECH_SECONDS = 0.8;
const SILENCE_RMS = 0.01;
// A recorded take cannot be re-recorded from the player's side once the
// microphone is closed, so a busy or restarting backend is worth waiting out
// rather than throwing the WAV away. Every retry re-sends the same idempotency
// key, so nothing here can turn one take into two clips.
const UPLOAD_MAX_ATTEMPTS = 4;
const UPLOAD_RETRY_BASE_MS = 800;
const UPLOAD_MAX_DELAY_MS = 10_000;
// Enough to cover a failover plus one genuinely dead session; past that the
// problem is not the session and minting more would only shed the identity.
const MAX_SESSION_RENEWALS = 2;
// Validation runs on a GPU that is shared, queued, and occasionally offline.
// The clip is already durable on the server by this point, so this deadline
// only decides how long the chart waits before letting the player move on.
const CLIP_POLL_TIMEOUT_MS = 5 * 60 * 1000;
const CLIP_POLL_FAST_ATTEMPTS = 4;
const CLIP_POLL_FAST_MS = 750;
const CLIP_POLL_SLOW_MS = 1500;
const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isTransientStatus(status) {
  return TRANSIENT_STATUSES.has(Number(status));
}

function retryAfterMs(response) {
  const header = response?.headers?.get?.("Retry-After");
  if (!header) return 0;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, Math.min(30, seconds)) * 1000;
  const when = Date.parse(header);
  return Number.isFinite(when) ? Math.max(0, Math.min(30_000, when - Date.now())) : 0;
}

function uploadBackoffMs(attempt, floorMs = 0) {
  const exponential = Math.min(UPLOAD_MAX_DELAY_MS, UPLOAD_RETRY_BASE_MS * 2 ** attempt);
  // Jitter, so a class that all stopped recording on the same server hiccup
  // does not all come back in the same millisecond.
  return Math.max(floorMs, exponential * (0.7 + Math.random() * 0.6));
}

function isContributionSessionFailure(status, detail) {
  if (status === 401) return true;
  if (status !== 403) return false;
  const text = String(detail || "").toLowerCase();
  return /beitrag|sitzung|session|zustimmung|consent|auth/.test(text);
}

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
    this._refreshContributionSession = null;
  }

  // The base this client actually calls: an explicit constructor argument wins,
  // otherwise whatever config.js set.
  _base() {
    return this.baseUrl ?? apiBase();
  }

  setContributionSessionRefresher(callback) {
    this._refreshContributionSession = typeof callback === "function" ? callback : null;
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
      // Which backend issued the session below. Kept so the upload can notice
      // that failover moved the game since this take began.
      ...(typeof context.apiBase === "string" ? { apiBase: context.apiBase } : {}),
      contributionSessionId: String(context.contributionSessionId || "").trim(),
      contributorId: String(context.contributorId || "").trim(),
      contributorToken: String(context.contributorToken || "").trim(),
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
    let recordingContext = { ...this._recordingContext };
    const buildHeaders = (context) => {
      const headers = { "Content-Type": "audio/wav" };
      const addEncodedHeader = (name, value) => {
      const clean = String(value || "").replace(/[\r\n]+/g, " ").trim();
      if (clean) headers[name] = encodeURIComponent(clean);
      };
      addEncodedHeader("X-Medicraft-Expected-Text", context.expectedText);
      addEncodedHeader("X-Medicraft-Scenario-ID", context.scenarioId);
      addEncodedHeader("X-Medicraft-Patient-ID", context.patientId);
      addEncodedHeader("X-Medicraft-Session-ID", context.contributionSessionId);
      if (context.contributorToken) {
        headers["X-Medicraft-Contributor-Token"] = context.contributorToken;
      }
      addEncodedHeader("X-Medicraft-Prompt-ID", context.promptId);
      addEncodedHeader("X-Medicraft-Task-Type", context.taskType);
      addEncodedHeader("X-Medicraft-Required-Concepts", JSON.stringify(context.requiredConcepts));
      addEncodedHeader("Idempotency-Key", context.idempotencyKey);
      return headers;
    };
    this.transcribing = true;
    emit("stt:status", { state: "transcribing", context: recordingContext });
    try {
      const endpoint = recordingContext.contributionMode ? "/api/clips" : "/api/transcribe";
      let headers = buildHeaders(recordingContext);
      const send = () => fetch(`${this._base()}${endpoint}`, {
        method: "POST",
        headers,
        body: blob,
        credentials: "include",
      });

      // Renew the consent-backed session and re-aim this exact WAV at it. The
      // idempotency key is deliberately left alone, so a first response that
      // arrives late cannot turn one take into two clips.
      let renewals = 0;
      const renewSession = async (detail) => {
        if (!this._refreshContributionSession || renewals >= MAX_SESSION_RENEWALS) return false;
        renewals += 1;
        let refreshed = null;
        try {
          refreshed = await this._refreshContributionSession(recordingContext);
        } catch {
          return false;
        }
        if (!refreshed?.sessionId) return false;
        recordingContext = {
          ...recordingContext,
          contributionSessionId: refreshed.sessionId,
          contributorId: refreshed.contributorId || recordingContext.contributorId,
          contributorToken: refreshed.contributorToken || recordingContext.contributorToken,
          apiBase: refreshed.apiBase ?? this._base(),
        };
        headers = buildHeaders(recordingContext);
        emit("stt:status", {
          state: "transcribing",
          detail: detail || "Beitragssitzung wird erneuert …",
          context: recordingContext,
        });
        return true;
      };

      let res = null;
      let data = null;
      for (let attempt = 0; attempt < UPLOAD_MAX_ATTEMPTS; attempt++) {
        // A session id and its contributor token belong to one backend. If
        // failover moved the game since this take started, mint a session on
        // the host we are about to post to rather than sending an id it has
        // never seen and collecting a guaranteed 403.
        if (
          recordingContext.contributionMode &&
          typeof recordingContext.apiBase === "string" &&
          recordingContext.apiBase !== this._base()
        ) {
          await renewSession("Backend gewechselt — Beitragssitzung wird erneuert …");
        }
        try {
          res = await send();
        } catch (transportError) {
          // A take is expensive to redo, so if the selected backend has gone
          // away between the health probe and now, re-probe and try again
          // rather than losing the recording.
          res = null;
          // An earlier attempt's error body must not be reported as this one's.
          data = null;
          if (this.baseUrl === null) {
            invalidateApiBase();
            await resolveApiBase({ force: true }).catch(() => {});
          }
          if (attempt + 1 >= UPLOAD_MAX_ATTEMPTS) break;
          await sleep(uploadBackoffMs(attempt));
          continue;
        }
        data = await res.json().catch(() => null);
        if (res.ok) break;
        if (
          recordingContext.contributionMode &&
          isContributionSessionFailure(res.status, data?.detail) &&
          await renewSession()
        ) {
          // Renewal does not count against the transport retry budget: the
          // request was answered, it was just answered by a host that had
          // forgotten us.
          attempt -= 1;
          continue;
        }
        if (!isTransientStatus(res.status) || attempt + 1 >= UPLOAD_MAX_ATTEMPTS) break;
        await sleep(uploadBackoffMs(attempt, retryAfterMs(res)));
      }

      if (res && res.ok && data && recordingContext.contributionMode) {
        // The backend mints a replacement shift when the one presented is
        // unknown, and names it in the response. Pass it back so the rest of
        // the mission stops presenting an id that no longer exists.
        const detail = {
          clipId: data.clip_id,
          sessionId: data.session_id || recordingContext.contributionSessionId,
          promptId: data.prompt_id || recordingContext.promptId,
          taskType: data.task_type || recordingContext.taskType,
          validationState: data.validation_state,
          basicAccepted: Boolean(data.basic_accepted),
          qc: data.qc || {},
          audioBlob: blob,
          audioInfo: this.lastAudioInfo,
          context: recordingContext,
        };
        if (data.session_id) {
          recordingContext = { ...recordingContext, contributionSessionId: data.session_id };
          detail.context = recordingContext;
        }
        if (detail.basicAccepted) {
          emit("stt:clip-accepted", detail);
          this._pollContributionClip(detail.clipId, recordingContext).catch(() => {});
        } else {
          const reason = detail.qc?.reasons?.[0] || "Aufnahme erfüllt die Qualitätsprüfung nicht.";
          emit("stt:clip-rejected", { ...detail, reason });
          emit("stt:error", { message: `${reason} Bitte erneut aufnehmen.`, context: recordingContext, handled: true });
        }
      } else if (res && res.ok && data) {
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
        // whatever host the request actually reached, so say which one. A run
        // that never got a response at all is a transport failure, and the
        // retries above have already exhausted themselves against it.
        emit("stt:error", {
          message: (data && data.detail) || this._backendFailureDetail(res?.status ?? null),
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

  // Watch a durable clip until the backend has validated it.
  //
  // The clip is already stored and consented at this point, so nothing here can
  // lose a take — but the chart is showing a spinner against this call, so it
  // must always end in an event. It used to give up silently on the first
  // non-OK response, which left the spinner on forever whenever the backend was
  // briefly busy, and on every single poll wherever the browser refuses the
  // cross-site cookie: the pseudonymous token that exists for exactly that case
  // was not being sent.
  async _pollContributionClip(clipId, context) {
    if (!clipId) return;
    const terminal = new Set(["training_ready", "review_required", "rejected", "deleted"]);
    const deadline = Date.now() + CLIP_POLL_TIMEOUT_MS;
    let poll = { ...context };
    let attempt = 0;
    let renewals = 0;
    let lastState = null;
    // A wall clock, not an attempt count: a backgrounded tab has its timers
    // throttled to about one a minute, and counting attempts there would give
    // up hours later instead of five minutes later.
    while (Date.now() < deadline) {
      await sleep(attempt < CLIP_POLL_FAST_ATTEMPTS ? CLIP_POLL_FAST_MS : CLIP_POLL_SLOW_MS);
      attempt += 1;
      let response;
      try {
        response = await fetch(`${this._base()}/api/clips/${encodeURIComponent(clipId)}`, {
          credentials: "include",
          cache: "no-store",
          headers: poll.contributorToken
            ? { "X-Medicraft-Contributor-Token": poll.contributorToken }
            : {},
        });
      } catch (error) {
        continue;
      }
      // The clip belongs to a contributor this backend does not have — almost
      // always because failover moved us to the other host mid-validation.
      // There is nothing to wait for here.
      if (response.status === 404) break;
      if (response.status === 401 || response.status === 403) {
        if (renewals >= MAX_SESSION_RENEWALS || !this._refreshContributionSession) break;
        renewals += 1;
        let refreshed = null;
        try {
          refreshed = await this._refreshContributionSession(poll);
        } catch {
          break;
        }
        if (!refreshed?.contributorToken || refreshed.contributorToken === poll.contributorToken) break;
        poll = {
          ...poll,
          contributorToken: refreshed.contributorToken,
          contributorId: refreshed.contributorId || poll.contributorId,
        };
        continue;
      }
      // Anything else non-OK is the backend being busy or restarting. Keep
      // waiting — the deadline is what ends this loop.
      if (!response.ok) continue;
      const data = await response.json().catch(() => null);
      if (!data) continue;
      lastState = data.validation_state || lastState;
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
    // No verdict inside the deadline. The recording is safe on the server and
    // will still be validated; the chart just must not keep waiting on it.
    emit("stt:clip-pending", { clipId, validationState: lastState, context });
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

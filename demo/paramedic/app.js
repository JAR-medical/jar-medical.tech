(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const shell = $("game-shell");
  const viewport = $("scene-viewport");
  const world = $("scene-world");
  const API_BASE = (window.JAR_API_BASE || "https://jar-voice-api.alexanderh2seo4.workers.dev").replace(/\/$/, "");
  const state = {
    authenticated: false, csrf: null, recording: false, processing: false,
    recorder: null, stream: null, chunks: [], transcript: "", voiceGood: false,
    patientFocused: false, findings: { breathing: false, pulse: false },
    cardsGiven: {}, completed: false, lookX: 0, lookY: 0, moveX: 0, moveY: 0,
    drag: null, cardboard: false, xr: null
  };
  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  // Resolve the current tunnel target before API calls. The worker currently
  // redirects API traffic, and browsers reject that redirect for credentialed
  // cross-origin requests. The target is cached briefly and re-resolved after
  // a transient failure so a restarted tunnel recovers automatically.
  const API_TARGET_CACHE_MS = 30000;
  const API_RESOLVE_TIMEOUT_MS = 12000;
  let resolvedApiBase = null;
  let resolvedApiAt = 0;
  let apiBasePromise = null;

  function resetApiBase() {
    if (window.JAR_API_BASE) return;
    resolvedApiBase = null;
    resolvedApiAt = 0;
    apiBasePromise = null;
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = API_RESOLVE_TIMEOUT_MS) {
    const controller = typeof AbortController === "undefined" ? null : new AbortController();
    let timeoutId = null;
    try {
      const request = { ...options };
      if (controller) {
        request.signal = controller.signal;
        timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
      }
      return await fetch(url, request);
    } catch (error) {
      if (controller?.signal.aborted) {
        const timeoutError = new Error("The Modell-PC request timed out.");
        timeoutError.name = "TypeError";
        timeoutError.transient = true;
        throw timeoutError;
      }
      throw error;
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
    }
  }

  async function resolveApiBase() {
    const response = await fetchWithTimeout(
      API_BASE + "/__target?refresh=" + Date.now(),
      { credentials: "omit", cache: "no-store" }
    );
    if (!response.ok) {
      const error = new Error("Tunnel target HTTP " + response.status);
      error.status = response.status;
      error.transient = true;
      throw error;
    }
    let body;
    try {
      body = await response.json();
    } catch (_) {
      const error = new Error("Tunnel target response was invalid.");
      error.transient = true;
      throw error;
    }
    if (!body?.base_url) {
      const error = new Error("Tunnel target unavailable.");
      error.transient = true;
      throw error;
    }
    const candidate = new URL(body.base_url);
    const workerHost = new URL(API_BASE).hostname;
    const allowedTarget = candidate.protocol === "https:" &&
      (candidate.hostname.endsWith(".trycloudflare.com") ||
       candidate.hostname === "api.jar-medical.tech" ||
       candidate.hostname === workerHost);
    if (!allowedTarget) throw new Error("Invalid tunnel target.");
    const health = await fetchWithTimeout(
      candidate.origin + "/v1/health?probe=" + Date.now(),
      { credentials: "omit", cache: "no-store" }
    );
    if (!health.ok) {
      const error = new Error("Tunnel health HTTP " + health.status);
      error.status = health.status;
      error.transient = true;
      throw error;
    }
    return candidate.origin;
  }

  async function getApiBase(force = false) {
    if (window.JAR_API_BASE) return API_BASE;
    if (force) resetApiBase();
    if (resolvedApiBase && Date.now() - resolvedApiAt < API_TARGET_CACHE_MS) {
      return resolvedApiBase;
    }
    if (!apiBasePromise) {
      const pending = (async () => {
        const base = await resolveApiBase();
        resolvedApiBase = base;
        resolvedApiAt = Date.now();
        return base;
      })();
      apiBasePromise = pending;
      pending.catch(() => {
        if (apiBasePromise === pending) apiBasePromise = null;
      });
    }
    return apiBasePromise;
  }
  function isTransientApiError(error) {
    return Boolean(error?.transient || [502, 503, 504].includes(error?.status) ||
      (!error?.status && (error?.name === "TypeError" || error?.message === "Failed to fetch")));
  }
  async function apiRequest(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const init = { cache: "no-store", ...options, headers, credentials: "include" };
    let lastError = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const base = await getApiBase();
        const response = await fetch(`${base}${path}`, init);
        let body = null;
        try { body = await response.json(); } catch (_) {}
        if (!response.ok) {
          const detail = body?.detail;
          const message = typeof detail === "string" ? detail : detail?.message || `HTTP ${response.status}`;
          const error = new Error(message);
          error.status = response.status; error.body = body;
          error.transient = [502, 503, 504].includes(response.status);
          if (response.status === 401) setAuthState(false, "Anmeldung erforderlich");
          throw error;
        }
        return body;
      } catch (error) {
        lastError = error;
        if (!isTransientApiError(error) || attempt === 3) throw error;
        resetApiBase();
        await sleep(500 * (2 ** attempt));
      }
    }
    throw lastError || new Error("Verbindung zum Modell-PC fehlgeschlagen.");
  }

  function setConnection(text, status = "") {
    const node = $("connection-state");
    node.textContent = text;
    node.className = `connection-state ${status}`.trim();
  }
  function setAuthState(authenticated, message = null, csrf = null) {
    state.authenticated = authenticated;
    if (csrf) state.csrf = csrf;
    $("auth-dot").className = `auth-dot${authenticated ? " ready" : ""}`;
    $("voice-button").disabled = !authenticated || state.processing;
    if (message) $("auth-status").textContent = message;
    $("login-form").hidden = authenticated;
    if (authenticated) $("auth-status").textContent = "Verbunden. Deine Stimme bleibt im lokalen Modell-PC.";
  }
  async function loadSession() {
    try {
      const result = await apiRequest("/v1/auth/session");
      setAuthState(true, null, result.csrf_token); setConnection("Modell verbunden", "ready");
    } catch (error) {
      if (error.status === 401) {
        setAuthState(false, "Bitte das Modell-Passwort eingeben.");
        setConnection("Anmeldung erforderlich");
      } else {
        setAuthState(false, "Der lokale Modell-PC ist gerade nicht erreichbar.");
        setConnection("Modell offline", "error");
      }
    }
  }
  async function login(event) {
    event.preventDefault();
    const input = $("auth-password");
    const password = input.value.trim();
    if (!password) { $("auth-status").textContent = "Passwort fehlt."; return; }
    $("login-button").disabled = true;
    $("auth-status").textContent = "Verbinde mit dem lokalen Modell ...";
    try {
      const result = await apiRequest("/v1/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      input.value = ""; setAuthState(true, null, result.csrf_token);
      setConnection("Modell verbunden", "ready"); logEvent("Modellverbindung hergestellt.", "good");
    } catch (error) {
      setAuthState(false, error.message || "Anmeldung fehlgeschlagen.");
    } finally { $("login-button").disabled = false; }
  }

  function setCaption(text) { $("scene-caption").textContent = text; }
  function logEvent(text, tone = "") {
    const item = document.createElement("li");
    item.className = tone; item.textContent = text; $("event-log").prepend(item);
  }
  function updateObjectives() {
    const result = {
      breathing: state.findings.breathing, pulse: state.findings.pulse,
      voice: state.voiceGood, card: Boolean(state.cardsGiven.red || state.cardsGiven.oxygen)
    };
    Object.entries(result).forEach(([key, done]) => {
      document.querySelector(`[data-objective="${key}"]`)?.classList.toggle("done", done);
    });
    const count = Object.values(result).filter(Boolean).length;
    $("score-line").textContent = `${count} / 4 Ziele`;
    if (count === 4 && !state.completed) {
      state.completed = true;
      $("result-copy").textContent = "Das lokale Modell hat deine Einsatzmeldung verstanden. Die Prioritaetskarte passt zur Lage.";
      $("result-modal").hidden = false;
      logEvent("Szenario abgeschlossen - gute erste Lageeinschaetzung.", "good");
    }
  }
  function inspectPatient(kind) {
    state.patientFocused = true; $("patient-card").classList.add("focused");
    if (kind === "breathing" || kind === "all") {
      state.findings.breathing = true; $("vital-breathing").textContent = "28 / min";
      $("patient-note").textContent = "Schnelle, flache Atmung. Lea sagt: 'Ich bekomme schlecht Luft.'";
      $("observe-breathing").classList.add("used");
      logEvent("Atmung: schnell und flach; kurze Saetze.", "good");
      setCaption("Atemnot bestaetigt. Was sagt dein Lagebild?");
    }
    if (kind === "pulse" || kind === "all") {
      state.findings.pulse = true; $("vital-pulse").textContent = "118 / min";
      $("vital-skin").textContent = "blass / kalt";
      $("patient-note").textContent = "Tachykarder Puls, blasse kalte Haut, SpO2 89%.";
      $("observe-pulse").classList.add("used");
      logEvent("Puls: 118/min; Haut blass und kalt. SpO2 89%.", "warn");
      setCaption("Kreislauf ist belastet. Waehle eine Versorgungskarte.");
    }
    if (kind === "card") {
      $("patient-card").classList.add("revealed"); $("show-card").classList.add("used");
      logEvent("Patientenkarte geoeffnet: Lea M., 29 Jahre, ansprechbar.");
      setCaption("Patientenkarte bereit. Eine Karte kann gegeben werden.");
    }
    updateObjectives();
  }
  function giveCard(cardId) {
    if (!state.patientFocused) {
      setCaption("Erst die Patientin anklicken und untersuchen.");
      logEvent("Karte zurueckgehalten: Patientin noch nicht untersucht.", "warn"); return;
    }
    state.cardsGiven[cardId] = true;
    document.querySelector(`[data-card="${cardId}"]`)?.classList.add("given");
    const labels = { red: "ROTE Prioritaetskarte", oxygen: "O2-Atemhilfe-Karte", transport: "GELBE Transportkarte", observe: "GRUENE Beobachtungskarte" };
    $("card-count").textContent = `${Object.keys(state.cardsGiven).length} / 4 gegeben`;
    const correct = cardId === "red" || cardId === "oxygen";
    logEvent(`${labels[cardId]} gegeben - ${correct ? "passt zur Lage." : "pruefe die Prioritaet noch einmal."}`, correct ? "good" : "warn");
    setCaption(correct ? "Karte gegeben. Beobachte weiter." : "Diese Karte ist nicht die beste erste Prioritaet.");
    updateObjectives();
  }
  function interpretTranscript(text) {
    const normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const tags = [];
    if (/atemnot|kurzatmig|keine luft|schlecht luft|dyspnoe|luftnot/.test(normalized)) tags.push("Atemnot");
    if (/blass|kalt|schweiss|schock|kreislauf|schnell(er)? puls|tachykard/.test(normalized)) tags.push("Kreislaufbelastung");
    if (/rote karte|rot|prioritaet|sofort/.test(normalized)) tags.push("hohe Prioritaet");
    state.voiceGood = tags.includes("Atemnot") && (tags.includes("Kreislaufbelastung") || tags.includes("hohe Prioritaet"));
    const result = tags.length ? `Modell-Lagebild: ${tags.join(" + ")}.` : "Modell-Lagebild: keine passende Lagebeschreibung erkannt.";
    $("transcript-box").textContent = `${text || "Kein Text erkannt."} — ${result}`;
    $("transcript-box").className = `transcript-box ${tags.length ? "model" : "error"}`;
    $("record-state").textContent = state.voiceGood ? "Lagebild erkannt" : "erneut versuchen";
    logEvent(state.voiceGood ? `Voice-Lagebild erkannt: ${tags.join(", ")}.` : "Voice-Lagebild unvollstaendig.", state.voiceGood ? "good" : "warn");
    setCaption(state.voiceGood ? "Das Modell erkennt Atemnot mit Kreislaufbelastung." : "Sag Symptome und Prioritaet in einem kurzen Satz.");
    updateObjectives();
  }

  function recorderMimeType() {
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
    return types.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || "";
  }
  async function uploadAndTranscribe(file) {
    const json = (method, body) => ({
      method, headers: { "Content-Type": "application/json", "X-CSRF-Token": state.csrf || "" },
      body: JSON.stringify(body)
    });
    const created = await apiRequest("/v1/uploads", json("POST", {
      filename: file.name, size: file.size, mime_type: file.type || "application/octet-stream"
    }));
    const uploadId = created.upload_id;
    const chunkSize = Number(created.chunk_size) || 16 * 1024 * 1024;
    let offset = Number(created.next_offset) || 0;
    while (offset < file.size) {
      const endExclusive = Math.min(file.size, offset + chunkSize);
      const chunk = file.slice(offset, endExclusive);
      let uploaded = false; let lastError = null;
      for (let attempt = 0; attempt < 4 && !uploaded; attempt += 1) {
        try {
          const result = await apiRequest(`/v1/uploads/${encodeURIComponent(uploadId)}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/octet-stream",
              "Content-Range": `bytes ${offset}-${endExclusive - 1}/${file.size}`,
              "X-CSRF-Token": state.csrf || ""
            }, body: chunk
          });
          offset = Number(result.next_offset) || endExclusive; uploaded = true;
        } catch (error) {
          lastError = error;
          if (error.status === 409 && error.body?.detail?.next_offset != null) {
            offset = Number(error.body.detail.next_offset); uploaded = true; break;
          }
          if (isTransientApiError(error)) $("record-state").textContent = "Verbindung wird erneut aufgebaut ...";
          await sleep(700 * (attempt + 1));
        }
      }
      if (!uploaded) throw lastError || new Error("Upload fehlgeschlagen.");
    }
    const finalJob = await apiRequest(`/v1/uploads/${encodeURIComponent(uploadId)}/complete`, json("POST", {}));
    return pollJob(finalJob.job.job_id);
  }
  async function pollJob(jobId) {
    let reconnects = 0;
    for (;;) {
      try {
        const job = await apiRequest(`/v1/jobs/${encodeURIComponent(jobId)}`);
        reconnects = 0;
        if (job.status === "completed") return job;
        if (job.status === "error") throw new Error(job.error || "Transkription fehlgeschlagen.");
        $("record-state").textContent = `Modell verarbeitet ${Math.round((Number(job.progress) || 0) * 100)}%`;
      } catch (error) {
        if (!isTransientApiError(error)) throw error;
        reconnects += 1; $("record-state").textContent = `Verbindung wird erneut aufgebaut (${reconnects}) ...`;
        await sleep(Math.min(15000, 1000 * (2 ** Math.min(reconnects, 3)))); continue;
      }
      await sleep(1500);
    }
  }
  async function processVoiceFile(file) {
    state.processing = true; $("voice-button").disabled = true;
    $("record-state").textContent = "Upload / Modell laeuft";
    $("transcript-box").className = "transcript-box";
    $("transcript-box").textContent = "Audio wird an den lokalen Modell-PC gesendet ...";
    try {
      const job = await uploadAndTranscribe(file);
      state.transcript = job.transcript || ""; interpretTranscript(state.transcript);
    } catch (error) {
      $("record-state").textContent = "Fehler"; $("transcript-box").className = "transcript-box error";
      $("transcript-box").textContent = error.message || "Modellantwort fehlgeschlagen.";
      logEvent(error.message || "Modellantwort fehlgeschlagen.", "bad");
    } finally {
      state.processing = false; $("voice-button").disabled = !state.authenticated;
      if (!$("record-state").textContent.includes("Lagebild")) $("record-state").textContent = "bereit";
    }
  }
  async function toggleRecording() {
    if (state.processing) return;
    if (!state.authenticated) {
      $("auth-status").textContent = "Bitte zuerst mit dem Modell verbinden.";
      $("auth-password").focus(); return;
    }
    if (state.recording) {
      state.recording = false; setRecordingUI(false);
      if (state.recorder && state.recorder.state !== "inactive") state.recorder.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      $("record-state").textContent = "Mikrofon nicht verfuegbar";
      $("transcript-box").textContent = "Bitte eine Audiodatei laden."; return;
    }
    try {
      state.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = recorderMimeType(); state.chunks = [];
      state.recorder = new MediaRecorder(state.stream, mimeType ? { mimeType } : undefined);
      state.recorder.ondataavailable = (event) => { if (event.data?.size) state.chunks.push(event.data); };
      state.recorder.onstop = () => {
        const recorder = state.recorder;
        const type = recorder?.mimeType || mimeType || "audio/webm";
        const extension = type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : "webm";
        const blob = new Blob(state.chunks, { type });
        state.stream?.getTracks().forEach((track) => track.stop());
        state.stream = null; state.recorder = null; state.chunks = [];
        void processVoiceFile(new File([blob], `paramedic-voice-${Date.now()}.${extension}`, { type }));
      };
      state.recorder.start(1000); state.recording = true; setRecordingUI(true);
      logEvent("Aufnahme gestartet. Sprich die Lagebeschreibung.", "");
    } catch (error) {
      state.stream?.getTracks().forEach((track) => track.stop()); state.stream = null;
      $("record-state").textContent = "Mikrofon verweigert";
      $("transcript-box").textContent = error.message || "Mikrofon konnte nicht gestartet werden.";
    }
  }
  function setRecordingUI(active) {
    const button = $("voice-button");
    button.classList.toggle("recording", active);
    button.querySelector("strong").textContent = active ? "Aufnahme beenden" : "Aufnahme starten";
    $("record-state").textContent = active ? "nimmt auf ..." : "bereit";
  }

  function setLook(x, y) {
    state.lookX = clamp(x, -34, 34); state.lookY = clamp(y, -20, 20);
    world.style.setProperty("--look-x", `${state.lookX}deg`);
    world.style.setProperty("--look-y", `${state.lookY}deg`);
  }
  function setMove(x, y) {
    state.moveX = clamp(x, -75, 75); state.moveY = clamp(y, -35, 35);
    world.style.setProperty("--move-x", `${state.moveX}px`);
    world.style.setProperty("--move-y", `${state.moveY}px`);
  }
  function nudgeLook(direction) {
    if (direction === "left") setLook(state.lookX - 10, state.lookY);
    if (direction === "right") setLook(state.lookX + 10, state.lookY);
    if (direction === "forward") setLook(state.lookX, state.lookY - 7);
    if (direction === "back") setLook(state.lookX, state.lookY + 7);
    setCaption("Sicht angepasst. Suche die Patientin und den Notfallkoffer.");
  }
  function handlePointerDown(event) {
    if (event.target.closest("button")) return;
    state.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, lookX: state.lookX, lookY: state.lookY };
    viewport.setPointerCapture?.(event.pointerId);
  }
  function handlePointerMove(event) {
    if (!state.drag || state.drag.id !== event.pointerId) return;
    setLook(state.drag.lookX + (event.clientX - state.drag.x) * .12, state.drag.lookY - (event.clientY - state.drag.y) * .08);
  }
  function handlePointerUp(event) { if (state.drag?.id === event.pointerId) state.drag = null; }
  function handleKey(event) {
    if (event.target.closest("input,button")) return;
    const key = event.key.toLowerCase();
    if (!["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) return;
    event.preventDefault();
    if (key === "a" || key === "arrowleft") setMove(state.moveX - 12, state.moveY);
    if (key === "d" || key === "arrowright") setMove(state.moveX + 12, state.moveY);
    if (key === "w" || key === "arrowup") setMove(state.moveX, state.moveY - 8);
    if (key === "s" || key === "arrowdown") setMove(state.moveX, state.moveY + 8);
  }

  function resetScenario() {
    state.recording = false; state.processing = false; state.transcript = "";
    state.voiceGood = false; state.patientFocused = false; state.findings = { breathing: false, pulse: false };
    state.cardsGiven = {}; state.completed = false;
    if (state.recorder && state.recorder.state !== "inactive") state.recorder.stop();
    state.stream?.getTracks().forEach((track) => track.stop());
    state.stream = null; state.recorder = null; setMove(0, 0); setLook(0, 0);
    $("patient-card").classList.remove("focused", "revealed");
    $("vital-pulse").textContent = "--"; $("vital-breathing").textContent = "--";
    $("vital-skin").textContent = "--"; $("patient-note").textContent = "Noch keine Untersuchung dokumentiert.";
    $("transcript-box").className = "transcript-box"; $("transcript-box").textContent = "Noch keine Modellantwort.";
    $("record-state").textContent = "bereit";
    document.querySelectorAll(".action-button").forEach((node) => node.classList.remove("used"));
    document.querySelectorAll(".triage-card").forEach((node) => node.classList.remove("given"));
    $("card-count").textContent = "0 / 4 gegeben"; $("result-modal").hidden = true;
    setRecordingUI(false); $("event-log").replaceChildren();
    logEvent("Neuer Einsatz gestartet: Bahnhofsvorplatz, Fall P-07.", "good");
    setCaption("Ziehe im Bild, nutze WASD oder waehle einen Hotspot."); updateObjectives();
  }

  function onOrientation(event) {
    if (!state.cardboard) return;
    const gamma = clamp(Number(event.gamma) || 0, -45, 45);
    const beta = clamp(Number(event.beta) || 45, 15, 90);
    setLook(gamma * .58, (beta - 45) * .24);
  }
  async function startCardboard() {
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      const permission = await DeviceOrientationEvent.requestPermission();
      if (permission !== "granted") { setCaption("Bewegungssensor nicht freigegeben. Ziehen funktioniert weiterhin."); return; }
    }
    state.cardboard = true; shell.classList.add("cardboard-mode");
    window.addEventListener("deviceorientation", onOrientation);
    $("xr-button").textContent = "Cardboard beenden"; $("mode-pill").textContent = "CARDBOARD VIEW";
    setCaption("Bewege dein iPhone oder ziehe mit dem Finger, um dich umzusehen.");
    if (document.documentElement.requestFullscreen) { try { await document.documentElement.requestFullscreen(); } catch (_) {} }
  }
  async function stopCardboard() {
    state.cardboard = false; shell.classList.remove("cardboard-mode");
    window.removeEventListener("deviceorientation", onOrientation);
    $("xr-button").textContent = "VR / Cardboard"; $("mode-pill").textContent = "FIRST PERSON";
    if (document.fullscreenElement && document.exitFullscreen) { try { await document.exitFullscreen(); } catch (_) {} }
  }

  function mat4Multiply(a, b) {
    const out = new Float32Array(16);
    for (let column = 0; column < 4; column += 1) for (let row = 0; row < 4; row += 1) {
      out[column * 4 + row] = a[row] * b[column * 4] + a[4 + row] * b[column * 4 + 1] +
        a[8 + row] * b[column * 4 + 2] + a[12 + row] * b[column * 4 + 3];
    }
    return out;
  }
  function boxMatrix(x, y, z, sx, sy, sz) {
    const m = new Float32Array(16);
    m[0] = sx; m[5] = sy; m[10] = sz; m[15] = 1; m[12] = x; m[13] = y; m[14] = z; return m;
  }
  function createXRProgram(gl) {
    const compile = (type, source) => {
      const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error("VR shader failed");
      return shader;
    };
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, "attribute vec3 p;uniform mat4 m;void main(){gl_Position=m*vec4(p,1.0);}"));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, "precision mediump float;uniform vec4 c;void main(){gl_FragColor=c;}"));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("VR program failed");
    const faces = [
      [-1,-1,1,1,-1,1,1,1,1,-1,-1,1,1,1,1,-1,1,1],
      [1,-1,-1,-1,-1,-1,-1,1,-1,1,-1,-1,-1,1,-1,1,1,-1],
      [-1,1,1,1,1,1,1,1,-1,-1,1,1,1,1,-1,-1,1,-1],
      [-1,-1,-1,1,-1,-1,1,-1,1,-1,-1,-1,1,-1,1,-1,-1,1],
      [-1,-1,-1,-1,-1,1,-1,1,1,-1,-1,-1,-1,1,1,-1,1,-1],
      [1,-1,1,1,-1,-1,1,1,-1,1,-1,1,1,1,-1,1,1,1]
    ];
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(faces.flat()), gl.STATIC_DRAW);
    return { program, buffer, position: gl.getAttribLocation(program, "p"),
      matrix: gl.getUniformLocation(program, "m"), color: gl.getUniformLocation(program, "c") };
  }
  function drawXRBox(xr, view, x, y, z, sx, sy, sz, color) {
    const gl = xr.gl;
    const matrix = mat4Multiply(view.projectionMatrix, mat4Multiply(view.transform.inverse.matrix, boxMatrix(x, y, z, sx, sy, sz)));
    gl.uniformMatrix4fv(xr.program.matrix, false, matrix); gl.uniform4fv(xr.program.color, color);
    gl.drawArrays(gl.TRIANGLES, 0, 36);
  }
  function renderXR(time, frame) {
    const xr = state.xr; if (!xr) return;
    const pose = frame.getViewerPose(xr.referenceSpace);
    if (pose) {
      const gl = xr.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, xr.layer.framebuffer); gl.enable(gl.DEPTH_TEST);
      gl.useProgram(xr.program.program); gl.bindBuffer(gl.ARRAY_BUFFER, xr.program.buffer);
      gl.enableVertexAttribArray(xr.program.position); gl.vertexAttribPointer(xr.program.position, 3, gl.FLOAT, false, 0, 0);
      for (const view of pose.views) {
        const rect = xr.layer.getViewport(view); gl.viewport(rect.x, rect.y, rect.width, rect.height);
        gl.clearColor(.035, .08, .1, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        drawXRBox(xr, view, 0, -1.1, -2.8, 5, .1, 5, [.12,.23,.24,1]);
        drawXRBox(xr, view, 0, 1.5, -4.5, 5, 2.5, .1, [.12,.25,.27,1]);
        drawXRBox(xr, view, 0, -.15, -2.6, .55, .85, .38, [.75,.18,.2,1]);
        drawXRBox(xr, view, 0, .85, -2.6, .27, .28, .27, [.7,.42,.32,1]);
        drawXRBox(xr, view, -.22, -1.05, -2.6, .17, .65, .18, [.18,.25,.34,1]);
        drawXRBox(xr, view, .22, -1.05, -2.6, .17, .65, .18, [.18,.25,.34,1]);
        drawXRBox(xr, view, -1.25, -.75, -2.1, .42, .08, .25, [.85,.56,.22,1]);
      }
    }
    xr.session.requestAnimationFrame(renderXR);
  }
  async function startXR() {
    if (!navigator.xr || typeof XRWebGLLayer === "undefined") return false;
    if (!await navigator.xr.isSessionSupported("immersive-vr").catch(() => false)) return false;
    const session = await navigator.xr.requestSession("immersive-vr", { optionalFeatures: ["local-floor"] });
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl", { xrCompatible: true, antialias: true });
    if (!gl) { await session.end(); return false; }
    await gl.makeXRCompatible();
    const layer = new XRWebGLLayer(session, gl); session.updateRenderState({ baseLayer: layer });
    const referenceSpace = await session.requestReferenceSpace("local-floor").catch(() => session.requestReferenceSpace("local"));
    state.xr = { session, gl, layer, referenceSpace, program: createXRProgram(gl) };
    $("xr-button").textContent = "VR beenden"; $("mode-pill").textContent = "IMMERSIVE VR";
    setCaption("VR aktiv: die Szene laeuft direkt im Headset."); session.requestAnimationFrame(renderXR);
    session.addEventListener("end", () => {
      if (state.xr?.session !== session) return;
      state.xr = null; $("xr-button").textContent = "VR / Cardboard"; $("mode-pill").textContent = "FIRST PERSON";
    });
    return true;
  }
  async function toggleXR() {
    if (state.xr) { await state.xr.session.end(); return; }
    if (state.cardboard) { await stopCardboard(); return; }
    try { if (!await startXR()) await startCardboard(); }
    catch (_) { logEvent("VR nicht verfuegbar - Cardboard-Modus gestartet.", "warn"); await startCardboard(); }
  }

  $("login-form").addEventListener("submit", login);
  $("voice-button").addEventListener("click", () => { void toggleRecording(); });
  $("voice-file").addEventListener("change", () => {
    const file = $("voice-file").files?.[0];
    if (!file) return;
    if (!state.authenticated) { $("auth-status").textContent = "Bitte zuerst mit dem Modell verbinden."; return; }
    void processVoiceFile(file);
  });
  $("observe-breathing").addEventListener("click", () => inspectPatient("breathing"));
  $("observe-pulse").addEventListener("click", () => inspectPatient("pulse"));
  $("show-card").addEventListener("click", () => inspectPatient("card"));
  $("patient-hotspot").addEventListener("click", () => inspectPatient("all"));
  $("kit-hotspot").addEventListener("click", () => {
    setCaption("Der Koffer enthaelt vier Karten. Welche passt zur Lage?");
    logEvent("Notfallkoffer geoeffnet: vier Prioritaetskarten verfuegbar.");
  });
  document.querySelectorAll(".triage-card").forEach((card) => card.addEventListener("click", () => giveCard(card.dataset.card)));
  document.querySelectorAll(".look-button").forEach((button) => button.addEventListener("click", () => nudgeLook(button.dataset.look)));
  viewport.addEventListener("pointerdown", handlePointerDown);
  viewport.addEventListener("pointermove", handlePointerMove);
  viewport.addEventListener("pointerup", handlePointerUp);
  viewport.addEventListener("pointercancel", handlePointerUp);
  viewport.addEventListener("wheel", (event) => {
    event.preventDefault(); setLook(state.lookX + event.deltaX * .06, state.lookY + event.deltaY * .04);
  }, { passive: false });
  window.addEventListener("keydown", handleKey);
  $("xr-button").addEventListener("click", () => { void toggleXR(); });
  $("reset-button").addEventListener("click", resetScenario);
  $("modal-reset").addEventListener("click", resetScenario);
  resetScenario();
  void loadSession();
})();

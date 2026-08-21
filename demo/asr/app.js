(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const app = $("asr-app");
  const audio = $("audio-player");
  const fileInput = $("file-input");
  const stageOrder = ["capture", "trim", "relevance", "voice", "context", "extract", "output"];
  const API_BASE = (window.JAR_API_BASE || "https://jar-voice-api.alexanderh2seo4.workers.dev").replace(/\/$/, "");
  let resolvedApiBase = null;
  let apiBasePromise = null;

  async function getApiBase() {
    if (window.JAR_API_BASE || resolvedApiBase) return resolvedApiBase || API_BASE;
    if (!apiBasePromise) {
      apiBasePromise = fetch(`${API_BASE}/__target`, { credentials: "omit" })
        .then(async (response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const body = await response.json();
          if (!body?.base_url) throw new Error("Tunnel target unavailable");
          const candidate = new URL(body.base_url);
          if (candidate.protocol !== "https:" || !candidate.hostname.endsWith(".trycloudflare.com")) {
            throw new Error("Invalid tunnel target");
          }
          resolvedApiBase = candidate.origin;
          return resolvedApiBase;
        })
        .catch((error) => {
          apiBasePromise = null;
          throw error;
        });
    }
    return apiBasePromise;
  }
  const DEMO_RECORD = {
    "Hinweis": "Demoausgabe. Für echte Transkription anmelden und Analyse starten.",
    "Transkript": "Noch keine Server-Transkription abgerufen."
  };

  const state = {
    recording: false,
    elapsed: 0,
    timer: null,
    analyzing: false,
    objectUrl: null,
    sourceName: "sample-voice-thorsten.mp3",
    file: null,
    mediaRecorder: null,
    mediaStream: null,
    recordedChunks: [],
    authenticated: false,
    csrf: null,
    authPanel: null
  };

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  function pad(value) { return String(value).padStart(2, "0"); }
  function timeText(seconds) { return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`; }
  function wait(ms) { return new Promise((resolve) => window.setTimeout(resolve, ms)); }

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
    state.timer = window.setInterval(() => {
      state.elapsed += 1;
      renderListeningTime();
    }, 1000);
  }

  function setStage(stage, status) {
    const node = document.querySelector(`[data-stage="${stage}"]`);
    if (!node) return;
    node.classList.remove("active", "done");
    if (["läuft", "running"].includes(status)) node.classList.add("active");
    if (["fertig", "done"].includes(status)) node.classList.add("done");
    const statusNode = node.querySelector(".node-status");
    if (statusNode) statusNode.textContent = status;
  }

  function resetStages() {
    stageOrder.forEach((stage, index) => setStage(stage, index === 0 ? "bereit" : "wartet"));
  }

  function setAnalysisStatus(text, running = false, done = false) {
    const nodes = [$("analysis-status"), $("output-status")].filter(Boolean);
    nodes.forEach((node) => {
      node.className = `analysis-status${running ? " running" : ""}${done ? " done" : ""}`;
      node.textContent = text;
    });
  }

  function renderOutput(record, metadata = {}) {
    const entries = Object.entries(record || {});
    $("output-body").innerHTML = entries.length
      ? entries.map(([key, value]) => `<tr><td>${esc(key)}</td><td>${esc(value)}</td></tr>`).join("")
      : `<tr><td>Transkript</td><td>Kein Text erkannt.</td></tr>`;
    $("json-output").textContent = JSON.stringify({
      transcript: record?.Transkript || "",
      ...metadata,
      _demo: Boolean(metadata._demo)
    }, null, 2);
  }

  function renderDemo() {
    $("output-title").textContent = "Transkript";
    $("top-note").textContent = "lokaler CrisperWhisper-Server · Anmeldung erforderlich";
    $("output-footnote").textContent = "Forschungs-/Demo-Betrieb. Audiodateien werden lokal auf dem Modell-PC verarbeitet.";
    renderOutput(DEMO_RECORD, { _demo: true, _hinweis: "Keine Modellabfrage" });
  }

  function makeAuthPanel() {
    if (state.authPanel) return state.authPanel;
    const panel = document.createElement("section");
    panel.id = "auth-panel";
    panel.style.cssText = [
      "display:flex", "gap:12px", "align-items:center", "flex-wrap:wrap", "margin:0 0 18px",
      "padding:14px 16px", "border:1px solid rgba(125,145,160,.35)", "border-radius:12px",
      "background:rgba(255,255,255,.04)"
    ].join(";");
    panel.innerHTML = `
      <strong>Lokale Transkription</strong>
      <span id="auth-copy" class="muted">Passwort eingeben, um den PC-Dienst zu verwenden.</span>
      <form id="auth-form" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-left:auto">
        <input id="auth-password" type="password" autocomplete="current-password" placeholder="Passwort" aria-label="Passwort"
          style="min-width:180px;padding:9px 10px;border-radius:8px;border:1px solid rgba(125,145,160,.5);background:transparent;color:inherit">
        <button class="action primary" type="submit" id="auth-submit">Anmelden</button>
        <button class="action" type="button" id="auth-logout" hidden>Abmelden</button>
      </form>
      <span id="auth-status" class="analysis-status" aria-live="polite"></span>
      <small style="width:100%;opacity:.72">CrisperWhisper2.0 Large · Non-Commercial Research/Demo License</small>`;
    const page = document.querySelector(".page");
    if (page) page.prepend(panel);
    state.authPanel = panel;
    $("auth-form").addEventListener("submit", (event) => {
      event.preventDefault();
      void login();
    });
    $("auth-logout").addEventListener("click", () => { void logout(); });
    return panel;
  }

  function showAuthStatus(text, running = false, done = false) {
    const node = $("auth-status");
    if (!node) return;
    node.className = `analysis-status${running ? " running" : ""}${done ? " done" : ""}`;
    node.textContent = text;
  }

  function setAuthenticated(authenticated, csrf = null) {
    state.authenticated = authenticated;
    if (csrf) state.csrf = csrf;
    const password = $("auth-password");
    const submit = $("auth-submit");
    const logoutButton = $("auth-logout");
    const copy = $("auth-copy");
    if (password) password.hidden = authenticated;
    if (submit) submit.hidden = authenticated;
    if (logoutButton) logoutButton.hidden = !authenticated;
    if (copy) copy.textContent = authenticated
      ? "Der lokale Modell-PC ist verbunden."
      : "Passwort eingeben, um den PC-Dienst zu verwenden.";
  }

  async function apiRequest(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const init = { ...options, headers, credentials: "include" };
    const base = await getApiBase();
    const response = await fetch(`${base}${path}`, init);
    let body = null;
    try { body = await response.json(); } catch (_) { body = null; }
    if (!response.ok) {
      if (response.status === 401) {
        setAuthenticated(false);
        showAuthStatus("Anmeldung erforderlich");
      }
      const detail = body?.detail;
      const message = typeof detail === "string" ? detail : detail?.message || `HTTP ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.body = body;
      throw error;
    }
    return body;
  }

  function jsonOptions(method, body) {
    return {
      method,
      headers: { "Content-Type": "application/json", "X-CSRF-Token": state.csrf || "" },
      body: JSON.stringify(body)
    };
  }

  async function loadSession() {
    try {
      const result = await apiRequest("/v1/auth/session");
      setAuthenticated(true, result.csrf_token);
      showAuthStatus("verbunden", false, true);
    } catch (error) {
      if (error.status !== 401) showAuthStatus("Server nicht erreichbar");
    }
  }

  async function login() {
    const input = $("auth-password");
    const password = input?.value || "";
    if (!password) {
      showAuthStatus("Passwort fehlt");
      return;
    }
    showAuthStatus("Anmeldung läuft …", true);
    try {
      const result = await apiRequest("/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      if (input) input.value = "";
      setAuthenticated(true, result.csrf_token);
      showAuthStatus("verbunden", false, true);
    } catch (error) {
      showAuthStatus(error.message || "Anmeldung fehlgeschlagen");
    }
  }

  async function logout() {
    if (!state.authenticated) return;
    try { await apiRequest("/v1/auth/logout", jsonOptions("POST", {})); } catch (_) { /* local state is still cleared */ }
    state.csrf = null;
    setAuthenticated(false);
    showAuthStatus("abgemeldet");
  }

  function setAudioSource(file) {
    if (state.objectUrl) window.URL.revokeObjectURL(state.objectUrl);
    state.file = file;
    state.objectUrl = window.URL.createObjectURL(file);
    state.sourceName = file.name;
    audio.src = state.objectUrl;
    $("audio-name").textContent = file.name;
    $("file-status").textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB · bereit`;
    $("analyze-button").textContent = "Transkription starten";
    setAnalysisStatus("bereit");
  }

  function recorderMimeType() {
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
    return types.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || "";
  }

  async function activate(source) {
    if (state.recording) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setActivationMessage("Mikrofon nicht verfügbar", "Bitte eine Audiodatei laden.", "nicht verfügbar", "");
      return;
    }
    try {
      state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = recorderMimeType();
      state.recordedChunks = [];
      state.mediaRecorder = new MediaRecorder(state.mediaStream, mimeType ? { mimeType } : undefined);
      state.mediaRecorder.ondataavailable = (event) => {
        if (event.data?.size) state.recordedChunks.push(event.data);
      };
      state.mediaRecorder.onstop = () => {
        const type = state.mediaRecorder?.mimeType || mimeType || "audio/webm";
        const extension = type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : "webm";
        const blob = new Blob(state.recordedChunks, { type });
        setAudioSource(new File([blob], `aufnahme-${Date.now()}.${extension}`, { type }));
        state.mediaStream?.getTracks().forEach((track) => track.stop());
        state.mediaStream = null;
        state.mediaRecorder = null;
        state.recordedChunks = [];
      };
      state.mediaRecorder.start(1000);
      state.recording = true;
      state.elapsed = 0;
      renderListeningTime();
      startTimer();
      app.classList.add("recording");
      $("scan-button").textContent = "Aufnahme beenden";
      setActivationMessage(
        source === "keyword" ? "Vorsichtung erkannt · Mikrofon aktiv" : "QR-JAR-1842 erkannt · Mikrofon aktiv",
        "Der Audiostrom wird lokal im Browser aufgenommen.",
        "aktiv",
        "live"
      );
      $("analysis-status").textContent = "Aufnahme aktiv";
    } catch (error) {
      state.mediaStream?.getTracks().forEach((track) => track.stop());
      state.mediaStream = null;
      setActivationMessage("Mikrofonzugriff verweigert", error.message || "Bitte Mikrofonzugriff erlauben.", "bereit", "");
    }
  }

  function deactivate(reason) {
    if (!state.recording) {
      setActivationMessage("Aufnahme beendet", reason || "Audiodatei kann verarbeitet werden.", "beendet", "done");
      return;
    }
    state.recording = false;
    stopTimer();
    app.classList.remove("recording");
    $("scan-button").textContent = "QR-Scan simulieren";
    setActivationMessage("Aufnahme beendet", reason || "Audiodatei wird vorbereitet.", "beendet", "done");
    $("analysis-status").textContent = "Aufnahme bereit";
    if (state.mediaRecorder && state.mediaRecorder.state !== "inactive") state.mediaRecorder.stop();
  }

  async function defaultSampleFile() {
    if (state.file) return state.file;
    const response = await fetch("./sample-voice-thorsten.mp3");
    if (!response.ok) throw new Error("Beispieldatei konnte nicht geladen werden.");
    const blob = await response.blob();
    return new File([blob], "sample-voice-thorsten.mp3", { type: blob.type || "audio/mpeg" });
  }

  async function uploadAndTranscribe(file) {
    const created = await apiRequest("/v1/uploads", jsonOptions("POST", {
      filename: file.name,
      size: file.size,
      mime_type: file.type || "application/octet-stream"
    }));
    const uploadId = created.upload_id;
    const chunkSize = Number(created.chunk_size) || 16 * 1024 * 1024;
    let offset = Number(created.next_offset) || 0;
    while (offset < file.size) {
      const endExclusive = Math.min(file.size, offset + chunkSize);
      const chunk = file.slice(offset, endExclusive);
      let uploaded = false;
      let lastError = null;
      for (let attempt = 0; attempt < 4 && !uploaded; attempt += 1) {
        try {
          const result = await apiRequest(`/v1/uploads/${encodeURIComponent(uploadId)}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/octet-stream",
              "Content-Range": `bytes ${offset}-${endExclusive - 1}/${file.size}`,
              "X-CSRF-Token": state.csrf || ""
            },
            body: chunk
          });
          offset = Number(result.next_offset) || endExclusive;
          uploaded = true;
        } catch (error) {
          lastError = error;
          if (error.status === 409 && error.body?.detail?.next_offset != null) {
            offset = Number(error.body.detail.next_offset);
            uploaded = true;
            break;
          }
          await wait(700 * (attempt + 1));
        }
      }
      if (!uploaded) throw lastError || new Error("Upload fehlgeschlagen.");
      const percent = file.size ? Math.round((offset / file.size) * 100) : 100;
      setAnalysisStatus(`Hochladen · ${percent}%`, true);
    }
    const finalized = await apiRequest(`/v1/uploads/${encodeURIComponent(uploadId)}/complete`, jsonOptions("POST", {}));
    return pollJob(finalized.job.job_id);
  }

  async function pollJob(jobId) {
    for (;;) {
      const job = await apiRequest(`/v1/jobs/${encodeURIComponent(jobId)}`);
      if (job.status === "completed") return job;
      if (job.status === "error") throw new Error(job.error || "Transkription fehlgeschlagen.");
      const percent = Math.round((Number(job.progress) || 0) * 100);
      setAnalysisStatus(`Modell verarbeitet · ${percent}% · ${job.chunks || 0} Fenster`, true);
      await wait(1500);
    }
  }

  async function analyze() {
    if (state.analyzing) return;
    if (!state.authenticated) {
      showAuthStatus("Bitte zuerst anmelden");
      $("auth-password")?.focus();
      return;
    }
    state.analyzing = true;
    $("analyze-button").disabled = true;
    $("analyze-button").textContent = "Transkription läuft …";
    resetStages();
    setAnalysisStatus("Datei wird vorbereitet", true);
    try {
      const file = await defaultSampleFile();
      setStage("capture", "fertig");
      setStage("trim", "läuft");
      await wait(180);
      setStage("trim", "fertig");
      setStage("voice", "läuft");
      const job = await uploadAndTranscribe(file);
      setStage("voice", "fertig");
      ["relevance", "context", "extract"].forEach((stage) => setStage(stage, "nicht aktiviert"));
      setStage("output", "fertig");
      renderOutput({
        "Datei": job.filename,
        "Transkript": job.transcript || "Kein Text erkannt.",
        "Dauer": job.duration_seconds == null ? "unbekannt" : `${Number(job.duration_seconds).toFixed(1)} s`,
        "Fenster": job.chunks,
        "Modell": "CrisperWhisper2.0 Large + EMS LoRA"
      }, {
        model: job.model,
        duration_seconds: job.duration_seconds,
        chunks: job.chunks,
        processing_seconds: job.processing_seconds
      });
      setAnalysisStatus("Transkription fertig", false, true);
    } catch (error) {
      setStage("voice", "fehler");
      setAnalysisStatus(error.message || "Transkription fehlgeschlagen");
    } finally {
      state.analyzing = false;
      $("analyze-button").disabled = false;
      $("analyze-button").textContent = "Erneut transkribieren";
    }
  }

  $("scan-button").addEventListener("click", () => {
    if (state.recording) deactivate("Aufnahme beendet.");
    else void activate("qr");
  });
  $("vorsichtung-button").addEventListener("click", () => {
    if (state.recording) deactivate("Vorsichtung abgeschlossen.");
    else void activate("keyword");
  });
  $("complete-button").addEventListener("click", () => {
    if (state.recording) deactivate("Aufnahme abgeschlossen.");
    else setActivationMessage("Aufnahme ist beendet", "Nächster Schritt: Transkription starten.", "beendet", "done");
  });
  $("keyword-button").addEventListener("click", () => {
    if (state.recording) deactivate("Sichtung abgeschlossen.");
    else setActivationMessage("Kein aktiver Audiostrom", "Das Schlüsselwort wird nur während einer Aufnahme ausgewertet.", "bereit", "");
  });
  $("fast-forward-button").addEventListener("click", () => {
    state.elapsed = Math.max(state.elapsed, 183);
    renderListeningTime();
    if (!state.recording) setActivationMessage("Beispielzeit gesetzt", "Die Anzeige dient nur der Demo.", "bereit", "");
  });
  $("analyze-button").addEventListener("click", () => { void analyze(); });
  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (file) setAudioSource(file);
  });
  audio.addEventListener("loadedmetadata", () => {
    if (Number.isFinite(audio.duration)) $("audio-duration").textContent = timeText(Math.round(audio.duration));
  });
  $("toggle-json").addEventListener("click", () => {
    const panel = $("json-panel");
    const show = panel.hidden;
    panel.hidden = !show;
    $("toggle-json").textContent = show ? "JSON ausblenden" : "JSON anzeigen";
  });
  $("copy-json").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("json-output").textContent);
      $("copy-json").textContent = "kopiert";
      window.setTimeout(() => { $("copy-json").textContent = "JSON kopieren"; }, 1600);
    } catch (_) {
      $("copy-json").textContent = "Kopieren nicht möglich";
    }
  });

  makeAuthPanel();
  renderDemo();
  resetStages();
  renderListeningTime();
  void loadSession();
})();

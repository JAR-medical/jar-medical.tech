import { emit } from "./events.js";
import { HOTBAR_ITEMS, hotbarKeyLabel } from "./items.js";

function mmss(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export class UI {
  constructor() {
    this.handlers = {};
    this._vDown = false;
    this._recording = false;
    this._audioCtx = null;
    this._voiceObjectUrl = null;
    this._toastTimer = null;

    this.isTouchDevice =
      navigator.maxTouchPoints > 0 ||
      window.matchMedia?.("(hover: none) and (pointer: coarse)").matches === true ||
      window.innerWidth <= 760;
    document.body.classList.toggle("touch-device", this.isTouchDevice);

    const $ = (id) => document.getElementById(id);
    const hotbar = $("hotbar");
    for (const [index, item] of HOTBAR_ITEMS.entries()) {
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = `slot${index === 0 ? " active" : ""}`;
      slot.dataset.index = String(index);
      slot.title = `${item.label} — ${item.help}`;
      slot.setAttribute("aria-label", `${hotbarKeyLabel(index)}: ${item.label}`);
      slot.innerHTML = `<span class="slot-key">${hotbarKeyLabel(index)}</span><span class="slot-icon" aria-hidden="true">${item.icon}</span>`;
      hotbar.appendChild(slot);
    }

    this.el = {
      startScreen: $("start-screen"),
      btnStart: $("btn-start"),
      briefingScreen: $("briefing-screen"),
      btnConsent: $("btn-consent"),
      sttBadge: $("stt-badge"),
      endScreen: $("end-screen"),
      endTitle: $("end-title"),
      endStats: $("end-stats"),
      endRank: $("end-rank"),
      btnRestart: $("btn-restart"),
      hud: $("hud"),
      missionLine: $("mission-line"),
      missionTimer: $("mission-timer"),
      scoreValue: $("score-value"),
      prompt: $("prompt"),
      promptText: $("prompt-text"),
      hotbar,
      slots: Array.from(hotbar.querySelectorAll(".slot")),
      toasts: $("toasts"),
      chartPanel: $("chart-panel"),
      chartTitle: $("chart-title"),
      chartSeverity: $("chart-severity"),
      chartTimer: $("chart-timer"),
      chartSymptoms: $("chart-symptoms"),
      chartVitalsBody: $("chart-vitals-body"),
      chartHint: $("chart-hint"),
      chartProfile: $("chart-profile"),
      chartActions: $("chart-actions"),
      transcriptArea: $("transcript-area"),
      chartRecord: $("chart-record"),
      voiceOutput: $("voice-output"),
      voiceAudio: $("voice-audio"),
      voiceRawMeta: $("voice-raw-meta"),
      verdictBox: $("verdict-box"),
      fallbackInput: $("fallback-input"),
      fallbackSend: $("fallback-send"),
      chartClose: $("chart-close"),
      touchLook: $("touch-look"),
      touchJoystick: $("touch-joystick"),
      touchJoystickKnob: $("touch-joystick-knob"),
      touchInteract: $("touch-interact"),
      touchJump: $("touch-jump"),
      touchSprint: $("touch-sprint"),
      touchBreak: $("touch-break"),
      touchUse: $("touch-use"),
    };

    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      const typingInFallback = document.activeElement === this.el.fallbackInput;
      if (e.key === "Escape") {
        if (this._chartOpen && this.handlers.onCloseChart) {
          this.handlers.onCloseChart();
        }
        return;
      }
      if ((e.key === "v" || e.key === "V") && this._chartOpen && !typingInFallback) {
        this._vDown = true;
        this._requestRecordStart();
      }
      if ((e.key === "t" || e.key === "T") && this._chartOpen && !typingInFallback) {
        e.preventDefault();
        this.el.fallbackInput.focus();
      }
    });
    window.addEventListener("keyup", (e) => {
      if ((e.key === "v" || e.key === "V") && this._vDown) {
        this._vDown = false;
        this._requestRecordStop();
      }
    });

  }

  get _chartOpen() {
    return !this.el.chartPanel.classList.contains("hidden");
  }

  _hideMenus() {
    this.el.startScreen.classList.add("hidden");
    this.el.briefingScreen.classList.add("hidden");
    this.el.endScreen.classList.add("hidden");
  }

  bindMain(h) {
    this.handlers = h;
    this.el.btnStart.addEventListener("click", () => {
      this._hideMenus();
      h.onStart();
    });
    this.el.btnConsent.addEventListener("click", () => {
      this.el.briefingScreen.classList.add("hidden");
      h.onConsentAccepted();
    });
    this.el.btnRestart.addEventListener("click", () => {
      this._hideMenus();
      h.onRestart();
    });
    this.el.chartClose.addEventListener("click", () => h.onCloseChart());
    const submitTyped = () => {
      const value = this.el.fallbackInput.value.trim();
      if (!value) return;
      this.el.fallbackInput.value = "";
      this.el.fallbackInput.blur();
      h.onSubmitTyped(value);
    };
    this.el.fallbackSend.addEventListener("click", submitTyped);
    this.el.fallbackInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitTyped();
      }
    });
    for (const slot of this.el.slots) {
      slot.addEventListener("click", () => {
        const index = Number(slot.dataset.index);
        if (Number.isInteger(index)) emit("input:hotbar", { index });
      });
    }
    this.el.chartRecord.addEventListener("click", () => {
      if (this._recording) this._requestRecordStop();
      else this._requestRecordStart();
    });
    this._bindTouchControls();
  }

  _requestRecordStart() {
    if (!this._chartOpen || this._recording) return;
    this._recording = true;
    this.setRecordingUI(true, false);
    emit("ui:record-start", {});
  }

  _requestRecordStop() {
    if (!this._recording) return;
    this._recording = false;
    this.setRecordingUI(false, true);
    emit("ui:record-stop", {});
  }

  _bindTouchControls() {
    const isTouchPointer = (event) => this.isTouchDevice || event.pointerType !== "mouse";
    const stopPointer = (element, event) => {
      try {
        if (element.hasPointerCapture?.(event.pointerId)) element.releasePointerCapture(event.pointerId);
      } catch (err) {
        /* pointer capture may already have been released */
      }
    };

    let joystickPointerId = null;
    const resetJoystick = () => {
      joystickPointerId = null;
      this.el.touchJoystick.classList.remove("active");
      this.el.touchJoystickKnob.style.transform = "translate(-50%, -50%)";
      emit("input:touch-move", { x: 0, y: 0 });
    };
    const updateJoystick = (event) => {
      const rect = this.el.touchJoystick.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const maxRadius = rect.width * 0.38;
      let dx = event.clientX - centerX;
      let dy = event.clientY - centerY;
      const distance = Math.hypot(dx, dy);
      if (distance > maxRadius) {
        const scale = maxRadius / distance;
        dx *= scale;
        dy *= scale;
      }
      const x = dx / maxRadius;
      const y = dy / maxRadius;
      this.el.touchJoystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      emit("input:touch-move", { x, y });
    };
    this.el.touchJoystick.addEventListener("pointerdown", (event) => {
      if (!isTouchPointer(event) || joystickPointerId !== null) return;
      event.preventDefault();
      joystickPointerId = event.pointerId;
      this.el.touchJoystick.classList.add("active");
      this.el.touchJoystick.setPointerCapture?.(event.pointerId);
      updateJoystick(event);
    });
    this.el.touchJoystick.addEventListener("pointermove", (event) => {
      if (event.pointerId !== joystickPointerId) return;
      event.preventDefault();
      updateJoystick(event);
    });
    for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"]) {
      this.el.touchJoystick.addEventListener(eventName, (event) => {
        if (joystickPointerId === null || (event.pointerId !== undefined && event.pointerId !== joystickPointerId)) return;
        stopPointer(this.el.touchJoystick, event);
        resetJoystick();
      });
    }

    let lookPointerId = null;
    let lastLookX = 0;
    let lastLookY = 0;
    this.el.touchLook.addEventListener("pointerdown", (event) => {
      if (!isTouchPointer(event) || lookPointerId !== null) return;
      event.preventDefault();
      lookPointerId = event.pointerId;
      lastLookX = event.clientX;
      lastLookY = event.clientY;
      this.el.touchLook.setPointerCapture?.(event.pointerId);
    });
    this.el.touchLook.addEventListener("pointermove", (event) => {
      if (event.pointerId !== lookPointerId) return;
      event.preventDefault();
      const dx = event.clientX - lastLookX;
      const dy = event.clientY - lastLookY;
      lastLookX = event.clientX;
      lastLookY = event.clientY;
      emit("input:touch-look", { dx, dy });
    });
    for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"]) {
      this.el.touchLook.addEventListener(eventName, (event) => {
        if (lookPointerId === null || (event.pointerId !== undefined && event.pointerId !== lookPointerId)) return;
        stopPointer(this.el.touchLook, event);
        lookPointerId = null;
      });
    }

    const bindTap = (element, eventName) => {
      element.addEventListener("pointerdown", (event) => {
        if (!isTouchPointer(event)) return;
        event.preventDefault();
        element.setPointerCapture?.(event.pointerId);
        emit(eventName, {});
      });
    };
    bindTap(this.el.touchInteract, "input:interact");
    bindTap(this.el.touchJump, "input:jump");
    bindTap(this.el.touchUse, "input:medicate");

    let breakPointerId = null;
    const stopBreaking = (event) => {
      if (breakPointerId === null || (event.pointerId !== undefined && event.pointerId !== breakPointerId)) return;
      stopPointer(this.el.touchBreak, event);
      breakPointerId = null;
      emit("input:break-stop", {});
    };
    this.el.touchBreak.addEventListener("pointerdown", (event) => {
      if (!isTouchPointer(event) || breakPointerId !== null) return;
      event.preventDefault();
      breakPointerId = event.pointerId;
      this.el.touchBreak.setPointerCapture?.(event.pointerId);
      emit("input:break-start", {});
    });
    for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"]) {
      this.el.touchBreak.addEventListener(eventName, stopBreaking);
    }

    let sprintPointerId = null;
    const stopSprint = (event) => {
      if (sprintPointerId === null || (event.pointerId !== undefined && event.pointerId !== sprintPointerId)) return;
      stopPointer(this.el.touchSprint, event);
      sprintPointerId = null;
      this.el.touchSprint.classList.remove("active");
      emit("input:touch-sprint", { active: false });
    };
    this.el.touchSprint.addEventListener("pointerdown", (event) => {
      if (!isTouchPointer(event) || sprintPointerId !== null) return;
      event.preventDefault();
      sprintPointerId = event.pointerId;
      this.el.touchSprint.setPointerCapture?.(event.pointerId);
      this.el.touchSprint.classList.add("active");
      emit("input:touch-sprint", { active: true });
    });
    for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"]) {
      this.el.touchSprint.addEventListener(eventName, stopSprint);
    }

  }

  showStart(sttReady) {
    this.el.startScreen.classList.remove("hidden");
    this.el.briefingScreen.classList.add("hidden");
    this.el.endScreen.classList.add("hidden");
    this.el.hud.classList.add("hidden");
    this._setBadge(sttReady);
  }

  showBriefing() {
    this.el.startScreen.classList.add("hidden");
    this.el.endScreen.classList.add("hidden");
    this.el.briefingScreen.classList.remove("hidden");
    this.el.btnConsent.focus({ preventScroll: true });
  }

  _setBadge(sttReady) {
    const badge = this.el.sttBadge;
    if (sttReady) {
      badge.className = "badge ready";
      badge.textContent = "STT: bereit";
    } else {
      badge.className = "badge unavailable";
      badge.textContent = "STT: nicht verfügbar";
    }
  }

  setSttStatus(state, detail) {
    if (!this.el.startScreen.classList.contains("hidden")) {
      this._setBadge(state === "ready");
    }
    if (state === "recording") {
      this._recording = true;
      this.setRecordingUI(true, false);
    } else if (state === "transcribing") {
      this._recording = false;
      this.setRecordingUI(false, true);
    } else if (state === "idle" || state === "ready" || state === "error" || state === "unavailable") {
      this._recording = false;
      this.setRecordingUI(false, false);
    }
  }

  setRecordingUI(isRecording, busy = false) {
    const button = this.el.chartRecord;
    if (!button) return;
    button.disabled = Boolean(busy);
    button.classList.toggle("recording", Boolean(isRecording));
    button.setAttribute("aria-pressed", String(Boolean(isRecording)));
    button.textContent = busy
      ? "⏳ Text wird verarbeitet …"
      : isRecording
        ? "■ Aufnahme stoppen"
        : "🎤 Aufnahme starten";
  }

  toast(msg, type = "info") {
    if (this._toastTimer) clearTimeout(this._toastTimer);

    const div = document.createElement("div");
    div.className = `toast ${type === "info" ? "" : type}`.trim();
    div.textContent = msg;
    this.el.toasts.replaceChildren(div);
    this._toastTimer = setTimeout(() => {
      if (div.parentNode === this.el.toasts) div.remove();
      this._toastTimer = null;
    }, 4000);
  }

  showPrompt(text) {
    if (text) {
      this.el.prompt.classList.remove("hidden");
      this.el.promptText.textContent = text;
    } else {
      this.el.prompt.classList.add("hidden");
    }
  }

  setHotbar(index) {
    for (const slot of this.el.slots) {
      slot.classList.toggle("active", Number(slot.dataset.index) === Number(index));
    }
  }

  updateHud(state) {
    let line = `Patienten ${state.saved}/${state.total}`;
    if (state.dead > 0) line += ` · ✖${state.dead}`;
    this.el.missionLine.textContent = line;
    this.el.missionTimer.textContent = mmss(state.elapsed);
    this.el.scoreValue.textContent = String(state.score);
  }

  openChart(view) {
    this.el.chartTitle.textContent = `${view.name} · ${view.age} J.`;
    this.el.chartSeverity.textContent = view.severity.toUpperCase();
    this.el.chartSeverity.className = `chip ${view.severity}`;
    this.el.chartProfile.innerHTML = "";
    const profile = view.profile || {};
    const profileRows = [
      ["Einsatz", profile.incident?.label_de || "—"],
      ["Verletzungen", (profile.injuries || []).map((entry) => entry.label_de).join("; ") || "—"],
      ["Vorerkrankungen", (profile.history || []).map((entry) => entry.label_de).join("; ") || "—"],
      ["Allergien", (profile.allergies || []).map((entry) => entry.label_de).join("; ") || "—"],
      ["Dauermedikation", (profile.currentMedications || []).map((entry) => entry.label_de).join("; ") || "—"],
      ["Maßnahmen", (profile.treatmentPlan?.actions || []).map((entry) => entry.label_de || entry.label_en).join(" · ") || "—"],
    ];
    for (const [label, value] of profileRows) {
      const row = document.createElement("div");
      row.className = "profile-row";
      const title = document.createElement("b");
      title.textContent = label;
      const content = document.createElement("span");
      content.textContent = value;
      row.append(title, content);
      this.el.chartProfile.appendChild(row);
    }
    this.el.chartSymptoms.innerHTML = "";
    for (const symptom of view.symptoms) {
      const li = document.createElement("li");
      li.innerHTML = `<span class="de">${symptom.de}</span>`;
      this.el.chartSymptoms.appendChild(li);
    }
    this.el.chartVitalsBody.innerHTML = "";
    const vitals = [
      ["RR", view.vitals.RR],
      ["HF", view.vitals.HF],
      ["SpO₂", view.vitals.SpO2],
      ["BZ", view.vitals.BZ],
      ["GCS", view.vitals.GCS],
    ];
    for (const [label, value] of vitals) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${label}</td><td>${value}</td>`;
      this.el.chartVitalsBody.appendChild(tr);
    }
    this.el.chartHint.innerHTML = `<span class="script-label">SAG DAS</span><span class="script-copy">${view.hint}</span>`;
    this.el.chartActions.innerHTML = "";
    if (view.usedItems?.length) {
      const itemsById = new Map(HOTBAR_ITEMS.map((item) => [item.id, item]));
      const label = document.createElement("div");
      label.className = "chart-actions-label";
      label.textContent = "Vor Ort eingesetzt";
      this.el.chartActions.appendChild(label);
      for (const itemId of view.usedItems) {
        const item = itemsById.get(itemId);
        if (!item) continue;
        const chip = document.createElement("span");
        chip.className = "action-chip";
        chip.textContent = `${item.icon} ${item.label}`;
        this.el.chartActions.appendChild(chip);
      }
    }
    if (view.performedActionLabels?.length) {
      const label = document.createElement("div");
      label.className = "chart-actions-label";
      label.textContent = "Maßnahmen protokolliert";
      this.el.chartActions.appendChild(label);
      for (const actionLabel of view.performedActionLabels) {
        const chip = document.createElement("span");
        chip.className = "action-chip performed";
        chip.textContent = `✔ ${actionLabel}`;
        this.el.chartActions.appendChild(chip);
      }
    }
    this.transcriptPlaceholder();
    this._recording = false;
    this.setRecordingUI(false, false);
    this.clearVoiceOutput();
    this.clearVerdict();
    this.updateChartTimer(view.elapsed);
    this.el.chartPanel.classList.remove("hidden");
  }

  updateChartTimer(elapsedSeconds) {
    this.el.chartTimer.textContent = mmss(elapsedSeconds);
    this.el.chartTimer.classList.remove("critical");
  }

  transcriptPlaceholder() {
    this.el.transcriptArea.textContent = "";
    this.el.transcriptArea.classList.add("hidden");
  }

  appendTranscript(text) {
    if (!text) {
      this.transcriptPlaceholder();
    } else {
      this.el.transcriptArea.textContent = text;
      this.el.transcriptArea.classList.remove("hidden");
    }
  }

  clearVoiceOutput() {
    if (this._voiceObjectUrl) {
      URL.revokeObjectURL(this._voiceObjectUrl);
      this._voiceObjectUrl = null;
    }
    this.el.voiceAudio.removeAttribute("src");
    this.el.voiceAudio.load();
    this.el.voiceRawMeta.textContent = "";
    this.el.voiceOutput.classList.add("hidden");
  }

  showVoiceRawData({ audioBlob, audioInfo, processingSeconds = null } = {}) {
    if (this._voiceObjectUrl) URL.revokeObjectURL(this._voiceObjectUrl);
    this._voiceObjectUrl = null;
    if (audioBlob instanceof Blob) {
      this._voiceObjectUrl = URL.createObjectURL(audioBlob);
      this.el.voiceAudio.src = this._voiceObjectUrl;
    } else {
      this.el.voiceAudio.removeAttribute("src");
      this.el.voiceAudio.load();
    }
    const parts = [];
    if (audioInfo?.durationSeconds != null) parts.push(`${Number(audioInfo.durationSeconds).toFixed(1)} s`);
    if (audioInfo?.sampleRate) parts.push(`${audioInfo.sampleRate} Hz`);
    if (audioInfo?.bytes) parts.push(`${audioInfo.bytes} B WAV`);
    if (processingSeconds != null) parts.push(`STT ${Number(processingSeconds).toFixed(1)} s`);
    this.el.voiceRawMeta.textContent = parts.join(" · ") || "WAV gespeichert";
    this.el.voiceOutput.classList.remove("hidden");
  }

  clearVerdict() {
    this.el.verdictBox.innerHTML = "";
  }

  showVerdict(result) {
    this.clearVerdict();
    const headline = document.createElement("div");
    headline.className = "feedback-line";
    if (result.saved) {
      headline.textContent = "GERETTET ✔";
      headline.classList.add("good");
    } else if (result.verdict === "partial") {
      headline.textContent = "UNVOLLSTÄNDIG — es fehlt:";
      headline.classList.add("bad");
    } else {
      headline.textContent = "ABGELEHNT ✖";
      headline.classList.add("bad");
    }
    this.el.verdictBox.appendChild(headline);

    const chips = document.createElement("div");
    chips.className = "verdict-chips";
    const matchedLabels = result.matchedLabels || result.matchedKeys || [];
    const missingLabels = result.missingLabels || result.missingKeys || [];
    for (const label of matchedLabels) {
      const chip = document.createElement("span");
      chip.className = "vchip hit";
      chip.textContent = String(label).replace(/_/g, " ");
      chips.appendChild(chip);
    }
    for (const label of missingLabels) {
      const chip = document.createElement("span");
      chip.className = "vchip miss";
      chip.textContent = String(label).replace(/_/g, " ");
      chips.appendChild(chip);
    }
    for (const hit of result.forbiddenHits || []) {
      const chip = document.createElement("span");
      chip.className = "vchip forbid";
      chip.textContent = hit.label_de || hit.label_en || hit.key;
      chips.appendChild(chip);
    }
    this.el.verdictBox.appendChild(chips);

    for (const line of result.feedback || []) {
      const p = document.createElement("p");
      p.className = "feedback-line";
      const good = line.includes("✔") || line.includes("erfüllt") || line.includes("gerettet");
      if (good) p.classList.add("good");
      else if (line.includes("✖") || line.includes("Fehlt") || line.includes("Kontraindiziert")) p.classList.add("bad");
      p.textContent = line;
      this.el.verdictBox.appendChild(p);
    }
  }

  showEnd(stats) {
    this.closeChart();
    const won = stats.won !== false;
    this.el.endTitle.textContent = won ? "EINSATZ ABGESCHLOSSEN" : "EINSATZ BEENDET";
    this.el.endRank.textContent = stats.rank;
    this.el.endStats.innerHTML =
      `<div>Gerettet: <b>${stats.saved}</b></div>` +
      `<div>Verloren: <b style="color:#ff4136">${stats.dead}</b></div>` +
      `<div>Punkte: <b>${stats.score}</b></div>` +
      `<div>Einsatzzeit: <b>${mmss(stats.elapsed)}</b></div>` +
      `<div>${won ? "Alle Patienten versorgt." : "Nicht alle Patienten konnten gerettet werden."}</div>`;
    this.el.btnRestart.textContent = "↻ Neue Welt & Patienten";
    this.el.endScreen.classList.remove("hidden");
    this.el.hud.classList.add("hidden");
  }

  closeChart() {
    this.el.chartPanel.classList.add("hidden");
    this._recording = false;
    this.setRecordingUI(false, false);
    this.clearVoiceOutput();
    if (this.el.fallbackInput === document.activeElement) this.el.fallbackInput.blur();
  }

  playTone(freq, durMs, type = "square") {
    try {
      if (!this._audioCtx) this._audioCtx = new AudioContext();
      if (this._audioCtx.state === "suspended") this._audioCtx.resume();
      const osc = this._audioCtx.createOscillator();
      const gain = this._audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      const now = this._audioCtx.currentTime;
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durMs / 1000);
      osc.connect(gain);
      gain.connect(this._audioCtx.destination);
      osc.start(now);
      osc.stop(now + durMs / 1000);
    } catch (err) {
      /* audio unavailable */
    }
  }
}

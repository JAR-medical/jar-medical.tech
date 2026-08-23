import { emit } from "./events.js";
import { HOTBAR_ITEMS, hotbarKeyLabel } from "./items.js";
import {
  LEADERBOARD_NOTE,
  LEADERBOARD_NOTES,
  leaderboardView,
  loadIdentity,
  loadLocalRuns,
  saveIdentity,
} from "./leaderboard.js";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, (char) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot" }[char]};`);
}

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
    this._bannerTimer = null;
    this._countdownTimer = null;
    this._toasts = [];
    this._scoreShown = 0;
    this._proximity = -1;
    this._lbScope = "global";
    this._lbData = { global: null, local: null, demo: null };
    this._lbYouKey = { global: null, local: null, demo: null };
    this._lbIdentity = null;
    this._lbSummary = null;
    this._lbStatus = "";
    this.audio = null;

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
      endLeaderboard: $("end-leaderboard"),
      endRank: $("end-rank"),
      btnRestart: $("btn-restart"),
      levelComplete: $("level-complete"),
      levelCompleteIndex: $("level-complete-index"),
      levelCompleteCount: $("level-complete-count"),
      levelCompleteTitle: $("level-complete-title"),
      levelCompleteStats: $("level-complete-stats"),
      levelNextTitle: $("level-next-title"),
      levelNextBriefing: $("level-next-briefing"),
      btnNextLevel: $("btn-next-level"),
      levelCountdown: $("level-countdown"),
      levelBanner: $("level-banner"),
      levelBannerKicker: $("level-banner-kicker"),
      levelBannerTitle: $("level-banner-title"),
      levelBannerText: $("level-banner-text"),
      hud: $("hud"),
      levelLine: $("level-line"),
      missionLine: $("mission-line"),
      missionTimer: $("mission-timer"),
      scoreValue: $("score-value"),
      accuracyValue: $("accuracy-value"),
      hiddenHint: $("hidden-hint"),
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
      screenFlash: $("screen-flash"),
      screenVignette: $("screen-vignette"),
      scorePops: $("score-pops"),
      comboPanel: $("combo-panel"),
      comboCount: $("combo-count"),
      comboMultiplier: $("combo-multiplier"),
      comboBarFill: $("combo-bar-fill"),
      proximityMeter: $("proximity-meter"),
      proximityFill: $("proximity-fill"),
      audioToggle: $("audio-toggle"),
      endMedals: $("end-medals"),
      endBest: $("end-best"),
      crewName: $("crew-name"),
      crewStation: $("crew-station"),
      btnSaveName: $("btn-save-name"),
      lbTabs: Array.from(document.querySelectorAll(".lb-tab")),
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
      if ((e.key === "m" || e.key === "M") && !typingInFallback && document.activeElement?.tagName !== "INPUT") {
        this.toggleAudio();
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
    this.hideLevelComplete();
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
    this.el.btnNextLevel?.addEventListener("click", () => {
      this.hideLevelComplete();
      h.onNextLevel?.();
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
    this.el.audioToggle?.addEventListener("click", () => this.toggleAudio());
    this.el.btnSaveName?.addEventListener("click", () => this._commitIdentity());
    for (const field of [this.el.crewName, this.el.crewStation]) {
      field?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        this._commitIdentity();
      });
    }
    for (const tab of this.el.lbTabs) {
      tab.addEventListener("click", () => {
        this.audio?.play("ui-click");
        this.setLeaderboardScope(tab.dataset.scope);
      });
    }
    // Every button in the game makes the same click, so the audio wiring lives
    // here once instead of at each call site. It also doubles as the gesture
    // that unlocks the AudioContext.
    document.addEventListener(
      "pointerdown",
      (event) => {
        const button = event.target instanceof Element ? event.target.closest("button") : null;
        if (!button || button.disabled) return;
        this.audio?.unlock();
        if (!button.classList.contains("lb-tab")) this.audio?.play("ui-click");
      },
      true,
    );
    this._bindTouchControls();
  }

  setAudio(audio) {
    this.audio = audio;
    this.syncAudioButton();
  }

  toggleAudio() {
    if (!this.audio) return;
    const enabled = this.audio.toggle();
    this.syncAudioButton();
    this.toast(enabled ? "Ton an" : "Ton aus", "info");
    if (enabled) this.audio.play("ui-confirm");
  }

  syncAudioButton() {
    const button = this.el.audioToggle;
    if (!button) return;
    const enabled = Boolean(this.audio?.enabled);
    button.setAttribute("aria-pressed", String(enabled));
    button.firstChild.textContent = enabled ? "🔊" : "🔇";
  }

  _commitIdentity() {
    const identity = saveIdentity({
      name: this.el.crewName?.value,
      crew: this.el.crewStation?.value,
    });
    if (this.el.crewName) this.el.crewName.value = identity.name;
    if (this.el.crewStation) this.el.crewStation.value = identity.crew;
    this._lbIdentity = identity;
    this.renderLeaderboard(this._lbSummary);
    this.audio?.play("ui-confirm");
    this.handlers.onIdentityChanged?.(identity);
    return identity;
  }

  _requestRecordStart() {
    if (!this._chartOpen || this._recording) return;
    this._recording = true;
    this.setRecordingUI(true, false);
    // The cue plays before the duck, so the player hears "go" and then silence.
    this.audio?.play("record-start");
    emit("ui:record-start", {});
  }

  _requestRecordStop() {
    if (!this._recording) return;
    this._recording = false;
    this.setRecordingUI(false, true);
    this.audio?.play("record-stop");
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

  // Toasts used to replace each other, so a rescue message could be erased by
  // the hint that followed it a frame later. They stack now, oldest first, up
  // to three at a time.
  toast(msg, type = "info") {
    const div = document.createElement("div");
    div.className = `toast ${type === "info" ? "" : type}`.trim();
    div.textContent = msg;
    this.el.toasts.appendChild(div);
    this._toasts.push(div);
    while (this._toasts.length > 3) this._removeToast(this._toasts[0]);
    setTimeout(() => this._removeToast(div), 4000);
    if (type === "bad") this.audio?.play("warn");
    else if (type !== "good") this.audio?.play("toast");
  }

  _removeToast(div) {
    const index = this._toasts.indexOf(div);
    if (index >= 0) this._toasts.splice(index, 1);
    if (div.parentNode !== this.el.toasts) return;
    div.classList.add("leaving");
    setTimeout(() => div.remove(), 250);
  }

  // A number that leaps off the crosshair is worth more than the same number
  // appearing quietly in the corner.
  scorePop(text, kind = "good") {
    const host = this.el.scorePops;
    if (!host || !text) return;
    const div = document.createElement("div");
    div.className = `score-pop ${kind}`;
    div.textContent = text;
    host.appendChild(div);
    while (host.childElementCount > 5) host.firstElementChild.remove();
    setTimeout(() => div.remove(), 1300);
  }

  flash(kind = "good") {
    const el = this.el.screenFlash;
    if (!el) return;
    el.className = "";
    // Reading offsetWidth restarts the CSS animation; without it a second
    // flash inside the same second does nothing at all.
    void el.offsetWidth;
    el.className = `flash-${kind}`;
  }

  setCombo({ streak = 0, multiplier = 1, progress = 0 } = {}) {
    const panel = this.el.comboPanel;
    if (!panel) return;
    const active = streak >= 2;
    panel.classList.toggle("hidden", !active);
    if (!active) return;
    const grew = this.el.comboCount.textContent !== String(streak);
    this.el.comboCount.textContent = String(streak);
    this.el.comboMultiplier.textContent = `×${multiplier.toFixed(1)}`;
    this.el.comboBarFill.style.width = `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`;
    panel.classList.toggle("hot", multiplier >= 1.5);
    if (grew) {
      panel.classList.remove("gained");
      void panel.offsetWidth;
      panel.classList.add("gained");
    }
  }

  // How close the nearest unfound casualty is, 0 (far) to 1 (on top of them).
  setProximity(ratio) {
    const value = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : -1;
    if (Math.abs(value - this._proximity) < 0.02) return;
    this._proximity = value;
    const meter = this.el.proximityMeter;
    if (meter) {
      meter.classList.toggle("hidden", value < 0);
      if (value >= 0) this.el.proximityFill.style.width = `${Math.round(value * 100)}%`;
    }
    this.el.screenVignette?.classList.toggle("close", value > 0.55);
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
    if (state.score !== this._scoreShown) {
      this._scoreShown = state.score;
      this.el.scoreValue.textContent = String(state.score);
      this.el.scoreValue.classList.remove("bumped");
      void this.el.scoreValue.offsetWidth;
      this.el.scoreValue.classList.add("bumped");
    }

    if (this.el.levelLine) {
      const number = state.levelNumber || 1;
      const count = state.levelCount || 1;
      this.el.levelLine.textContent = state.levelTitle
        ? `Level ${number}/${count} · ${state.levelTitle}`
        : `Level ${number}/${count}`;
    }
    if (this.el.accuracyValue) {
      const accuracy = state.accuracy;
      this.el.accuracyValue.textContent = accuracy?.count
        ? `${accuracy.average}% · ${accuracy.label}`
        : "—";
    }
    if (this.el.hiddenHint) {
      const remaining = Number(state.hiddenRemaining) || 0;
      this.el.hiddenHint.textContent = remaining
        ? `${remaining} Patient${remaining === 1 ? "" : "en"} noch nicht gesichtet`
        : "";
      this.el.hiddenHint.classList.toggle("hidden", remaining === 0);
    }
  }

  showLevelBanner({ index = 0, count = 1, title = "", subtitle = "", briefing = "", patients = 0, hidden = 0 } = {}) {
    if (!this.el.levelBanner) return;
    clearTimeout(this._bannerTimer);
    this.el.levelBannerKicker.textContent = `LEVEL ${index + 1}/${count}${subtitle ? ` · ${subtitle}` : ""}`;
    this.el.levelBannerTitle.textContent = title;
    const parts = [`${patients} Patient${patients === 1 ? "" : "en"}`];
    if (hidden > 0) parts.push(`${hidden} davon versteckt`);
    this.el.levelBannerText.textContent = `${parts.join(" · ")}${briefing ? ` — ${briefing}` : ""}`;
    this.el.levelBanner.classList.remove("hidden");
    this._bannerTimer = setTimeout(() => this.el.levelBanner.classList.add("hidden"), 9000);
  }

  showLevelComplete({ cleared, next, index = 0, count = 1, stats = {}, campaign = {}, delaySeconds = 6 } = {}) {
    if (!this.el.levelComplete) return;
    this.closeChart();
    this.el.hud.classList.add("hidden");
    this.el.levelBanner?.classList.add("hidden");
    this.el.levelCompleteIndex.textContent = String(index + 1);
    this.el.levelCompleteCount.textContent = String(count);
    this.el.levelCompleteTitle.textContent = cleared?.title || "Einsatz abgeschlossen";

    const rows = [
      ["Gerettet", `${stats.saved ?? 0}/${stats.total ?? stats.saved ?? 0}`],
      ["Einsatzzeit", mmss(stats.elapsed ?? 0)],
      ["Punkte gesamt", String(campaign.score ?? stats.score ?? 0)],
      ["Genauigkeit gesamt", campaign.accuracySamples ? `${campaign.accuracy}% · ${campaign.accuracyLabel}` : "—"],
    ];
    if (stats.hidden) rows.splice(1, 0, ["Versteckte Patienten", String(stats.hidden)]);
    this.el.levelCompleteStats.innerHTML = rows
      .map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`)
      .join("");

    this.el.levelNextTitle.textContent = next?.title || "—";
    this.el.levelNextBriefing.textContent = next?.briefing || "";
    this.el.levelComplete.classList.remove("hidden");
    this.el.btnNextLevel?.focus({ preventScroll: true });

    clearInterval(this._countdownTimer);
    let remaining = Math.max(1, Math.round(delaySeconds));
    if (this.el.levelCountdown) this.el.levelCountdown.textContent = String(remaining);
    this._countdownTimer = setInterval(() => {
      remaining -= 1;
      if (this.el.levelCountdown) this.el.levelCountdown.textContent = String(Math.max(0, remaining));
      if (remaining > 0) this.audio?.play("countdown");
      if (remaining <= 0) clearInterval(this._countdownTimer);
    }, 1000);
  }

  hideLevelComplete() {
    clearInterval(this._countdownTimer);
    this.el.levelComplete?.classList.add("hidden");
  }

  openChart(view) {
    this.el.chartTitle.textContent = `${view.name} · ${view.age} J.${view.hidden ? " · versteckt aufgefunden" : ""}`;
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

    if (result.accuracy?.scored) {
      const accuracy = document.createElement("div");
      accuracy.className = "accuracy-line";
      const bar = document.createElement("span");
      bar.className = "accuracy-bar";
      bar.style.setProperty("--accuracy", `${result.accuracy.score}%`);
      const text = document.createElement("b");
      text.textContent = `${result.accuracy.score}% · ${result.accuracy.label}`;
      const detail = document.createElement("span");
      detail.className = "accuracy-detail";
      detail.textContent = `${result.accuracy.correctWords}/${result.accuracy.expectedWordCount} Wörter erkannt`;
      accuracy.append(text, bar, detail);
      this.el.verdictBox.appendChild(accuracy);
    }

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

  showEnd(summary, extras = {}) {
    this.closeChart();
    this.hideLevelComplete();
    const cleared = summary.levelsCleared ?? 0;
    const total = summary.levelCount ?? cleared;
    const complete = cleared >= total && total > 0;
    this.el.endTitle.textContent = complete ? "ALLE LEVEL ABGESCHLOSSEN" : "DURCHLAUF BEENDET";
    this.el.endRank.textContent = summary.accuracySamples
      ? `${summary.accuracy}% Sprachgenauigkeit · ${summary.accuracyLabel}`
      : "Keine Sprachaufnahme gewertet";

    const levelRows = (summary.results || [])
      .map(
        (entry, index) =>
          `<div class="end-level"><span>Level ${index + 1} · ${entry.title}</span><b>${entry.saved}/${entry.total} · ${mmss(entry.elapsed)}</b></div>`,
      )
      .join("");

    this.el.endStats.innerHTML =
      `<div>Level: <b>${cleared}/${total}</b></div>` +
      `<div>Gerettet: <b>${summary.saved}/${summary.total}</b></div>` +
      `<div>Punkte: <b>${summary.score}</b></div>` +
      `<div>Gesamtzeit: <b>${mmss(summary.elapsed)}</b></div>` +
      `<div>Gewertete Sprachberichte: <b>${summary.accuracySamples || 0}</b></div>` +
      `<div class="end-levels">${levelRows}</div>`;

    this.renderMedals(summary, extras);
    this.renderPersonalBest(extras.personalBest, summary);
    this.prefillIdentity(extras.identity);

    this._lbSummary = summary;
    this._lbData = {
      global: Array.isArray(extras.remoteEntries) ? extras.remoteEntries : null,
      local: loadLocalRuns(),
      demo: null,
    };
    this._lbYouKey = { global: null, local: extras.runKey || null, demo: null };
    this._lbIdentity = extras.identity || loadIdentity();
    this._lbStatus = extras.remoteStatus || "";
    this.setLeaderboardScope(this._lbData.global ? "global" : "local", { silent: true });

    this.el.btnRestart.textContent = "↻ Neuer Durchlauf ab Level 1";
    this.el.endScreen.classList.remove("hidden");
    this.el.hud.classList.add("hidden");
    this.setCombo({ streak: 0 });
    this.setProximity(-1);
  }

  // Medals name what the run actually did well. A score alone says "3499"; a
  // medal says "every concealed casualty found", which is the thing worth
  // trying to repeat.
  renderMedals(summary, extras = {}) {
    const host = this.el.endMedals;
    if (!host) return;
    const medals = [];
    const savedAll = summary.total > 0 && summary.saved >= summary.total;
    if (savedAll) medals.push({ cls: "gold", icon: "🏅", label: "Alle Patienten gerettet" });
    if ((summary.levelsCleared ?? 0) >= (summary.levelCount ?? 0) && (summary.levelCount ?? 0) > 0) {
      medals.push({ cls: "gold", icon: "🎖", label: "Kampagne abgeschlossen" });
    }
    if (summary.accuracySamples > 0 && summary.accuracy >= 90) {
      medals.push({ cls: "green", icon: "🎙", label: "Funkdisziplin", detail: `${summary.accuracy}% Genauigkeit` });
    } else if (summary.accuracySamples > 0 && summary.accuracy >= 75) {
      medals.push({ cls: "green", icon: "🎙", label: "Klare Übergabe", detail: `${summary.accuracy}%` });
    }
    if (extras.hiddenTotal > 0 && extras.hiddenFound >= extras.hiddenTotal) {
      medals.push({ cls: "blue", icon: "🔎", label: "Alle Versteckten gefunden", detail: `${extras.hiddenFound}/${extras.hiddenTotal}` });
    } else if (extras.hiddenFound > 0) {
      medals.push({ cls: "blue", icon: "🔎", label: "Versteckte gefunden", detail: `${extras.hiddenFound}/${extras.hiddenTotal}` });
    }
    if (extras.bestStreak >= 5) medals.push({ cls: "green", icon: "🔥", label: "Serie", detail: `${extras.bestStreak} in Folge` });
    if (savedAll && summary.elapsed > 0 && summary.elapsed < 900) {
      medals.push({ cls: "gold", icon: "⚡", label: "Schnelle Schicht", detail: mmss(summary.elapsed) });
    }
    if (extras.personalBest?.beatenScore) medals.push({ cls: "gold", icon: "📈", label: "Neuer Punkterekord" });

    host.innerHTML = medals
      .map(
        (medal) =>
          `<span class="medal ${medal.cls}">${medal.icon} ${escapeHtml(medal.label)}` +
          `${medal.detail ? ` <small>${escapeHtml(medal.detail)}</small>` : ""}</span>`,
      )
      .join("");
    if (medals.length) this.audio?.play("medal");
  }

  renderPersonalBest(best, summary) {
    const host = this.el.endBest;
    if (!host) return;
    if (!best?.next || best.next.runs <= 1) {
      host.innerHTML = "";
      return;
    }
    const record = best.beatenScore;
    host.innerHTML =
      `<div>Beste Punktzahl: <b>${best.next.score}</b>${record ? ` <span class="record">— neuer Rekord (+${summary.score - best.previous.score})</span>` : ""}</div>` +
      `<div>Beste Genauigkeit: <b>${Math.round(best.next.accuracy)}%</b> · Läufe: <b>${best.next.runs}</b></div>`;
  }

  prefillIdentity(identity = loadIdentity()) {
    if (this.el.crewName) this.el.crewName.value = identity?.name || "";
    if (this.el.crewStation) this.el.crewStation.value = identity?.crew || "";
  }

  // The scope decides which rows the board is built from; the renderer below
  // does not care where they came from.
  setLeaderboardScope(scope, { silent = false } = {}) {
    if (!scope) return;
    this._lbScope = scope;
    for (const tab of this.el.lbTabs) tab.classList.toggle("active", tab.dataset.scope === scope);
    if (!silent) this.audio?.play("ui-click");
    this.renderLeaderboard(this._lbSummary);
  }

  // `global` and `local` are real runs. `demo` is openly fictional and the note
  // under it says so, so a player never mistakes the demo crews for people.
  renderLeaderboard(summary, options = {}) {
    const host = this.el.endLeaderboard;
    if (!host || !summary) return;
    const scope = options.scope || this._lbScope || "demo";
    const entries = scope === "demo" ? null : this._lbData[scope];
    const board = leaderboardView(summary, {
      scope,
      entries: entries || undefined,
      identity: options.identity || this._lbIdentity,
      youKey: this._lbYouKey[scope],
    });

    const rows = board.shown
      .map((row) => {
        if (row.gap) return `<div class="lb-row lb-gap"><span>⋯</span></div>`;
        const medal = row.rank <= 3 ? ` lb-top${row.rank}` : "";
        return (
          `<div class="lb-row${row.you ? " lb-you" : ""}${medal}">` +
          `<span class="lb-rank">${row.rank}</span>` +
          `<span class="lb-name"><b>${escapeHtml(row.name)}</b><small>${escapeHtml(row.crew)}</small></span>` +
          `<span class="lb-saved">${row.saved}/${row.total}</span>` +
          `<span class="lb-acc">${Math.round(row.accuracy) || 0}%</span>` +
          `<span class="lb-time">${mmss(row.elapsed)}</span>` +
          `<span class="lb-score">${row.score}</span>` +
          `</div>`
        );
      })
      .join("");

    const heading = { global: "SERVER-BESTENLISTE", local: "DEINE LÄUFE", demo: "DEMO-BESTENLISTE" }[scope] || "BESTENLISTE";
    const note = scope === "global" && !entries
      ? "Kein Server erreichbar — es wird nur lokal gewertet."
      : LEADERBOARD_NOTES[scope] || LEADERBOARD_NOTE;
    const status = this._lbStatus && scope === "global" ? `<p class="lb-status">${escapeHtml(this._lbStatus)}</p>` : "";

    host.innerHTML =
      `<div class="lb-head"><b>${heading}</b><span>Platz ${board.yourRank} von ${board.count}</span></div>` +
      `<div class="lb-legend"><span class="lb-rank">#</span><span class="lb-name">Schicht</span>` +
      `<span class="lb-saved">Gerettet</span><span class="lb-acc">Genau.</span>` +
      `<span class="lb-time">Zeit</span><span class="lb-score">Punkte</span></div>` +
      `<div class="lb-rows">${rows}</div>` +
      `<p class="lb-note">${escapeHtml(note)}</p>${status}`;
  }

  // Called once the backend answers, so the end screen fills in without the
  // player having to wait on the network before seeing their run.
  applyRemoteLeaderboard(entries, status = "", youKey = null) {
    this._lbData.global = Array.isArray(entries) ? entries : null;
    if (youKey) this._lbYouKey.global = String(youKey);
    this._lbStatus = status;
    if (this._lbScope === "global") this.renderLeaderboard(this._lbSummary);
  }

  closeChart() {
    this.el.chartPanel.classList.add("hidden");
    this._recording = false;
    this.setRecordingUI(false, false);
    this.clearVoiceOutput();
    if (this.el.fallbackInput === document.activeElement) this.el.fallbackInput.blur();
  }

  // Kept because the frozen contract has main.js calling it; it now routes
  // through the shared engine so one mute switch covers everything, and only
  // falls back to its own context if the engine never started.
  playTone(freq, durMs, type = "square") {
    if (this.audio?.ready) {
      this.audio._tone({ freq, dur: Math.max(0.03, durMs / 1000), type, gain: 0.18 });
      return;
    }
    if (this.audio && !this.audio.enabled) return;
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

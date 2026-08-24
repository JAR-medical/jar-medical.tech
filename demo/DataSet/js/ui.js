import { emit } from "./events.js";
import { HOTBAR_ITEMS, hotbarKeyLabel } from "./items.js";
import { LEVELS, hiddenCount } from "./levels.js";
import {
  LEADERBOARD_NOTE,
  LEADERBOARD_NOTES,
  hasStoredIdentity,
  leaderboardView,
  loadIdentity,
  loadLocalRuns,
  saveIdentity,
} from "./leaderboard.js?v=20260824-consent10";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, (char) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot" }[char]};`);
}

function mmss(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// The admin password is a convenience lock for development, not a security
// boundary: it lives in the shipped bundle, so anyone who opens the sources can
// read it. It exists so the dev tools are not one stray click away during a
// real session, and nothing behind it touches the backend.
const ADMIN_PASSWORD = "12345678";
const ADMIN_SESSION_KEY = "medicraft.admin";

export class UI {
  constructor() {
    this.handlers = {};
    this._vDown = false;
    this._recording = false;
    this._voiceSubmissionPending = false;
    this._sttState = "idle";
    this._playerNameTouched = false;
    this._audioCtx = null;
    this._voiceObjectUrl = null;
    this._bannerTimer = null;
    this._veilTimer = null;
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
    this._setLbScope = "global";
    this._publicLeaderboardOptIn = false;
    this._settingsTab = "sound";
    this._settingsSnapshot = null;
    this._admin = false;
    this.audio = null;

    try {
      this._admin = globalThis.sessionStorage?.getItem(ADMIN_SESSION_KEY) === "1";
    } catch (err) {
      this._admin = false;
    }

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
      btnPractice: $("btn-practice"),
      dataConsentConfirm: $("data-consent-confirm"),
      ageConfirm: $("age-confirm"),
      consentError: $("consent-error"),
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
      introVeil: $("intro-veil"),
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
      voiceClipsValue: $("voice-clips-value"),
      trainingReadyValue: $("training-ready-value"),
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
      voiceStageLabel: $("voice-stage-label"),
      voiceStageProgress: $("voice-stage-progress"),
      chartProfile: $("chart-profile"),
      chartActions: $("chart-actions"),
      transcriptLoading: $("transcript-loading"),
      transcriptLoadingLabel: $("transcript-loading-label"),
      transcriptLabel: $("transcript-label"),
      transcriptArea: $("transcript-area"),
      chartRecord: $("chart-record"),
      voiceOutput: $("voice-output"),
      voiceAudio: $("voice-audio"),
      voiceRawMeta: $("voice-raw-meta"),
      verdictBox: $("verdict-box"),
      fallbackInput: $("fallback-input"),
      fallbackSend: $("fallback-send"),
      fallbackRow: document.querySelector("#chart-panel .fallback-row"),
      chartClose: $("chart-close"),
      touchLook: $("touch-look"),
      touchJoystick: $("touch-joystick"),
      touchJoystickKnob: $("touch-joystick-knob"),
      touchInteract: $("touch-interact"),
      screenFlash: $("screen-flash"),
      screenVignette: $("screen-vignette"),
      scorePops: $("score-pops"),
      comboPanel: $("combo-panel"),
      comboCount: $("combo-count"),
      comboMultiplier: $("combo-multiplier"),
      comboBarFill: $("combo-bar-fill"),
      proximityMeter: $("proximity-meter"),
      proximityFill: $("proximity-fill"),
      endMedals: $("end-medals"),
      endBest: $("end-best"),
      crewName: $("crew-name"),
      crewStation: $("crew-station"),
      endTeamField: $("end-team-field"),
      btnSaveName: $("btn-save-name"),
      lbTabs: Array.from(document.querySelectorAll("#end-screen .lb-tab")),
      playerName: $("player-name"),
      playerCrew: $("player-crew"),
      playerCrewField: $("player-crew-field"),
      playerNameError: $("player-name-error"),
      playerNameCount: $("player-name-count"),
      playerCrewCount: $("player-crew-count"),
      leaderboardOptInStart: $("leaderboard-opt-in-start"),
      identityAvatar: $("identity-avatar"),
      identityPreviewName: $("identity-preview-name"),
      identityPreviewCrew: $("identity-preview-crew"),
      identityState: $("identity-state"),
      settingsToggle: $("settings-toggle"),
      settingsPanel: $("settings-panel"),
      settingsClose: $("settings-close"),
      settingsTabs: Array.from(document.querySelectorAll(".settings-tab")),
      settingsSections: Array.from(document.querySelectorAll(".settings-section")),
      setSoundEnabled: $("set-sound-enabled"),
      setMusicVolume: $("set-music-volume"),
      setMusicValue: $("set-music-value"),
      setSfxVolume: $("set-sfx-volume"),
      setSfxValue: $("set-sfx-value"),
      settingsRun: $("settings-run"),
      settingsLevels: $("settings-levels"),
      setPlayerName: $("set-player-name"),
      setPlayerCrew: $("set-player-crew"),
      settingsTeamField: $("settings-team-field"),
      setSaveName: $("set-save-name"),
      settingsLbTabs: Array.from(document.querySelectorAll("#settings-panel .lb-tab")),
      settingsLeaderboard: $("settings-leaderboard"),
      contributionSummary: $("contribution-summary"),
      contributionRecovery: $("contribution-recovery"),
      withdrawContribution: $("withdraw-contribution"),
      withdrawRecoveryCode: $("withdraw-recovery-code"),
      withdrawByCode: $("withdraw-by-code"),
      withdrawStatus: $("withdraw-status"),
      adminLock: $("admin-lock"),
      adminPassword: $("admin-password"),
      adminUnlock: $("admin-unlock"),
      adminError: $("admin-error"),
      adminTools: $("admin-tools"),
      adminLockAgain: $("admin-lock-again"),
      adminLevels: $("admin-levels"),
      adminButtons: Array.from(document.querySelectorAll("[data-admin]")),
    };

    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      const activeElement = document.activeElement;
      const typingInFallback = activeElement === this.el.fallbackInput;
      // A field can remain focused after its menu is hidden (notably when a run
      // starts via Enter). Only a visible editor should suppress shortcuts.
      const typingAnywhere =
        ["INPUT", "TEXTAREA"].includes(activeElement?.tagName) &&
        Boolean(activeElement?.getClientRects?.().length);
      if (e.key === "Escape") {
        // The settings panel sits on top of everything, so it is what Escape
        // closes first; only then does Escape mean "leave the chart".
        if (this._settingsOpen) {
          this.closeSettings();
          return;
        }
        if (this._chartOpen && this.handlers.onCloseChart) {
          this.handlers.onCloseChart();
        }
        return;
      }
      if ((e.code === "KeyU" || e.key === "u" || e.key === "U") && !typingAnywhere) {
        e.preventDefault();
        this.toggleSettings();
        return;
      }
      if ((e.key === "m" || e.key === "M") && !typingAnywhere) {
        this.toggleAudio();
        return;
      }
      // Chart shortcuts stay behind the settings panel: it covers the chart, so
      // a keypress meant for the panel must not start a recording underneath.
      if (this._settingsOpen) return;
      if ((e.key === "v" || e.key === "V") && this._chartOpen && !typingInFallback) {
        this._vDown = true;
        this._requestRecordStart();
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

  get _settingsOpen() {
    return Boolean(this.el.settingsPanel) && !this.el.settingsPanel.classList.contains("hidden");
  }

  _hideMenus() {
    const activeElement = document.activeElement;
    if (["INPUT", "TEXTAREA"].includes(activeElement?.tagName)) activeElement.blur();
    this.setConsentBusy(false);
    this.el.startScreen.classList.add("hidden");
    this.el.briefingScreen.classList.add("hidden");
    this.el.endScreen.classList.add("hidden");
    this.hideLevelComplete();
  }

  // Same thing, for callers outside the UI — the dev level jump drops the
  // player straight into a map from whatever menu they were on.
  hideMenus() {
    this._hideMenus();
  }

  bindMain(h) {
    this.handlers = h;
    this.prefillPlayerName();
    this.el.btnStart.addEventListener("click", () => {
      // A public name is optional. Anonymous runs are shown as "Anonym" on the
      // board, so opting out of the name never blocks data collection.
      this._commitPlayerName();
      this._hideMenus();
      h.onStart();
    });
    this.el.playerName?.addEventListener("input", () => {
      this._playerNameTouched = true;
      this.updateStartIdentity();
    });
    this.el.playerCrew?.addEventListener("input", () => this.updateStartIdentity());
    this.el.playerName?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      if (!(this.el.playerName.value || "").trim()) {
        this.el.btnStart.click();
        return;
      }
      this.el.playerCrew?.focus({ preventScroll: true });
    });
    this.el.playerCrew?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      this.el.btnStart.click();
    });
    // This is deliberately not restored from local storage: a public
    // publication choice must be an active selection for the current run.
    this.syncLeaderboardOptIn(false);
    this.el.leaderboardOptInStart?.addEventListener("change", () => {
      const enabled = Boolean(this.el.leaderboardOptInStart.checked);
      this.syncLeaderboardOptIn(enabled);
      this.handlers.onLeaderboardOptInChanged?.(enabled);
    });
    const handleConsentClick = () => {
      const consentChecked = Boolean(this.el.dataConsentConfirm?.checked);
      const ageChecked = Boolean(this.el.ageConfirm?.checked);
      if (!consentChecked || !ageChecked) {
        if (this.el.consentError) {
          this.el.consentError.textContent = !ageChecked
            ? "Die Teilnahme ist erst ab 16 Jahren möglich."
            : "Bitte bestätige die Datenvereinbarung.";
        }
        this.el.consentError?.classList.remove("hidden");
        (ageChecked ? this.el.dataConsentConfirm : this.el.ageConfirm)?.focus({ preventScroll: true });
        return;
      }
      this.el.consentError?.classList.add("hidden");
      this.setConsentBusy(true);
      // Give immediate visual feedback while the consent/session request and
      // microphone preparation are in flight. The main controller restores the
      // briefing if the backend rejects the request.
      try {
        const pending = h.onConsentAccepted();
        pending?.catch?.((error) => {
          this.setConsentBusy(false);
          if (this.el.consentError) {
            this.el.consentError.textContent = String(error?.message || "Die Sitzung konnte nicht gestartet werden.");
            this.el.consentError.classList.remove("hidden");
          }
          this.showBriefing();
        });
      } catch (error) {
        this.setConsentBusy(false);
        if (this.el.consentError) {
          this.el.consentError.textContent = String(error?.message || "Die Sitzung konnte nicht gestartet werden.");
          this.el.consentError.classList.remove("hidden");
        }
        this.showBriefing();
      }
    };
    // Delegate from the stable briefing container so a static-host refresh or
    // a browser restoring the dialog cannot leave the visible button without
    // its consent handler. Pointer-down covers touch and restored dialogs in
    // browsers that fail to deliver the follow-up click after a checkbox
    // change; the short guard prevents a normal pointer click from starting
    // the contribution session twice.
    let lastConsentAttempt = 0;
    const handleConsentAttempt = (event) => {
      const now = performance.now();
      if (now - lastConsentAttempt < 350) return;
      lastConsentAttempt = now;
      handleConsentClick(event);
    };
    this.el.btnConsent.addEventListener("pointerdown", handleConsentAttempt);
    this.el.btnConsent.addEventListener("click", handleConsentAttempt);
    const handleConsentFromDocument = (event) => {
      const target = event.target instanceof Element ? event.target.closest("#btn-consent") : null;
      if (target === this.el.btnConsent) handleConsentAttempt(event);
    };
    document.addEventListener("pointerdown", handleConsentFromDocument, true);
    document.addEventListener("click", handleConsentFromDocument, true);
    const updateConsentButton = () => {
      const ready = Boolean(this.el.dataConsentConfirm?.checked && this.el.ageConfirm?.checked);
      if (ready) this.el.consentError?.classList.add("hidden");
    };
    this.el.dataConsentConfirm?.addEventListener("change", updateConsentButton);
    this.el.ageConfirm?.addEventListener("change", updateConsentButton);
    updateConsentButton();
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
    this.el.btnSaveName?.addEventListener("click", () => this._commitIdentity());
    for (const field of [this.el.crewName, this.el.crewStation]) {
      field?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        this._commitIdentity();
      });
    }
    this.el.crewName?.addEventListener("input", () => this._syncIdentityTeamVisibility(this.el.crewName.value));
    for (const tab of this.el.lbTabs) {
      tab.addEventListener("click", () => {
        this.audio?.play("ui-click");
        this.setLeaderboardScope(tab.dataset.scope);
      });
    }
    this._bindSettings();
    this.el.withdrawContribution?.addEventListener("click", async () => {
      if (!window.confirm("Alle gespeicherten Sprachaufnahmen widerrufen und löschen?")) return;
      this.el.withdrawContribution.disabled = true;
      if (this.el.withdrawStatus) this.el.withdrawStatus.textContent = "Löschung wird ausgeführt …";
      try {
        const result = await this.handlers.onWithdrawContribution?.();
        if (this.el.withdrawStatus) this.el.withdrawStatus.textContent = `${result?.deleted_clips || 0} Aufnahmen wurden gelöscht.`;
      } catch (error) {
        if (this.el.withdrawStatus) this.el.withdrawStatus.textContent = String(error?.message || "Löschung fehlgeschlagen.");
        this.el.withdrawContribution.disabled = false;
      }
    });
    this.el.withdrawByCode?.addEventListener("click", async () => {
      const code = String(this.el.withdrawRecoveryCode?.value || "").trim();
      if (!code) {
        if (this.el.withdrawStatus) this.el.withdrawStatus.textContent = "Bitte gib den Löschcode ein.";
        this.el.withdrawRecoveryCode?.focus({ preventScroll: true });
        return;
      }
      if (!window.confirm("Mit diesem Löschcode die gespeicherten Sprachaufnahmen widerrufen und löschen?")) return;
      this.el.withdrawByCode.disabled = true;
      if (this.el.withdrawStatus) this.el.withdrawStatus.textContent = "Löschung wird ausgeführt …";
      try {
        const result = await this.handlers.onWithdrawByCode?.(code);
        if (this.el.withdrawStatus) this.el.withdrawStatus.textContent = `${result?.deleted_clips || 0} Aufnahmen wurden gelöscht.`;
      } catch (error) {
        if (this.el.withdrawStatus) this.el.withdrawStatus.textContent = String(error?.message || "Löschung fehlgeschlagen.");
        this.el.withdrawByCode.disabled = false;
      }
    });
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
    this.syncSoundControls();
  }

  toggleAudio() {
    if (!this.audio) return;
    const enabled = this.audio.toggle();
    if (this.el.setSoundEnabled) {
      this.el.setSoundEnabled.setAttribute("aria-pressed", String(enabled));
      this.el.setSoundEnabled.textContent = enabled ? "An" : "Aus";
    }
    this.toast(enabled ? "Ton an" : "Ton aus", "info");
    if (enabled) this.audio.play("ui-confirm");
  }

  _commitIdentity() {
    const identity = saveIdentity({
      name: this.el.crewName?.value,
      crew: this.el.crewStation?.value,
    });
    if (this.el.crewName) this.el.crewName.value = identity.name;
    if (this.el.crewStation) this.el.crewStation.value = identity.crew;
    if (this.el.playerName) this.el.playerName.value = identity.name;
    if (this.el.playerCrew) this.el.playerCrew.value = identity.crew || "";
    this._syncIdentityTeamVisibility(identity.name);
    this.syncSettingsIdentity(identity);
    this.updateStartIdentity({ saved: true });
    this._lbIdentity = identity;
    this.renderLeaderboard(this._lbSummary);
    this.audio?.play("ui-confirm");
    this.handlers.onIdentityChanged?.(identity);
    return identity;
  }

  // ---------------------------------------------------------------------
  // Player name (start screen)
  // ---------------------------------------------------------------------

  _syncIdentityTeamVisibility(name) {
    const visible = Boolean(String(name || "").trim());
    const fields = [
      [this.el.playerCrewField, this.el.playerCrew],
      [this.el.endTeamField, this.el.crewStation],
      [this.el.settingsTeamField, this.el.setPlayerCrew],
    ];
    for (const [field, input] of fields) {
      field?.classList.toggle("hidden", !visible);
      field?.setAttribute("aria-hidden", String(!visible));
      if (input) input.disabled = !visible;
    }
    return visible;
  }

  prefillPlayerName() {
    const stored = hasStoredIdentity() ? loadIdentity() : null;
    if (this.el.playerName) this.el.playerName.value = stored?.name || "";
    if (this.el.playerCrew) this.el.playerCrew.value = stored?.crew || "";
    this.syncSettingsIdentity(stored || { name: "", crew: "" });
    this._playerNameTouched = false;
    this.updateStartIdentity();
  }

  updateStartIdentity({ saved = false } = {}) {
    const name = (this.el.playerName?.value || "").trim();
    let crew = (this.el.playerCrew?.value || "").trim();
    if (!name && crew) {
      crew = "";
      if (this.el.playerCrew) this.el.playerCrew.value = "";
    }
    const stored = hasStoredIdentity() ? loadIdentity() : null;
    const storedCrew = (stored?.crew || "").trim();
    const unchanged = Boolean(name) && stored?.name === name && storedCrew === crew;
    const hasName = Boolean(name);
    const invalid = false;

    if (this.el.playerNameCount) this.el.playerNameCount.textContent = `${this.el.playerName?.value.length || 0} / 28`;
    if (this.el.playerCrewCount) this.el.playerCrewCount.textContent = `${this.el.playerCrew?.value.length || 0} / 28`;
    this._syncIdentityTeamVisibility(name);
    if (this.el.identityAvatar) {
      const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toLocaleUpperCase("de-DE");
      this.el.identityAvatar.textContent = initials || "?";
      this.el.identityAvatar.classList.toggle("ready", hasName);
    }
    if (this.el.identityPreviewName) this.el.identityPreviewName.textContent = name || "Anonym teilnehmen";
    if (this.el.identityPreviewCrew) {
      this.el.identityPreviewCrew.textContent = hasName ? (crew || "Team optional") : "Team wird nach dem Namen eingeblendet";
    }
    if (this.el.identityState) {
      const state = !hasName ? "anonymous" : saved || unchanged ? "saved" : "ready";
      this.el.identityState.className = `identity-state ${state}`;
      this.el.identityState.textContent = state === "saved" ? "GESPEICHERT" : state === "ready" ? "BEREIT" : "OPTIONAL";
    }
    this.el.playerName?.classList.toggle("invalid", invalid);
    this.el.playerName?.setAttribute("aria-invalid", String(invalid));
    this.el.playerNameError?.classList.add("hidden");
  }

  // Save the optional public identity. An empty name deliberately remains a
  // valid choice and is published as "Anonym" when the run is submitted.
  _commitPlayerName() {
    const raw = (this.el.playerName?.value || "").trim();
    const identity = saveIdentity({ name: raw, crew: raw ? this.el.playerCrew?.value : "" });
    if (this.el.playerName) this.el.playerName.value = identity.name;
    if (this.el.playerCrew) this.el.playerCrew.value = identity.crew || "";
    this._lbIdentity = identity;
    this.prefillIdentity(identity);
    this.syncSettingsIdentity(identity);
    this.updateStartIdentity({ saved: true });
    this.handlers.onIdentityChanged?.(identity);
    return identity;
  }

  syncSettingsIdentity(identity = loadIdentity()) {
    if (this.el.setPlayerName) this.el.setPlayerName.value = identity?.name || "";
    if (this.el.setPlayerCrew) this.el.setPlayerCrew.value = identity?.crew || "";
    this._syncIdentityTeamVisibility(identity?.name);
  }

  // ---------------------------------------------------------------------
  // Settings panel
  // ---------------------------------------------------------------------

  _bindSettings() {
    this.el.settingsToggle?.addEventListener("click", () => this.toggleSettings());
    this.el.settingsClose?.addEventListener("click", () => this.closeSettings());
    this.el.settingsPanel?.addEventListener("click", (event) => {
      if (event.target === this.el.settingsPanel) this.closeSettings();
    });
    for (const tab of this.el.settingsTabs) {
      tab.addEventListener("click", () => this.setSettingsTab(tab.dataset.tab));
    }

    this.el.setSoundEnabled?.addEventListener("click", () => {
      this.toggleAudio();
      this.syncSoundControls();
    });
    const bindVolume = (input, setter) => {
      if (!input) return;
      const apply = () => {
        this.audio?.unlock();
        setter(Number(input.value) / 100);
        this.syncSoundControls();
      };
      input.addEventListener("pointerdown", () => this.audio?.unlock(), { passive: true });
      input.addEventListener("keydown", () => this.audio?.unlock(), { passive: true });
      input.addEventListener("input", apply);
      input.addEventListener("change", apply);
    };
    bindVolume(this.el.setMusicVolume, (value) => this.audio?.setMusicVolume(value));
    bindVolume(this.el.setSfxVolume, (value) => this.audio?.setSfxVolume(value));
    // One preview beep on release, so a slider drag is not a machine-gun of
    // test tones but still tells the player what they just set.
    this.el.setSfxVolume?.addEventListener("change", () => this.audio?.play("ui-confirm"));

    this.el.setSaveName?.addEventListener("click", () => this._commitSettingsIdentity());
    for (const field of [this.el.setPlayerName, this.el.setPlayerCrew]) {
      field?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        this._commitSettingsIdentity();
      });
    }
    this.el.setPlayerName?.addEventListener("input", () => this._syncIdentityTeamVisibility(this.el.setPlayerName.value));
    for (const tab of this.el.settingsLbTabs) {
      tab.addEventListener("click", () => {
        this.audio?.play("ui-click");
        this._setLbScope = tab.dataset.scope;
        for (const other of this.el.settingsLbTabs) other.classList.toggle("active", other === tab);
        this.renderSettingsBoard();
      });
    }

    this.el.adminUnlock?.addEventListener("click", () => this._tryAdminUnlock());
    this.el.adminPassword?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      this._tryAdminUnlock();
    });
    this.el.adminPassword?.addEventListener("input", () => this.el.adminError?.classList.add("hidden"));
    this.el.adminLockAgain?.addEventListener("click", () => {
      this.setAdmin(false);
      this.toast("Admin-Modus gesperrt.", "info");
    });
    for (const button of this.el.adminButtons) {
      button.addEventListener("click", () => this._runAdminAction(button.dataset.admin));
    }
    this.setAdmin(this._admin, { silent: true });
  }

  toggleSettings() {
    if (this._settingsOpen) this.closeSettings();
    else this.openSettings();
  }

  openSettings() {
    if (!this.el.settingsPanel || this._settingsOpen) return;
    this.audio?.unlock();
    this.el.settingsPanel.classList.remove("hidden");
    this.el.settingsToggle?.setAttribute("aria-expanded", "true");
    this.syncSoundControls();
    this.syncSettingsIdentity(this._lbIdentity || loadIdentity());
    this._lbData.local = loadLocalRuns();
    this.applySettingsSnapshot(this.handlers.onSettingsOpen?.() || null);
    this.setSettingsTab(this._settingsTab, { silent: true });
    this.el.settingsClose?.focus({ preventScroll: true });
    emit("ui:settings-open", {});
  }

  closeSettings() {
    if (!this._settingsOpen) return;
    this.el.settingsPanel.classList.add("hidden");
    this.el.settingsToggle?.setAttribute("aria-expanded", "false");
    this.audio?.play("ui-back");
    emit("ui:settings-close", {});
  }

  setSettingsTab(tab, { silent = false } = {}) {
    const name = tab || "sound";
    this._settingsTab = name;
    for (const button of this.el.settingsTabs) button.classList.toggle("active", button.dataset.tab === name);
    for (const section of this.el.settingsSections) {
      const match = section.dataset.panel === name;
      section.classList.toggle("hidden", !match);
      section.setAttribute("aria-hidden", String(!match));
    }
    if (name === "board") this.renderSettingsBoard();
    if (name === "progress") this.renderProgress();
    if (name === "data") this.renderContributionSummary(this.handlers.onContributionSummary?.() || null);
    if (!silent) this.audio?.play("ui-click");
  }

  syncSoundControls() {
    const enabled = Boolean(this.audio?.enabled);
    if (this.el.setSoundEnabled) {
      this.el.setSoundEnabled.setAttribute("aria-pressed", String(enabled));
      this.el.setSoundEnabled.textContent = enabled ? "An" : "Aus";
    }
    const music = Math.round((this.audio?.musicVolume ?? 0.7) * 100);
    const sfx = Math.round((this.audio?.sfxVolume ?? 0.85) * 100);
    if (this.el.setMusicVolume) this.el.setMusicVolume.value = String(music);
    if (this.el.setSfxVolume) this.el.setSfxVolume.value = String(sfx);
    if (this.el.setMusicValue) this.el.setMusicValue.textContent = `${music} %`;
    if (this.el.setSfxValue) this.el.setSfxValue.textContent = `${sfx} %`;
  }

  _commitSettingsIdentity() {
    const identity = saveIdentity({
      name: this.el.setPlayerName?.value,
      crew: this.el.setPlayerCrew?.value,
    });
    this.syncSettingsIdentity(identity);
    this.prefillIdentity(identity);
    if (this.el.playerName) this.el.playerName.value = identity.name;
    if (this.el.playerCrew) this.el.playerCrew.value = identity.crew || "";
    this._lbIdentity = identity;
    this.updateStartIdentity({ saved: true });
    this.audio?.play("ui-confirm");
    this.toast(identity.name ? `Spielername gespeichert: ${identity.name}` : "Spielerprofil anonym gespeichert", "good");
    this.renderSettingsBoard();
    this.renderLeaderboard(this._lbSummary);
    this.handlers.onIdentityChanged?.(identity);
    return identity;
  }

  // The snapshot is whatever main.js knows about the run right now. The panel
  // never reaches into the game itself, so opening it cannot change anything.
  applySettingsSnapshot(snapshot) {
    this._settingsSnapshot = snapshot;
    this.renderProgress();
    this.renderSettingsBoard();
    this._renderAdminLevels();
  }

  renderProgress() {
    const host = this.el.settingsLevels;
    if (!host) return;
    const snap = this._settingsSnapshot || {};
    const results = Array.isArray(snap.results) ? snap.results : [];
    const current = snap.current || null;
    const running = Boolean(snap.running);
    const levelIndex = Number.isInteger(snap.levelIndex) ? snap.levelIndex : 0;

    if (this.el.settingsRun) {
      const savedNow = (Number(snap.savedTotal) || 0) + (current ? Number(current.saved) || 0 : 0);
      const totalNow = (Number(snap.patientTotal) || 0) + (current ? Number(current.total) || 0 : 0);
      const elapsedNow = (Number(snap.elapsed) || 0) + (current ? Number(current.elapsed) || 0 : 0);
      const tiles = [
        ["Level", `${Math.min(results.length + (running ? 1 : 0), LEVELS.length)}/${LEVELS.length}`],
        ["Gerettet", `${savedNow}/${totalNow}`],
        ["Punkte", String(current ? current.score : snap.score || 0)],
        ["Genauigkeit", snap.accuracySamples ? `${snap.accuracy}%` : "—"],
        ["Zeit", mmss(elapsedNow)],
        ["Beste Serie", String(snap.bestStreak || 0)],
        ["Versteckte", `${snap.hiddenFound || 0}/${snap.hiddenTotal || 0}`],
      ];
      this.el.settingsRun.innerHTML = tiles
        .map(([label, value]) => `<div><span>${label}</span><b>${escapeHtml(value)}</b></div>`)
        .join("");
    }

    host.innerHTML = LEVELS.map((level, index) => {
      const done = index < results.length;
      const isCurrent = running && index === levelIndex && !done;
      const state = done ? "done" : isCurrent ? "current" : "locked";
      const hidden = hiddenCount(level);
      const meta = [
        level.subtitle,
        `${level.patientCount} Patient${level.patientCount === 1 ? "" : "en"}`,
        hidden ? `<span class="hidden-count">${hidden} versteckt</span>` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      const result = done
        ? `<b>${results[index].saved}/${results[index].total}</b>${mmss(results[index].elapsed)}`
        : isCurrent
          ? `<b>${current ? current.saved : 0}/${current ? current.total : level.patientCount}</b>läuft`
          : "—";
      return (
        `<div class="level-card ${state}">` +
        `<span class="level-no">${done ? "✔" : index + 1}</span>` +
        `<span><span class="level-name">${escapeHtml(level.title)}</span>` +
        `<span class="level-meta">${meta}</span></span>` +
        `<span class="level-result">${result}</span>` +
        `</div>`
      );
    }).join("");
  }

  renderContributionSummary(summary, recoveryCode = null) {
    if (summary) this._contributionSummary = summary;
    const data = this._contributionSummary || {};
    if (this.el.contributionSummary) {
      const tiles = [
        ["Beiträge", data.contributed_clips || 0],
        ["Audio akzeptiert", data.basic_accepted_clips || 0],
        ["Training-ready", data.training_ready_clips || 0],
        ["In Prüfung", data.review_required_clips || 0],
        ["Beitragspunkte", data.contribution_units || 0],
        ["Durchläufe", data.completed_shifts || 0],
        ["Rang", data.rank || "Datenhelfer"],
      ];
      this.el.contributionSummary.innerHTML = tiles
        .map(([label, value]) => `<div><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`)
        .join("");
    }
    if (recoveryCode && this.el.contributionRecovery) {
      this.el.contributionRecovery.textContent = `Löschcode: ${recoveryCode}`;
      this.el.contributionRecovery.classList.remove("hidden");
    }
  }

  renderSettingsBoard() {
    const host = this.el.settingsLeaderboard;
    if (!host) return;
    const summary = this._settingsSnapshot?.summary || this._lbSummary;
    if (!summary) {
      host.innerHTML = `<p class="lb-note">Die Bestenliste zeigt deinen Beitrag, sobald die erste Datensammlung läuft.</p>`;
      return;
    }
    this.renderLeaderboard(summary, {
      host,
      scope: this._setLbScope,
      youKey: this._settingsSnapshot?.runKey || this._lbYouKey[this._setLbScope],
    });
  }

  // ---------------------------------------------------------------------
  // Admin (dev tools)
  // ---------------------------------------------------------------------

  _tryAdminUnlock() {
    const value = this.el.adminPassword?.value || "";
    if (value !== ADMIN_PASSWORD) {
      this.el.adminError?.classList.remove("hidden");
      this.audio?.play("warn");
      return false;
    }
    if (this.el.adminPassword) this.el.adminPassword.value = "";
    this.el.adminError?.classList.add("hidden");
    this.setAdmin(true);
    this.toast("🔓 Admin-Modus aktiv — Level lassen sich jetzt überspringen.", "good");
    return true;
  }

  setAdmin(on, { silent = false } = {}) {
    this._admin = Boolean(on);
    try {
      if (this._admin) globalThis.sessionStorage?.setItem(ADMIN_SESSION_KEY, "1");
      else globalThis.sessionStorage?.removeItem(ADMIN_SESSION_KEY);
    } catch (err) {
      /* private mode, or no storage at all */
    }
    this.el.adminLock?.classList.toggle("hidden", this._admin);
    this.el.adminTools?.classList.toggle("hidden", !this._admin);
    for (const tab of this.el.settingsTabs) {
      if (tab.dataset.tab === "admin") tab.classList.toggle("admin-on", this._admin);
    }
    if (this._admin) this._renderAdminLevels();
    if (!silent) this.audio?.play(this._admin ? "ui-confirm" : "ui-back");
    return this._admin;
  }

  get isAdmin() {
    return this._admin;
  }

  _renderAdminLevels() {
    const host = this.el.adminLevels;
    if (!host) return;
    const active = this._settingsSnapshot?.levelIndex ?? -1;
    host.innerHTML = LEVELS.map(
      (level, index) =>
        `<button class="btn small${index === active ? " current" : ""}" type="button" data-jump="${index}">` +
        `${index + 1} · ${escapeHtml(level.title)}</button>`,
    ).join("");
    for (const button of host.querySelectorAll("[data-jump]")) {
      button.addEventListener("click", () => this._runAdminAction("jump-level", { index: Number(button.dataset.jump) }));
    }
  }

  _runAdminAction(action, payload = {}) {
    if (!this._admin || !action) return;
    const result = this.handlers.onAdminAction?.(action, payload);
    if (result?.message) this.toast(result.message, result.ok === false ? "warn" : "good");
    if (result?.close) this.closeSettings();
    else this.applySettingsSnapshot(this.handlers.onSettingsOpen?.() || null);
  }

  _requestRecordStart() {
    if (!this._chartOpen || this._recording || this.el.chartRecord?.disabled) return;
    this._recording = true;
    this.setRecordingUI(true, false);
    // The cue plays before the microphone opens; the music is already silent
    // by the time the controller asks getUserMedia for the input stream.
    this.audio?.play("record-start");
    this.audio?.duck("recording", true);
    emit("ui:record-start", {});
  }

  _requestRecordStop() {
    if (!this._recording) return;
    this._recording = false;
    this.setRecordingUI(false, true);
    emit("ui:record-stop", {});
    // stopRecording tears the stream down synchronously before its upload
    // promise is returned, so the cue is audible but never recorded.
    this.audio?.play("record-stop");
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
      // Older cached pages may not contain the optional touch action yet.
      // Missing touch markup must never abort the whole app boot and leave the
      // loading overlay covering the game forever.
      if (!element) return;
      element.addEventListener("pointerdown", (event) => {
        if (!isTouchPointer(event)) return;
        event.preventDefault();
        element.setPointerCapture?.(event.pointerId);
        emit(eventName, {});
      });
    };
    bindTap(this.el.touchInteract, "input:interact");

  }

  showStart(sttReady = null) {
    this.el.startScreen.classList.remove("hidden");
    this.el.briefingScreen.classList.add("hidden");
    this.el.endScreen.classList.add("hidden");
    this.el.hud.classList.add("hidden");
    this.syncLeaderboardOptIn(false);
    this.handlers.onLeaderboardOptInChanged?.(false);
    this.prefillPlayerName();
    this._setBadge(sttReady);
  }

  showBriefing() {
    this.setConsentBusy(false);
    this.el.startScreen.classList.add("hidden");
    this.el.endScreen.classList.add("hidden");
    this.el.briefingScreen.classList.remove("hidden");
    const target = this.el.dataConsentConfirm?.checked && this.el.ageConfirm?.checked
      ? this.el.btnConsent
      : this.el.dataConsentConfirm || this.el.ageConfirm || this.el.btnConsent;
    target?.focus({ preventScroll: true });
  }

  setConsentBusy(busy) {
    const button = this.el.btnConsent;
    if (!button) return;
    const waiting = Boolean(busy);
    // Keep the button clickable before the checks are ticked. The handler then
    // explains exactly which confirmation is missing. Relying on a disabled
    // button made restored/cached dialogs look dead when the browser restored
    // checkbox state without replaying the change event.
    button.disabled = waiting;
    button.setAttribute("aria-busy", String(waiting));
    button.textContent = waiting ? "Datensammlung wird vorbereitet …" : "Einwilligen & Datensammlung starten";
  }

  syncLeaderboardOptIn(value = false) {
    const enabled = Boolean(value);
    if (this.el.leaderboardOptInStart) this.el.leaderboardOptInStart.checked = enabled;
    return enabled;
  }

  _setBadge(sttReady) {
    const badge = this.el.sttBadge;
    if (sttReady === null || sttReady === "checking") {
      badge.className = "badge unknown";
      badge.textContent = "STT: wird geprüft …";
      return;
    }
    if (sttReady) {
      badge.className = "badge ready";
      badge.textContent = "STT: bereit";
    } else {
      badge.className = "badge unavailable";
      badge.textContent = "STT: nicht verfügbar";
    }
  }

  setSttStatus(state, detail) {
    this._sttState = state;
    if (!this.el.startScreen.classList.contains("hidden")) {
      this._setBadge(state === "ready");
    }
    if (state === "recording") {
      this._recording = true;
      this.setTranscriptionLoading(false);
      this.setRecordingUI(true, false);
    } else if (state === "transcribing") {
      this._recording = false;
      this.setTranscriptionLoading(true, detail || "Wird verarbeitet …");
      this.setRecordingUI(false, true);
    } else if (state === "idle" || state === "ready" || state === "error" || state === "unavailable") {
      this._recording = false;
      if (!this._voiceSubmissionPending) this.setTranscriptionLoading(false);
      this.setRecordingUI(false, false);
    }
  }

  setTranscriptionLoading(active, detail = "Wird verarbeitet …") {
    const loading = this.el.transcriptLoading;
    if (!loading) return;
    loading.classList.toggle("hidden", !active);
    loading.setAttribute("aria-busy", String(Boolean(active)));
    if (active && this.el.transcriptLoadingLabel) {
      this.el.transcriptLoadingLabel.textContent = String(detail || "Wird verarbeitet …");
    }
  }

  setRecordingUI(isRecording, busy = false) {
    const button = this.el.chartRecord;
    if (!button) return;
    button.disabled = Boolean(busy || this._voiceSubmissionPending);
    button.classList.toggle("recording", Boolean(isRecording));
    button.setAttribute("aria-pressed", String(Boolean(isRecording)));
    button.textContent = busy
      ? "⏳ Transkription läuft …"
      : this._voiceSubmissionPending
        ? "✔ Aufnahme gespeichert"
      : isRecording
        ? "■ Aufnahme stoppen"
        : "🎤 Aufnahme starten";
  }

  setVoiceSubmissionPending(pending) {
    this._voiceSubmissionPending = Boolean(pending);
    if (this._voiceSubmissionPending) this.setTranscriptionLoading(true, "Wird verarbeitet …");
    else if (this._sttState !== "transcribing") this.setTranscriptionLoading(false);
    this.setRecordingUI(this._recording, false);
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
    if (this.el.voiceClipsValue) {
      const accepted = Number(state.acceptedVoiceClips) || 0;
      const required = Number(state.requiredVoiceClips) || 0;
      this.el.voiceClipsValue.textContent = required ? `${accepted}/${required}` : String(accepted);
    }
    if (this.el.trainingReadyValue) this.el.trainingReadyValue.textContent = String(Number(state.trainingReadyClips) || 0);
    if (this.el.hiddenHint) {
      const remaining = Number(state.hiddenRemaining) || 0;
      this.el.hiddenHint.textContent = remaining
        ? `${remaining} Patient${remaining === 1 ? "" : "en"} noch nicht gesichtet`
        : "";
      this.el.hiddenHint.classList.toggle("hidden", remaining === 0);
    }
  }

  // Held over the campaign's first frame while the corridor meshes, then
  // removed outright — the element is purely decorative and must not sit on top
  // of the canvas for the rest of the run.
  showIntroVeil() {
    const veil = this.el.introVeil;
    if (!veil) return;
    clearTimeout(this._veilTimer);
    veil.classList.remove("hidden");
    // Restarting the animation needs the element out of the flow for a frame,
    // or a second run of the intro shows an already-finished veil.
    veil.style.animation = "none";
    void veil.offsetWidth;
    veil.style.animation = "";
    this._veilTimer = setTimeout(() => veil.classList.add("hidden"), 2500);
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
    const contributionMode = Boolean(view.contributionMode);
    if (contributionMode) {
      this.setVoicePrompt(view.voicePrompt || {
        label: "Bericht sprechen",
        stageNumber: 1,
        stageCount: 1,
        text: view.hint,
      });
    } else {
      if (this.el.voiceStageLabel) this.el.voiceStageLabel.textContent = "ÜBUNGSMODUS · GETIPPTER BERICHT";
      if (this.el.voiceStageProgress) this.el.voiceStageProgress.textContent = "—";
      if (this.el.chartHint) {
        this.el.chartHint.innerHTML = `<span class="script-label">OHNE DATENSPENDE ÜBEN</span><span class="script-copy">Gib deinen Bericht unten ein. Es wird kein Mikrofon geöffnet und kein Beitrag gesendet.</span>`;
      }
    }
    this.el.chartRecord?.classList.toggle("hidden", !contributionMode);
    this.el.fallbackRow?.classList.toggle("hidden", contributionMode);
    if (!contributionMode && this.el.fallbackInput) this.el.fallbackInput.value = "";
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
    this._voiceSubmissionPending = Boolean(contributionMode && view.acceptedVoiceClips > 0 && !view.resolved);
    this.setTranscriptionLoading(contributionMode && (this._sttState === "transcribing" || this._voiceSubmissionPending));
    this.setRecordingUI(false, contributionMode && this._sttState === "transcribing");
    this.clearVoiceOutput();
    this.clearVerdict();
    this.updateChartTimer(view.elapsed);
    this.el.chartPanel.classList.remove("hidden");
  }

  setVoicePrompt(prompt) {
    if (!prompt) return;
    if (this.el.voiceStageLabel) this.el.voiceStageLabel.textContent = String(prompt.label || "Sprachaufgabe").toUpperCase();
    if (this.el.voiceStageProgress) this.el.voiceStageProgress.textContent = `${prompt.stageNumber || 1}/${prompt.stageCount || 1}`;
    if (this.el.chartHint) {
      this.el.chartHint.innerHTML = `<span class="script-label">SPRICH DEN BERICHT VOR</span><span class="script-copy">${escapeHtml(prompt.text || "")}</span>`;
    }
    this.clearVerdict();
    this.transcriptPlaceholder();
  }

  showVoiceAccepted({ uploaded = false, completed = false } = {}) {
    this.clearVerdict();
    const line = document.createElement("div");
    line.className = "feedback-line good";
    line.textContent = uploaded
      ? "AUFNAHME GESPEICHERT — GENAUIGKEIT WIRD BERECHNET"
      : completed
        ? "BERICHT ABGESCHLOSSEN ✔"
        : "AUFNAHME GESPEICHERT ✔";
    this.el.verdictBox.appendChild(line);
  }

  updateChartTimer(elapsedSeconds) {
    this.el.chartTimer.textContent = mmss(elapsedSeconds);
    this.el.chartTimer.classList.remove("critical");
  }

  transcriptPlaceholder() {
    this.el.transcriptArea.textContent = "";
    this.el.transcriptArea.classList.add("hidden");
    this.el.transcriptLabel?.classList.add("hidden");
  }

  appendTranscript(text) {
    if (!text) {
      this.transcriptPlaceholder();
    } else {
      this.el.transcriptArea.textContent = text;
      this.el.transcriptArea.classList.remove("hidden");
      this.el.transcriptLabel?.classList.remove("hidden");
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
    const practice = summary.playMode === "practice";
    this.el.endTitle.textContent = practice
      ? (complete ? "ÜBUNG ABGESCHLOSSEN" : "ÜBUNG BEENDET")
      : (complete ? "ALLE LEVEL ABGESCHLOSSEN" : "DURCHLAUF BEENDET");
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
      (practice
        ? `<div>Sprachdatenspende: <b>nicht aktiviert</b></div>`
        : `<div>Gespeicherte Audioaufnahmen: <b>${summary.acceptedVoiceClips || 0}/${summary.requiredVoiceClips || 0}</b></div>` +
          `<div>Training-ready bisher: <b>${summary.trainingReadyClips || 0}</b></div>`) +
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
    this._publicLeaderboardOptIn = Boolean(extras.publicLeaderboardOptIn);
    this.setLeaderboardScope(this._lbData.global ? "global" : "local", { silent: true });

    this.el.btnRestart.textContent = practice ? "↻ Neue Übung starten" : "↻ Neue 5-Level-Datensammlung";
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
      medals.push({ cls: "green", icon: "🎙", label: "Berichtsgenauigkeit", detail: `${summary.accuracy}% Genauigkeit` });
    } else if (summary.accuracySamples > 0 && summary.accuracy >= 75) {
      medals.push({ cls: "green", icon: "🎙", label: "Klarer Bericht", detail: `${summary.accuracy}%` });
    }
    if (extras.hiddenTotal > 0 && extras.hiddenFound >= extras.hiddenTotal) {
      medals.push({ cls: "blue", icon: "🔎", label: "Alle Versteckten gefunden", detail: `${extras.hiddenFound}/${extras.hiddenTotal}` });
    } else if (extras.hiddenFound > 0) {
      medals.push({ cls: "blue", icon: "🔎", label: "Versteckte gefunden", detail: `${extras.hiddenFound}/${extras.hiddenTotal}` });
    }
    if (extras.bestStreak >= 5) medals.push({ cls: "green", icon: "🔥", label: "Serie", detail: `${extras.bestStreak} in Folge` });
    if (savedAll && summary.elapsed > 0 && summary.elapsed < 900) {
      medals.push({ cls: "gold", icon: "⚡", label: "Schneller Durchlauf", detail: mmss(summary.elapsed) });
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
    this._syncIdentityTeamVisibility(identity?.name);
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
    // `host` lets the settings panel reuse the same renderer for its own copy
    // of the board; without one this is the end screen, exactly as before.
    const host = options.host || this.el.endLeaderboard;
    if (!host || !summary) return;
    const scope = options.scope || this._lbScope || "demo";
    const entries = scope === "demo" ? null : this._lbData[scope];
    const board = leaderboardView(summary, {
      scope,
      entries: entries || undefined,
      identity: options.identity || this._lbIdentity,
      youKey: options.youKey ?? this._lbYouKey[scope],
      includeYou: scope !== "global" || this._publicLeaderboardOptIn,
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

    const place = scope === "global" && !this._publicLeaderboardOptIn
      ? "Lauf nicht veröffentlicht"
      : `Platz ${board.yourRank} von ${board.count}`;
    host.innerHTML =
      `<div class="lb-head"><b>${heading}</b><span>${place}</span></div>` +
      `<div class="lb-legend"><span class="lb-rank">#</span><span class="lb-name">Spieler</span>` +
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
    if (this._settingsOpen && this._setLbScope === "global") this.renderSettingsBoard();
  }

  closeChart() {
    this.el.chartPanel.classList.add("hidden");
    this._recording = false;
    this._voiceSubmissionPending = false;
    this.setTranscriptionLoading(false);
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

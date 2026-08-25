import * as THREE from "../vendor/three.module.js";
import { emit, on } from "./events.js";
import { World } from "./world.js?v=20260824-transcript1";
import { Player } from "./player.js?v=20260825-funny3";
import { PatientManager } from "./entities.js";
import { Game } from "./gameplay.js?v=20260824-consent10";
import { SpeechClient } from "./stt.js?v=20260824-recording90";
import { UI } from "./ui.js?v=20260825-funny4";
import { OtherMode } from "./other_mode.js?v=20260825-funny3";
import { GameAudio } from "./audio.js";
import { HOTBAR_ITEMS } from "./items.js";
import { randomSeed } from "./cases.js";
import { Campaign } from "./campaign.js";
import { IntroSequence } from "./intro.js?v=20260825-signremoved1";
import { LEVELS } from "./levels.js";
import { ContributionClient } from "./contributions.js?v=20260825-role2";
import {
  fetchRemoteRuns,
  LEADERBOARD_CONSENT_VERSION,
  loadIdentity,
  runFromSummary,
  saveLocalRun,
  submitRun,
  updatePersonalBest,
} from "./leaderboard.js?v=20260824-consent10";

const $ = (id) => document.getElementById(id);
const TELEPORT_DELAY_MS = 6000;

function isContributionServiceUnavailable(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return /failed to fetch|networkerror|load failed|server antwortet nicht|http 5\d\d/.test(message);
}

const DISPLAY_SETTINGS_KEY = "medicraft.display-settings.v2";
const DISPLAY_FOV_DEFAULTS = Object.freeze({ phone: 85, ipad: 77, pc: 72 });
const DISPLAY_SETTINGS_DEFAULTS = Object.freeze({ crosshair: true, reducedMotion: false });

function displayDeviceClass() {
  const navigatorLike = globalThis.navigator || {};
  const userAgent = String(navigatorLike.userAgent || "");
  const platform = String(navigatorLike.platform || "");
  const touchPoints = Number(navigatorLike.maxTouchPoints || 0);
  const coarsePointer = globalThis.matchMedia?.("(hover: none) and (pointer: coarse)").matches === true;
  const width = Number(globalThis.innerWidth || 0);
  const height = Number(globalThis.innerHeight || 0);
  const ipad = /iPad/i.test(userAgent) || (platform === "MacIntel" && touchPoints > 1);
  const phone = !ipad && (
    /iPhone|iPod|Android.*Mobile|Windows Phone/i.test(userAgent) ||
    (coarsePointer && Math.min(width || Infinity, height || Infinity) <= 760)
  );
  return ipad ? "ipad" : phone ? "phone" : "pc";
}

function defaultDisplayFov() {
  return DISPLAY_FOV_DEFAULTS[displayDeviceClass()];
}

function clampDisplayFov(value, fallback = defaultDisplayFov()) {
  return Math.max(60, Math.min(110, Math.round(Number(value) || fallback)));
}

function loadDisplaySettings() {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(DISPLAY_SETTINGS_KEY) || "{}");
    return {
      fov: clampDisplayFov(parsed.fov, defaultDisplayFov()),
      crosshair: parsed.crosshair !== false,
      reducedMotion: Boolean(parsed.reducedMotion),
    };
  } catch (error) {
    return { fov: defaultDisplayFov(), ...DISPLAY_SETTINGS_DEFAULTS };
  }
}

function saveDisplaySettings(settings) {
  try {
    globalThis.localStorage?.setItem(DISPLAY_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    // Blocked or private storage must never stop the game.
  }
}

// A streak is consecutive patients saved without losing one. It is worth real
// points, which is what makes "read the next chart properly" the interesting
// choice instead of "run to the next beacon".
const STREAK_BONUS = 25;
const STREAK_MAX_MULTIPLIER = 2;

// How far away a concealed casualty starts registering on the proximity meter
// and the search ping. Slightly outside the reveal radius, so the ping leads
// the player in rather than confirming what the beacon already showed.
const SEARCH_RANGE = 26;
const REVEAL_RANGE = 9;

// Rendering budget. Menus do not need 144 fps, and a hidden tab needs none.
const MENU_FRAME_MS = 1000 / 30;

export class App {
  constructor() {
    this.mode = "loading";
    this.currentPatientId = null;
    this.currentReportScript = "";
    this.hudAccumulator = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.hiddenFound = 0;
    this.hiddenTotal = 0;
    this.runSubmitted = false;
    this.lastSummary = null;
    this.searchPingCooldown = 0;
    this.lastFrameAt = 0;
    this.runKey = null;
    this._resumeAfterSettings = false;
    this.playMode = "campaign";
    this.leaderboardOptIn = false;
    this.medicContext = false;
    this.trainingReadyClips = 0;
    this.displaySettings = loadDisplaySettings();

    const touchDevice =
      navigator.maxTouchPoints > 0 ||
      window.matchMedia?.("(hover: none) and (pointer: coarse)").matches === true ||
      window.innerWidth <= 760;
    this.touchDevice = touchDevice;
    this.view = $("app");
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    const view = this.viewportSize();
    this.renderer.setPixelRatio(this.pixelRatio());
    // updateStyle = false: the stylesheet stretches the canvas over #app, so
    // only the drawing buffer follows a measurement. Letting three.js write an
    // inline width/height instead is what left part of the screen black.
    this.renderer.setSize(view.width, view.height, false);
    this.view.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.008);

    this.camera = new THREE.PerspectiveCamera(this.displaySettings.fov, view.width / view.height, 0.1, 420);

    this.hemiLight = new THREE.HemisphereLight(0xcfe8ff, 0x54442e, 0.9);
    this.scene.add(this.hemiLight);
    this.dirLight = new THREE.DirectionalLight(0xfff3d6, 1.15);
    this.dirLight.position.set(60, 90, 30);
    this.scene.add(this.dirLight);

    this.campaign = new Campaign(LEVELS);
    this.levelTimer = null;

    // The first map used to be generated before the menu appeared, then
    // generated a second time when the player actually started the mission.
    // Keep the menu lightweight and build the world only when it is needed.
    this.world = null;
    // Only the first level has an opening corridor; it also keeps automatic
    // sprint disabled for the whole level.
    this.intro = null;
    this.player = new Player(this.camera, null, this.renderer.domElement);
    this.entities = new PatientManager(this.scene);
    this.game = new Game(this.entities);
    this.speech = new SpeechClient();  // base resolved from window.MEDICRAFT_API_BASE
    this.contributions = new ContributionClient();
    this.ui = new UI();
    this.audio = new GameAudio();
    this.ui.setAudio(this.audio);
    this.applyDisplaySettings(this.displaySettings, { persist: false });
    this.otherMode = new OtherMode({
      player: this.player,
      getWorld: () => this.world,
      camera: this.camera,
      canvas: this.renderer.domElement,
      ui: this.ui,
      audio: this.audio,
      isPlaying: () => this.mode === "playing",
      isTouchDevice: this.touchDevice,
      scene: this.scene,
      getNearestPatient: () => this.entities.getNearest(this.player.position, 4.5, { activeOnly: true }),
    });

    this.clock = new THREE.Clock();

    this.bindViewport();

    this.wireUi();
    this.renderer.domElement.addEventListener("click", () => {
      this.audio.unlock();
      if (this.mode === "playing" && document.pointerLockElement !== this.renderer.domElement) this.requestLock();
    });
    // A tab that is not on screen renders nothing and plays nothing; leaving
    // the music running behind another window is the fastest way to make a
    // player mute the game permanently.
    document.addEventListener("visibilitychange", () => {
      this.audio.duck("hidden-tab", document.hidden);
    });

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);

    // The health probe is informative, not a prerequisite for starting: typed
    // reports work without STT and a slow/offline upstream must not hold the
    // first screen behind a spinner. checkHealth updates the badge when it
    // finishes in the background.
    $("loading-overlay").classList.add("hidden");
    this.mode = "start";
    this.ui.showStart(null);
    this.audio.duck("menu", true);
    this.speech.checkHealth().catch(() => {});
    this.contributions.refreshSummary().then((summary) => {
      this.trainingReadyClips = Number(summary.training_ready_clips) || 0;
      this.ui.renderContributionSummary(summary);
    }).catch(() => {});
  }
  // Sizing the canvas off window.innerWidth/innerHeight reads correctly until a
  // phone pinches: iOS reports the *zoomed* visual viewport there, so the canvas
  // was rebuilt smaller than the page and everything it no longer covered showed
  // the black body behind it. #app is laid out in the layout viewport, which a
  // zoom does not move, so it is the honest measurement.
  viewportSize() {
    const host = this.view || $("app");
    const width = host?.clientWidth || document.documentElement.clientWidth || window.innerWidth;
    const height = host?.clientHeight || document.documentElement.clientHeight || window.innerHeight;
    return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
  }

  // Phones render at 1.5x at most: a 3x buffer costs three times the fill rate
  // for a pixel-art world nobody can tell apart at arm's length.
  pixelRatio() {
    return Math.min(window.devicePixelRatio || 1, this.touchDevice ? 1.5 : 2);
  }

  applyViewport() {
    this._resizeQueued = false;
    const { width, height } = this.viewportSize();
    const ratio = this.pixelRatio();
    if (width === this._viewWidth && height === this._viewHeight && ratio === this._viewRatio) return;
    this._viewWidth = width;
    this._viewHeight = height;
    this._viewRatio = ratio;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  applyDisplaySettings(settings = {}, { persist = true } = {}) {
    const next = {
      fov: clampDisplayFov(settings.fov),
      crosshair: settings.crosshair !== false,
      reducedMotion: Boolean(settings.reducedMotion),
    };
    this.displaySettings = next;
    this.camera.fov = next.fov;
    this.camera.updateProjectionMatrix();
    $("crosshair")?.classList.toggle("hidden", !next.crosshair);
    document.body.classList.toggle("user-reduced-motion", next.reducedMotion);
    if (persist) saveDisplaySettings(next);
    return next;
  }

  // Everything that can change the box — a rotation, the URL bar sliding away,
  // the soft keyboard, a window drag — funnels into one rAF-coalesced pass.
  bindViewport() {
    const queue = () => {
      if (this._resizeQueued) return;
      // A hidden tab is handed no frames, and a callback queued into one that
      // never arrives would leave the flag set and every later resize ignored.
      if (document.hidden) {
        this.applyViewport();
        return;
      }
      this._resizeQueued = true;
      requestAnimationFrame(() => this.applyViewport());
    };
    window.addEventListener("resize", queue);
    window.addEventListener("orientationchange", queue);
    window.visualViewport?.addEventListener("resize", queue);
    if (typeof ResizeObserver === "function" && this.view) new ResizeObserver(queue).observe(this.view);

    // iOS Safari has ignored user-scalable=no since iOS 10, so the zoom that broke
    // the canvas has to be refused gesture by gesture. Two fingers on the screen
    // are the left stick plus the look area, never a pinch this game wants.
    for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
      document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
    }
    document.addEventListener(
      "touchmove",
      (event) => {
        if (event.touches.length > 1) event.preventDefault();
      },
      { passive: false },
    );
    // Double-tap zoom, minus the double taps that are really two quick presses of
    // the same button — swallowing those would eat menu clicks.
    let lastTouchEnd = 0;
    document.addEventListener(
      "touchend",
      (event) => {
        const now = performance.now();
        const control =
          event.target instanceof Element && event.target.closest("button, input, select, textarea, a, label");
        if (!control && now - lastTouchEnd < 320) event.preventDefault();
        lastTouchEnd = now;
      },
      { passive: false },
    );
    // A zoom that still slipped through leaves the page panned away from the HUD
    // once it snaps back; put it where the layout thinks it is.
    window.visualViewport?.addEventListener("scroll", () => {
      if ((window.visualViewport.scale || 1) <= 1.01 && (window.scrollX || window.scrollY)) window.scrollTo(0, 0);
    });
    this.applyViewport();
  }
  wireUi() {
    this.ui.bindMain({
      onStart: () => this.showBriefing(),
      onConsentAccepted: () => this.startMission(),
      onInteract: (patientId) => this.openChart(patientId),
      onSubmitTyped: (text) => this.submitReport(text),
      onCloseChart: () => this.closeChart(),
      onRestart: () => {
        this.ui.setMedicContextSelected(false);
        this.showBriefing();
      },
      onNextLevel: () => this.teleportToNextLevel(),
      onIdentityChanged: (identity) => this.publishRun(identity),
      onLeaderboardOptInChanged: (enabled) => { this.leaderboardOptIn = Boolean(enabled); },
      onMedicContextChanged: (enabled) => { this.medicContext = Boolean(enabled); },
      onSettingsOpen: () => this.settingsSnapshot(),
      onDisplaySettingsChanged: (settings) => this.applyDisplaySettings(settings),
      onOtherModeChanged: (state) => this.otherMode.setState({
        enabled: state.otherEnabled,
        extra: state.otherOtherEnabled,
      }),
      onOtherAction: (action) => {
        if (this.ui._settingsOpen) this.ui.closeSettings();
        return this.otherMode.action(action);
      },
      onContributionSummary: () => this.contributions.summary,
      onWithdrawContribution: () => this.withdrawContribution(),
      onWithdrawByCode: (code) => this.withdrawContributionByCode(code),
      onAdminAction: (action, payload) => this.runAdminAction(action, payload),
    });

    // The settings panel is a pause in everything but name: the world keeps
    // rendering behind it, but nothing the player does reaches the paramedic.
    on("ui:settings-open", () => {
      this._resumeAfterSettings = this.mode === "playing";
      if (!this._resumeAfterSettings) return;
      this.player.enabled = false;
      document.exitPointerLock?.();
    });

    on("ui:settings-close", () => {
      if (this._resumeAfterSettings && this.mode === "playing") {
        this.player.enabled = true;
        this.requestLock();
      }
      this._resumeAfterSettings = false;
    });

    on("input:interact", () => {
      if (this.mode !== "playing") return;
      const patient = this.entities.getNearest(this.player.position, 4, { activeOnly: true });
      if (patient) this.openChart(patient.id);
    });

    on("input:hotbar", ({ index }) => {
      this.ui.setHotbar(index);
      this.audio.play("hotbar", { index });
    });

    on("input:item-use", ({ itemId }) => this.useSelectedItem(itemId));

    on("input:medicate", () => this.medicateNearbyPatient());

    on("ui:request-lock", ({ want }) => {
      if (want && this.mode === "playing") this.requestLock();
      if (!want) document.exitPointerLock?.();
    });

    on("player:jump", ({ surface }) => this.audio.play("jump", { material: surface }));
    on("player:land", ({ surface, strength }) => this.audio.play("land", { material: surface, strength }));
    on("player:block-placed", ({ material }) => this.audio.play("place", { material }));

    on("stt:status", ({ state, detail }) => {
      this.ui.setSttStatus(state, detail);
      // Once recording stops, the WAV is complete: gameplay audio can return
      // while the immutable take is uploaded and transcribed in the background.
      this.audio.duck("recording", state === "recording");
      if (state === "transcribing") {
        this.ui.toast("Transkription läuft — das Fenster bleibt geöffnet.", "info");
      }
    });

    on("stt:error", ({ message, context = {}, handled = false }) => {
      this.ui.setTranscriptionLoading(false);
      this.ui.toast(message, "bad");
      this.ui.flash("bad");
      if (!handled && this.contributions.session) {
        this.contributions.track("record_abandoned", {
          prompt_id: context.promptId || null,
          patient_id: context.patientId || null,
          reason: message,
        });
      }
    });

    on("ui:record-start", () => {
      // The microphone is reachable only from an active, consented campaign.
      if (this.mode !== "chart" || this.playMode !== "campaign" || !this.contributions.session) return;
      this.audio.duck("recording", true);
      const view = this.game.getView(this.currentPatientId);
      const prompt = view?.voicePrompt;
      let context = {
        expectedText: this.currentReportScript,
        scenarioId: this.game.scenarioId,
        patientId: this.currentPatientId,
      };
      if (prompt && this.contributions.session) {
        context = this.contributions.recordingContext(prompt, context);
        this.contributions.track("record_started", { patient_id: this.currentPatientId, prompt_id: prompt.promptId });
      }
      this.speech.startRecording(context).catch((err) => {
        const message = String(err?.message || "Aufnahme konnte nicht gestartet werden.");
        this.audio.duck("recording", false);
        this.ui.setSttStatus("error", message);
        this.ui.toast(message, "bad");
      });
    });

    on("ui:record-stop", () => {
      if (this.mode !== "chart" || this.playMode !== "campaign") return;
      this.speech.stopRecording().catch(() => {});
    });

    on("stt:clip-accepted", (detail) => {
      const { context = {} } = detail;
      this.audio.play("transcribed");
      this.contributions.track("basic_accepted", {
        clip_id: detail.clipId,
        prompt_id: detail.promptId,
        patient_id: context.patientId,
      });
      const result = this.game.acceptVoiceClip(context.patientId, detail);
      if (!result.accepted) {
        this.ui.toast(result.reason || "Aufnahme konnte nicht gespeichert werden.", "warn");
        return;
      }
      const sameChart = this.mode === "chart" && this.currentPatientId === context.patientId;
      if (sameChart) {
        this.ui.showVoiceRawData({ audioBlob: detail.audioBlob, audioInfo: detail.audioInfo });
        this.ui.showVoiceAccepted(result);
        this.ui.setVoiceSubmissionPending(true);
        this.ui.setTranscriptionLoading(true, "Transkription wird berechnet …");
      }
      this.ui.scorePop("AUFNAHME GESPEICHERT", "good");
    });

    on("stt:clip-rejected", ({ context = {}, reason }) => {
      if (this.mode === "chart" && this.currentPatientId === context.patientId) {
        this.ui.setVoiceSubmissionPending(false);
        this.ui.setTranscriptionLoading(false);
      }
      this.contributions.track("retry_requested", { prompt_id: context.promptId, reason });
    });

    on("stt:clip-status", ({ validationState, contributionUnits, context = {} }) => {
      if (validationState === "training_ready") {
        this.contributions.track("training_ready", { prompt_id: context.promptId, units: contributionUnits });
      } else if (validationState === "review_required") {
        this.contributions.track("review_required", { prompt_id: context.promptId });
      }
      clearTimeout(this._contributionRefreshTimer);
      this._contributionRefreshTimer = setTimeout(() => {
        this.contributions.refreshSummary().then((summary) => {
          this.trainingReadyClips = Number(summary.training_ready_clips) || 0;
          this.ui.renderContributionSummary(summary, this.contributions.recoveryCode);
        }).catch(() => {});
      }, 250);
    });

    on("stt:result", ({ text, seconds, audioBlob, audioInfo, context = {} }) => {
      if (context.contributionMode) {
        if (this.playMode !== "campaign") return;
        const patientId = context.patientId || null;
        const sameChart = this.mode === "chart" && this.currentPatientId === context.patientId;
        if (sameChart) this.ui.setTranscriptionLoading(false);
        if (sameChart && text) this.ui.appendTranscript(text);
        if (!text || !text.trim()) {
          const result = this.submitReport("", {
            source: "audio",
            keepChart: true,
            background: !sameChart,
            patientId,
            scenarioId: context.scenarioId || null,
            allowEmpty: true,
          });
          return;
        }
        const result = this.submitReport(text, {
          source: "audio",
          keepChart: true,
          background: !sameChart,
          patientId,
          scenarioId: context.scenarioId || null,
        });
        return;
      }
      const patientId = context.patientId || null;
      const sameChart = this.mode === "chart" && this.currentPatientId === patientId;
      if (sameChart) this.ui.setTranscriptionLoading(false);
      if (sameChart) this.ui.showVoiceRawData({ audioBlob, audioInfo, processingSeconds: seconds });
      if (!text || !text.trim()) {
        this.ui.toast("Leere Aufnahme — nochmal sprechen.", "warn");
        return;
      }
      this.audio.play("transcribed");
      if (sameChart) this.ui.appendTranscript(text);
      const result = this.submitReport(text, {
        source: "audio",
        keepChart: true,
        background: !sameChart,
        patientId,
        scenarioId: context.scenarioId || null,
      });
      if (result && !sameChart) this.ui.toast("Transkription im Hintergrund abgeschlossen.", "good");
    });

    on("patient:revealed", ({ name, hidden }) => {
      if (!hidden) return;
      this.hiddenFound += 1;
      this.audio.play("reveal");
      this.ui.flash("find");
      this.ui.scorePop("GEFUNDEN", "find");
      this.ui.toast(`🔎 Versteckter Patient gefunden: ${name}`, "good");
    });

    on("score:bonus", ({ delta, reason }) => {
      if (delta <= 0) return;
      this.ui.scorePop(`+${delta} ${reason}`, "warn");
    });

    on("patient:saved", ({ caseTitle, scoreDelta, completionMode, accuracy, hiddenBonus }) => {
      const mode =
        completionMode === "instant"
          ? "sofort geheilt"
          : completionMode === "audio"
            ? "Audiobericht"
            : completionMode === "kit"
              ? "Rettungsset"
              : "Bericht";
      const extras = [];
      if (Number.isFinite(accuracy)) extras.push(`Genauigkeit ${accuracy}%`);
      if (hiddenBonus) extras.push("Versteckt gefunden");
      const suffix = extras.length ? ` · ${extras.join(" · ")}` : "";
      this.ui.toast(`✔ ${caseTitle} gerettet mit ${mode} (+${scoreDelta})${suffix}`, "good");
      this.ui.scorePop(`+${scoreDelta}`, "good");
      this.ui.flash("good");
      this.audio.play("saved");
      this.registerStreak(true, accuracy);
    });

    on("patient:partial", ({ scoreDelta }) => {
      this.ui.toast(`Teilbefund erkannt (+${scoreDelta}) — vervollständige den Bericht!`, "warn");
      this.ui.scorePop(`+${scoreDelta}`, "warn");
      this.audio.play("partial");
    });

    on("patient:dead", ({ caseTitle }) => {
      this.ui.toast(`✖ ${caseTitle} verloren (−50)`, "bad");
      this.ui.scorePop("−50", "bad");
      this.ui.flash("bad");
      this.audio.play("dead");
      this.registerStreak(false);
    });

    // The last patient of a level ends it: the player is pulled out of the map,
    // shown what the level cost them in points and accuracy, and teleported on.
    const finishLevel = (stats) => {
      clearTimeout(this.levelTimer);
      this.mode = "levelend";
      document.exitPointerLock?.();
      this.player.enabled = false;
      this.closeChart(true);
      this.campaign.completeLevel(stats);
      this.audio.stopAmbience();
      this.audio.duck("menu", true);

      if (this.campaign.isFinal()) {
        this.finishCampaign();
        return;
      }
      const next = this.campaign.levels[this.campaign.index + 1];
      this.ui.showLevelComplete({
        cleared: this.campaign.current(),
        next,
        index: this.campaign.index,
        count: this.campaign.levelCount,
        stats,
        campaign: this.campaign.summary(),
        delaySeconds: Math.round(TELEPORT_DELAY_MS / 1000),
      });
      this.audio.play("level-complete");
      this.levelTimer = setTimeout(() => this.teleportToNextLevel(), TELEPORT_DELAY_MS);
    };

    on("game:won", finishLevel);
    on("game:lost", finishLevel);
    // The dev tools end a level the same way the last rescue does, so a skipped
    // level goes through the identical bookkeeping as a played one.
    this._finishLevel = finishLevel;
  }

  // Everything the settings panel shows about the run, read-only. Building it
  // here keeps the panel from reaching into the game, campaign or entities.
  settingsSnapshot() {
    const running = this.mode === "playing" || this.mode === "chart";
    const campaign = this.campaign.summary();
    const state = running ? this.game.state() : null;
    // A run in progress still deserves a row on the boards, so the panel gets a
    // summary shaped exactly like the one the end screen submits. Before the
    // first level there is nothing to rank, and a 0/0 ghost row on a board
    // other people read is worse than no row at all.
    const played = Boolean(this.lastSummary) || running || campaign.results.length > 0;
    const summary = !played
      ? null
      : this.lastSummary || {
          ...campaign,
          score: state ? state.score : campaign.score,
          saved: campaign.saved + (state?.saved || 0),
          total: campaign.total + (state?.total || 0),
          elapsed: campaign.elapsed + (state?.elapsed || 0),
          hiddenFound: this.hiddenFound,
        };
    // Opening the panel is as good a moment as any to see whether the server
    // board moved; the render below does not wait for it.
    if (this.mode !== "loading") this.refreshRemoteBoard().catch(() => {});
    return {
      mode: this.mode,
      running,
      levelIndex: this.campaign.index,
      levelCount: this.campaign.levelCount,
      results: campaign.results,
      score: campaign.score,
      elapsed: campaign.elapsed,
      savedTotal: campaign.saved,
      patientTotal: campaign.total,
      accuracy: campaign.accuracy,
      accuracyLabel: campaign.accuracyLabel,
      accuracySamples: campaign.accuracySamples,
      streak: this.streak,
      bestStreak: this.bestStreak,
      hiddenFound: this.hiddenFound,
      hiddenTotal: this.hiddenTotal,
      current: state,
      summary,
      ...this.displaySettings,
      ...this.otherMode.snapshot(),
      runKey: this.runKey || null,
    };
  }

  // Dev-only shortcuts behind the settings password. Each one returns the
  // toast the panel shows, so a refused action says why.
  runAdminAction(action, payload = {}) {
    const running = this.mode === "playing" || this.mode === "chart";
    switch (action) {
      case "jump-level": {
        const index = Number(payload?.index);
        if (!Number.isInteger(index) || index < 0 || index >= this.campaign.levelCount) {
          return { ok: false, message: "Kein solches Level." };
        }
        clearTimeout(this.levelTimer);
        this.closeChart(true);
        // Jumping in from a menu starts a fresh run at that level rather than
        // resuming whatever the last one left behind.
        if (!running) {
          this.ui.hideMenus();
          this.campaign.reset();
          this.streak = 0;
          this.bestStreak = 0;
          this.hiddenFound = 0;
          this.hiddenTotal = 0;
          this.runSubmitted = false;
          this.lastSummary = null;
          this.runKey = null;
          this.ui.setCombo({ streak: 0 });
        }
        this.campaign.index = index;
        this.startLevel();
        return { ok: true, close: true, message: `Level ${index + 1} geladen.` };
      }
      case "skip-level": {
        if (!running) return { ok: false, message: "Kein Level aktiv." };
        const resolved = this.game.resolveAllPatients?.("kit") ?? 0;
        if (!resolved) {
          // Nothing left to resolve (or nothing spawned): end it directly.
          this._finishLevel?.(this.game.state());
        }
        return { ok: true, close: true, message: "Level übersprungen." };
      }
      case "reveal-hidden": {
        if (!running) return { ok: false, message: "Kein Level aktiv." };
        let revealed = 0;
        for (const patient of this.entities.getAll()) {
          if (this.entities.reveal(patient.id)) revealed += 1;
        }
        return { ok: true, message: revealed ? `${revealed} Patient(en) aufgedeckt.` : "Nichts mehr versteckt." };
      }
      case "heal-nearest": {
        if (!running) return { ok: false, message: "Kein Level aktiv." };
        const patient = this.entities.getNearest(this.player.position, 512, { activeOnly: true });
        if (!patient) return { ok: false, message: "Kein offener Patient mehr." };
        this.game.resolvePatient?.(patient.id, "kit");
        return { ok: true, message: `${patient.name} geheilt.` };
      }
      case "add-score": {
        this.game.awardBonus(500, "Admin");
        return { ok: true, message: "+500 Punkte." };
      }
      case "finish-run": {
        if (this.mode === "end") return { ok: false, message: "Lauf ist schon beendet." };
        if (running) this.campaign.completeLevel(this.game.state());
        this.finishCampaign();
        return { ok: true, close: true, message: "Lauf beendet." };
      }
      default:
        return { ok: false, message: "Unbekannte Aktion." };
    }
  }

  // Consecutive rescues pay a bonus that grows with the streak, and a clean
  // read-back extends it further. Losing a patient resets it to zero.
  registerStreak(saved, accuracy = null) {
    if (!saved) {
      if (this.streak >= 2) this.ui.toast(`Serie von ${this.streak} beendet`, "warn");
      this.streak = 0;
      this.ui.setCombo({ streak: 0 });
      return;
    }
    this.streak += 1;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    const multiplier = Math.min(STREAK_MAX_MULTIPLIER, 1 + (this.streak - 1) * 0.25);
    if (this.streak >= 2) {
      const accuracyFactor = Number.isFinite(accuracy) ? 0.5 + accuracy / 200 : 0.75;
      const bonus = Math.round(STREAK_BONUS * (this.streak - 1) * accuracyFactor);
      if (bonus > 0) this.game.awardBonus(bonus, `Serie ×${this.streak}`);
      this.audio.play("score", { streak: this.streak });
    }
    this.ui.setCombo({
      streak: this.streak,
      multiplier,
      progress: (multiplier - 1) / (STREAK_MAX_MULTIPLIER - 1),
    });
  }

  teleportToNextLevel() {
    clearTimeout(this.levelTimer);
    if (this.mode !== "levelend") return;
    this.ui.hideLevelComplete();
    this.campaign.advance();
    this.startLevel();
  }

  setMode(mode) {
    this.mode = mode;
    this.player.enabled = mode === "playing";
    $("hud").classList.toggle("hidden", !(mode === "playing" || mode === "chart"));
    this.otherMode.syncLifecycle?.();
  }

  rebuildWorld(level) {
    this.intro?.dispose();
    this.intro = null;
    this.otherMode.restoreSandboxEdits?.();
    this.world?.dispose();
    this.world = new World(this.scene, randomSeed(), level);
    this.player.world = this.world;
    this.otherMode.setWorld(this.world);
    const sky = level?.sky ?? 0x87ceeb;
    this.scene.background = new THREE.Color(sky);
    this.scene.fog = new THREE.FogExp2(sky, level?.fog ?? 0.008);
    this.otherMode.onWorldChanged?.();
  }

  // Leaving the map for a menu must cancel a pending teleport, or the countdown
  // would drop the player into the next level from behind the briefing screen.
  showBriefing() {
    clearTimeout(this.levelTimer);
    this.mode = "start";
    this.player.enabled = false;
    this.audio.unlock();
    this.audio.stopAmbience();
    this.audio.duck("menu", true);
    this.audio.playMusic("menu");
    this.ui.showBriefing();
  }

  async startMission() {
    let contributionMode = true;
    try {
      const session = await this.contributions.startSession({
        ageBand: "16+",
        locale: "de-DE",
        mode: "campaign",
        medicContext: Boolean(this.medicContext),
      });
      this.trainingReadyClips = Number(session.summary?.training_ready_clips) || 0;
      this.ui.renderContributionSummary(session.summary, session.recovery_code);
    } catch (error) {
      if (isContributionServiceUnavailable(error)) {
        // A static copy must remain playable when its remote API or tunnel is
        // unreachable. The consent was still required to reach this point;
        // only the upload/session part is unavailable, so use local typed
        // reports and never attempt to send voice data in this mode.
        contributionMode = false;
        this.trainingReadyClips = 0;
        this.ui.renderContributionSummary({});
        this.ui.toast?.("Server nicht erreichbar — Offline-Spiel gestartet. Sprachdaten werden nicht übertragen.", "warn");
      } else {
        this.showBriefing();
        this.ui.showConsentError?.(
          `Beitragssitzung konnte nicht gestartet werden: ${String(error?.message || error)}`,
        );
        return;
      }
    }
    if (contributionMode && this.medicContext) {
      void this.contributions.track("profile_context_selected", {
        medic: true,
        selection_source: "start_screen",
      });
    }
    this.beginMission({ contributionMode });
  }

  beginMission({ contributionMode = true } = {}) {
    this.ui.hideMenus();
    this.playMode = contributionMode ? "campaign" : "offline";
    this.campaign = new Campaign(LEVELS);
    this.campaign.reset();
    this.streak = 0;
    this.bestStreak = 0;
    this.hiddenFound = 0;
    this.hiddenTotal = 0;
    this.runSubmitted = false;
    this.lastSummary = null;
    this.ui.setCombo({ streak: 0 });
    this.audio.play("mission-start");
    this.startLevel();
  }

  async withdrawContribution() {
    if (this.speech.recording) this.speech.abort();
    const result = await this.contributions.withdraw();
    this.trainingReadyClips = 0;
    this.ui.renderContributionSummary({});
    this.ui.closeSettings();
    this.ui.showStart(null);
    this.mode = "start";
    return result;
  }

  async withdrawContributionByCode(code) {
    if (this.speech.recording) this.speech.abort();
    const result = await this.contributions.withdrawByCode(code);
    this.trainingReadyClips = 0;
    this.ui.renderContributionSummary({});
    this.ui.closeSettings();
    this.ui.showStart(null);
    this.mode = "start";
    return result;
  }

  // Every level rebuilds the world from its own blueprint list and drops the
  // player at that map's staging point. Score, accuracy and the run's
  // no-repeat ledgers live in the campaign, so they carry across the teleport.
  startLevel() {
    clearTimeout(this.levelTimer);
    const level = this.campaign.current();
    if (!level) {
      this.finishCampaign();
      return;
    }
    this.player.autoSprintEnabled = this.campaign.index > 0;
    this.entities.reset();
    this.rebuildWorld(level);
    const scenarioSeed = randomSeed();
    const spots = this.world.findPatientSpots(level.patientCount, { seed: scenarioSeed });
    this.game.start(spots, level.patientCount, {
      scenarioSeed,
      level,
      levelIndex: this.campaign.index,
      startScore: this.campaign.carriedScore,
      usedHints: this.campaign.usedHints,
      caseUsage: this.campaign.caseUsage,
      contributionMode: this.playMode === "campaign",
    });
    this.currentReportScript = "";

    const spawn = level.spawn?.at || [this.world.clinic.x, this.world.clinic.z];
    // A scripted spawn can sit inside a structure, where the height map still
    // reports the terrain underneath it. `lift` is that spawn's feet measured
    // from the site floor, and it wins over the ground.
    const spawnY = level.spawn?.lift != null
      ? this.world.plazaY + level.spawn.lift
      : this.world.getHeight(spawn[0], spawn[1]) + 0.2;
    this.player.teleport(spawn[0], spawnY, spawn[1]);
    const face = level.spawn?.face || (this.world.disasterScene ? [this.world.disasterScene.x, this.world.disasterScene.z] : null);
    if (face) this.player.faceTowards(face[0], face[1]);

    this.hiddenTotal += spots.filter((spot) => spot.hidden).length;

    this.ui.clearVerdict();
    this.ui.appendTranscript("");
    this.setMode("playing");
    this.startIntro(level, spots);
    // Each map gets its own mood and its own weather bed, so a teleport is
    // audible before the banner is read.
    this.audio.duck("menu", false);
    this.audio.playMusic(level.id);
    this.audio.playAmbience(level.id);
    // A level with an intro shows its banner when the player reaches the map,
    // not while they are still reading the corridor.
    if (!this.intro) this.showLevelBannerFor(level, spots);
    this.requestLock();
  }

  showLevelBannerFor(level, spots) {
    this.ui.showLevelBanner({
      index: this.campaign.index,
      count: this.campaign.levelCount,
      title: level.title,
      subtitle: level.subtitle,
      briefing: level.briefing,
      patients: spots.length,
      hidden: spots.filter((spot) => spot.hidden).length,
    });
  }

  // The opening corridor keeps Level 1's automatic sprint disabled; later
  // levels use the normal two-second auto-sprint threshold.
  startIntro(level, spots) {
    this.player.sprintEnabled = true;
    if (!level?.intro) return;
    this.ui.showIntroVeil();
    this.intro = new IntroSequence(this.scene, level, this.world, {
      anisotropy: this.renderer.capabilities.getMaxAnisotropy(),
      onExit: () => {
        this.player.sprintEnabled = true;
        this.audio.play("medal");
        const sprintHint = this.player.autoSprintEnabled ? " — weiterlaufen, um automatisch zu sprinten" : "";
        this.ui.toast(`Korridor abgeschlossen${sprintHint}.`, "good");
        this.showLevelBannerFor(level, spots);
      },
    });
  }

  finishCampaign() {
    clearTimeout(this.levelTimer);
    this.mode = "end";
    document.exitPointerLock?.();
    this.player.enabled = false;
    this.closeChart(true);
    this.audio.stopAmbience();
    this.audio.duck("menu", true);
    this.audio.playMusic("menu");
    this.audio.play("campaign-complete");
    if (this.playMode === "campaign") {
      this.contributions.completeShift().then((contributionSummary) => {
        if (!contributionSummary) return;
        this.trainingReadyClips = Number(contributionSummary.training_ready_clips) || 0;
        this.ui.renderContributionSummary(contributionSummary, this.contributions.recoveryCode);
      }).catch(() => {});
    }

    const summary = {
      ...this.campaign.summary(),
      hiddenFound: this.hiddenFound,
      trainingReadyClips: this.trainingReadyClips,
      playMode: this.playMode,
    };
    this.lastSummary = summary;
    // One stamp identifies this run on every board it lands on, so the row it
    // occupies can be highlighted instead of duplicated.
    this.runKey = new Date().toISOString();
    const run = { ...runFromSummary(summary), recorded_at: this.runKey };
    const personalBest = updatePersonalBest(run);
    saveLocalRun(run);

    this.ui.showEnd(summary, {
      personalBest,
      identity: loadIdentity(),
      bestStreak: this.bestStreak,
      hiddenFound: this.hiddenFound,
      hiddenTotal: this.hiddenTotal,
      runKey: this.runKey,
      publicLeaderboardOptIn: this.playMode === "campaign" && this.leaderboardOptIn,
      remoteStatus: this.playMode === "campaign" && this.leaderboardOptIn
        ? "Bestenliste wird geladen …"
        : "Keine öffentliche Serververöffentlichung — der Lauf bleibt auf diesem Gerät.",
    });

    this.runSubmitted = false;
    if (this.playMode === "campaign" && this.leaderboardOptIn) this.publishRun();
  }

  // One run reaches the server once. Re-saving the name after that only
  // refreshes the board rather than adding a duplicate row.
  async publishRun(identity = loadIdentity()) {
    if (!this.lastSummary || this.playMode !== "campaign" || !this.leaderboardOptIn) return;
    if (this.runSubmitted) {
      this.refreshRemoteBoard();
      return;
    }
    this.runSubmitted = true;
    const run = {
      ...runFromSummary(this.lastSummary, identity),
      public_leaderboard_opt_in: true,
      leaderboard_consent_version: LEADERBOARD_CONSENT_VERSION,
    };
    const result = await submitRun(run);
    if (!result) {
      this.runSubmitted = false;
      this.refreshRemoteBoard("Server nicht erreichbar — der Lauf steht in „Dieses Gerät“.");
      return;
    }
    this.ui.applyRemoteLeaderboard(
      result.entries,
      result.rank ? `Eingetragen auf Platz ${result.rank} von ${result.count}.` : "Eingetragen.",
      result.run?.recorded_at,
    );
    if (result.rank && result.rank <= 3) {
      this.ui.toast(`🏆 Platz ${result.rank} auf der Server-Bestenliste!`, "good");
      this.audio.play("medal");
    }
  }

  async refreshRemoteBoard(status = "") {
    const board = await fetchRemoteRuns(25);
    const entries = board?.entries ?? null;
    let message = status;
    if (!entries) message = status || "Kein Server erreichbar.";
    else if (board.source === "published") {
      message = status || "Server offline — zuletzt veröffentlichter Stand.";
    }
    this.ui.applyRemoteLeaderboard(entries, message);
  }

  requestLock() {
    if (this.ui.isTouchDevice) {
      document.exitPointerLock?.();
      return;
    }
    if (document.pointerLockElement !== this.renderer.domElement) {
      const result = this.renderer.domElement.requestPointerLock?.();
      if (result && typeof result.catch === "function") result.catch(() => {});
    }
  }

  openChart(patientId) {
    if (this.mode !== "playing") return;
    const view = this.game.getView(patientId);
    if (!view) return;
    this.currentPatientId = patientId;
    const prompt = view.voicePrompt;
    this.currentReportScript = prompt?.expectedText || view.hint || "";
    this.ui.clearVerdict();
    this.ui.appendTranscript("");
    this.ui.openChart(view);
    if (prompt) {
      this.ui.setVoicePrompt(prompt);
      this.contributions.track("prompt_shown", { patient_id: patientId, prompt_id: prompt.promptId });
    }
    this.ui.setVoiceSubmissionPending(Boolean(view.contributionMode && view.acceptedVoiceClips > 0 && !view.resolved));
    this.setMode("chart");
    // The chart is where speaking happens, so the bed drops before the player
    // has even reached for the record button.
    this.audio.duck("chart", true);
    this.audio.play("ui-confirm");
    document.exitPointerLock?.();
    emit("ui:request-lock", { want: false });
  }

  closeChart(silent = false) {
    if (!this.currentPatientId && this.mode !== "chart") return;
    if (this.speech.recording) {
      // Closing the chart is a valid way to finish speaking. Forced closes
      // during level/menu transitions still discard a partial take, while a
      // player close seals the WAV and leaves its transcription running.
      if (silent) this.speech.abort();
      else this.speech.stopRecording().catch(() => {});
    }
    this.currentPatientId = null;
    this.currentReportScript = "";
    this.ui.closeChart();
    this.audio.duck("chart", false);
    this.audio.duck("recording", false);
    if (!silent && this.mode === "chart") {
      this.audio.play("ui-back");
      this.setMode("playing");
      this.requestLock();
    }
  }

  useSelectedItem(itemId) {
    if (this.mode !== "playing") return;
    const item = HOTBAR_ITEMS.find((candidate) => candidate.id === itemId);
    if (!item || item.type !== "use") return;

    const patient = this.entities.getNearest(this.player.position, 4.5, { activeOnly: true });
    if (!patient) {
      this.ui.toast("Gehe näher an einen aktiven Patienten heran.", "warn");
      this.audio.play("item-reject");
      return;
    }

    const result = this.game.useItem(patient.id, item);
    if (!result.used) {
      this.ui.toast(result.message, "warn");
      this.audio.play("item-reject");
      return;
    }

    this.entities.treatmentFx(patient.id, 0x66d9ff);
    const detail = item.id === "med-kit"
      ? " · alles behandelt — Bericht weiterhin möglich"
      : result.completed
        ? " · Patient vollständig behandelt"
        : result.actionLabels.length
          ? ` · ${result.actionLabels.join(" · ")}`
          : "";
    this.ui.toast(`✔ ${item.label} bei ${patient.name} eingesetzt${detail}`, "good");
    this.audio.play("item-use");
  }

  medicateNearbyPatient() {
    this.useSelectedItem("med-kit");
  }

  submitReport(text, options = {}) {
    const patientId = options.patientId || this.currentPatientId;
    const sameChart = this.mode === "chart" && this.currentPatientId === patientId;
    if (!patientId || (!sameChart && !options.background)) return null;
    const trimmed = (text || "").trim();
    if (!trimmed && !(options.allowEmpty && options.source === "audio")) {
      this.ui.toast("Kein Berichtinhalt.", "warn");
      return null;
    }
    if (options.scenarioId && options.scenarioId !== this.game.scenarioId) {
      this.ui.toast("Die Transkription gehört zu einem bereits beendeten Einsatz.", "warn");
      return null;
    }
    const result = this.game.submitReport(patientId, trimmed, options);
    if (options.source === "audio") this.campaign.recordAccuracy(result.accuracy);
    if (sameChart) this.ui.showVerdict(result);
    if (!result.saved) {
      this.audio.play(result.verdict === "partial" ? "partial" : "rejected");
      if (sameChart) this.ui.flash(result.verdict === "partial" ? "warn" : "bad");
    }
    if (result.accuracy?.scored) {
      this.ui.scorePop(`${result.accuracy.score}% ${result.accuracy.label}`, result.accuracy.score >= 80 ? "good" : "warn");
    }
    return result;
  }

  // The search ping is the only guidance a concealed casualty gets: it starts
  // faint at 26 blocks and tightens to a fast, high pulse right before the
  // reveal radius, which turns "search the whole warehouse" into "search here".
  updateSearchFeedback(dt) {
    if (this.mode !== "playing") {
      this.ui.setProximity(-1);
      return;
    }
    const distance = this.entities.nearestHiddenDistance?.(this.player.position) ?? Infinity;
    if (!Number.isFinite(distance) || distance > SEARCH_RANGE) {
      this.ui.setProximity(-1);
      this.searchPingCooldown = 0;
      return;
    }
    const closeness = 1 - Math.max(0, distance - REVEAL_RANGE) / (SEARCH_RANGE - REVEAL_RANGE);
    this.ui.setProximity(Math.max(0, Math.min(1, closeness)));
    this.searchPingCooldown -= dt;
    if (this.searchPingCooldown > 0) return;
    this.searchPingCooldown = 1.6 - closeness * 1.25;
    this.audio.play("ping", { closeness });
  }

  updateHudTick(dt) {
    this.hudAccumulator += dt;
    if (this.hudAccumulator < 0.25) return;
    const elapsedSinceHud = this.hudAccumulator;
    this.hudAccumulator = 0;

    const state = this.game.state();
    this.ui.updateHud({
      ...state,
      levelNumber: this.campaign.index + 1,
      levelCount: this.campaign.levelCount,
      levelTitle: this.campaign.current()?.title || state.levelTitle,
      accuracy: this.campaign.accuracySummary(),
      hiddenRemaining: this.entities.hiddenRemaining?.() ?? 0,
      trainingReadyClips: this.trainingReadyClips,
    });

    if (this.mode === "playing") {
      // Patients are opened directly with a left click (or the touch card
      // button); no distracting "heal with E" prompt is shown in the HUD.
      this.ui.showPrompt(null);
    } else if (this.mode !== "chart") {
      this.ui.showPrompt(null);
    }

    if (this.mode === "chart" && this.currentPatientId) {
      const view = this.game.getView(this.currentPatientId);
      if (view) this.ui.updateChartTimer(view.elapsed);
    }

    this.updateSearchFeedback(elapsedSinceHud);
  }

  loop(now = 0) {
    requestAnimationFrame(this.loop);
    // Nothing on screen, nothing to draw. A backgrounded tab already gets
    // throttled rAF, but this also skips the world and physics work.
    if (document.hidden) {
      this.clock.getDelta();
      return;
    }
    const running = this.mode === "playing" || this.mode === "chart";
    // Menus are static apart from CSS, so they render at 30 fps instead of
    // whatever the display can do. On a laptop that is the difference between
    // a warm fan on the start screen and a quiet one.
    if (!running && now - this.lastFrameAt < MENU_FRAME_MS) return;
    this.lastFrameAt = now;

    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.world?.update(this.player.position, dt);
    this.audio.update(dt);
    this.otherMode.syncLifecycle?.();
    if (running) {
      this.player.update(dt);
      this.otherMode.update(dt);
      this.intro?.update(dt, this.player.position);
      this.entities.update(dt, this.game.state().elapsed, this.player.position);
      this.game.update(dt);
      if (this.mode === "playing") {
        this.audio.stepTick(dt, {
          moving: this.player.moving,
          grounded: this.player.grounded,
          sprinting: this.player.sprinting,
          material: this.player.surface,
        });
      }
    }
    this.updateHudTick(dt);
    this.renderer.render(this.scene, this.camera);
  }
}

if (typeof document !== "undefined" && document.getElementById?.("app")) new App();

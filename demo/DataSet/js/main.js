import * as THREE from "../vendor/three.module.js";
import { emit, on } from "./events.js";
import { World } from "./world.js";
import { Player } from "./player.js";
import { PatientManager } from "./entities.js";
import { Game } from "./gameplay.js";
import { SpeechClient } from "./stt.js";
import { UI } from "./ui.js";
import { HOTBAR_ITEMS } from "./items.js";
import { randomSeed } from "./cases.js";
import { resolveApiBase } from "./api.js";
import { Campaign } from "./campaign.js";
import { LEVELS } from "./levels.js";

const $ = (id) => document.getElementById(id);
const TELEPORT_DELAY_MS = 6000;

class App {
  constructor() {
    this.mode = "loading";
    this.currentPatientId = null;
    this.currentReportScript = "";
    this.hudAccumulator = 0;
    this.submitTimer = null;

    const touchDevice =
      navigator.maxTouchPoints > 0 ||
      window.matchMedia?.("(hover: none) and (pointer: coarse)").matches === true ||
      window.innerWidth <= 760;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, touchDevice ? 1.5 : 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    $("app").appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.008);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 420);

    this.hemiLight = new THREE.HemisphereLight(0xcfe8ff, 0x54442e, 0.9);
    this.scene.add(this.hemiLight);
    this.dirLight = new THREE.DirectionalLight(0xfff3d6, 1.15);
    this.dirLight.position.set(60, 90, 30);
    this.scene.add(this.dirLight);

    this.campaign = new Campaign(LEVELS);
    this.levelTimer = null;

    const seed = (Date.now() % 100000) | 0;
    this.world = new World(this.scene, seed, LEVELS[0]);
    this.player = new Player(this.camera, this.world, this.renderer.domElement);
    this.entities = new PatientManager(this.scene);
    this.game = new Game(this.entities);
    this.speech = new SpeechClient();  // base resolved from window.MEDICRAFT_API_BASE
    this.ui = new UI();

    this.clock = new THREE.Clock();

    const resize = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);

    this.wireUi();
    this.renderer.domElement.addEventListener("click", () => {
      if (this.mode === "playing" && document.pointerLockElement !== this.renderer.domElement) this.requestLock();
    });

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);

    setTimeout(async () => {
      $("loading-overlay").classList.add("hidden");
      this.mode = "start";
      // Settle on a backend before the first health probe, so the badge and
      // every later /api/* call agree on which host they are talking to.
      await resolveApiBase().catch(() => {});
      const ok = await this.speech.checkHealth().catch(() => false);
      this.ui.showStart(ok);
    }, 900);
  }

  wireUi() {
    this.ui.bindMain({
      onStart: () => this.showBriefing(),
      onConsentAccepted: () => this.startMission(),
      onInteract: (patientId) => this.openChart(patientId),
      onSubmitTyped: (text) => this.submitReport(text),
      onCloseChart: () => this.closeChart(),
      onRestart: () => this.showBriefing(),
      onNextLevel: () => this.teleportToNextLevel(),
    });

    on("input:interact", () => {
      if (this.mode !== "playing") return;
      const patient = this.entities.getNearest(this.player.position, 4);
      if (patient && !patient.resolved) this.openChart(patient.id);
    });

    on("input:hotbar", ({ index }) => this.ui.setHotbar(index));

    on("input:item-use", ({ itemId }) => this.useSelectedItem(itemId));

    on("input:medicate", () => this.medicateNearbyPatient());

    on("ui:request-lock", ({ want }) => {
      if (want && this.mode === "playing") this.requestLock();
      if (!want) document.exitPointerLock?.();
    });

    on("stt:status", ({ state, detail }) => {
      this.ui.setSttStatus(state, detail);
    });

    on("stt:error", ({ message }) => {
      this.ui.toast(message, "bad");
    });

    on("ui:record-start", () => {
      if (this.mode !== "chart") return;
      this.speech.startRecording({
        expectedText: this.currentReportScript,
        scenarioId: this.game.scenarioId,
        patientId: this.currentPatientId,
      }).catch((err) => {
        this.ui.toast(String(err?.message || "Aufnahme konnte nicht gestartet werden."), "bad");
      });
    });

    on("ui:record-stop", () => {
      if (this.mode !== "chart") return;
      this.speech.stopRecording().catch(() => {});
    });

    on("stt:result", ({ text, seconds, audioBlob, audioInfo }) => {
      this.ui.showVoiceRawData({ audioBlob, audioInfo, processingSeconds: seconds });
      if (!text || !text.trim()) {
        this.ui.toast("Leere Aufnahme — nochmal sprechen.", "warn");
        return;
      }
      this.ui.appendTranscript(text);
      clearTimeout(this.submitTimer);
      this.submitTimer = setTimeout(() => {
        this.submitReport(text, { source: "audio", keepChart: true });
      }, 700);
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
      this.ui.playTone(880, 120, "square");
      setTimeout(() => this.ui.playTone(1320, 160, "square"), 130);
    });

    on("patient:partial", ({ scoreDelta }) => this.ui.toast(`Teilbefund erkannt (+${scoreDelta}) — vervollständige den Bericht!`, "warn"));

    on("patient:dead", ({ caseTitle }) => {
      this.ui.toast(`✖ ${caseTitle} verloren (−50)`, "bad");
      this.ui.playTone(160, 350, "sawtooth");
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
      this.ui.playTone(660, 120, "square");
      setTimeout(() => this.ui.playTone(990, 200, "square"), 140);
      this.levelTimer = setTimeout(() => this.teleportToNextLevel(), TELEPORT_DELAY_MS);
    };

    on("game:won", finishLevel);
    on("game:lost", finishLevel);
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
  }

  rebuildWorld(level) {
    this.world?.dispose();
    this.world = new World(this.scene, randomSeed(), level);
    this.player.world = this.world;
    const sky = level?.sky ?? 0x87ceeb;
    this.scene.background = new THREE.Color(sky);
    this.scene.fog = new THREE.FogExp2(sky, level?.fog ?? 0.008);
  }

  // Leaving the map for a menu must cancel a pending teleport, or the countdown
  // would drop the player into the next level from behind the briefing screen.
  showBriefing() {
    clearTimeout(this.levelTimer);
    this.mode = "start";
    this.player.enabled = false;
    this.ui.showBriefing();
  }

  startMission() {
    this.campaign.reset();
    this.startLevel();
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
    });
    this.currentReportScript = "";

    const spawn = level.spawn?.at || [this.world.clinic.x, this.world.clinic.z];
    const spawnY = this.world.getHeight(spawn[0], spawn[1]) + 0.2;
    this.player.teleport(spawn[0], spawnY, spawn[1]);
    const face = level.spawn?.face || (this.world.disasterScene ? [this.world.disasterScene.x, this.world.disasterScene.z] : null);
    if (face) this.player.faceTowards(face[0], face[1]);

    this.ui.clearVerdict();
    this.ui.appendTranscript("");
    this.setMode("playing");
    this.ui.showLevelBanner({
      index: this.campaign.index,
      count: this.campaign.levelCount,
      title: level.title,
      subtitle: level.subtitle,
      briefing: level.briefing,
      patients: spots.length,
      hidden: spots.filter((spot) => spot.hidden).length,
    });
    this.requestLock();
  }

  finishCampaign() {
    clearTimeout(this.levelTimer);
    this.mode = "end";
    document.exitPointerLock?.();
    this.player.enabled = false;
    this.closeChart(true);
    this.ui.showEnd(this.campaign.summary());
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
    this.currentReportScript = view.hint || "";
    this.ui.clearVerdict();
    this.ui.appendTranscript("");
    this.ui.openChart(view);
    this.setMode("chart");
    document.exitPointerLock?.();
    emit("ui:request-lock", { want: false });
  }

  closeChart(silent = false) {
    if (!this.currentPatientId && this.mode !== "chart") return;
    this.currentPatientId = null;
    if (this.speech.recording) this.speech.abort();
    this.currentReportScript = "";
    this.ui.closeChart();
    clearTimeout(this.submitTimer);
    if (!silent && this.mode === "chart") {
      this.setMode("playing");
      this.requestLock();
    }
  }

  useSelectedItem(itemId) {
    if (this.mode !== "playing") return;
    const item = HOTBAR_ITEMS.find((candidate) => candidate.id === itemId);
    if (!item || item.type !== "use") return;

    const patient = this.entities.getNearest(this.player.position, 4.5);
    if (!patient || patient.resolved) {
      this.ui.toast("Gehe näher an einen aktiven Patienten heran.", "warn");
      return;
    }

    const result = this.game.useItem(patient.id, item);
    if (!result.used) {
      this.ui.toast(result.message, "warn");
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
    this.ui.playTone(640, 90, "square");
  }

  medicateNearbyPatient() {
    this.useSelectedItem("med-kit");
  }

  submitReport(text, options = {}) {
    if (this.mode !== "chart" || !this.currentPatientId) return;
    const trimmed = (text || "").trim();
    if (!trimmed) {
      this.ui.toast("Kein Berichtinhalt.", "warn");
      return;
    }
    const result = this.game.submitReport(this.currentPatientId, trimmed, options);
    if (options.source === "audio") this.campaign.recordAccuracy(result.accuracy);
    this.ui.showVerdict(result);
    this.ui.playTone(result.saved ? 988 : 220, 140, result.saved ? "square" : "triangle");
    if (result.saved && !options.keepChart) {
      setTimeout(() => this.closeChart(), 1100);
    }
  }

  updateHudTick(dt) {
    this.hudAccumulator += dt;
    if (this.hudAccumulator < 0.25) return;
    this.hudAccumulator = 0;

    const state = this.game.state();
    this.ui.updateHud({
      ...state,
      levelNumber: this.campaign.index + 1,
      levelCount: this.campaign.levelCount,
      levelTitle: this.campaign.current()?.title || state.levelTitle,
      accuracy: this.campaign.accuracySummary(),
      hiddenRemaining: this.entities.hiddenRemaining?.() ?? 0,
    });

    if (this.mode === "playing") {
      const near = this.entities.getNearest(this.player.position, 4);
      if (near && !near.resolved) {
        this.ui.showPrompt(this.ui.isTouchDevice ? `Versorgen: ${near.name} · tippe 🩺` : `Versorgen: ${near.name}`);
      } else {
        this.ui.showPrompt(null);
      }
    } else if (this.mode !== "chart") {
      this.ui.showPrompt(null);
    }

    if (this.mode === "chart" && this.currentPatientId) {
      const view = this.game.getView(this.currentPatientId);
      if (view) this.ui.updateChartTimer(view.elapsed);
    }

  }

  loop() {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const running = this.mode === "playing" || this.mode === "chart";

    this.world.update(this.player.position, dt);
    if (running) {
      this.player.update(dt);
      this.entities.update(dt, this.game.state().elapsed, this.player.position);
      this.game.update(dt);
    }
    this.updateHudTick(dt);
    this.renderer.render(this.scene, this.camera);
  }
}

if (typeof document !== "undefined") new App();

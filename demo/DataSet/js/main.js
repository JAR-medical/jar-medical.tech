import * as THREE from "../vendor/three.module.js";
import { emit, on } from "./events.js";
import { World } from "./world.js";
import { Player } from "./player.js";
import { PatientManager } from "./entities.js";
import { Game } from "./gameplay.js";
import { SpeechClient } from "./stt.js";
import { UI } from "./ui.js";
import { GameAudio } from "./audio.js";
import { HOTBAR_ITEMS } from "./items.js";
import { randomSeed } from "./cases.js";
import { resolveApiBase } from "./api.js";
import { Campaign } from "./campaign.js";
import { LEVELS } from "./levels.js";
import {
  fetchRemoteRuns,
  hasStoredIdentity,
  loadIdentity,
  runFromSummary,
  saveLocalRun,
  submitRun,
  updatePersonalBest,
} from "./leaderboard.js";

const $ = (id) => document.getElementById(id);
const TELEPORT_DELAY_MS = 6000;

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

class App {
  constructor() {
    this.mode = "loading";
    this.currentPatientId = null;
    this.currentReportScript = "";
    this.hudAccumulator = 0;
    this.submitTimer = null;
    this.streak = 0;
    this.bestStreak = 0;
    this.hiddenFound = 0;
    this.hiddenTotal = 0;
    this.runSubmitted = false;
    this.lastSummary = null;
    this.searchPingCooldown = 0;
    this.lastFrameAt = 0;

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
    this.audio = new GameAudio();
    this.ui.setAudio(this.audio);

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
      this.audio.unlock();
      if (this.mode === "playing" && document.pointerLockElement !== this.renderer.domElement) this.requestLock();
    });
    // A tab that is not on screen renders nothing and plays nothing; leaving
    // the music running behind another window is the fastest way to make a
    // player mute the game permanently.
    document.addEventListener("visibilitychange", () => {
      this.audio.duck("hidden-tab", document.hidden);
      if (document.hidden) this.player._stopBreaking?.();
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
      this.audio.duck("menu", true);
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
      onIdentityChanged: (identity) => this.publishRun(identity),
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
    on("player:break-tick", ({ material }) => this.audio.play("break-tick", { material }));
    on("player:block-broken", ({ material }) => this.audio.play("break", { material }));
    on("player:block-placed", ({ material }) => this.audio.play("place", { material }));

    on("stt:status", ({ state, detail }) => {
      this.ui.setSttStatus(state, detail);
      // The bed goes silent for the whole recording *and* the transcription
      // that follows, so a late fade-in never lands in the tail of the clip.
      const speaking = state === "recording" || state === "transcribing";
      this.audio.duck("recording", speaking);
      if (state === "transcribing") this.ui.toast("Transkription läuft …", "info");
    });

    on("stt:error", ({ message }) => {
      this.ui.toast(message, "bad");
      this.ui.flash("bad");
    });

    on("ui:record-start", () => {
      if (this.mode !== "chart") return;
      this.audio.duck("recording", true);
      this.speech.startRecording({
        expectedText: this.currentReportScript,
        scenarioId: this.game.scenarioId,
        patientId: this.currentPatientId,
      }).catch((err) => {
        this.audio.duck("recording", false);
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
      this.audio.play("transcribed");
      this.ui.appendTranscript(text);
      clearTimeout(this.submitTimer);
      this.submitTimer = setTimeout(() => {
        this.submitReport(text, { source: "audio", keepChart: true });
      }, 700);
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
    this.audio.unlock();
    this.audio.stopAmbience();
    this.audio.duck("menu", true);
    this.audio.playMusic("menu");
    this.ui.showBriefing();
  }

  startMission() {
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

    this.hiddenTotal += spots.filter((spot) => spot.hidden).length;

    this.ui.clearVerdict();
    this.ui.appendTranscript("");
    this.setMode("playing");
    // Each map gets its own mood and its own weather bed, so a teleport is
    // audible before the banner is read.
    this.audio.duck("menu", false);
    this.audio.playMusic(level.id);
    this.audio.playAmbience(level.id);
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
    this.audio.stopAmbience();
    this.audio.duck("menu", true);
    this.audio.playMusic("menu");
    this.audio.play("campaign-complete");

    const summary = { ...this.campaign.summary(), hiddenFound: this.hiddenFound };
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
      remoteStatus: "Bestenliste wird geladen …",
    });

    this.runSubmitted = false;
    // A browser that has never named its shift is asked to before its run goes
    // on a board other people read; a returning player is entered straight in.
    if (hasStoredIdentity()) this.publishRun();
    else this.refreshRemoteBoard("Trage deine Schicht ein, um in die Server-Bestenliste zu kommen.");
  }

  // One run reaches the server once. Re-saving the name after that only
  // refreshes the board rather than adding a duplicate row.
  async publishRun(identity = loadIdentity()) {
    if (!this.lastSummary) return;
    if (this.runSubmitted) {
      this.refreshRemoteBoard();
      return;
    }
    this.runSubmitted = true;
    const run = runFromSummary(this.lastSummary, identity);
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
    const entries = await fetchRemoteRuns(25);
    this.ui.applyRemoteLeaderboard(entries, entries ? status : status || "Kein Server erreichbar.");
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
    // The chart is where speaking happens, so the bed drops before the player
    // has even reached for the record button.
    this.audio.duck("chart", true);
    this.audio.play("ui-confirm");
    document.exitPointerLock?.();
    emit("ui:request-lock", { want: false });
  }

  closeChart(silent = false) {
    if (!this.currentPatientId && this.mode !== "chart") return;
    this.currentPatientId = null;
    if (this.speech.recording) this.speech.abort();
    this.currentReportScript = "";
    this.ui.closeChart();
    this.audio.duck("chart", false);
    this.audio.duck("recording", false);
    clearTimeout(this.submitTimer);
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
    if (this.mode !== "chart" || !this.currentPatientId) return;
    const trimmed = (text || "").trim();
    if (!trimmed) {
      this.ui.toast("Kein Berichtinhalt.", "warn");
      return;
    }
    const result = this.game.submitReport(this.currentPatientId, trimmed, options);
    if (options.source === "audio") this.campaign.recordAccuracy(result.accuracy);
    this.ui.showVerdict(result);
    if (!result.saved) {
      this.audio.play(result.verdict === "partial" ? "partial" : "rejected");
      this.ui.flash(result.verdict === "partial" ? "warn" : "bad");
    }
    if (result.accuracy?.scored) {
      this.ui.scorePop(`${result.accuracy.score}% ${result.accuracy.label}`, result.accuracy.score >= 80 ? "good" : "warn");
    }
    if (result.saved && !options.keepChart) {
      setTimeout(() => this.closeChart(), 1100);
    }
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
    });

    if (this.mode === "playing") {
      const near = this.entities.getNearest(this.player.position, 4, { activeOnly: true });
      if (near) {
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
    this.world.update(this.player.position, dt);
    this.audio.update(dt);
    if (running) {
      this.player.update(dt);
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

if (typeof document !== "undefined") new App();

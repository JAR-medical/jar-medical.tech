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

const $ = (id) => document.getElementById(id);
const PATIENT_COUNT = 6;

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

    const seed = (Date.now() % 100000) | 0;
    this.world = new World(this.scene, seed);
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
      const ok = await this.speech.checkHealth().catch(() => false);
      this.ui.showStart(ok);
    }, 900);
  }

  wireUi() {
    this.ui.bindMain({
      onStart: () => this.ui.showBriefing(),
      onConsentAccepted: () => this.startMission(),
      onInteract: (patientId) => this.openChart(patientId),
      onSubmitTyped: (text) => this.submitReport(text),
      onCloseChart: () => this.closeChart(),
      onRestart: () => this.ui.showBriefing(),
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

    on("patient:saved", ({ caseTitle, scoreDelta, completionMode }) => {
      const mode =
        completionMode === "instant"
          ? "sofort geheilt"
          : completionMode === "audio"
            ? "Audiobericht"
            : completionMode === "kit"
              ? "Rettungsset"
              : "Bericht";
      this.ui.toast(`✔ ${caseTitle} gerettet mit ${mode} (+${scoreDelta})`, "good");
      this.ui.playTone(880, 120, "square");
      setTimeout(() => this.ui.playTone(1320, 160, "square"), 130);
    });

    on("patient:partial", ({ scoreDelta }) => this.ui.toast(`Teilbefund erkannt (+${scoreDelta}) — vervollständige den Bericht!`, "warn"));

    on("patient:dead", ({ caseTitle }) => {
      this.ui.toast(`✖ ${caseTitle} verloren (−50)`, "bad");
      this.ui.playTone(160, 350, "sawtooth");
    });

    const finishMission = (stats) => {
      this.mode = "end";
      document.exitPointerLock?.();
      this.player.enabled = false;
      this.closeChart(true);
      this.ui.showEnd(stats);
    };

    on("game:won", finishMission);
    on("game:lost", finishMission);
  }

  setMode(mode) {
    this.mode = mode;
    this.player.enabled = mode === "playing";
    $("hud").classList.toggle("hidden", !(mode === "playing" || mode === "chart"));
  }

  rebuildWorld() {
    this.world?.dispose();
    this.world = new World(this.scene, randomSeed());
    this.player.world = this.world;
  }

  startMission() {
    this.entities.reset();
    this.rebuildWorld();
    const scenarioSeed = randomSeed();
    const spots = this.world.findPatientSpots(PATIENT_COUNT, { seed: scenarioSeed });
    this.game.start(spots, PATIENT_COUNT, { scenarioSeed });
    this.currentReportScript = "";
    const c = this.world.clinic;
    this.player.teleport(c.x + 3.5, this.world.getHeight(c.x + 3.5, c.z + 3.5) + 0.2, c.z + 3.5);
    const disaster = this.world.disasterScene;
    if (disaster) this.player.faceTowards(disaster.x, disaster.z);
    this.ui.clearVerdict();
    this.ui.appendTranscript("");
    this.setMode("playing");
    this.ui.toast(`${spots.length} Patienten gemeldet — keine Zeitbegrenzung.`, "info");
    this.requestLock();
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
    this.ui.updateHud(state);

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

    this.world.update(this.player.position);
    if (running) {
      this.player.update(dt);
      this.entities.update(dt, this.game.state().elapsed);
      this.game.update(dt);
    }
    this.updateHudTick(dt);
    this.renderer.render(this.scene, this.camera);
  }
}

if (typeof document !== "undefined") new App();

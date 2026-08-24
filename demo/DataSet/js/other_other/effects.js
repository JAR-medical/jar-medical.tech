import { BLOCK } from "../world.js?v=20260824-transcript1";

const TOGGLE_IDS = Object.freeze(["rgb", "matrix", "disco", "rain", "moon", "turbo", "wide", "invert", "spin", "esp"]);
const BODY_CLASSES = Object.freeze(["other-matrix-active", "other-disco-active", "other-rain-active"]);

const DEFAULT_STATE = Object.freeze(
  Object.fromEntries(TOGGLE_IDS.map((id) => [id, false])),
);

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

export class OtherFunnyEffects {
  constructor({ player, getWorld, scene, camera, ui, audio, hud }) {
    this.player = player;
    this.getWorld = getWorld;
    this.scene = scene;
    this.camera = camera;
    this.ui = ui;
    this.audio = audio;
    this.hud = hud;
    this.state = { ...DEFAULT_STATE };
    this.active = false;
    this.phase = 0;
    this.statusClock = 0;
    this.baseFov = Number(camera?.fov) || 75;
    this.baseBackground = null;
    this.baseFogColor = null;
    this._capturePalette();
  }

  snapshot() {
    return {
      otherFunnyFeatures: { ...this.state },
      otherFunnyActive: this.active,
    };
  }

  setRuntimeActive(active) {
    const next = Boolean(active);
    if (next === this.active) {
      this._applyPresentation();
      return;
    }
    this.active = next;
    if (this.active) this._capturePalette();
    else this._restoreRuntime();
    this._applyPresentation();
  }

  onWorldChanged() {
    this._capturePalette();
    if (this.active) this._applyPresentation();
  }

  set(id, enabled) {
    if (!Object.prototype.hasOwnProperty.call(this.state, id)) return false;
    this.state[id] = Boolean(enabled);
    this._applyPresentation();
    if (this.active) {
      const feature = id === "rgb" ? "RGB-Welt" : id === "disco" ? "Disco-Sicht" : id;
      this.ui?.toast((this.state[id] ? "Aktiv: " : "Aus: ") + feature, "info");
      this.audio?.play("ui-click");
    }
    return this.state[id];
  }

  toggle(id) {
    return this.set(id, !this.state[id]);
  }

  reset() {
    for (const id of TOGGLE_IDS) this.state[id] = false;
    this._restoreRuntime();
    this._applyPresentation();
    this.ui?.toast("🧼 Sandbox-Effekte zurückgesetzt.", "good");
  }

  update(dt, blockName = "unbekannt") {
    if (!this.active) return;
    const delta = Math.max(0, Number(dt) || 0);
    this.phase = (this.phase + delta * 0.12) % 1;
    if (this.state.rgb) this._updateRgb();
    if (this.state.spin) this.player.yaw += delta * 0.72;
    this.statusClock += delta;
    if (this.statusClock >= 0.2) {
      this.statusClock = 0;
      this._renderHud(blockName);
    }
  }

  randomTeleport() {
    if (!this.active) return false;
    const world = this.getWorld?.();
    if (!world) return false;
    for (let attempt = 0; attempt < 24; attempt++) {
      const x = 3.5 + Math.random() * 121;
      const z = 3.5 + Math.random() * 121;
      const y = world.getHeight(x, z) + 0.35;
      const block = world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
      if (block !== BLOCK.AIR) continue;
      this.player.teleport(x, y, z);
      this.audio?.play("ui-confirm");
      this.ui?.toast("🎲 Teleport-Lotto: neuer Ort gefunden.", "good");
      return true;
    }
    this.ui?.toast("🎲 Kein sicherer Ort gefunden.", "warn");
    return false;
  }

  _capturePalette() {
    this.baseBackground = this.scene?.background?.clone?.() || null;
    this.baseFogColor = this.scene?.fog?.color?.clone?.() || null;
  }

  _restorePalette() {
    if (this.baseBackground && this.scene) this.scene.background = this.baseBackground.clone();
    if (this.baseFogColor && this.scene?.fog?.color) this.scene.fog.color.copy(this.baseFogColor);
  }

  _restoreRuntime() {
    this._restorePalette();
    this.player.setOtherPhysics?.({
      gravityScale: 1,
      speedScale: 1,
      jumpScale: 1,
      invertControls: false,
    });
    if (this.camera) {
      this.camera.fov = this.baseFov;
      this.camera.updateProjectionMatrix?.();
    }
  }

  _applyPresentation() {
    const active = this.active;
    const body = document.body;
    for (const className of BODY_CLASSES) body.classList.toggle(className, active && (
      className === "other-matrix-active" ? this.state.matrix :
        className === "other-disco-active" ? this.state.disco : this.state.rain
    ));
    if (this.hud) this.hud.classList.toggle("hidden", !active || (!this.state.matrix && !this.state.esp));
    const overlay = document.getElementById("other-fun-overlay");
    overlay?.classList.toggle("hidden", !active);
    overlay?.setAttribute("aria-hidden", active ? "false" : "true");
    this.player.setOtherPhysics?.({
      gravityScale: active && this.state.moon ? 0.34 : 1,
      speedScale: active && this.state.turbo ? 1.9 : 1,
      jumpScale: active && this.state.moon ? 1.85 : 1,
      invertControls: active && this.state.invert,
    });
    if (this.camera) {
      this.camera.fov = active && this.state.wide ? clamp(this.baseFov * 1.42, 75, 118) : this.baseFov;
      this.camera.updateProjectionMatrix?.();
    }
    if (active && this.state.rgb) this._updateRgb();
    else this._restorePalette();
  }

  _updateRgb() {
    if (!this.active || !this.state.rgb) return;
    const hue = this.phase;
    this.scene?.background?.setHSL?.(hue, 0.48, 0.28);
    this.scene?.fog?.color?.setHSL?.(hue, 0.28, 0.42);
  }

  _renderHud(blockName) {
    if (!this.hud || !this.active) return;
    const p = this.player.position;
    const effects = TOGGLE_IDS.filter((id) => this.state[id]).map((id) => id.toUpperCase()).join(" · ") || "KEINE";
    const prefix = this.state.matrix ? "JOKECLIENT // " : "SANDBOX-SCAN // ";
    this.hud.textContent =
      prefix + "X " + p.x.toFixed(1) + " Y " + p.y.toFixed(1) + " Z " + p.z.toFixed(1) +
      " // BLOCK " + String(blockName || "unbekannt").toUpperCase() + " // " + effects;
  }
}

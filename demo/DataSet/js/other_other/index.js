import { FUNNY_FEATURES } from "./features.js";
import { OtherFunnyEffects } from "./effects.js";
import { ReflexGame } from "./reflex.js";

export class OtherOtherFeatures {
  constructor({ player, getWorld, scene, camera, ui, audio }) {
    this.player = player;
    this.getWorld = getWorld;
    this.ui = ui;
    this.audio = audio;
    this.sandboxEnabled = false;
    this.runtimeActive = false;
    this.el = {
      menu: document.getElementById("other-fun-menu"),
      close: document.getElementById("other-fun-close"),
      grid: document.getElementById("other-fun-grid"),
      status: document.getElementById("other-fun-status"),
      labButton: document.getElementById("other-open-lab"),
      touchLabButton: document.getElementById("other-touch-lab"),
    };
    this.effects = new OtherFunnyEffects({
      player,
      getWorld,
      scene,
      camera,
      ui,
      audio,
      hud: document.getElementById("other-fun-hud"),
    });
    this.reflex = new ReflexGame({ ui, audio });
    this._renderFeatureList();
    this._bind();
  }

  snapshot() {
    return this.effects.snapshot();
  }

  setSandboxEnabled(enabled) {
    this.sandboxEnabled = Boolean(enabled);
    if (!this.sandboxEnabled) {
      this.closeLab();
      this.reflex.close();
      this.effects.reset();
    }
  }

  setRuntimeActive(active) {
    this.runtimeActive = Boolean(active) && this.sandboxEnabled;
    this.effects.setRuntimeActive(this.runtimeActive);
    if (!this.runtimeActive) {
      this.closeLab();
      this.reflex.close();
    }
  }

  onWorldChanged() {
    this.effects.onWorldChanged();
  }

  update(dt) {
    if (!this.runtimeActive) return;
    const block = this.player.world?.getBlock(
      Math.floor(this.player.position.x),
      Math.floor(this.player.position.y - 0.12),
      Math.floor(this.player.position.z),
    );
    this.effects.update(dt, String(block ?? "unbekannt"));
  }

  action(action) {
    if (!this.runtimeActive) return false;
    if (action === "open-lab") {
      this.openLab();
      return true;
    }
    if (action === "random-teleport") return this.effects.randomTeleport();
    if (action === "reflex") {
      this.openLab();
      this.reflex.open();
      return true;
    }
    if (action === "reset") {
      this.effects.reset();
      this._renderFeatureList();
      return true;
    }
    if (String(action).startsWith("toggle:")) {
      const result = this.effects.toggle(String(action).slice(7));
      this._renderFeatureList();
      return result;
    }
    return false;
  }

  openLab() {
    if (!this.runtimeActive || !this.el.menu) return;
    this.el.menu.classList.remove("hidden");
    this._renderFeatureList();
    this.el.close?.focus({ preventScroll: true });
  }

  closeLab() {
    this.el.menu?.classList.add("hidden");
    this.reflex.close();
  }

  _renderFeatureList() {
    const host = this.el.grid;
    if (!host) return;
    host.replaceChildren();
    const state = this.effects.state;
    for (const feature of FUNNY_FEATURES) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "other-fun-card";
      button.dataset.funnyAction = feature.action ? feature.action : "toggle:" + feature.id;
      const enabled = !feature.action && Boolean(state[feature.id]);
      if (enabled) button.classList.add("active");
      button.innerHTML =
        '<span class="other-fun-icon" aria-hidden="true">' + feature.icon + "</span>" +
        "<strong>" + feature.label + "</strong>" +
        "<small>" + feature.description + "</small>" +
        "<em>" + (feature.action ? "START" : enabled ? "AN" : "AUS") + "</em>" +
        (feature.key ? "<kbd>" + feature.key + "</kbd>" : "");
      host.appendChild(button);
    }
    if (this.el.status) {
      const active = Object.entries(state).filter(([, value]) => value).map(([id]) => id.toUpperCase());
      this.el.status.textContent = active.length ? "Aktiv: " + active.join(" · ") : "Keine Effekte aktiv.";
    }
  }

  _bind() {
    this.el.close?.addEventListener("click", () => this.closeLab());
    this.el.menu?.addEventListener("click", (event) => {
      if (event.target === this.el.menu) this.closeLab();
      const button = event.target.closest("[data-funny-action]");
      if (!button || !this.runtimeActive) return;
      this.action(button.dataset.funnyAction);
    });
    this.el.labButton?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (this.runtimeActive) this.openLab();
    });
    this.el.touchLabButton?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (this.runtimeActive) this.openLab();
    });
  }
}

import * as THREE from "../vendor/three.module.js";
import { emit } from "./events.js";
import { BLOCK, blockMaterial } from "./world.js?v=20260824-transcript1";
import { OTHER_BLOCKS } from "./other_blocks.js";

const STORAGE_KEY = "medicraft.other-tools.v1";
const DEFAULT_STATE = Object.freeze({ enabled: false, extra: false });
const PLAYER_HALF_WIDTH = 0.35;
const PLAYER_HEIGHT = 1.8;

function loadState() {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) || "{}");
    return {
      enabled: Boolean(parsed.enabled),
      extra: Boolean(parsed.extra),
    };
  } catch (error) {
    return { ...DEFAULT_STATE };
  }
}

function saveState(state) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    // Private browsing and blocked storage should never disable the tools.
  }
}

export class OtherMode {
  constructor({ player, getWorld, camera, canvas, ui, audio, isPlaying, isTouchDevice }) {
    this.player = player;
    this.getWorld = getWorld;
    this.camera = camera;
    this.canvas = canvas;
    this.ui = ui;
    this.audio = audio;
    this.isPlaying = isPlaying || (() => false);
    this.isTouchDevice = Boolean(isTouchDevice);
    this.world = null;
    this.state = loadState();
    this.enabled = this.state.enabled;
    this.extraEnabled = this.enabled && this.state.extra;
    this.flight = false;
    this.fun = false;
    this.tool = "build";
    this.selectedIndex = 0;
    this.funClock = 0;
    this.wasGrounded = false;
    this.verticalTouch = 0;
    this.lookDirection = new THREE.Vector3();
    this._breakEffectTimer = null;
    this._lastActive = false;

    this.el = {
      touchActions: document.getElementById("other-touch-actions"),
      pcToolbar: document.getElementById("other-pc-toolbar"),
      toolStatus: document.getElementById("other-tool-status"),
      touchStatus: document.getElementById("other-touch-status"),
      toggleFly: document.getElementById("other-toggle-fly"),
      toggleFun: document.getElementById("other-toggle-fun"),
      openBlocks: document.getElementById("other-open-blocks"),
      blockMenu: document.getElementById("other-block-menu"),
      blockClose: document.getElementById("other-block-close"),
      blockGrid: document.getElementById("other-block-grid"),
    };

    this._renderBlockLibrary();
    this._bindControls();
    this._syncVisibility(true);
  }

  snapshot() {
    return {
      otherEnabled: this.enabled,
      otherOtherEnabled: this.extraEnabled,
      otherFlying: this.flight,
      otherFun: this.fun,
    };
  }

  setWorld(world) {
    this.world = world;
  }

  setState({ enabled = false, extra = false } = {}) {
    this.enabled = Boolean(enabled);
    this.extraEnabled = this.enabled && Boolean(extra);
    if (!this.extraEnabled) {
      this.setFlight(false);
      this.setFun(false);
      this.closeBlockMenu();
    }
    saveState({ enabled: this.enabled, extra: this.extraEnabled });
    this._syncVisibility(true);
    return this.snapshot();
  }

  action(action) {
    if (action === "open-blocks") this.openBlockMenu();
    if (action === "toggle-flight") this.setFlight(!this.flight);
    if (action === "toggle-fun") this.setFun(!this.fun);
    if (action === "teleport") this.teleportHome();
    if (action === "burst") this.partyBurst(28);
    return this.snapshot();
  }

  update(dt) {
    this._syncVisibility();
    if (!this._active()) return;
    if (this.fun) {
      this.funClock += Math.max(0, Number(dt) || 0);
      if (this.funClock >= 0.18) {
        this.funClock = 0;
        this.partyBurst(5);
      }
      if (!this.flight && this.player.grounded && !this.wasGrounded) this.player.jumpQueued = true;
    }
    this.wasGrounded = Boolean(this.player.grounded);
    this._renderStatus();
  }

  setFlight(enabled) {
    this.flight = Boolean(enabled) && this._active();
    this.player.setCreativeFlight?.(this.flight);
    if (!this.flight) emit("input:other-flight-vertical", { value: 0 });
    this._renderStatus();
    if (this.flight) this.audio?.play("ui-confirm");
    return this.flight;
  }

  setFun(enabled) {
    this.fun = Boolean(enabled) && this._active();
    this.funClock = 0;
    this._renderStatus();
    if (this.fun) {
      this.partyBurst(18);
      this.audio?.play("medal");
      this.ui?.toast("✨ Spaßmodus: Konfetti und Super-Sprünge aktiv.", "good");
    }
    return this.fun;
  }

  _active() {
    return Boolean(this.enabled && this.extraEnabled && this.isPlaying() && !this.ui?._settingsOpen);
  }

  _syncVisibility(force = false) {
    const active = this._active();
    if (!force && active === this._lastActive) return;
    this._lastActive = active;
    this.el.touchActions?.classList.toggle("hidden", !active || !this.isTouchDevice);
    this.el.pcToolbar?.classList.toggle("hidden", !active || this.isTouchDevice);
    document.body.classList.toggle("other-extra-active", active);
    if (!active) {
      this.player.setCreativeFlight?.(false);
      this.flight = false;
      this.verticalTouch = 0;
      emit("input:other-flight-vertical", { value: 0 });
    }
    this._renderStatus();
  }

  _renderStatus() {
    const block = OTHER_BLOCKS[this.selectedIndex] || OTHER_BLOCKS[0];
    const tool = this.tool === "break" ? "⛏ ABBRUCH" : "🧱 BAUEN";
    const status = [tool, block.icon + " " + block.name].join(" · ");
    if (this.el.toolStatus) this.el.toolStatus.textContent = status;
    if (this.el.touchStatus) this.el.touchStatus.textContent = status;
    if (this.el.toggleFly) {
      this.el.toggleFly.textContent = this.flight ? "✈ Flug aus" : "✈ Fliegen";
      this.el.toggleFly.classList.toggle("active", this.flight);
    }
    if (this.el.toggleFun) {
      this.el.toggleFun.textContent = this.fun ? "🎉 Spaß aus" : "🎉 Spaß";
      this.el.toggleFun.classList.toggle("active", this.fun);
    }
    this.el.blockGrid?.querySelectorAll("[data-block-id]").forEach((button) => {
      button.classList.toggle("selected", Number(button.dataset.blockId) === block.id);
    });
  }

  _renderBlockLibrary() {
    const host = this.el.blockGrid;
    if (!host) return;
    host.replaceChildren();
    for (const block of OTHER_BLOCKS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "other-block-swatch";
      button.dataset.blockId = String(block.id);
      button.title = block.name;
      button.style.setProperty("--block-color", "rgb(" + block.color.map((value) => Math.round(value * 255)).join(", ") + ")");
      button.innerHTML = '<span class="other-block-icon" aria-hidden="true">' + block.icon + '</span><span>' + block.name + "</span>";
      host.appendChild(button);
    }
    this._renderStatus();
  }

  _bindControls() {
    window.addEventListener("keydown", (event) => {
      if (!this._active()) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      let handled = true;
      switch (event.code) {
        case "KeyB":
          this.openBlockMenu();
          break;
        case "KeyF":
          this.setFlight(!this.flight);
          break;
        case "KeyG":
          this.setFun(!this.fun);
          break;
        case "KeyT":
          this.teleportHome();
          break;
        case "KeyR":
          this.partyBurst(36);
          break;
        case "KeyX":
          this.tool = "break";
          this._renderStatus();
          break;
        case "KeyC":
          this.tool = "build";
          this._renderStatus();
          break;
        case "BracketLeft":
          this.cycleBlock(-1);
          break;
        case "BracketRight":
          this.cycleBlock(1);
          break;
        default:
          handled = false;
      }
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);

    this.canvas.addEventListener("mousedown", (event) => {
      if (!this._active() || ![0, 2].includes(event.button)) return;
      event.preventDefault();
      event.stopPropagation();
      if (document.pointerLockElement !== this.canvas) this.canvas.requestPointerLock?.();
      if (event.button === 0) this.destroyBlock();
      else this.placeBlock();
    }, true);
    this.canvas.addEventListener("contextmenu", (event) => {
      if (!this._active()) return;
      event.preventDefault();
      event.stopPropagation();
    }, true);

    this.el.openBlocks?.addEventListener("click", () => this.openBlockMenu());
    this.el.blockClose?.addEventListener("click", () => this.closeBlockMenu());
    this.el.blockMenu?.addEventListener("click", (event) => {
      if (event.target === this.el.blockMenu) this.closeBlockMenu();
    });
    this.el.blockGrid?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-block-id]");
      if (!button) return;
      this.selectBlock(Number(button.dataset.blockId));
      this.closeBlockMenu();
    });

    const bindAction = (id, action) => {
      document.getElementById(id)?.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!this._active()) return;
        if (action === "place") this.placeBlock();
        else if (action === "destroy") this.destroyBlock();
        else this.action(action);
      });
    };
    bindAction("other-toggle-fly", "toggle-flight");
    bindAction("other-toggle-fun", "toggle-fun");
    bindAction("other-teleport", "teleport");
    bindAction("other-party", "burst");
    bindAction("other-open-blocks", "open-blocks");
    bindAction("other-touch-blocks", "open-blocks");
    bindAction("other-touch-build", "place");
    bindAction("other-touch-break", "destroy");
    bindAction("other-touch-fly", "toggle-flight");
    bindAction("other-touch-fun", "toggle-fun");
    bindAction("other-touch-home", "teleport");
    this._bindVerticalButton("other-touch-up", 1);
    this._bindVerticalButton("other-touch-down", -1);
  }

  _bindVerticalButton(id, value) {
    const button = document.getElementById(id);
    if (!button) return;
    const release = (event) => {
      if (event?.pointerId !== undefined && button.hasPointerCapture?.(event.pointerId)) {
        try { button.releasePointerCapture(event.pointerId); } catch (error) { /* already released */ }
      }
      this.verticalTouch = 0;
      emit("input:other-flight-vertical", { value: 0 });
    };
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!this._active()) return;
      this.verticalTouch = value;
      button.setPointerCapture?.(event.pointerId);
      emit("input:other-flight-vertical", { value });
    });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) button.addEventListener(name, release);
  }

  selectBlock(id) {
    const index = OTHER_BLOCKS.findIndex((block) => block.id === Number(id));
    if (index < 0) return false;
    this.selectedIndex = index;
    this._renderStatus();
    this.audio?.play("hotbar", { index: index % 10 });
    this.ui?.toast("Block gewählt: " + OTHER_BLOCKS[index].name, "info");
    return true;
  }

  cycleBlock(direction) {
    if (!this._active()) return;
    this.selectedIndex = (this.selectedIndex + Number(direction) + OTHER_BLOCKS.length) % OTHER_BLOCKS.length;
    this._renderStatus();
  }

  openBlockMenu() {
    if (!this._active() || !this.el.blockMenu) return;
    this.el.blockMenu.classList.remove("hidden");
    this.el.blockClose?.focus({ preventScroll: true });
    this._renderStatus();
  }

  closeBlockMenu() {
    this.el.blockMenu?.classList.add("hidden");
  }

  _hit(maxDist = 8) {
    const world = this.getWorld?.();
    if (!world || !this.camera) return null;
    return world.raycast(this.camera.position.clone(), this.camera.getWorldDirection(this.lookDirection), maxDist);
  }

  placeBlock() {
    if (!this._active()) return false;
    const world = this.getWorld?.();
    const hit = this._hit();
    if (!world || !hit) return false;
    const x = hit.x + hit.nx;
    const y = hit.y + hit.ny;
    const z = hit.z + hit.nz;
    if (y < 0 || world.isMapBorder?.(x, y, z) || world.getBlock(x, y, z) !== BLOCK.AIR) return false;
    const p = this.player.position;
    const overlapsPlayer =
      x < p.x + PLAYER_HALF_WIDTH &&
      x + 1 > p.x - PLAYER_HALF_WIDTH &&
      y < p.y + PLAYER_HEIGHT &&
      y + 1 > p.y &&
      z < p.z + PLAYER_HALF_WIDTH &&
      z + 1 > p.z - PLAYER_HALF_WIDTH;
    if (overlapsPlayer) return false;
    const block = OTHER_BLOCKS[this.selectedIndex];
    world.setBlock(x, y, z, block.id);
    emit("player:block-placed", { x, y, z, block: block.id, material: blockMaterial(block.id) });
    this.audio?.play("place", { material: blockMaterial(block.id) });
    return true;
  }

  destroyBlock() {
    if (!this._active()) return false;
    const world = this.getWorld?.();
    const hit = this._hit();
    if (!world || !hit || hit.block === BLOCK.AIR || world.isMapBorder?.(hit.x, hit.y, hit.z)) return false;
    const previous = hit.block;
    world.setBlock(hit.x, hit.y, hit.z, BLOCK.AIR);
    world.spawnBlockDebris?.(hit.x, hit.y, hit.z, previous, this.fun ? 24 : 12);
    world.setBreakEffect?.(1, 10, hit);
    clearTimeout(this._breakEffectTimer);
    this._breakEffectTimer = setTimeout(() => world.setBreakEffect?.(0, 0, null), 140);
    emit("player:block-broken", { ...hit, material: blockMaterial(previous) });
    this.audio?.play("break", { material: blockMaterial(previous) });
    return true;
  }

  teleportHome() {
    if (!this._active()) return false;
    const world = this.getWorld?.();
    const clinic = world?.clinic;
    if (!world || !clinic) return false;
    const x = Math.max(2, Math.min(125, clinic.x + 3.5));
    const z = Math.max(2, Math.min(125, clinic.z + 3.5));
    const y = world.getHeight(x, z) + 0.35;
    this.player.teleport(x, y, z);
    this.player.faceTowards(clinic.x, clinic.z);
    this.audio?.play("ui-confirm");
    return true;
  }

  partyBurst(amount = 18) {
    if (!this._active()) return false;
    const world = this.getWorld?.();
    if (!world) return false;
    const block = OTHER_BLOCKS[Math.floor((this.funClock * 37 + this.selectedIndex) % OTHER_BLOCKS.length)];
    world.spawnBlockDebris?.(
      this.player.position.x - 0.5,
      this.player.position.y + 1.1,
      this.player.position.z - 0.5,
      block.id,
      amount,
    );
    return true;
  }
}

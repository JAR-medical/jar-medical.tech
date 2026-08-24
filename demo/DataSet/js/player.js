import * as THREE from "../vendor/three.module.js";
import { emit, on } from "./events.js";
import { BLOCK, WORLD_SIZE, blockMaterial } from "./world.js";
import { HOTBAR_BLOCKS, HOTBAR_ITEMS } from "./items.js";

export { HOTBAR_BLOCKS, HOTBAR_ITEMS };

const WALK_SPEED = 4.3;
const SPRINT_MULT = 1.45;
const JUMP_VELOCITY = 8.2;
const GRAVITY = -24;
const TERMINAL_VELOCITY = -50;
const HALF_WIDTH = 0.35;
const BODY_HEIGHT = 1.8;
const EYE_HEIGHT = 1.62;
const MOUSE_SENSITIVITY = 0.0022;
const TOUCH_LOOK_SENSITIVITY = 0.005;
const AUTO_JUMP_HEIGHT = 1.05;
const AUTO_SPRINT_DELAY = 2;

export class Player {
  constructor(camera, world, canvas) {
    this.camera = camera;
    this.world = world;
    this.canvas = canvas;
    camera.rotation.order = "YXZ";

    this.position = new THREE.Vector3(64.5, 20, 70.5);
    this.velocity = new THREE.Vector3();
    this.yaw = Math.PI;
    this.pitch = -0.12;
    this.enabled = false;
    // Scripted scenes can take running away and hand it back as a reward. The
    // walk speed is unaffected, so a gated player is slowed, never stuck.
    this.sprintEnabled = true;
    this.eyeHeight = EYE_HEIGHT;
    this.hotbarIndex = 0;
    this.grounded = false;

    this.keys = new Set();
    this.touchMove = { x: 0, y: 0 };
    this.touchSprint = false;
    this.jumpQueued = false;
    this._movementTime = 0;
    this._lookDir = new THREE.Vector3();
    this.moving = false;
    this.sprinting = false;
    this.surface = "default";
    this._wasGrounded = true;

    on("input:touch-move", ({ x = 0, y = 0 }) => {
      this.touchMove.x = Math.max(-1, Math.min(1, Number(x) || 0));
      this.touchMove.y = Math.max(-1, Math.min(1, Number(y) || 0));
    });
    on("input:touch-look", ({ dx = 0, dy = 0 }) => {
      if (!this.enabled) return;
      this.yaw -= Number(dx) * TOUCH_LOOK_SENSITIVITY;
      this.pitch -= Number(dy) * TOUCH_LOOK_SENSITIVITY;
      const limit = Math.PI / 2 - 0.01;
      this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
    });
    on("input:touch-sprint", ({ active }) => {
      this.touchSprint = Boolean(active);
    });
    on("input:hotbar", ({ index }) => this.setHotbar(index, false));
    on("input:jump", () => {
      if (this.enabled) this.jumpQueued = true;
    });
    on("input:place", () => {
      if (this.enabled) this._useSelectedItem();
    });
    on("input:use-item", () => {
      if (this.enabled) this._useSelectedItem();
    });

    this._onKeyDown = (e) => {
      if (!this.enabled) return;
      if (e.code === "KeyE" && !e.repeat) {
        emit("input:interact", {});
        return;
      }
      const digit = /^Digit([0-9])$/.exec(e.code);
      if (digit && !e.repeat) {
        const index = digit[1] === "0" ? 9 : parseInt(digit[1], 10) - 1;
        if (index < HOTBAR_ITEMS.length) this.setHotbar(index);
        return;
      }
      this.keys.add(e.code);
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);

    this._onMouseMove = (e) => {
      if (!this.enabled || document.pointerLockElement !== this.canvas) return;
      this.yaw -= e.movementX * MOUSE_SENSITIVITY;
      this.pitch -= e.movementY * MOUSE_SENSITIVITY;
      const limit = Math.PI / 2 - 0.01;
      this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
    };

    this._onMouseDown = (e) => {
      if (!this.enabled) return;
      // Left-click is the direct patient-card action. It also works before
      // pointer lock is acquired, so the first click near a patient is useful.
      if (e.button === 0) {
        emit("input:interact", {});
        return;
      }
      if (document.pointerLockElement !== this.canvas) return;
      if (e.button === 2) this._useSelectedItem();
    };

    this._onWheel = (e) => {
      if (!this.enabled || document.pointerLockElement !== this.canvas) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1 : -1;
      this.setHotbar((this.hotbarIndex + delta + HOTBAR_ITEMS.length) % HOTBAR_ITEMS.length);
    };

    this._onContextMenu = (e) => e.preventDefault();

    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    document.addEventListener("mousemove", this._onMouseMove);
    canvas.addEventListener("mousedown", this._onMouseDown);
    canvas.addEventListener("wheel", this._onWheel, { passive: false });
    canvas.addEventListener("contextmenu", this._onContextMenu);
  }

  _collides(px, py, pz) {
    const x0 = Math.floor(px - HALF_WIDTH);
    const x1 = Math.floor(px + HALF_WIDTH);
    const y0 = Math.floor(py);
    const y1 = Math.floor(py + BODY_HEIGHT - 0.001);
    const z0 = Math.floor(pz - HALF_WIDTH);
    const z1 = Math.floor(pz + HALF_WIDTH);
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          if (this.world.isSolid(x, y, z)) return true;
        }
      }
    }
    return false;
  }

  update(dt) {
    if (!this.enabled) {
      this.velocity.set(0, 0, 0);
      this.touchMove.x = 0;
      this.touchMove.y = 0;
      this.touchSprint = false;
      this.jumpQueued = false;
      this._movementTime = 0;
      return;
    }

    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    let moveX = 0;
    let moveZ = 0;
    if (this.keys.has("KeyW")) {
      moveX += forwardX;
      moveZ += forwardZ;
    }
    if (this.keys.has("KeyS")) {
      moveX -= forwardX;
      moveZ -= forwardZ;
    }
    if (this.keys.has("KeyD")) {
      moveX += rightX;
      moveZ += rightZ;
    }
    if (this.keys.has("KeyA")) {
      moveX -= rightX;
      moveZ -= rightZ;
    }
    moveX += rightX * this.touchMove.x + forwardX * -this.touchMove.y;
    moveZ += rightZ * this.touchMove.x + forwardZ * -this.touchMove.y;
    const length = Math.hypot(moveX, moveZ);
    if (length > 0) {
      moveX /= length;
      moveZ /= length;
    }
    const movingInput = length > 0.08;
    this._movementTime = movingInput ? this._movementTime + dt : 0;
    const sprinting =
      this.sprintEnabled &&
      (this.touchSprint ||
        this.keys.has("ShiftLeft") ||
        this.keys.has("ShiftRight") ||
        (movingInput && this._movementTime >= AUTO_SPRINT_DELAY));
    const speed = WALK_SPEED * (sprinting ? SPRINT_MULT : 1);
    this.velocity.x = moveX * speed;
    this.velocity.z = moveZ * speed;

    let jumpedThisFrame = false;
    if ((this.jumpQueued || this.keys.has("Space")) && this.grounded) {
      this.velocity.y = JUMP_VELOCITY;
      this.jumpQueued = false;
      this.grounded = false;
      this._wasGrounded = false;
      jumpedThisFrame = true;
      emit("player:jump", { surface: this.surface });
    }

    this.velocity.y = Math.max(TERMINAL_VELOCITY, this.velocity.y + GRAVITY * dt);

    const p = this.position;
    let nx = p.x + this.velocity.x * dt;
    const blockedX = this._collides(nx, p.y, p.z);
    if (blockedX) nx = p.x;
    let nz = p.z + this.velocity.z * dt;
    const blockedZ = this._collides(nx, p.y, nz);
    if (blockedZ) nz = p.z;
    // A one-block obstacle should not stop a player who is already moving.
    // The jump starts here and the normal vertical collision step carries the
    // player over it; two-block walls still fail the clearance check.
    if (
      !jumpedThisFrame &&
      this.grounded &&
      movingInput &&
      (blockedX || blockedZ) &&
      this._canAutoJump(p.x + this.velocity.x * dt, p.z + this.velocity.z * dt)
    ) {
      this.velocity.y = JUMP_VELOCITY;
      this.jumpQueued = false;
      this.grounded = false;
      this._wasGrounded = false;
      emit("player:jump", { surface: this.surface, automatic: true });
    }
    const impactSpeed = -this.velocity.y;
    let ny = p.y + this.velocity.y * dt;
    if (this._collides(nx, ny, nz)) {
      if (this.velocity.y < 0) this.grounded = true;
      ny = p.y;
      this.velocity.y = 0;
    } else {
      this.grounded = false;
    }

    p.x = nx;
    p.y = ny;
    p.z = nz;

    this.moving = length > 0 && (Math.abs(this.velocity.x) > 0.05 || Math.abs(this.velocity.z) > 0.05);
    this.sprinting = sprinting;
    this.surface = blockMaterial(this.world.getBlock(Math.floor(p.x), Math.floor(p.y - 0.12), Math.floor(p.z)));
    if (this.grounded && !this._wasGrounded && impactSpeed > 3) {
      emit("player:land", { surface: this.surface, strength: Math.min(1, impactSpeed / 16) });
    }
    this._wasGrounded = this.grounded;

    if (p.y < -10) {
      const c = this.world.clinic;
      this.teleport(c.x + 3.5, this.world.getHeight(c.x + 3.5, c.z + 3.5) + 0.2, c.z + 3.5);
    }

    this.camera.position.set(p.x, p.y + EYE_HEIGHT, p.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  _canAutoJump(x, z) {
    return !this._collides(x, this.position.y + AUTO_JUMP_HEIGHT, z);
  }

  teleport(x, y, z) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this._movementTime = 0;
  }

  faceTowards(x, z) {
    const dx = Number(x) - this.position.x;
    const dz = Number(z) - this.position.z;
    if (Math.hypot(dx, dz) < 0.001) return;
    this.yaw = Math.atan2(-dx, -dz);
    this.pitch = -0.12;
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  setHotbar(index, notify = true) {
    const next = Number(index);
    if (!Number.isInteger(next) || next < 0 || next >= HOTBAR_ITEMS.length) return;
    this.hotbarIndex = next;
    if (notify) emit("input:hotbar", { index: next });
  }

  _useSelectedItem() {
    const item = HOTBAR_ITEMS[this.hotbarIndex];
    if (!item) return;
    if (item.type === "block") {
      this._placeBlock(item.block);
      return;
    }
    emit("input:item-use", { itemId: item.id });
  }

  _placeBlock(blockId) {
    const hit = this.world.raycast(this.camera.position.clone(), this.camera.getWorldDirection(this._lookDir), 6);
    if (!hit) return;
    const tx = hit.x + hit.nx;
    const ty = hit.y + hit.ny;
    const tz = hit.z + hit.nz;
    const target = this.world.getBlock(tx, ty, tz);
    if (target !== BLOCK.AIR) return;
    const p = this.position;
    const overlapsPlayer =
      tx < p.x + HALF_WIDTH &&
      tx + 1 > p.x - HALF_WIDTH &&
      ty < p.y + BODY_HEIGHT &&
      ty + 1 > p.y &&
      tz < p.z + HALF_WIDTH &&
      tz + 1 > p.z - HALF_WIDTH;
    if (overlapsPlayer) return;
    this.world.setBlock(tx, ty, tz, blockId);
    emit("player:block-placed", { x: tx, y: ty, z: tz, block: blockId, material: blockMaterial(blockId) });
  }
}

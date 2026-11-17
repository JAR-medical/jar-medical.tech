// Desktop preview loop: pointer controls, WASD walking, keyboard shortcuts,
// resize handling with devicePixelRatio capped at 2, stoppable rAF loop.
//
// Gaze is driven by pointer ray (mouse provider) or head-forward.

import {
  mat4FromYawPitch,
  mat4Invert,
  mat4Perspective,
  deg2rad,
  clamp,
  normalize,
} from './math.js';
import { FIELD, QUALIA, PANEL } from './config.js';
import { state, triggerRestitch } from './state.js';

export class DesktopPreview {
  constructor({ canvas, renderer, gazeManager, calibration } = {}) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.gazeManager = gazeManager;
    this.calibration = calibration;

    this.running = false;
    this.rafId = null;
    this.lastTime = 0;

    // Camera pose
    this.pos = [0, 1.6, 0]; // eye height 1.6m
    this.yawDeg = 0;
    this.pitchDeg = 0;
    this.fovY = 75;

    this.walkSpeed = 3.0; // m/s
    this.lookSensitivity = 0.18; // deg/px
    this.isDragging = false;
    this.lastPointer = [0, 0];
    this.bypass = false; // Space key hold for normal vision
    this.symptomsSaved = null;

    this.keysDown = new Set();

    this.boundOnPointerDown = this.onPointerDown.bind(this);
    this.boundOnPointerMove = this.onPointerMove.bind(this);
    this.boundOnPointerUp = this.onPointerUp.bind(this);
    this.boundOnKeyDown = this.onKeyDown.bind(this);
    this.boundOnKeyUp = this.onKeyUp.bind(this);
    this.boundOnResize = this.onResize.bind(this);
    this.boundLoop = this.loop.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;

    this.renderer.setMode('desktop');
    this.renderer.setScene(state.scene);
    this.renderer.setNight(state.night);
    this.renderer.setReduceFlashing(state.reduceFlashing);

    this.gazeManager.start({ canvas: this.canvas });

    window.addEventListener('resize', this.boundOnResize);
    this.canvas.addEventListener('pointerdown', this.boundOnPointerDown);
    window.addEventListener('pointermove', this.boundOnPointerMove);
    window.addEventListener('pointerup', this.boundOnPointerUp);
    window.addEventListener('pointercancel', this.boundOnPointerUp);
    window.addEventListener('keydown', this.boundOnKeyDown);
    window.addEventListener('keyup', this.boundOnKeyUp);

    this.onResize();
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.boundLoop);
  }

  stop() {
    if (!this.running) return;
    this.running = false;

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    window.removeEventListener('resize', this.boundOnResize);
    this.canvas.removeEventListener('pointerdown', this.boundOnPointerDown);
    window.removeEventListener('pointermove', this.boundOnPointerMove);
    window.removeEventListener('pointerup', this.boundOnPointerUp);
    window.removeEventListener('pointercancel', this.boundOnPointerUp);
    window.removeEventListener('keydown', this.boundOnKeyDown);
    window.removeEventListener('keyup', this.boundOnKeyUp);

    this.isDragging = false;
    this.keysDown.clear();
    this.gazeManager.stop();
  }

  onResize() {
    if (!this.canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  onPointerDown(e) {
    if (e.button === 0) { // Left click
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {}
      this.isDragging = true;
      this.lastPointer = [e.clientX, e.clientY];
    }
  }

  onPointerMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const aspect = (rect.width || 1) / (rect.height || 1);

    if (this.isDragging) {
      const dx = e.clientX - this.lastPointer[0];
      const dy = e.clientY - this.lastPointer[1];
      this.lastPointer = [e.clientX, e.clientY];

      this.yawDeg = (this.yawDeg + dx * this.lookSensitivity) % 360;
      this.pitchDeg = clamp(this.pitchDeg - dy * this.lookSensitivity, -85, 85);
    }

    // Compute pointer ray in view/head space for mouse gaze provider
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

    const tanHalf = Math.tan(deg2rad(this.fovY) / 2);
    const rayX = ndcX * tanHalf * aspect;
    const rayY = ndcY * tanHalf;
    const rayZ = -1;
    const ray = normalize([rayX, rayY, rayZ]);

    const mouseProvider = this.gazeManager.getProvider('mouse');
    mouseProvider?.setRay(ray);
  }

  onPointerUp(e) {
    if (this.isDragging) {
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch {}
      this.isDragging = false;
    }
  }

  onKeyDown(e) {
    if (e.repeat && (e.key === '0' || e.key === '1' || e.key === '2' || e.key === 'p' || e.key === 'c')) {
      return;
    }

    this.keysDown.add(e.code);

    switch (e.key) {
      case '0': {
        // Toggle all symptoms off / on
        if (this.symptomsSaved === null) {
          this.symptomsSaved = {
            field: FIELD.enabled,
            qualia: {},
          };
          for (const [qname, q] of Object.entries(QUALIA)) {
            this.symptomsSaved.qualia[qname] = q.enabled;
            q.enabled = false;
          }
          FIELD.enabled = false;
          this.renderer.setHud('All symptoms: OFF', 1.5);
        } else {
          FIELD.enabled = this.symptomsSaved.field;
          for (const [qname, q] of Object.entries(QUALIA)) {
            if (this.symptomsSaved.qualia[qname] !== undefined) {
              q.enabled = this.symptomsSaved.qualia[qname];
            }
          }
          this.symptomsSaved = null;
          this.renderer.setHud('All symptoms: RESTORED', 1.5);
        }
        triggerRestitch();
        this.renderer.restitch();
        break;
      }
      case '1': {
        FIELD.enabled = !FIELD.enabled;
        this.renderer.setHud(`Field: ${FIELD.enabled ? 'ON' : 'OFF'}`, 1.5);
        triggerRestitch();
        this.renderer.restitch();
        break;
      }
      case '2': {
        QUALIA.nyctalopia.enabled = !QUALIA.nyctalopia.enabled;
        state.night = QUALIA.nyctalopia.enabled;
        this.renderer.setNight(state.night);
        this.renderer.setHud(`Nyctalopia / Night: ${QUALIA.nyctalopia.enabled ? 'ON' : 'OFF'}`, 1.5);
        triggerRestitch();
        this.renderer.restitch();
        break;
      }
      case 'p':
      case 'P': {
        PANEL.enabled = !PANEL.enabled;
        this.renderer.setHud(`Glance Panel: ${PANEL.enabled ? 'ON' : 'OFF'}`, 1.5);
        triggerRestitch();
        this.renderer.restitch();
        break;
      }
      case 'c':
      case 'C': {
        if (this.calibration) {
          if (this.calibration.isActive()) {
            this.calibration.abort();
          } else {
            this.calibration.start();
          }
        }
        break;
      }
      case '[': {
        FIELD.params.degeneration.value = clamp(FIELD.params.degeneration.value - 0.05, 0, 1);
        this.renderer.setHud(`Degeneration: ${(FIELD.params.degeneration.value * 100).toFixed(0)}%`, 1.5);
        break;
      }
      case ']': {
        FIELD.params.degeneration.value = clamp(FIELD.params.degeneration.value + 0.05, 0, 1);
        this.renderer.setHud(`Degeneration: ${(FIELD.params.degeneration.value * 100).toFixed(0)}%`, 1.5);
        break;
      }
      case ' ': {
        this.bypass = true;
        break;
      }
    }
  }

  onKeyUp(e) {
    this.keysDown.delete(e.code);
    if (e.code === 'Space') {
      this.bypass = false;
    }
  }

  updateMovement(dt) {
    const yawRad = deg2rad(this.yawDeg);
    const fwd = [-Math.sin(yawRad), 0, -Math.cos(yawRad)];
    const right = [Math.cos(yawRad), 0, -Math.sin(yawRad)];

    let moveX = 0;
    let moveZ = 0;

    if (this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp')) moveZ += 1;
    if (this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown')) moveZ -= 1;
    if (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft')) moveX -= 1;
    if (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight')) moveX += 1;

    if (moveX !== 0 || moveZ !== 0) {
      const len = Math.hypot(moveX, moveZ);
      const nx = moveX / len;
      const nz = moveZ / len;

      const dist = this.walkSpeed * dt;
      this.pos[0] += (fwd[0] * nz + right[0] * nx) * dist;
      this.pos[2] += (fwd[2] * nz + right[2] * nx) * dist;
    }

    this.pos[1] = 1.6; // Keep head at fixed height
  }

  loop(now) {
    if (!this.running) return;

    const dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;

    this.updateMovement(dt);

    if (this.calibration && this.calibration.isActive()) {
      this.calibration.update(dt);
    }

    const gaze = this.gazeManager.update(null, null, null, dt);
    const gazeDirView = gaze.dirHead;

    this.renderer.beginFrame(now / 1000, dt);

    const aspect = this.canvas.width / (this.canvas.height || 1);
    const camWorld = mat4FromYawPitch(this.yawDeg, this.pitchDeg, this.pos);
    const viewMatrix = mat4Invert(camWorld);
    const projMatrix = mat4Perspective(this.fovY, aspect, 0.1, 100);

    const targets = this.calibration ? this.calibration.getTargets() : null;

    this.renderer.renderView({
      viewMatrix,
      projectionMatrix: projMatrix,
      viewport: { x: 0, y: 0, width: this.canvas.width, height: this.canvas.height },
      framebuffer: null,
      gazeDirView,
      bypass: this.bypass || state.bypass,
      targets,
      gazeCursor: state.showGazeCursor,
    });

    this.rafId = requestAnimationFrame(this.boundLoop);
  }
}

// Gaze providers for RP-XR:
// 1. BridgeGazeProvider   - WebSocket from companion app / mock server (ws://127.0.0.1:8765)
// 2. WebXRGazeProvider    - XRInputSource with targetRayMode === 'gaze'
// 3. ControllerGazeProvider - Thumbstick angular integration with spring-back
// 4. HeadGazeProvider     - Straight-ahead default ([0, 0, -1])
// 5. MouseGazeProvider    - Desktop preview pointer position
//
// All provider failure paths are observable via statusText / getStatus() (no silent catch).

import { normalize, length, quatRotate, anglesToDir, angleBetween } from '../math.js';
import { GAZE, BRIDGE } from '../config.js';

/**
 * Bridge WebSocket provider for PICO 4 Enterprise eye tracking.
 */
export class BridgeGazeProvider {
  constructor({ url = BRIDGE.defaultUrl, reconnectMs = BRIDGE.reconnectMs } = {}) {
    this.id = 'bridge';
    this.label = 'Bridge (PICO Eye Tracking)';
    this.url = url;
    this.minReconnectMs = reconnectMs[0];
    this.maxReconnectMs = reconnectMs[1];
    this.reconnectDelay = this.minReconnectMs;

    this.ws = null;
    this.running = false;
    this.reconnectTimer = null;

    this.lastSample = null; // { dirHead, valid, conf, t }
    this.sampleCount = 0;
    this.sampleRateHz = 0;
    this.lastHzCalcT = null;

    this.state = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'error'
    this.statusText = 'Disconnected';
    this.lastError = null;
  }

  setUrl(url) {
    if (url === this.url) return;
    this.url = url;
    if (this.running) {
      this.stop();
      this.start();
    }
  }

  start(ctx) {
    this.running = true;
    this.reconnectDelay = this.minReconnectMs;
    this.connect();
  }

  stop() {
    this.running = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.state = 'disconnected';
    this.statusText = 'Disconnected';
    this.lastSample = null;
    this.sampleRateHz = 0;
  }

  connect() {
    if (!this.running) return;
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }

    this.state = 'connecting';
    this.statusText = `Connecting to ${this.url}...`;

    try {
      // Browser WebSocket
      const ws = new WebSocket(this.url);
      this.ws = ws;

      ws.onopen = () => {
        if (this.ws !== ws) return;
        this.state = 'connected';
        this.statusText = 'Connected';
        this.reconnectDelay = this.minReconnectMs;
        this.lastHzCalcT = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        this.sampleCount = 0;
      };

      ws.onmessage = (event) => {
        if (this.ws !== ws) return;
        this.onMessage(event.data);
      };

      ws.onerror = (err) => {
        if (this.ws !== ws) return;
        this.lastError = err?.message || 'WebSocket connection error';
        this.statusText = `Error: ${this.lastError}`;
      };

      ws.onclose = (event) => {
        if (this.ws !== ws) return;
        this.state = 'disconnected';
        this.statusText = `Closed (code ${event.code}). Reconnecting in ${this.reconnectDelay}ms...`;
        this.ws = null;
        this.scheduleReconnect();
      };
    } catch (err) {
      this.lastError = err?.message || 'Failed to instantiate WebSocket';
      this.state = 'error';
      this.statusText = `Failed to connect: ${this.lastError}`;
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (!this.running || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.maxReconnectMs, this.reconnectDelay * 2);
  }

  onMessage(rawData) {
    let msg;
    try {
      msg = JSON.parse(rawData);
    } catch (err) {
      this.statusText = `Parse error: ${err.message}`;
      return;
    }

    if (!msg || msg.type !== 'gaze') {
      this.statusText = `Ignored message: expected type="gaze"`;
      return;
    }

    if (!Array.isArray(msg.dir) || msg.dir.length !== 3) {
      this.statusText = 'Invalid gaze message: "dir" must be 3-element array';
      return;
    }

    const [x, y, z] = msg.dir;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      this.statusText = 'Invalid gaze message: non-finite dir vector';
      return;
    }

    const len = length([x, y, z]);
    if (len < 1e-6) {
      this.statusText = 'Rejected zero gaze vector';
      return;
    }

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const dirHead = normalize([x, y, z]);
    const valid = msg.valid !== false;
    const conf = typeof msg.conf === 'number' ? msg.conf : 1.0;

    this.lastSample = { dirHead, valid, conf, t: now };
    this.sampleCount++;

    if (this.lastHzCalcT === null) this.lastHzCalcT = now;
    const elapsed = now - this.lastHzCalcT;
    if (elapsed >= 1000) {
      this.sampleRateHz = Math.round((this.sampleCount * 1000) / elapsed);
      this.sampleCount = 0;
      this.lastHzCalcT = now;
      this.statusText = `Connected (${this.sampleRateHz} Hz)`;
    }
  }

  sample(frame, viewerPose, refSpace, dt) {
    if (this.state !== 'connected' || !this.lastSample) {
      return { dirHead: null, valid: false, isEye: true, confidence: 0 };
    }

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const age = now - this.lastSample.t;
    if (age > GAZE.staleMs) {
      this.statusText = `Stale data (${Math.round(age)}ms old)`;
      return { dirHead: null, valid: false, isEye: true, confidence: 0, stale: true };
    }

    return {
      dirHead: this.lastSample.dirHead,
      valid: this.lastSample.valid,
      isEye: true,
      confidence: this.lastSample.conf,
    };
  }

  getStatus() {
    return {
      id: this.id,
      label: this.label,
      state: this.state,
      statusText: this.statusText,
      hz: this.sampleRateHz,
      isEye: true,
    };
  }
}

/**
 * WebXR native eye/head gaze provider via XRInputSource (targetRayMode === 'gaze').
 */
export class WebXRGazeProvider {
  constructor() {
    this.id = 'webxr';
    this.label = 'WebXR Input Source';
    this.session = null;
    this.viewerSpace = null;
    this.hasDeviated = false;
    this.isEye = false;
    this.statusText = 'WebXR not started';
    this.onInputSourcesChange = this.handleInputSourcesChange.bind(this);
  }

  start(ctx) {
    this.session = ctx?.session || null;
    this.hasDeviated = false;
    this.isEye = false;
    this.statusText = 'Waiting for WebXR gaze source';

    if (this.session) {
      this.session.addEventListener('inputsourceschange', this.onInputSourcesChange);
      if (typeof this.session.requestReferenceSpace === 'function') {
        this.session.requestReferenceSpace('viewer')
          .then((space) => {
            this.viewerSpace = space;
            this.statusText = 'Viewer reference space acquired';
          })
          .catch((err) => {
            this.statusText = `Failed viewer space: ${err.message}`;
          });
      }
    }
  }

  stop() {
    if (this.session) {
      try {
        this.session.removeEventListener('inputsourceschange', this.onInputSourcesChange);
      } catch {}
      this.session = null;
    }
    this.viewerSpace = null;
    this.hasDeviated = false;
    this.isEye = false;
    this.statusText = 'Stopped';
  }

  handleInputSourcesChange(event) {
    const hasGaze = Array.from(this.session?.inputSources || []).some(
      (s) => s.targetRayMode === 'gaze'
    );
    this.statusText = hasGaze ? 'WebXR gaze source detected' : 'No gaze source found';
  }

  sample(frame, viewerPose, refSpace, dt) {
    if (!frame) {
      return { dirHead: null, valid: false, isEye: this.isEye, confidence: 0 };
    }

    if (!this.session && frame.session) {
      this.start({ session: frame.session });
    }

    const session = this.session || frame.session;
    if (!session || !session.inputSources) {
      this.statusText = 'No active XR session';
      return { dirHead: null, valid: false, isEye: this.isEye, confidence: 0 };
    }

    let gazeSource = null;
    for (const src of session.inputSources) {
      if (src.targetRayMode === 'gaze') {
        gazeSource = src;
        break;
      }
    }

    if (!gazeSource) {
      this.statusText = 'No targetRayMode === "gaze" input source';
      return { dirHead: null, valid: false, isEye: this.isEye, confidence: 0 };
    }

    if (!this.viewerSpace) {
      this.statusText = 'Viewer space not yet ready';
      return { dirHead: null, valid: false, isEye: this.isEye, confidence: 0 };
    }

    const pose = frame.getPose(gazeSource.targetRaySpace, this.viewerSpace);
    if (!pose) {
      this.statusText = 'Gaze pose is null for frame';
      return { dirHead: null, valid: false, isEye: this.isEye, confidence: 0 };
    }

    const o = pose.transform.orientation;
    const q = [o.x, o.y, o.z, o.w];
    const dirHead = normalize(quatRotate(q, [0, 0, -1]));

    const dev = angleBetween(dirHead, [0, 0, -1]);
    if (dev > 2.0) {
      this.hasDeviated = true;
      this.isEye = true;
    }

    this.statusText = this.isEye ? 'WebXR eye gaze tracking' : 'WebXR gaze (head-locked ≤2°)';
    return { dirHead, valid: true, isEye: this.isEye, confidence: 1.0 };
  }

  getStatus() {
    return {
      id: this.id,
      label: this.label,
      state: this.session ? 'active' : 'idle',
      statusText: this.statusText,
      hz: 0,
      isEye: this.isEye,
    };
  }
}

/**
 * Controller thumbstick gaze provider with spring-back.
 */
export class ControllerGazeProvider {
  constructor({
    speedDegPerSec = GAZE.controllerSpeedDegPerSec,
    springBack = GAZE.springBack,
    easeMs = GAZE.easeMs,
    maxExcursionDeg = GAZE.maxExcursionDeg,
  } = {}) {
    this.id = 'controller';
    this.label = 'Controller Thumbstick';
    this.speedDegPerSec = speedDegPerSec;
    this.springBack = springBack;
    this.easeMs = easeMs;
    this.maxExcursionDeg = maxExcursionDeg;

    this.az = 0;
    this.el = 0;
    this.active = false;
    this.statusText = 'Controller ready';
  }

  start(ctx) {
    this.az = 0;
    this.el = 0;
    this.active = false;
    this.statusText = 'Controller active';
  }

  stop() {
    this.az = 0;
    this.el = 0;
    this.active = false;
    this.statusText = 'Stopped';
  }

  setDeflection(stickX, stickY, dt) {
    const deadzone = 0.12;
    const sx = Math.abs(stickX) > deadzone ? stickX : 0;
    const sy = Math.abs(stickY) > deadzone ? stickY : 0;

    if (sx !== 0 || sy !== 0) {
      this.az += sx * this.speedDegPerSec * dt;
      this.el -= sy * this.speedDegPerSec * dt; // Gamepad thumbstick up is negative Y

      const hyp = Math.hypot(this.az, this.el);
      if (hyp > this.maxExcursionDeg) {
        const k = this.maxExcursionDeg / hyp;
        this.az *= k;
        this.el *= k;
      }
      this.active = true;
      this.statusText = 'Steering gaze with thumbstick';
    } else if (this.springBack && (Math.abs(this.az) > 0.05 || Math.abs(this.el) > 0.05)) {
      const keep = Math.exp(-dt / (this.easeMs / 1000));
      this.az *= keep;
      this.el *= keep;
      if (Math.hypot(this.az, this.el) < 0.1) {
        this.az = 0;
        this.el = 0;
        this.active = false;
        this.statusText = 'Centered';
      } else {
        this.active = true;
        this.statusText = 'Springing back';
      }
    } else {
      this.active = false;
      this.statusText = 'Idle';
    }
  }

  sample(frame, viewerPose, refSpace, dt) {
    if (frame?.session?.inputSources) {
      let maxDeflectionX = 0;
      let maxDeflectionY = 0;
      for (const src of frame.session.inputSources) {
        const gp = src.gamepad;
        if (gp && gp.axes && gp.axes.length >= 4) {
          // Standard thumbstick axes: 2 (X) and 3 (Y)
          const ax = gp.axes[2];
          const ay = gp.axes[3];
          if (Math.hypot(ax, ay) > Math.hypot(maxDeflectionX, maxDeflectionY)) {
            maxDeflectionX = ax;
            maxDeflectionY = ay;
          }
        }
      }
      this.setDeflection(maxDeflectionX, maxDeflectionY, dt || 1 / 72);
    }

    if (!this.active) {
      return { dirHead: [0, 0, -1], valid: false, isEye: false, confidence: 1.0, active: false };
    }

    const dirHead = anglesToDir(this.az, this.el);
    return { dirHead, valid: true, isEye: false, confidence: 1.0, active: true };
  }

  getStatus() {
    return {
      id: this.id,
      label: this.label,
      state: this.active ? 'deflected' : 'idle',
      statusText: this.statusText,
      hz: 0,
      isEye: false,
    };
  }
}

/**
 * Head-fixed gaze provider: straight ahead ([0, 0, -1]).
 */
export class HeadGazeProvider {
  constructor() {
    this.id = 'head';
    this.label = 'Head-Forward (Tunnel Vision)';
    this.statusText = 'Head-fixed [0, 0, -1]';
  }

  start() {}
  stop() {}

  sample() {
    return { dirHead: [0, 0, -1], valid: true, isEye: false, confidence: 1.0 };
  }

  getStatus() {
    return {
      id: this.id,
      label: this.label,
      state: 'active',
      statusText: this.statusText,
      hz: 0,
      isEye: false,
    };
  }
}

/**
 * Mouse gaze provider for desktop preview.
 */
export class MouseGazeProvider {
  constructor() {
    this.id = 'mouse';
    this.label = 'Mouse Pointer';
    this.dirHead = [0, 0, -1];
    this.hasInput = false;   // true once a pointer ray arrived (auto mode uses it then)
    this.statusText = 'Mouse gaze ready';
  }

  start() {
    this.statusText = 'Mouse active';
  }

  stop() {
    this.dirHead = [0, 0, -1];
    this.hasInput = false;
    this.statusText = 'Stopped';
  }

  setRay(dir) {
    if (Array.isArray(dir) && dir.length === 3 && dir.every(Number.isFinite)) {
      this.hasInput = true;
      this.dirHead = normalize(dir);
      this.statusText = 'Mouse tracking';
    }
  }

  sample() {
    return { dirHead: this.dirHead, valid: true, isEye: false, confidence: 1.0 };
  }

  getStatus() {
    return {
      id: this.id,
      label: this.label,
      state: 'active',
      statusText: this.statusText,
      hz: 0,
      isEye: false,
    };
  }
}

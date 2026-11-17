// Gaze manager: selection, filtering, priority and status.
//
// Pipeline per SPEC:
// 1. Provider selection: preferred || auto (priority: bridge > webxr(isEye) > controller(deflected/springing) > head)
// 2. Extract direction in head space -> convert to angles (az, el)
// 3. GazeFilter: bias correction -> clamp to maxExcursionDeg -> one-euro filter -> blink hold / fallback easing
// 4. Output filtered dirHead, sourceId, isEye, valid.
// Exposes lastRaw for 9-point calibration.

import { dirToAngles, anglesToDir } from '../math.js';
import { GAZE } from '../config.js';
import { GazeFilter } from './filter.js';
import {
  BridgeGazeProvider,
  WebXRGazeProvider,
  ControllerGazeProvider,
  HeadGazeProvider,
  MouseGazeProvider,
} from './providers.js';

export class GazeManager {
  constructor({
    providers = null,
    preferred = 'auto',
    filter = null,
    bias = null,
  } = {}) {
    this.providers = new Map();

    if (providers) {
      if (Array.isArray(providers)) {
        for (const p of providers) this.providers.set(p.id, p);
      } else if (providers instanceof Map) {
        this.providers = new Map(providers);
      } else if (typeof providers === 'object') {
        for (const [k, p] of Object.entries(providers)) this.providers.set(k, p);
      }
    } else {
      // Default standard provider set
      this.providers.set('bridge', new BridgeGazeProvider());
      this.providers.set('webxr', new WebXRGazeProvider());
      this.providers.set('controller', new ControllerGazeProvider());
      this.providers.set('head', new HeadGazeProvider());
      this.providers.set('mouse', new MouseGazeProvider());
    }

    this.preferred = preferred; // 'auto' | id
    this.filter = filter || new GazeFilter({
      maxExcursionDeg: GAZE.maxExcursionDeg,
      blinkHoldMs: GAZE.blinkHoldMs,
      fallbackAfterMs: GAZE.fallbackAfterMs,
      easeMs: GAZE.easeMs,
      oneEuro: GAZE.oneEuro,
    });

    if (bias) this.filter.setBias(bias);

    this.activeSourceId = 'head';
    this.isEye = false;
    this.lastRaw = null;
    this.lastSampleResult = null;
  }

  setPreferred(id) {
    this.preferred = id || 'auto';
  }

  getPreferred() {
    return this.preferred;
  }

  getActiveSourceId() {
    return this.activeSourceId;
  }

  getProvider(id) {
    return this.providers.get(id) || null;
  }

  setBias(bias) {
    this.filter.setBias(bias);
  }

  start(ctx) {
    for (const p of this.providers.values()) {
      if (typeof p.start === 'function') {
        try {
          p.start(ctx);
        } catch (err) {
          p.statusText = `Failed to start: ${err.message}`;
        }
      }
    }
    this.filter.reset();
  }

  stop() {
    for (const p of this.providers.values()) {
      if (typeof p.stop === 'function') {
        try {
          p.stop();
        } catch (err) {
          p.statusText = `Failed to stop: ${err.message}`;
        }
      }
    }
    this.filter.reset();
    this.activeSourceId = 'head';
    this.isEye = false;
    this.lastRaw = null;
  }

  /**
   * Sample providers and run the gaze filtering pipeline.
   * @param {XRFrame|null} frame
   * @param {XRViewerPose|null} viewerPose
   * @param {XRReferenceSpace|null} refSpace
   * @param {number} dt (seconds)
   * @param {number} [customTimeMs] optional explicit timestamp for node tests
   * @returns {{ dirHead: number[], sourceId: string, isEye: boolean, valid: boolean }}
   */
  update(frame = null, viewerPose = null, refSpace = null, dt = 1 / 72, customTimeMs = null) {
    const tMs = typeof customTimeMs === 'number'
      ? customTimeMs
      : (typeof performance !== 'undefined' ? performance.now() : Date.now());

    let chosenProvider = null;
    let chosenSample = null;

    if (this.preferred !== 'auto') {
      const p = this.providers.get(this.preferred);
      if (p) {
        chosenProvider = p;
        try {
          chosenSample = p.sample(frame, viewerPose, refSpace, dt);
        } catch (err) {
          p.statusText = `Sample error: ${err.message}`;
          chosenSample = { dirHead: null, valid: false, isEye: false, confidence: 0 };
        }
      }
    }

    if (!chosenProvider) {
      // Auto priority: bridge > webxr(isEye) > controller(only while deflected/springing) > head
      const bridge = this.providers.get('bridge');
      if (bridge) {
        try {
          const s = bridge.sample(frame, viewerPose, refSpace, dt);
          if (s && s.valid && s.dirHead) {
            chosenProvider = bridge;
            chosenSample = s;
          }
        } catch (err) {
          bridge.statusText = `Sample error: ${err.message}`;
        }
      }

      if (!chosenProvider) {
        const webxr = this.providers.get('webxr');
        if (webxr) {
          try {
            const s = webxr.sample(frame, viewerPose, refSpace, dt);
            if (s && s.valid && s.dirHead && s.isEye) {
              chosenProvider = webxr;
              chosenSample = s;
            }
          } catch (err) {
            webxr.statusText = `Sample error: ${err.message}`;
          }
        }
      }

      if (!chosenProvider) {
        const controller = this.providers.get('controller');
        if (controller) {
          try {
            const s = controller.sample(frame, viewerPose, refSpace, dt);
            if (s && s.valid && s.dirHead && s.active) {
              chosenProvider = controller;
              chosenSample = s;
            }
          } catch (err) {
            controller.statusText = `Sample error: ${err.message}`;
          }
        }
      }

      // desktop / 2D-window: the pointer is the gaze once it has moved
      // (in Wolvic's window mode its eye-gaze pointer drives this too)
      if (!chosenProvider) {
        const mouse = this.providers.get('mouse');
        if (mouse && mouse.hasInput) {
          chosenProvider = mouse;
          chosenSample = mouse.sample(frame, viewerPose, refSpace, dt);
        }
      }

      if (!chosenProvider) {
        const head = this.providers.get('head');
        if (head) {
          chosenProvider = head;
          try {
            chosenSample = head.sample(frame, viewerPose, refSpace, dt);
          } catch (err) {
            head.statusText = `Sample error: ${err.message}`;
            chosenSample = { dirHead: [0, 0, -1], valid: true, isEye: false, confidence: 1.0 };
          }
        }
      }
    }

    if (!chosenProvider) {
      // Ultimate fallback
      chosenSample = { dirHead: [0, 0, -1], valid: true, isEye: false, confidence: 1.0 };
      this.activeSourceId = 'fallback';
      this.isEye = false;
    } else {
      this.activeSourceId = chosenProvider.id;
      this.isEye = Boolean(chosenSample?.isEye);
    }

    this.lastSampleResult = chosenSample;

    // Convert raw direction to angles (az, el)
    let rawAngles = null;
    if (chosenSample && chosenSample.valid && chosenSample.dirHead) {
      const { az, el } = dirToAngles(chosenSample.dirHead);
      rawAngles = { az, el, valid: true };
    } else {
      rawAngles = { valid: false };
    }

    // Filter step
    const filtered = this.filter.update(rawAngles, tMs);
    this.lastRaw = this.filter.lastRaw;

    const dirHead = anglesToDir(filtered.az, filtered.el);

    return {
      dirHead,
      sourceId: this.activeSourceId,
      isEye: this.isEye,
      valid: filtered.valid,
      state: filtered.state,
      az: filtered.az,
      el: filtered.el,
    };
  }

  /**
   * Return status line diagnostic information.
   */
  getStatus() {
    const list = [];
    for (const p of this.providers.values()) {
      if (typeof p.getStatus === 'function') {
        list.push(p.getStatus());
      } else {
        list.push({ id: p.id, label: p.label || p.id, statusText: 'ok' });
      }
    }

    const activeProvider = this.providers.get(this.activeSourceId);
    const hz = activeProvider?.sampleRateHz || 0;

    let summary = `Gaze: ${this.activeSourceId}`;
    if (this.isEye) summary += ' (eye)';
    if (hz > 0) summary += ` ${hz}Hz`;

    return {
      preferred: this.preferred,
      activeSourceId: this.activeSourceId,
      isEye: this.isEye,
      hz,
      summary,
      providers: list,
    };
  }
}

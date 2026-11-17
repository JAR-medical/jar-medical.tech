// 9-point gaze calibration and bias correction.
//
// 9 targets at az, el in {-15, 0, 15}^2 in head space, 1.6 s each.
// Samples collected during last 1.0 s of each target, per-axis median.
// Bias = mean of (target - measured).
// Accuracy = RMS angular error after correction.
// Stored in localStorage 'rp-xr-gaze-bias' keyed by provider id.

import { anglesToDir, angleBetween } from './math.js';

export const CALIBRATION_POINTS = [
  { az: -15, el:  15 },
  { az:   0, el:  15 },
  { az:  15, el:  15 },
  { az: -15, el:   0 },
  { az:   0, el:   0 },
  { az:  15, el:   0 },
  { az: -15, el: -15 },
  { az:   0, el: -15 },
  { az:  15, el: -15 },
];

// acceptance thresholds for applying a calibration result
export const MIN_VALID_POINTS = 7;
export const MAX_ACCEPT_RMS_DEG = 4;
export const MAX_ACCEPT_BIAS_DEG = 10;
export const MIN_SAMPLES_PER_POINT = 5;
export const CALIBRATION_STORAGE_KEY = 'rp-xr-gaze-bias';

function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export class CalibrationProcedure {
  constructor({ manager, renderer = null } = {}) {
    this.manager = manager;
    this.renderer = renderer;

    this.active = false;
    this.targetIndex = 0;
    this.pointTimer = 0; // seconds on current point
    this.pointDuration = 1.6;
    this.settleDuration = 0.6; // collect during last 1.0s

    this.samples = []; // samples for current point
    this.lastSampleT = null;
    this.measuredPoints = []; // 9 results { az, el }
  }

  setRenderer(renderer) {
    this.renderer = renderer;
  }

  isActive() {
    return this.active;
  }

  start() {
    this.active = true;
    this.targetIndex = 0;
    this.pointTimer = 0;
    this.samples = [];
    this.lastSampleT = null;
    this.measuredPoints = [];

    this.renderer?.setHud?.('Look directly at the yellow target', 2.0);
  }

  abort() {
    if (!this.active) return;
    this.active = false;
    this.samples = [];
    this.measuredPoints = [];
    this.renderer?.setHud?.('Calibration aborted', 2.0);
  }

  update(dtSec) {
    if (!this.active) return;

    this.pointTimer += dtSec;

    // Collect during the last 1.0 s of each point
    if (this.pointTimer >= this.settleDuration) {
      const raw = this.manager?.lastRaw;
      if (raw && Number.isFinite(raw.az) && Number.isFinite(raw.el)) {
        if (this.lastSampleT === null || raw.t !== this.lastSampleT) {
          this.samples.push({ az: raw.az, el: raw.el });
          this.lastSampleT = raw.t;
        }
      }
    }

    if (this.pointTimer >= this.pointDuration) {
      // Process current point
      // too few fresh samples (tracker lost, blink, frozen stream) = this
      // point failed; finish() counts it as missing, never as perfect
      this.measuredPoints[this.targetIndex] = this.samples.length >= MIN_SAMPLES_PER_POINT
        ? { az: median(this.samples.map((s) => s.az)),
            el: median(this.samples.map((s) => s.el)) }
        : null;

      // Advance
      this.targetIndex++;
      this.pointTimer = 0;
      this.samples = [];
      this.lastSampleT = null;

      if (this.targetIndex >= CALIBRATION_POINTS.length) {
        this.finish();
      }
    }
  }

  finish() {
    this.active = false;

    // Only points that actually collected samples count — a missing point
    // is a failed fixation, never "perfect".
    const pairs = CALIBRATION_POINTS
      .map((target, i) => ({ target, meas: this.measuredPoints[i] }))
      .filter(p => p.meas && Number.isFinite(p.meas.az) && Number.isFinite(p.meas.el));
    if (pairs.length < MIN_VALID_POINTS) {
      this.renderer?.setHud?.(
        `Calibration failed: only ${pairs.length}/${CALIBRATION_POINTS.length} points tracked — not applied`, 4);
      return;
    }

    // bias = mean of (target - measured)
    let sumErrAz = 0;
    let sumErrEl = 0;
    for (const { target, meas } of pairs) {
      sumErrAz += target.az - meas.az;
      sumErrEl += target.el - meas.el;
    }
    const n = pairs.length;
    const biasAz = sumErrAz / n;
    const biasEl = sumErrEl / n;

    // RMS angular error after bias correction
    let sumSqErr = 0;
    for (const { target, meas } of pairs) {
      const errDeg = angleBetween(anglesToDir(target.az, target.el),
                                  anglesToDir(meas.az + biasAz, meas.el + biasEl));
      sumSqErr += errDeg * errDeg;
    }
    const rmsError = Math.sqrt(sumSqErr / n);

    // A constant offset only fixes a well-tracked but shifted gaze. If the
    // residual error is large (the user didn't follow the targets, or the
    // tracker is bad) or the offset is implausible, applying it would move
    // the whole damaged field to the wrong place — keep the previous bias.
    if (rmsError > MAX_ACCEPT_RMS_DEG || Math.hypot(biasAz, biasEl) > MAX_ACCEPT_BIAS_DEG) {
      this.renderer?.setHud?.(
        `Calibration rejected: error ${rmsError.toFixed(1)}°, offset ${Math.hypot(biasAz, biasEl).toFixed(1)}° — not applied`, 4);
      return;
    }

    this.manager?.setBias({ az: biasAz, el: biasEl });

    // Store bias in localStorage keyed by provider id
    const providerId = this.manager?.getActiveSourceId() || 'unknown';
    try {
      const existing = localStorage.getItem(CALIBRATION_STORAGE_KEY);
      const data = existing ? JSON.parse(existing) : {};
      data[providerId] = {
        az: biasAz,
        el: biasEl,
        accuracy: rmsError,
        timestamp: Date.now(),
      };
      localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save gaze bias to localStorage', e);
    }

    this.renderer?.setHud?.(`Gaze accuracy ${rmsError.toFixed(1)}° (bias applied)`, 3.5);
  }

  loadSavedBias() {
    try {
      const existing = localStorage.getItem(CALIBRATION_STORAGE_KEY);
      if (!existing) return;
      const data = JSON.parse(existing);
      const providerId = this.manager?.getActiveSourceId() || 'bridge';
      const saved = data[providerId];
      if (saved && Number.isFinite(saved.az) && Number.isFinite(saved.el)) {
        this.manager?.setBias({ az: saved.az, el: saved.el });
      }
    } catch {}
  }

  getTargets() {
    if (!this.active || this.targetIndex >= CALIBRATION_POINTS.length) {
      return null;
    }

    const target = CALIBRATION_POINTS[this.targetIndex];
    return [
      {
        dirView: anglesToDir(target.az, target.el),
        radiusDeg: 1.8,
        color: [0.98, 0.82, 0.15], // bright yellow / amber
      },
    ];
  }
}

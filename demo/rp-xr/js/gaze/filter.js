// Gaze signal conditioning — pure, DOM-free, clock-free (every call takes
// an explicit timestamp), so it runs unchanged under `node --test`.
//
// Pipeline (SPEC "Gaze"): raw (az, el) → bias correction → clamp to
// maxExcursionDeg → one-euro filter on az and el → invalid samples (blinks)
// hold the last value for blinkHoldMs, stay held (but reported invalid)
// until fallbackAfterMs, then ease toward centre with time constant easeMs.
//
// Angles are degrees, WebXR convention (az = atan2(x, -z), el up).

const TAU = 2 * Math.PI;

// Exponential smoothing factor for a first-order low-pass with the given
// cutoff (Hz) at sample interval dt (s): alpha = 1 / (1 + tau / dt),
// tau = 1 / (2π·cutoff).
function smoothingFactor(dt, cutoff) {
  const r = TAU * cutoff * dt;
  return r / (r + 1);
}

/**
 * One-euro filter (Casiez, Roussel & Vogel, CHI 2012): an adaptive low-pass
 * whose cutoff rises with the (low-passed) speed of the signal — heavy
 * smoothing at rest (kills jitter), little lag when the signal moves fast.
 * Timestamps are seconds; dt is taken from consecutive timestamps.
 */
export class OneEuroFilter {
  constructor({ minCutoff = 1.0, beta = 0.0, dCutoff = 1.0 } = {}) {
    if (!(minCutoff > 0) || !(dCutoff > 0) || !(beta >= 0))
      throw new RangeError(`OneEuroFilter: invalid parameters minCutoff=${minCutoff} beta=${beta} dCutoff=${dCutoff}`);
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.reset();
  }

  reset() {
    this.xPrev = null;   // previous FILTERED value
    this.dxPrev = 0;     // previous filtered derivative
    this.tPrev = null;
  }

  /** Re-seed the filter state at value x, time tSec, derivative 0. */
  seed(x, tSec) {
    this.xPrev = x;
    this.dxPrev = 0;
    this.tPrev = tSec;
  }

  /** @returns the filtered value for raw sample x observed at time tSec (seconds). */
  filter(x, tSec) {
    if (!Number.isFinite(x) || !Number.isFinite(tSec))
      throw new TypeError(`OneEuroFilter.filter: non-finite input x=${x} t=${tSec}`);
    if (this.tPrev === null) {
      this.seed(x, tSec);
      return x;
    }
    const dt = tSec - this.tPrev;
    // duplicate / out-of-order timestamp: no usable time step, keep state
    if (dt <= 0) return this.xPrev;
    const dx = (x - this.xPrev) / dt;
    const edx = this.dxPrev + smoothingFactor(dt, this.dCutoff) * (dx - this.dxPrev);
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    const xh = this.xPrev + smoothingFactor(dt, cutoff) * (x - this.xPrev);
    this.xPrev = xh;
    this.dxPrev = edx;
    this.tPrev = tSec;
    return xh;
  }
}

/** Radially clamp (az, el) so hypot(az, el) <= maxDeg. Returns [az, el]. */
export function clampExcursion(az, el, maxDeg) {
  const m = Math.hypot(az, el);
  if (!(maxDeg >= 0) || m <= maxDeg || m === 0) return [az, el];
  const k = maxDeg / m;
  return [az * k, el * k];
}

/**
 * Full gaze conditioning for ONE stream of samples.
 * update(raw | null, tMs) → { az, el, valid, state }
 *   state: 'idle'     no valid sample seen yet (output centre, invalid)
 *          'tracking' fresh valid sample
 *          'blink'    invalid for ≤ blinkHoldMs: last value held, still valid
 *          'lost'     invalid for ≤ fallbackAfterMs: last value held, invalid
 *          'fallback' invalid for longer: easing toward centre, invalid
 */
export class GazeFilter {
  constructor({
    maxExcursionDeg = 35, blinkHoldMs = 300, fallbackAfterMs = 1500, easeMs = 60,
    oneEuro = { minCutoff: 1.0, beta: 0.02, dCutoff: 1.0 },
  } = {}) {
    this.maxExcursionDeg = maxExcursionDeg;
    this.blinkHoldMs = blinkHoldMs;
    this.fallbackAfterMs = Math.max(fallbackAfterMs, blinkHoldMs);
    this.easeMs = Math.max(1, easeMs);
    this.fAz = new OneEuroFilter(oneEuro);
    this.fEl = new OneEuroFilter(oneEuro);
    this.bias = { az: 0, el: 0 };
    this.reset();
  }

  reset() {
    this.fAz.reset();
    this.fEl.reset();
    this.out = { az: 0, el: 0 };
    this.lastT = null;
    this.lastValidT = null;
    this.state = 'idle';
    this.lastRaw = null; // { az, el, t } — the latest valid sample BEFORE bias
  }

  setBias(bias) {
    const az = Number(bias?.az) || 0, el = Number(bias?.el) || 0;
    this.bias = { az, el };
  }

  update(raw, tMs) {
    if (!Number.isFinite(tMs)) throw new TypeError(`GazeFilter.update: non-finite time ${tMs}`);
    const dtMs = this.lastT === null ? 0 : Math.max(0, tMs - this.lastT);
    this.lastT = tMs;
    const ok = raw != null && raw.valid !== false && Number.isFinite(raw.az) && Number.isFinite(raw.el);

    if (ok) {
      this.lastRaw = { az: raw.az, el: raw.el, t: tMs };
      const [az, el] = clampExcursion(raw.az + this.bias.az, raw.el + this.bias.el, this.maxExcursionDeg);
      const tSec = tMs / 1000;
      // resuming after the output drifted away from the filter state (fallback
      // easing, or the very first sample): start smoothing from what is shown
      if (this.state === 'fallback') {
        this.fAz.seed(this.out.az, tSec - dtMs / 1000);
        this.fEl.seed(this.out.el, tSec - dtMs / 1000);
      }
      this.out = { az: this.fAz.filter(az, tSec), el: this.fEl.filter(el, tSec) };
      this.lastValidT = tMs;
      this.state = 'tracking';
      return { az: this.out.az, el: this.out.el, valid: true, state: this.state };
    }

    if (this.lastValidT === null) {
      this.state = 'idle';
      return { az: this.out.az, el: this.out.el, valid: false, state: this.state };
    }
    const gap = tMs - this.lastValidT;
    let valid;
    if (gap <= this.blinkHoldMs) {
      this.state = 'blink';
      valid = true;
    } else if (gap <= this.fallbackAfterMs) {
      this.state = 'lost';
      valid = false;
    } else {
      this.state = 'fallback';
      valid = false;
      const keep = Math.exp(-dtMs / this.easeMs);
      this.out = { az: this.out.az * keep, el: this.out.el * keep };
    }
    return { az: this.out.az, el: this.out.el, valid, state: this.state };
  }
}

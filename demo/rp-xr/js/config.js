// Schema and tunables for RP-XR. Ported from the reference simulator's
// config.js (_ref/config.js): FIELD, QUALIA, PANEL and clampParams keep
// their shape ({ enabled, params: { name: { value, min, max, label } } }),
// so a settings UI can be generated from label/min/max/hint.
//
// Pure data + one pure function: importable in node (no DOM, no WebGL).
//
// SAFETY amplitude caps are NOT params: they stay hardcoded in the shader
// chunks (js/shaders/chunks.js), as in the reference.

// Geometry of the visual field. Quale-shaped so a UI can toggle it, but
// the 10-field chunk is ALWAYS stitched: toggling off compiles a
// full-survival short-circuit, because its outputs feed sparkle,
// transition and photopsia.
// Radii are degrees of TRUE angular eccentricity from the gaze direction
// (the renderer maps deg -> shader units as deg / 180, see renderer.js
// applyField). [mild, late] pair-values are the value at degeneration 0
// and 1; in between is a straight blend.
export const FIELD = {
  enabled: true,
  // The reference drew a phone screen as if its edge were 90 deg, so its
  // edge wobble (up to 0.085 r ~ 15 deg), soft edge (~20 deg) and sparkle /
  // transition bands were visually thin there. In a headset every pixel is
  // at its TRUE eccentricity, and at full width those terms swamp a 13 deg
  // island. This one factor scales all of them (not the island radii).
  // 1 = the reference's numbers; 0.35 keeps the late-stage tunnel tight.
  edgeScale: 0.35,
  params: {
    // how far the degeneration has advanced, 0..1 — picks the point on
    // every [mild, late] pair below
    degeneration: { value: 0.82, min: 0, max: 1, label: 'Degeneration of central field' },

    // radius of the surviving central island, [mild, late], degrees
    inner: { value: [81, 13], min: 0, max: 90, label: 'Central island radius' },

    // radius where far-peripheral islands can begin — the dead ring's far
    // side, [mild, late], degrees. Widens outward as degeneration advances.
    outer: { value: [85, 90], min: 0, max: 90, label: 'Far islands begin' },

    // how much of the beyond-the-ring field survives when mild
    outerCoverage: { value: 0.65, min: 0, max: 1, label: 'Far island coverage' },

    // how strongly degeneration erodes the islands (1 = all gone at full)
    erosion: { value: 0.9, min: 0, max: 1, label: 'Island erosion' },

    // picks the personal geography of the islands
    islandSeed: { value: 7.0, min: 0, max: 20, label: 'Island layout seed' },
  },
};

// The glance panel: a simulated head-worn display — the AID, not a
// symptom. HEAD-FIXED: placed in view-space angles, deliberately untouched
// by gaze — glasses move with the head, damage moves with the eye.
// XR reinterpretation (SPEC "Renderer internals"):
//   position = [azDeg, elDeg] of the panel centre in view space
//   size     = panel width in degrees (height = size / aspect)
//   focus    = [azDeg, elDeg] the zoomed crop is centred on (head-forward
//              [0, 0] by default); the renderer clamps it at apply time so
//              the crop stays inside the eye's field of view.
export const PANEL = {
  enabled: false,

  // the panel's fixed width : height ratio (a device property, not a knob)
  aspect: 4 / 3,

  // while repositioning (renderer.panelHighlight), the field mask goes
  // this transparent so the moving panel stays visible (0 = opaque mask)
  repositionSeeThru: 0.5,

  // presence floor: at full Display transparency the panel keeps this
  // much replace-mix, so it reads as a faint ghost rather than vanishing
  minOpacity: 0.06,

  params: {
    position: { value: [18, 12], min: -45, max: 45, noUI: true, label: 'Panel position (az, el °)' },

    size: { value: 22, min: 8, max: 50, label: 'Panel size (°)',
            hint: 'Width of the display in degrees of visual angle' },

    zoom: { value: 2, min: 1, max: 6, label: 'Panel zoom',
            hint: 'How much the display magnifies the view straight ahead' },

    focus: { value: [0, 0], min: -30, max: 30, noUI: true, label: 'Panel focus (az, el °)' },

    // ambient light estimate: gain = min(1, 1 / ambient) — the display can
    // never exceed the source feed's brightness; min stays above zero
    // because this value divides
    ambient: { value: 0.5, min: 0.2, max: 2, label: 'Ambient light' },

    // 1 = maximum see-through (additive optics, floored by minOpacity),
    // 0 = opaque display
    transparency: { value: 0.5, min: 0, max: 1, label: 'Display transparency' },
  },
};

// The qualia schema: which qualia are stitched into the shader, and every
// tunable each one owns. All-on at these values reproduces the reference
// look. Pair-valued params carry [a, b]; min/max apply to each element.
export const QUALIA = {
  smoke: { enabled: true, params: {} },   // toggle only

  murk: {
    enabled: true,
    params: {
      // 0..1 patchy see-through vision in the dead ring
      transparency: { value: 0.3, min: 0, max: 1, label: 'See-through patches' },
    },
  },

  photopsia: {
    enabled: true,
    params: {
      density: { value: 0.4, min: 0, max: 1, label: 'Net density' },
      scale: { value: 2, min: 1, max: 4, label: 'Net fineness' },
      messiness: { value: 0.75, min: 0, max: 1, label: 'Strand messiness' },
      // flashes per second (max kept modest for photosensitive viewers)
      flickerHz: { value: 9, min: 0, max: 12, label: 'Flicker rate' },
    },
  },

  sparkle: {
    enabled: true,
    params: {
      // 60 / (2*pi) ≈ 9.55 reproduces the reference's sin(uTime * 60.0)
      flickerHz: { value: 60 / (2 * Math.PI), min: 0, max: 12, label: 'Sparkle rate' },
      // band straddling the wobbly surviving edge: [start, end] distances
      // from the edge in shader radius units (1 unit = 180°)
      bandIn:  { value: [0.08, 0.01], min: 0, max: 0.2, label: 'Band, inner side' },
      bandOut: { value: [0.03, 0.10], min: 0, max: 0.2, label: 'Band, outer side' },
    },
  },

  transition: { enabled: true, params: {} },  // toggle only

  // nyctalopia (night blindness): below the cone threshold dim regions are
  // ABSENT (black). Ships disabled; bulk toggles leave it alone.
  // The reference's values (threshold 0.75 > max 0.5, knee 0.75 > max 0.4)
  // were inconsistent with their own ranges; fixed per SPEC.
  nyctalopia: {
    enabled: false,
    bulkExempt: true,
    params: {
      threshold: { value: 0.25, min: 0, max: 0.5, label: 'Darkness threshold',
                   hint: 'How dark a surface must be before it disappears entirely' },
      knee: { value: 0.15, min: 0.01, max: 0.4, label: 'Fade softness' },
    },
  },
};

// Controller A/X cycles the degeneration through these values.
export const DEGENERATION_STEPS = [0.3, 0.6, 0.82, 1.0];

export const GAZE = {
  easeMs: 60,
  maxExcursionDeg: 35,
  springBack: true,
  controllerSpeedDegPerSec: 90,
  staleMs: 250,
  blinkHoldMs: 300,
  fallbackAfterMs: 1500,
  oneEuro: { minCutoff: 1.0, beta: 0.02, dCutoff: 1.0 },
};

export const BRIDGE = { defaultUrl: 'ws://127.0.0.1:8765', reconnectMs: [500, 8000] };

export const XR = { framebufferScale: 0.8, targetFrameRate: 72, foveation: 1 };

export const SAFETY = { warningKey: 'rp-xr-warning-ack' };

// Clamp every param value into its schema range, naming each clamp in the
// console rather than silently trusting the number. In place. Non-finite
// numbers (NaN, ±Infinity from a corrupt preset) are replaced by the
// nearest bound (NaN -> min) so they can never reach a uniform.
// Returns the number of params that were changed.
export function clampParams(owner, params) {
  let changed = 0;
  for (const [pname, p] of Object.entries(params)) {
    const vals = Array.isArray(p.value) ? p.value : [p.value];
    const clamped = vals.map(v => {
      if (typeof v !== 'number' || Number.isNaN(v)) return p.min;
      return Math.min(p.max, Math.max(p.min, v));
    });
    if (clamped.some((v, i) => v !== vals[i])) {
      console.warn(`${owner}.${pname}: ${JSON.stringify(p.value)} ` +
                   `outside [${p.min}, ${p.max}] — clamped`);
      p.value = Array.isArray(p.value) ? clamped : clamped[0];
      changed++;
    }
  }
  return changed;
}

// Clamp the whole schema (FIELD, PANEL, every quale). Run at load, and
// callable again after a preset / persisted state was applied.
export function clampAll() {
  let n = clampParams('FIELD', FIELD.params);
  n += clampParams('PANEL', PANEL.params);
  for (const [qname, quale] of Object.entries(QUALIA))
    n += clampParams(`QUALIA.${qname}`, quale.params);
  return n;
}
clampAll();

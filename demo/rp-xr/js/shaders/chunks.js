// GLSL ES 3.00 chunk sources for the RP pass, ported from _ref/shader/*.frag
// (WebGL1). Stitched in fixed order by js/stitch.js, which prepends
// `#version 300 es` and the Q_* / RP_AR defines. No chunk may contain a
// #version line.
//
// What changed vs. the reference:
//  * GLSL ES 3.00: in/out, texture()/textureLod(), out vec4 fragColor.
//  * Screen-space geometry (cuv / centered / contAsp / letterbox / uGaze /
//    uFit / uAspect / fallbackScene) is replaced by the per-pixel angular
//    eccentricity mapping (retinalFrame): `centered` is the direction of
//    the pixel's ray around the gaze axis, scaled by eccentricity/180, so
//    r = deg / 180 exactly like the reference's "screen units". Every
//    quale then runs unchanged on centered / r / ang.
//  * The glance panel is placed in view-space angles (az, el of the ray)
//    and its feed is the scene FBO sampled at a zoomed direction.
//  * RP_AR: no scene to sample (passthrough is composited by the OS); the
//    composite outputs a premultiplied overlay instead (see 90-composite).
//  * `patch` (reserved in GLSL ES 3.00) renamed in murk.
//  * Bypass (normal vision) and calibration targets / gaze cursor / HUD
//    overlays (80-overlay) are new; drawn after the composite, unfiltered.
// Kept exactly: every quale's maths, every SAFETY cap, ADD_CAP = 0.65, the
// slot order and the #ifdef Q_* call sites.

export const RP_VERTEX = `#version 300 es
layout(location = 0) in vec2 aPos;
out vec2 vUV;
void main() {
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const PRELUDE = `// 00-prelude — shared ground every chunk stands on: precision,
// uniforms, noise helpers, the scene sampler and the angular helpers.
// Always stitched in.
precision highp float;
precision highp int;
in vec2 vUV;
out vec4 fragColor;
#ifndef RP_AR
uniform sampler2D uScene;   // scene pass colour (FBO), same size as the viewport
#endif
uniform float uTime;
uniform mat4 uInvProj;      // inverse projection of THIS eye
uniform mat4 uProj;         // projection of THIS eye (panel feed lookup)
uniform vec3 uGazeDir;      // unit gaze direction in THIS eye's view space
uniform float uBypass;      // 1 = normal vision (no RP at all)
uniform float uEdgeBase;    // radius of surviving central field
uniform float uNetDensity;  // 0..1 density of the flashing net
uniform float uSeeThru;     // 0..1 periphery transparency
uniform float uNetScale;    // fineness of the net (1 = coarse, higher = tighter)
uniform float uNetWarp;     // strand messiness (0 = straight, ~0.5 = tangled)
uniform float uNetFlicker;  // flicker angular speed (2*pi*Hz)
uniform float uOuterEdge;   // radius where far-peripheral islands begin
uniform float uOuterCover;  // 0..1 how much of the outer field survives
uniform float uIslandSeed;  // picks the personal geography of the islands
uniform float uSparkleFlicker; // edge sparkle flicker angular speed (2*pi*Hz)
uniform vec2 uSparkleBandIn;   // sparkle band inside the edge: [start, end]
uniform vec2 uSparkleBandOut;  // sparkle band outside the edge: [start, end]
uniform vec2 uPanelPos;     // glance panel centre, view-space [az, el] degrees
uniform float uPanelW;      // glance panel width, degrees
uniform float uPanelAspect; // panel's fixed width : height ratio
uniform float uPanelZoom;   // glance panel magnification of the feed
uniform vec2 uPanelFocus;   // view direction [az, el] degrees the zoomed crop
                            // is centred on (clamped by the renderer)
uniform float uPanelGain;   // panel light per feed unit: min(1, 1 / ambient)
uniform float uPanelOpaque; // replace-mix: minOpacity floor .. 1 = opaque display
uniform float uPanelHi;     // 1 = reposition mode: draw the boundary highlight
uniform float uPanelSee;    // reposition mode: how transparent the field mask goes
uniform float uNightThresh; // nyctalopia: luminance floor — below it, void
uniform float uNightKnee;   // width of the soft ramp above the floor
uniform float uEdgeScale;   // edge wobble / softness / band widths, true-angle
                            // rescale of the reference's screen-units (FIELD.edgeScale)

// -- small value-noise helpers ------------------------------------
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i),               hash(i + vec2(1,0)), f.x),
             mix(hash(i + vec2(0,1)),   hash(i + vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return v;
}

#ifndef RP_AR
// The world as rendered by the scene pass for this eye. Explicit LOD 0:
// the FBO has no mipmaps and several call sites sit in non-uniform
// control flow (panel), where implicit derivatives are undefined.
vec3 getScene(vec2 uv) {
  return textureLod(uScene, uv, 0.0).rgb;
}
#endif

// -- angular helpers (WebXR view space: -Z forward, +X right, +Y up) ---
// [az, el] in degrees: az = atan(x, -z), el = atan(y, hypot(x, z))
vec2 viewAngles(vec3 d) {
  return degrees(vec2(atan(d.x, -d.z), atan(d.y, length(d.xz))));
}
// inverse of viewAngles (unit vector)
vec3 dirFromAngles(vec2 a) {
  vec2 rr = radians(a);
  float ce = cos(rr.y);
  return vec3(ce * sin(rr.x), sin(rr.y), -ce * cos(rr.x));
}
// angle between two unit directions, degrees (well conditioned near 0)
float angleBetween(vec3 a, vec3 b) {
  return degrees(atan(length(cross(a, b)), dot(a, b)));
}
// true for points inside the unit square (false for NaN as well)
bool inUnit(vec2 p) {
  return all(greaterThanEqual(p, vec2(0.0))) && all(lessThanEqual(p, vec2(1.0)));
}

// The retinal frame. Replaces the reference's screen-space
//   centered = (cuv - 0.5 - uGaze) * vec2(contAsp, 1)
// with the pixel's TRUE angular position around the gaze axis g:
//   ecc      = angle(ray, g) in degrees
//   basis    right = normalize(cross(g, +Y)) (fallback +X), up = cross(right, g)
//   centered = normalize(vec2(ray.right, ray.up)) * ecc / 180
// so r = ecc / 180 (the reference's deg/180 units) and everything derived
// from centered moves rigidly with the eye. ecc is computed as
// atan(|p|, ray.g) — equal to acos(dot(ray, g)) but well conditioned at 0.
void retinalFrame(vec3 ray, vec3 g, out vec2 centered, out float r,
                  out float ang, out float ecc) {
  vec3 right = cross(g, vec3(0.0, 1.0, 0.0));
  float rl = length(right);
  right = rl > 1e-5 ? right / rl : vec3(1.0, 0.0, 0.0);
  vec3 up = cross(right, g);
  vec2 p = vec2(dot(ray, right), dot(ray, up));
  float s = length(p);                       // = sin(ecc)
  ecc = degrees(atan(s, dot(ray, g)));
  centered = s > 1e-7 ? p / s * (ecc / 180.0) : vec2(0.0);
  r = length(centered);
  ang = r > 1e-7 ? atan(centered.y, centered.x) : 0.0;
}
`;

const FIELD = `// 10-field — tier 1: the field geometry. ALWAYS stitched in — its
// outputs feed sparkle, transition, and photopsia — but toggleable:
// without Q_FIELD the body compiles to a full-survival short-circuit.
// Returns survival: 1 where vision works, 0 in the dead ring. The out
// params hand back the wobbly edge radii and the two partial masks,
// which downstream qualia (sparkle, transition) reuse.
float fieldSurvival(vec2 centered, float r, float ang,
                    out float edge, out float oEdge,
                    out float central, out float outer) {
#ifndef Q_FIELD
  // field toggled off: vision survives everywhere. Edges parked far past
  // the largest reachable radius (r <= 1.0 = 180 degrees) so sparkle's
  // band and transition's centre rim never appear; outer = 0 is
  // load-bearing — transition's island rim term is ringO * outer.
  edge = 10.0; oEdge = 10.0; central = 1.0; outer = 0.0;
  return 1.0;
#else
  // irregular boundary: radius wobbles around the island edge and
  // creeps slightly over time so the edge feels alive, not stenciled
  float wobble = (noise(vec2(ang * 1.6 + 10.0, uTime * 0.05)) * 0.06
               + noise(vec2(ang * 5.0, uTime * 0.03)) * 0.025) * uEdgeScale;
  edge = uEdgeBase + wobble;

  // central island — preserved centre
  central = 1.0 - smoothstep(edge - 0.05 * uEdgeScale, edge + 0.06 * uEdgeScale, r);

  // outer islands — far-peripheral vision that survives beyond the dead
  // ring. STATIC geography: no uTime anywhere here — islands are places,
  // not weather. Noise is sampled in position space (not angle) to avoid
  // the wrap-around seam.
  float geo = fbm(centered * 3.0 + uIslandSeed);

  // inferotemporal bias: the lower-lateral field survives longest
  float lower   = smoothstep(0.05, -0.25, centered.y);
  float lateral = smoothstep(0.10, 0.45, abs(centered.x));
  float bias = 0.35 * lower * lateral;

  // coverage sets the bar the noise must clear: full coverage = low bar
  float bar = mix(0.78, 0.38, clamp(uOuterCover, 0.0, 1.0));
  float gate = smoothstep(bar - 0.07, bar + 0.07, geo + bias);

  // the ring's far side gets its own irregular, slowly-creeping edge
  float wobble2 = noise(vec2(ang * 2.1 + 33.0, uTime * 0.04)) * 0.05 * uEdgeScale;
  oEdge = uOuterEdge + wobble2;
  outer = smoothstep(oEdge - 0.06 * uEdgeScale, oEdge + 0.05 * uEdgeScale, r) * gate;

  return max(central, outer);
#endif
}
`;

const NYCTALOPIA = `// 12-nyctalopia — quale: night blindness (rod death). Below the cone
// threshold dim regions are ABSENT — black, not gray, not noisy. Runs
// before the panel: the dark eats the WORLD, the display makes its own
// light. Steady by construction (no time-dependent term).
vec3 nyctalopiaQuale(vec3 scene) {
  float luma = dot(scene, vec3(0.299, 0.587, 0.114));
  // visibility: 0 at/below the threshold, 1 above threshold + knee
  float vis = smoothstep(uNightThresh, uNightThresh + uNightKnee, luma);
  return scene * vis;
}
`;

const PANEL = `// 15-glance-panel — the AID, not a symptom: a head-worn see-through
// display showing the same view, cropped and zoomed. HEAD-FIXED: placed
// in view-space angles, never from the gaze. Called BEFORE every symptom
// slot, so the field mask (which moves with gaze) composites over it.
// SAFETY (structural): NO time-dependent term may ever enter this chunk —
// steady light only. A pulsing panel feature must route through addLight
// and inherit ADD_CAP.

// One width knob (degrees); height follows from the fixed aspect.
vec2 panelSize() {
  return vec2(uPanelW, uPanelW / uPanelAspect);
}

// The feed: the scene FBO looked up in direction a = [az, el] (degrees),
// projected through this eye's projection. Off-view directions are black
// (= transparent on the additive display).
vec3 panelFeed(vec2 a) {
  vec4 c = uProj * vec4(dirFromAngles(a), 1.0);
  if (c.w <= 0.0) return vec3(0.0);
  vec2 uv = c.xy / c.w * 0.5 + 0.5;
  if (!inUnit(uv)) return vec3(0.0);
  return getScene(uv);
}

vec3 panelQuale(vec3 scene, vec2 pa) {
  // 0..1 inside the panel rect; outside means no panel at this pixel
  vec2 local = (pa - uPanelPos) / panelSize() + 0.5;
  if (!inUnit(local)) return scene;
  // zoomed crop about the focus direction:
  // anglesToDir(focusAz + localAz / zoom, focusEl + localEl / zoom)
  vec2 zoomed = uPanelFocus + (local - 0.5) * panelSize() / uPanelZoom;
  vec3 feed = panelFeed(zoomed);
  // optical see-through: the display ADDS light over the world; the
  // wash-out ratio is gain = min(1, 1 / ambient); uPanelOpaque blends
  // toward the opaque display, floored at minOpacity by the renderer.
  return mix(scene + feed * uPanelGain, feed, uPanelOpaque);
}

// Reposition-mode boundary: a STEADY yellow glow along the rect's edge
// (signed distance in degrees, converted to the reference's units where
// 1 unit = 180 degrees). Steady is load-bearing (no-pulse rule above).
float panelBorder(vec2 pa) {
  vec2 q = abs(pa - uPanelPos) - panelSize() * 0.5;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  return exp(-abs(d / 180.0) * 120.0);
}
`;

const SMOKE = `// 20-smoke — quale: opaque smoke billows filling the dead ring.
// Fill slot: takes nothing, paints the periphery base.
vec3 smokeQuale(vec2 sp, vec2 drift) {
  // smoke billows churning slowly (domain-warped noise = the swirl)
  float swirl = fbm(sp + drift + 1.5 * fbm(sp * 1.7 - drift));
  return mix(vec3(0.02, 0.025, 0.035), vec3(0.11, 0.13, 0.17), swirl);
}
`;

const PHOTOPSIA = `// 21-photopsia — quale: a messy net of continuous rapid flashes —
// curved, interconnected filaments (noise ridges at two scales), each
// strand flickering with its own phase, in differing shades of light.
// Additive slot: returns light the compositor ADDS to the periphery.
vec3 photopsiaQuale(vec2 sp, vec2 drift) {
  // warping the coordinates with a second noise field bends the strands
  // into tangled filaments
  vec2 np = sp * uNetScale;
  vec2 bend = (vec2(fbm(np * 0.9 + drift),
                    fbm(np * 0.9 + 4.7 - drift)) - 0.5) * 2.0 * uNetWarp;
  np += bend;
  float n1 = noise(np * (1.5 + 5.0 * uNetDensity) + drift * 2.0);
  float n2 = noise(np * (3.0 + 11.0 * uNetDensity) - drift * 1.5);
  float net = pow(1.0 - abs(2.0 * n1 - 1.0), 5.0)
            + 0.7 * pow(1.0 - abs(2.0 * n2 - 1.0), 5.0);
  float shade = 0.25 + 0.75 * noise(np * 1.4 + vec2(7.0, 3.0));
  float flick = 0.55 + 0.45 * sin(uTime * uNetFlicker + n1 * 14.0 + n2 * 9.0);
  // SAFETY: amplitude capped so the net stays well below full white
  return vec3(0.8, 0.87, 1.0) * net * shade * flick
       * 0.55 * smoothstep(0.0, 0.08, uNetDensity);
}
`;

const SPARKLE = `// 22-sparkle — quale: messy flashing ring hugging the inner edge of
// surviving vision: a band straddling the boundary (follows the
// irregular wobble), filled with broken flickering filaments. Post-
// additive slot: ADDED after the survival mix, glows on both sides.
vec3 sparkleQuale(float r, float ang, vec2 sp, vec2 drift, float edge) {
  float band = smoothstep(edge - uSparkleBandIn.x, edge - uSparkleBandIn.y, r)
             * (1.0 - smoothstep(edge + uSparkleBandOut.x, edge + uSparkleBandOut.y, r));
  float rn = noise(sp * 5.0 + drift * 3.0);
  float rim = pow(1.0 - abs(2.0 * rn - 1.0), 4.0);          // messy strands
  float gaps = 0.35 + 0.65 * noise(vec2(ang * 2.2, uTime * 0.15)); // broken ring
  float flickR = 0.5 + 0.5 * sin(uTime * uSparkleFlicker + rn * 20.0 + ang * 5.0);
  // SAFETY: amplitude capped, band is narrow
  return vec3(0.85, 0.9, 1.0) * band * gaps * (0.25 + rim) * flickR * 0.5;
}
`;

const MURK = `// 23-murk — quale: patches of murky see-through vision ("smokey
// water") opening in whatever base fill is underneath.
// The patch opacity is shared with RP_AR, where the see-through patches
// lower the overlay alpha instead of sampling a scene.
float murkSeeThru(vec2 sp, vec2 drift) {
  // patchy opacity: some regions near-opaque, others half see-through
  float patchN = fbm(sp * 1.1 + drift * 0.6);
  return smoothstep(0.30, 0.70, patchN) * uSeeThru;
}
#ifndef RP_AR
vec3 murkQuale(vec3 base, vec2 suv, vec2 sp, vec2 drift) {
  // the world glimpsed through turbid water: warped, dim, washed out
  vec2 warp = (vec2(noise(suv * 7.0 + uTime * 0.2),
                    noise(suv * 7.0 - uTime * 0.17)) - 0.5) * 0.03;
  vec3 murky = getScene(suv + warp);
  float mg = dot(murky, vec3(0.299, 0.587, 0.114));
  murky = mix(vec3(mg), murky, 0.35) * 0.5;
  return mix(base, murky, murkSeeThru(sp, drift));
}
#endif
`;

const TRANSITION = `// 24-transition — quale: transition bands — slight desaturation +
// dimming before full loss, on BOTH boundaries of the dead ring (central
// edge and island rims). Scene-modifying slot, applied before the
// survival mix. The band weight is shared with RP_AR (black overlay).
float transitionBand(float r, float edge, float oEdge, float central, float outer) {
  float ringC = smoothstep(edge - 0.10 * uEdgeScale, edge - 0.02 * uEdgeScale, r);            // centre side
  float ringO = 1.0 - smoothstep(oEdge + 0.02 * uEdgeScale, oEdge + 0.10 * uEdgeScale, r);    // island side
  return max(ringC * central, ringO * outer);
}
#ifndef RP_AR
vec3 transitionQuale(vec3 scene, float r, float edge, float oEdge,
                     float central, float outer) {
  float gray = dot(scene, vec3(0.299, 0.587, 0.114));
  vec3 degraded = mix(vec3(gray), scene, 0.4) * 0.55;
  return mix(scene, degraded, transitionBand(r, edge, oEdge, central, outer));
}
#endif
`;

const OVERLAY = `// 80-overlay — UI drawn UNFILTERED on top of the composite: calibration
// targets, the debug gaze cursor and the head-locked HUD toast. Not
// qualia: never touched by the field mask. Always stitched in. All
// steady light (no time-dependent term; the HUD alpha only fades out).
uniform sampler2D uHudTex;     // 512x128 canvas, straight alpha, uploaded flipped
uniform float uHudAlpha;       // 0 = hidden; fades over the last 0.5 s
uniform vec4 uHudRect;         // [az centre, el centre, width, height] degrees
uniform int uTargetCount;      // 0..9
uniform vec3 uTargetDir[9];    // unit directions, view space
uniform vec4 uTargetStyle[9];  // rgb, radius (degrees)
uniform float uCursor;         // 1 = draw the gaze ring

// premultiplied "over": layer colour c with coverage a over dst
vec4 overPremul(vec4 dst, vec3 c, float a) {
  return vec4(c * a, a) + dst * (1.0 - a);
}

// px = angular size of one pixel in degrees (antialiasing width)
vec4 drawOverlays(vec4 dst, vec3 ray, vec2 pa, float ecc, float px) {
  for (int i = 0; i < 9; i++) {
    if (i >= uTargetCount) break;
    vec4 st = uTargetStyle[i];
    float rad = max(st.w, 0.05);
    float d = angleBetween(ray, uTargetDir[i]);
    float halo = 1.0 - smoothstep(rad, rad + max(0.35 * rad, 2.0 * px), d);
    float disc = 1.0 - smoothstep(rad - px, rad + px, d);
    float pip = 1.0 - smoothstep(0.22 * rad - px, 0.22 * rad + px, d);
    dst = overPremul(dst, vec3(0.0), halo * 0.6);   // dark outline: readable on any scene
    dst = overPremul(dst, st.rgb, disc);
    dst = overPremul(dst, vec3(0.0), pip);          // fixation pip
  }
  if (uCursor > 0.5) {
    float ringR = 1.2, ringW = max(0.12, px);
    float ring = 1.0 - smoothstep(ringW, ringW + px, abs(ecc - ringR));
    dst = overPremul(dst, vec3(1.0, 0.3, 0.2), ring * 0.9);
  }
  if (uHudAlpha > 0.001) {
    vec2 hl = (pa - uHudRect.xy) / uHudRect.zw + 0.5;
    if (inUnit(hl)) {
      vec4 h = textureLod(uHudTex, hl, 0.0);
      dst = overPremul(dst, h.rgb, h.a * uHudAlpha);
    }
  }
  return dst;
}
`;

const COMPOSITE = `// 90-composite — the compositor: fixed slots, in fixed order. Toggling a
// quale changes slot membership, never order. Each Q_* define is injected
// by the stitcher only when that quale is enabled — a disabled quale's
// call site AND function body are absent from the compiled program.
// Returns PREMULTIPLIED colour (alpha 1 outside RP_AR).
vec4 rpComposite(vec2 suv, vec2 pa, vec2 centered, float r, float ang) {
#ifndef RP_AR
  vec3 scene = getScene(suv);
#endif

  // ---- slot: nyctalopia (before the aid) -------------------------
#ifdef Q_NYCTALOPIA
  scene = nyctalopiaQuale(scene);
#endif

  // ---- slot: the aid (before every symptom slot) -----------------
  // head-fixed, placed from view-space angles, burned into the scene so
  // the field mask and rim greying composite over it
#ifdef Q_PANEL
  scene = panelQuale(scene, pa);
#endif

  // ---- tier 1: field geometry (always on) ------------------------
  float edge, oEdge, central, outer;
  float survival = fieldSurvival(centered, r, ang, edge, oEdge, central, outer);

  // shared coordinate frames for the qualia
  vec2 sp = centered * 2.6;
  vec2 drift = vec2(uTime * 0.035, uTime * -0.02);

#ifdef RP_AR
  // ---- AR: same slots, expressed as a premultiplied overlay ------
  // transition: a black overlay over the surviving view
  float band = 0.0;
#ifdef Q_TRANSITION
  band = transitionBand(r, edge, oEdge, central, outer);
#endif
  // fill: smoke paints the periphery (opaque); murk's see-through
  // patches lower the fill opacity (passthrough shows through)
  vec3 periphery = vec3(0.0);
  float fillA = 1.0;
#ifdef Q_SMOKE
  periphery = smokeQuale(sp, drift);
#endif
#ifdef Q_MURK
  fillA = 1.0 - murkSeeThru(sp, drift);
#endif
#else
  // ---- slot: scene-modifying qualia ------------------------------
#ifdef Q_TRANSITION
  scene = transitionQuale(scene, r, edge, oEdge, central, outer);
#endif

  // ---- slot: fill qualia (relay: each modifies the periphery) ----
  vec3 periphery = vec3(0.0);
#ifdef Q_SMOKE
  periphery = smokeQuale(sp, drift);
#endif
#ifdef Q_MURK
  periphery = murkQuale(periphery, suv, sp, drift);
#endif
#endif

  // ---- slot: additive qualia (each capped) -----------------------
  // All ADDED flashing light accumulates in addLight; the global SAFETY
  // clamp acts on this term alone — the scene is never clamped.
  vec3 addLight = vec3(0.0);
#ifdef Q_PHOTOPSIA
  addLight += photopsiaQuale(sp, drift) * (1.0 - survival);
#endif

  // ---- the mix: periphery where dead, scene where vision survives -
#ifdef RP_AR
  float dead = 1.0 - survival;
  vec3 col = periphery * fillA * dead;
  float alpha = fillA * dead + 0.45 * band * survival;
#else
  vec3 col = mix(periphery, scene, survival);
#endif

  // ---- slot: post-additive qualia (also added light) -------------
#ifdef Q_SPARKLE
  addLight += sparkleQuale(r, ang, sp, drift, edge);
#endif

  // ---- slot: global brightness clamp -----------------------------
  // SAFETY: ceiling on ADDED flashing light (photopsia + sparkle) — the
  // scene itself is never clamped. Not a tunable. Scales, never clips —
  // hue preserved, and below the ceiling the scale factor is exactly 1.
  const float ADD_CAP = 0.65;
  float addLuma = dot(addLight, vec3(0.299, 0.587, 0.114));
  addLight *= ADD_CAP / max(addLuma, ADD_CAP);
  col += addLight;

#ifdef RP_AR
  // added light carries alpha = its luma (after ADD_CAP)
  float addA = dot(addLight, vec3(0.299, 0.587, 0.114));
  alpha = alpha + addA * (1.0 - alpha);
  return clamp(vec4(col, alpha), 0.0, 1.0);
#else
  // reposition mode: the field mask goes uPanelSee transparent, then the
  // steady yellow boundary (steady light only)
#ifdef Q_PANEL
  col = mix(col, scene, uPanelHi * uPanelSee);
  col = mix(col, vec3(1.0, 0.85, 0.2), panelBorder(pa) * uPanelHi);
#endif
  return vec4(col, 1.0);
#endif
}

void main() {
  vec2 suv = vUV;                         // pixel uv in the scene FBO
  // per-pixel view ray: un-project the near-plane point (same direction
  // as the far-plane point, and finite even for an infinite far plane)
  vec4 hp = uInvProj * vec4(vUV * 2.0 - 1.0, -1.0, 1.0);
  vec3 ray = normalize(hp.xyz / hp.w);
  vec2 pa = viewAngles(ray);
  // angular pixel size for antialiasing (uniform control flow here)
  float px = max(degrees(length(fwidth(ray))), 1e-3);

  vec2 centered;
  float r, ang, ecc;
  retinalFrame(ray, normalize(uGazeDir), centered, r, ang, ecc);

  vec4 outc;
  if (uBypass > 0.5) {
#ifdef RP_AR
    outc = vec4(0.0);                     // passthrough untouched
#else
    outc = vec4(getScene(suv), 1.0);      // normal vision
#endif
  } else {
    outc = rpComposite(suv, pa, centered, r, ang);
  }
  outc = drawOverlays(outc, ray, pa, ecc, px);
#ifndef RP_AR
  outc.a = 1.0;
#endif
  fragColor = outc;
}
`;

// Chunk sources keyed by name; order lives in stitch.js (CHUNKS).
export const SOURCES = Object.freeze({
  '00-prelude': PRELUDE,
  '10-field': FIELD,
  '12-nyctalopia': NYCTALOPIA,
  '15-glance-panel': PANEL,
  '20-smoke': SMOKE,
  '21-photopsia': PHOTOPSIA,
  '22-sparkle': SPARKLE,
  '23-murk': MURK,
  '24-transition': TRANSITION,
  '80-overlay': OVERLAY,
  '90-composite': COMPOSITE,
});

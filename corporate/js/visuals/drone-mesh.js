// Visuals for the "Demo: from drone flight to 3D mesh" course.
//   drone-mesh-player          real drone footage with the photogrammetry model
//                              reconstructed from it, then the model alone
//   stitch-demo                three flight segments stitched into one map (4-DoF)
//   mapping-software-pipeline  the software chain from video to operating picture
// Built with el()/svg() only (never innerHTML). Strings are { de, en }.
import { el } from "../ui.js";
import { L, svg, injectStyle, animate, prefersReducedMotion, clamp, lerp, ease } from "./kit.js";
import {
  createModelRenderer, projectionFromIntrinsics, viewFromAxes, lookAtAxes,
  quatFromAxes, axesFromQuat, slerp, vec,
} from "./mesh-gl.js";

const VIDEO_SRC = "assets/drone/drone-flight.mp4";
const POSTER_SRC = "assets/drone/drone-flight.jpg";

// Portal tokens for canvas drawing, read from the visual's own element: the
// dark palette is scoped to .theme-dark, not set on :root.
function tokens(node) {
  const cs = getComputedStyle(node);
  const v = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
  return {
    mint: v("--brand-mint", "#8ee6c9"),
    teal: v("--brand-teal", "#3fb7a6"),
    accent: v("--accent", "#8ee6c9"),
    red: v("--sig-red", "#f0776e"),
    amber: v("--sig-amber", "#f2b84b"),
    green: v("--sig-green", "#6fd38f"),
    ink: v("--ink", "#e9edf5"),
    soft: v("--ink-soft", "#a9b1c4"),
    faint: v("--ink-faint", "#6c7489"),
    line: v("--line", "rgba(255,255,255,0.12)"),
    bg: v("--bg-deep", "#0c0b1f"),
    mono: v("--font-mono", "ui-monospace, monospace"),
    sans: v("--font-sans", "system-ui, sans-serif"),
  };
}

// "#rrggbb" or "rgb(…)" → "rgba(r,g,b,a)"; anything else is returned unchanged.
function alpha(color, a) {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(color);
  if (rgb) {
    const [r, g, b] = rgb[1].split(",").map((s) => s.trim());
    return `rgba(${r},${g},${b},${a})`;
  }
  return color;
}

const CSS = `
.vd-card { border: 1px solid var(--line); border-radius: var(--r-lg); background: var(--bg-raise); padding: var(--sp-5); margin: var(--sp-5) 0; }
.vd-kicker { font-family: var(--font-mono); font-size: var(--t-micro); letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); margin: 0 0 var(--sp-1); }
.vd-title { font-size: 1.15rem; font-weight: 600; color: var(--ink); margin: 0 0 var(--sp-1); line-height: 1.3; }
.vd-sub { color: var(--ink-soft); font-size: var(--t-small); margin: 0 0 var(--sp-4); line-height: 1.5; }
.vd-stage { position: relative; aspect-ratio: 16 / 9; border-radius: var(--r-md); overflow: hidden; background: var(--bg-deep); border: 1px solid var(--line); }
.vd-stage video, .vd-stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.vd-stage video { object-fit: cover; }
.vd-tag { position: absolute; left: 10px; top: 10px; z-index: 2; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.04em; color: var(--ink); background: rgba(12, 11, 31, 0.72); border: 1px solid var(--line-strong); border-radius: var(--r-pill); padding: 4px 10px; max-width: calc(100% - 20px); }
.vd-phase { position: absolute; left: 10px; bottom: 10px; z-index: 2; font-family: var(--font-mono); font-size: 12px; color: var(--ink); background: rgba(12, 11, 31, 0.78); border: 1px solid var(--line-strong); border-radius: var(--r-md); padding: 6px 10px; max-width: calc(100% - 20px); line-height: 1.4; }
.vd-missing { position: absolute; inset: 0; z-index: 3; display: grid; place-items: center; text-align: center; padding: var(--sp-5); color: var(--ink-soft); font-size: var(--t-small); background: var(--bg-deep); }
.vd-bar { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-top: var(--sp-3); }
.vd-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--sp-2); margin-top: var(--sp-3); }
.vd-stat { border: 1px solid var(--line); border-radius: var(--r-md); padding: 10px 12px; background: var(--bg-deep); min-width: 0; }
.vd-stat b { display: block; font-family: var(--font-mono); font-size: 1.1rem; color: var(--ink); font-weight: 600; }
.vd-stat span { display: block; font-size: 12px; color: var(--ink-soft); line-height: 1.35; margin-top: 2px; }
.vd-note { font-size: 12px; color: var(--ink-faint); margin: var(--sp-3) 0 0; line-height: 1.5; }
.vd-steps { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; margin-top: var(--sp-3); }
.vd-step { border: 1px solid var(--line); border-radius: var(--r-sm); padding: 6px 8px; font-size: 12px; line-height: 1.3; color: var(--ink-faint); background: transparent; text-align: left; cursor: pointer; font-family: inherit; }
.vd-step.is-on { color: var(--ink); border-color: var(--accent); background: var(--surface-tint); }
.vd-step b { display: block; font-family: var(--font-mono); font-size: 11px; color: var(--accent); }
.vd-pipe { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--sp-2); }
.vd-node { position: relative; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--bg-deep); padding: 14px 16px; min-height: 92px; text-align: left; color: var(--ink-soft); cursor: pointer; font-family: inherit; min-width: 0; transition: border-color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out); }
.vd-node b { display: block; font-family: var(--font-mono); font-size: 13px; color: var(--ink-faint); margin-bottom: 6px; }
.vd-node strong { display: block; font-size: 17px; color: var(--ink); line-height: 1.3; font-weight: 600; }
.vd-node.is-on { border-color: var(--accent); background: var(--surface-tint); }
.vd-node.is-on b { color: var(--accent); }
.vd-node.is-jar { border-style: dashed; }
.vd-inspect { margin-top: var(--sp-3); border: 1px solid var(--line); border-radius: var(--r-md); padding: var(--sp-4); background: var(--bg-deep); }
.vd-inspect h4 { margin: 0 0 var(--sp-2); font-size: 1rem; color: var(--ink); }
.vd-inspect dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 12px; margin: 0; font-size: var(--t-small); line-height: 1.45; }
.vd-inspect dt { color: var(--accent); font-family: var(--font-mono); font-size: 12px; padding-top: 2px; }
.vd-inspect dd { margin: 0; color: var(--ink-soft); }
@media (max-width: 560px) {
  .vd-card { padding: var(--sp-4); }
  .vd-tag { font-size: 10px; padding: 3px 8px; left: 6px; top: 6px; }
  .vd-phase { position: static; margin: var(--sp-2) 0 0; max-width: none; background: var(--bg-deep); }
  .vd-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .vd-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .vd-pipe { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .vd-node { min-height: 0; padding: 12px; }
  .vd-node strong { font-size: 15px; }
  .vd-inspect dl { grid-template-columns: 1fr; }
}
`;

function card(lang, kicker, title, sub) {
  injectStyle("vd-styles", CSS);
  return el("figure", { class: "vd-card" },
    el("p", { class: "vd-kicker" }, L(lang, kicker)),
    el("h3", { class: "vd-title" }, L(lang, title)),
    sub ? el("p", { class: "vd-sub" }, L(lang, sub)) : null);
}

function button(label, onclick) {
  return el("button", { class: "btn btn-outline btn-small", type: "button", onclick }, label);
}

// ---------------------------------------------------------------------------
// Drone player: the photogrammetry model reconstructed offline from this very
// flight (assets/drone/model/, rebuild steps in the private repo
// JAR-medical/website_setup → corporate/tools/drone-model).
// While the video plays, the model's point cloud and a hidden-line wireframe
// are projected with each frame's computed camera, so they sit exactly on the
// buildings. Then the video fades and only the textured model remains, which
// the user can orbit and zoom.
const MODEL_DIR = "assets/drone/model/";
const CUT_AT = 16; // clip seconds after which the footage gives way to the model
const ORBIT_SPEED = 0.11; // rad/s automatic orbit
const DEG = Math.PI / 180;

const T_PLAYER = {
  kicker: { de: "Photogrammetrie · echtes Drohnenvideo", en: "Photogrammetry · real drone footage" },
  title: { de: "Aus dem Drohnenflug wird ein exaktes 3D-Modell", en: "The drone flight becomes an exact 3D model" },
  sub: {
    de: "Aus den Einzelbildern dieses Flugs wurden die Kameraposition jedes Bildes und die Oberfläche der Einsatzstelle berechnet. Deshalb liegt das Modell deckungsgleich auf dem Video. Danach bleibt nur das Modell, das Sie frei drehen können.",
    en: "From the frames of this flight, the camera position of every frame and the surface of the scene were computed. That is why the model lines up exactly with the video. Then only the model remains, and you can turn it freely.",
  },
  tagVideo: { de: "Rekonstruiertes Modell, mit der berechneten Kamera jedes Bildes projiziert", en: "Reconstructed model, projected with each frame's computed camera" },
  tagModel: { de: "Rekonstruiertes 3D-Modell · Textur aus dem Video", en: "Reconstructed 3D model · texture from the video" },
  tagShort: { de: "3D-Modell aus dem Video", en: "3D model from the video" },
  loading: { de: "3D-Modell wird geladen … {p} %", en: "Loading 3D model … {p} %" },
  loadFail: { de: "Das 3D-Modell konnte nicht geladen werden. Das Video läuft trotzdem.", en: "The 3D model could not be loaded. The video still plays." },
  noGl: { de: "Für das 3D-Modell braucht Ihr Browser WebGL. Das Video läuft trotzdem.", en: "The 3D model needs WebGL in your browser. The video still plays." },
  play: { de: "Abspielen", en: "Play" },
  pause: { de: "Pause", en: "Pause" },
  show3d: { de: "Nur 3D-Modell zeigen", en: "Show 3D model only" },
  restart: { de: "Von vorn", en: "Restart" },
  modes: {
    video: {
      mesh: { de: "Ansicht: Netz auf dem Video", en: "View: mesh on the video" },
      points: { de: "Ansicht: Punktwolke", en: "View: point cloud" },
      clean: { de: "Ansicht: nur Video", en: "View: video only" },
    },
    model: {
      mesh: { de: "Ansicht: Modell mit Netz", en: "View: model with mesh" },
      points: { de: "Ansicht: Punktwolke", en: "View: point cloud" },
      clean: { de: "Ansicht: nur Modell", en: "View: model only" },
    },
  },
  phase: [
    { de: "1 · Kameras und 3D-Punkte, berechnet aus dem Video", en: "1 · Cameras and 3D points, computed from the video" },
    { de: "2 · Die Punkte werden zur Oberfläche vernetzt", en: "2 · The points are joined into a surface mesh" },
    { de: "3 · Das Modell liegt deckungsgleich auf dem Video", en: "3 · The model lines up exactly with the video" },
    { de: "4 · Nur noch das 3D-Modell: ziehen zum Drehen, scrollen zum Zoomen", en: "4 · Only the 3D model: drag to rotate, scroll to zoom" },
  ],
  stats: {
    frames: { de: "Einzelbilder ausgewertet", en: "frames analysed" },
    registered: { de: "Kamerapositionen berechnet", en: "camera positions computed" },
    points: { de: "3D-Punkte rekonstruiert", en: "3D points reconstructed" },
    triangles: { de: "Dreiecke im Modell", en: "triangles in the model" },
  },
  hint: {
    de: "Ziehen zum Drehen · Mausrad oder zwei Finger zum Zoomen · Pfeiltasten · Doppelklick setzt die Ansicht zurück",
    en: "Drag to rotate · mouse wheel or two fingers to zoom · arrow keys · double-click resets the view",
  },
  missing: {
    de: "Das Drohnenvideo konnte nicht geladen werden. Bitte laden Sie die Seite neu.",
    en: "The drone video could not be loaded. Please reload the page.",
  },
  aria: {
    de: "Drohnenvideo eines nach einem Erdbeben eingestürzten Wohnhauses. Darauf liegt das aus dem Video rekonstruierte 3D-Modell; danach ist nur noch das texturierte Modell zu sehen und lässt sich drehen.",
    en: "Drone video of a residential building that collapsed in an earthquake, overlaid with the 3D model reconstructed from the video; then only the textured model remains and can be rotated.",
  },
};

// The model assets are shared by every render of the lesson (language
// switches re-render it), so they are fetched once per page.
let assetPromise = null;
function loadModelAssets(onProgress) {
  if (!assetPromise) {
    assetPromise = fetchModelAssets(onProgress).catch((e) => { assetPromise = null; throw e; });
  }
  return assetPromise;
}

async function fetchBinary(url, onBytes) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  if (!res.body || !res.body.getReader) return res.arrayBuffer();
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onBytes(value.length);
  }
  const out = new Uint8Array(got);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out.buffer;
}

async function fetchModelAssets(onProgress) {
  const res = await fetch(MODEL_DIR + "scene.json");
  if (!res.ok) throw new Error("scene.json: HTTP " + res.status);
  const scene = await res.json();
  if (!scene || scene.version !== 1 || !Array.isArray(scene.poses) || scene.poses.length < 2 || !scene.intrinsics) {
    throw new Error("scene.json: unexpected format");
  }
  const total = (scene.sizes?.total) || 1;
  let loaded = 0;
  const tick = (n) => { loaded += n; onProgress?.(Math.min(0.99, loaded / total)); };
  const [meshBuf, wireBuf, pointBuf, image] = await Promise.all([
    fetchBinary(MODEL_DIR + scene.mesh.file, tick),
    fetchBinary(MODEL_DIR + scene.wire.file, tick),
    fetchBinary(MODEL_DIR + scene.points.file, tick),
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("texture failed to load"));
      img.src = MODEL_DIR + scene.texture.file;
    }),
  ]);
  const lo = scene.quant.min, hi = scene.quant.max;
  const deq = (u16) => {
    const out = new Float32Array(u16.length);
    for (let i = 0; i < u16.length; i += 3) {
      out[i] = lo[0] + (u16[i] / 65535) * (hi[0] - lo[0]);
      out[i + 1] = lo[1] + (u16[i + 1] / 65535) * (hi[1] - lo[1]);
      out[i + 2] = lo[2] + (u16[i + 2] / 65535) * (hi[2] - lo[2]);
    }
    return out;
  };
  const m = scene.mesh, w = scene.wire, p = scene.points;
  const positions = deq(new Uint16Array(meshBuf, m.offsets[0], m.vertices * 3));
  const uvq = new Uint16Array(meshBuf, m.offsets[1], m.vertices * 2);
  const uvs = new Float32Array(uvq.length);
  for (let i = 0; i < uvq.length; i++) uvs[i] = uvq[i] / 65535;
  const indices = new Uint32Array(meshBuf, m.offsets[2], m.indices);
  const wrev = new Uint8Array(wireBuf, w.offsets[1], w.vertices);
  const prev = new Uint8Array(pointBuf, p.offsets[2], p.count);
  onProgress?.(1);
  return {
    scene,
    image,
    mesh: { positions, uvs, indices, normals: vertexNormals(positions, indices) },
    wire: { positions: deq(new Uint16Array(wireBuf, w.offsets[0], w.vertices * 3)), reveal: Float32Array.from(wrev, (v) => v / 255), indices: new Uint32Array(wireBuf, w.offsets[2], w.lines * 2) },
    points: { positions: deq(new Uint16Array(pointBuf, p.offsets[0], p.count * 3)), colors: new Uint8Array(pointBuf, p.offsets[1], p.count * 3), reveal: Float32Array.from(prev, (v) => v / 255) },
  };
}

function vertexNormals(pos, idx) {
  const n = new Float32Array(pos.length);
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) { n[k] += nx; n[k + 1] += ny; n[k + 2] += nz; }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l; n[i + 1] /= l; n[i + 2] /= l;
  }
  return n;
}

// Camera of the clip at time t: interpolated between the reconstructed frames.
function poseAt(poses, t) {
  if (t <= poses[0][0]) return { q: poses[0].slice(1, 5), c: poses[0].slice(5, 8) };
  const last = poses[poses.length - 1];
  if (t >= last[0]) return { q: last.slice(1, 5), c: last.slice(5, 8) };
  let lo = 0, hi = poses.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (poses[mid][0] <= t) lo = mid; else hi = mid; }
  const a = poses[lo], b = poses[hi];
  const u = (t - a[0]) / (b[0] - a[0] || 1);
  return { q: slerp(a.slice(1, 5), b.slice(1, 5), u), c: vec.lerp(a.slice(5, 8), b.slice(5, 8), u) };
}

// Renderers whose canvas left the page get their WebGL context released, so
// re-rendering the lesson never piles up contexts.
const liveRenderers = new Set();
function releaseDetached() {
  for (const r of liveRenderers) {
    if (!r.canvas.isConnected) { r.renderer.destroy?.(); liveRenderers.delete(r); }
  }
}

function renderDroneMeshPlayer(block, lang) {
  const root = card(lang, T_PLAYER.kicker, T_PLAYER.title, T_PLAYER.sub);
  const video = el("video", {
    src: VIDEO_SRC, poster: POSTER_SRC, muted: true, playsinline: true, preload: "auto",
    "aria-hidden": "true",
  });
  video.muted = true; // the attribute alone does not mute in every browser
  video.style.transition = "opacity 1.4s ease";
  const glCanvas = el("canvas", { role: "img", "aria-label": L(lang, T_PLAYER.aria), tabindex: "0", style: "pointer-events:none;outline:none" });
  const narrow = globalThis.matchMedia?.("(max-width: 560px)");
  const phaseEl = el("p", { class: "vd-phase" }, L(lang, T_PLAYER.phase[0]));
  const tagEl = el("p", { class: "vd-tag" }, L(lang, narrow?.matches ? T_PLAYER.tagShort : T_PLAYER.tagVideo));
  const statusEl = el("p", { class: "vd-tag", style: "top:auto;bottom:10px;left:auto;right:10px", hidden: true });
  const stage = el("div", { class: "vd-stage" }, video, glCanvas, tagEl, statusEl, phaseEl);
  const placePhase = () => { if (narrow?.matches) stage.after(phaseEl); else stage.append(phaseEl); };

  const stat = (label) => {
    const value = el("b", {}, "–");
    return { node: el("div", { class: "vd-stat" }, value, el("span", {}, L(lang, label))), value };
  };
  const sFrames = stat(T_PLAYER.stats.frames), sReg = stat(T_PLAYER.stats.registered), sPts = stat(T_PLAYER.stats.points), sTris = stat(T_PLAYER.stats.triangles);
  const fmt = (n) => (typeof n === "number" ? n.toLocaleString(lang === "en" ? "en-GB" : "de-DE") : "–");

  const modes = ["mesh", "points", "clean"];
  let mode = "mesh";
  let userPaused = prefersReducedMotion();
  let phase = "video"; // "video" | "model"
  let t3 = 0; // seconds since the cut
  let cutPose = null;
  const orbit = { yaw: 0, pitch: 38 * DEG, dist: 1, base: 1, lastInput: -1e9, auto: !prefersReducedMotion() };

  const playBtn = button("", () => {
    userPaused = !userPaused;
    if (phase === "video") { if (userPaused) video.pause(); else video.play().catch(() => {}); }
    syncButtons();
  });
  const modeBtn = button("", () => { mode = modes[(modes.indexOf(mode) + 1) % modes.length]; syncButtons(); });
  const modelBtn = button(L(lang, T_PLAYER.show3d), () => { if (phase === "video" && assets) startModel(); });
  const restartBtn = button(L(lang, T_PLAYER.restart), () => restartFlight());
  const hint = el("p", { class: "vd-note", hidden: true }, L(lang, T_PLAYER.hint));
  function syncButtons() {
    playBtn.textContent = L(lang, userPaused ? T_PLAYER.play : T_PLAYER.pause);
    modeBtn.textContent = L(lang, T_PLAYER.modes[phase][mode]);
    modelBtn.disabled = phase !== "video" || !assets;
    hint.hidden = phase !== "model";
  }


  root.append(stage,
    el("div", { class: "vd-bar" }, playBtn, modeBtn, modelBtn, restartBtn),
    hint,
    el("div", { class: "vd-stats" }, sFrames.node, sReg.node, sPts.node, sTris.node),
  );
  placePhase();
  narrow?.addEventListener?.("change", placePhase);
  video.addEventListener("error", () => stage.append(el("div", { class: "vd-missing" }, L(lang, T_PLAYER.missing))));
  video.addEventListener("ended", () => { if (phase === "video" && assets) startModel(); });

  // Exact time of the frame on screen when the browser reports it.
  let frameTime = 0;
  const onFrame = (now, meta) => { frameTime = meta.mediaTime; video.requestVideoFrameCallback(onFrame); };
  if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(onFrame);
  const clipTime = () => (video.requestVideoFrameCallback && !video.paused ? frameTime : video.currentTime);

  // WebGL + assets.
  releaseDetached();
  const renderer = createModelRenderer(glCanvas);
  let assets = null;
  const status = (text) => { statusEl.hidden = !text; statusEl.textContent = text || ""; };
  if (!renderer.ok) status(L(lang, T_PLAYER.noGl));
  else {
    liveRenderers.add({ canvas: glCanvas, renderer });
    status(L(lang, T_PLAYER.loading).replace("{p}", "0"));
    loadModelAssets((f) => status(L(lang, T_PLAYER.loading).replace("{p}", String(Math.round(f * 100)))))
      .then((a) => {
        if (!glCanvas.isConnected && !stage.isConnected) return;
        renderer.setModel(a.mesh, a.image);
        renderer.setWire(a.wire);
        renderer.setPoints(a.points);
        assets = a;
        const s = a.scene.stats || {};
        sFrames.value.textContent = fmt(s.frames);
        sReg.value.textContent = fmt(s.registered);
        sPts.value.textContent = fmt(s.points);
        sTris.value.textContent = fmt(s.triangles);
        status("");
        syncButtons();
      })
      .catch((e) => { console.warn("drone-mesh: model failed to load", e); status(L(lang, T_PLAYER.loadFail)); });
  }
  syncButtons();

  // Play only while visible, unless the user paused on purpose.
  if ("IntersectionObserver" in globalThis) {
    new IntersectionObserver((entries) => {
      const visible = entries.some((e) => e.isIntersecting);
      if (visible && !userPaused && phase === "video") video.play().catch(() => {});
      if (!visible) video.pause();
    }, { threshold: 0.25 }).observe(stage);
  }

  // ----- orbit geometry
  function basis() {
    const up = vec.norm(assets.scene.up);
    let e1 = vec.cross(up, [1, 0, 0]);
    if (Math.hypot(...e1) < 0.1) e1 = vec.cross(up, [0, 1, 0]);
    e1 = vec.norm(e1);
    return { up, e1, e2: vec.cross(up, e1) };
  }
  function orbitEye() {
    const { up, e1, e2 } = basis();
    const T = assets.scene.target;
    const cp = Math.cos(orbit.pitch), sp = Math.sin(orbit.pitch);
    const dir = vec.add(vec.add(vec.scale(e1, cp * Math.cos(orbit.yaw)), vec.scale(e2, cp * Math.sin(orbit.yaw))), vec.scale(up, sp));
    return vec.add(T, vec.scale(dir, orbit.dist));
  }
  function startModel() {
    if (!assets || phase === "model") return;
    const t = clipTime();
    video.pause();
    cutPose = poseAt(assets.scene.poses, t);
    // Start the orbit where the camera is now.
    const { up, e1, e2 } = basis();
    const v = vec.sub(cutPose.c, assets.scene.target);
    const d = Math.hypot(...v);
    orbit.base = assets.scene.orbitDistance || d;
    orbit.dist = d;
    orbit.yaw = Math.atan2(vec.dot(v, e2), vec.dot(v, e1));
    orbit.pitch = clamp(Math.asin(clamp(vec.dot(v, up) / d, -1, 1)), 18 * DEG, 70 * DEG);
    phase = "model";
    t3 = 0;
    video.style.opacity = "0";
    tagEl.textContent = L(lang, narrow?.matches ? T_PLAYER.tagShort : T_PLAYER.tagModel);
    phaseEl.textContent = L(lang, T_PLAYER.phase[3]);
    glCanvas.style.pointerEvents = "auto";
    glCanvas.style.touchAction = "none";
    glCanvas.style.cursor = "grab";
    syncButtons();
  }
  function restartFlight() {
    phase = "video";
    t3 = 0;
    video.style.opacity = "1";
    tagEl.textContent = L(lang, narrow?.matches ? T_PLAYER.tagShort : T_PLAYER.tagVideo);
    glCanvas.style.pointerEvents = "none";
    glCanvas.style.touchAction = "auto";
    glCanvas.style.cursor = "";
    video.currentTime = 0;
    frameTime = 0;
    if (!userPaused) video.play().catch(() => {});
    syncButtons();
  }

  // ----- interaction (model phase only)
  const pointers = new Map();
  let pinch = 0;
  const touchInput = () => { orbit.lastInput = performance.now(); };
  glCanvas.addEventListener("pointerdown", (e) => {
    if (phase !== "model") return;
    glCanvas.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    glCanvas.style.cursor = "grabbing";
    touchInput();
  });
  glCanvas.addEventListener("pointermove", (e) => {
    if (phase !== "model" || !pointers.has(e.pointerId)) return;
    const prevPos = pointers.get(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 1) {
      orbit.yaw -= (e.clientX - prevPos[0]) * 0.006;
      orbit.pitch = clamp(orbit.pitch + (e.clientY - prevPos[1]) * 0.005, 5 * DEG, 85 * DEG);
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) orbit.dist = clamp(orbit.dist * (pinch / d), orbit.base * 0.2, orbit.base * 2.5);
      pinch = d;
    }
    touchInput();
  });
  const endPointer = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = 0; if (!pointers.size) glCanvas.style.cursor = phase === "model" ? "grab" : ""; };
  glCanvas.addEventListener("pointerup", endPointer);
  glCanvas.addEventListener("pointercancel", endPointer);
  glCanvas.addEventListener("wheel", (e) => {
    if (phase !== "model") return;
    e.preventDefault();
    orbit.dist = clamp(orbit.dist * Math.exp(e.deltaY * 0.0012), orbit.base * 0.2, orbit.base * 2.5);
    touchInput();
  }, { passive: false });
  glCanvas.addEventListener("dblclick", () => {
    if (phase !== "model") return;
    orbit.pitch = 38 * DEG;
    orbit.dist = orbit.base;
    orbit.lastInput = -1e9;
  });
  glCanvas.addEventListener("keydown", (e) => {
    if (phase !== "model") return;
    const k = { ArrowLeft: () => (orbit.yaw += 0.08), ArrowRight: () => (orbit.yaw -= 0.08), ArrowUp: () => (orbit.pitch = clamp(orbit.pitch + 0.06, 5 * DEG, 85 * DEG)), ArrowDown: () => (orbit.pitch = clamp(orbit.pitch - 0.06, 5 * DEG, 85 * DEG)), "+": () => (orbit.dist = clamp(orbit.dist * 0.9, orbit.base * 0.2, orbit.base * 2.5)), "-": () => (orbit.dist = clamp(orbit.dist * 1.1, orbit.base * 0.2, orbit.base * 2.5)) }[e.key];
    if (k) { e.preventDefault(); k(); touchInput(); }
  });

  // ----- frame loop
  animate(stage, (elapsed, dt) => {
    if (!renderer.ok || !assets) return;
    const r = stage.getBoundingClientRect();
    const W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height));
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const s = assets.scene, K = s.intrinsics;
    const proj = projectionFromIntrinsics(K.fx, K.fy, K.cx, K.cy, s.video.width, s.video.height, s.near, s.far);
    const { up, e1, e2 } = basis();
    const light = vec.norm(vec.add(vec.add(vec.scale(up, 0.8), vec.scale(e1, 0.45)), vec.scale(e2, 0.3)));

    if (phase === "video") {
      const t = clipTime();
      if (t >= CUT_AT && !userPaused && !prefersReducedMotion()) { startModel(); return; }
      const pose = poseAt(s.poses, t);
      const view = viewFromAxes(axesFromQuat(pose.q), pose.c);
      const step = t < 3 ? 0 : t < 9.5 ? 1 : 2;
      phaseEl.textContent = L(lang, T_PLAYER.phase[step]);
      const pointsReveal = clamp((t - 0.2) / 4, 0, 1);
      const wireReveal = clamp((t - 3) / 6, 0, 1);
      renderer.render({
        view, proj, W, H, dpr,
        modelAlpha: 0,
        pointsAlpha: mode === "points" ? 0.95 : mode === "mesh" ? (t < 8 ? 0.9 : Math.max(0.3, 0.9 - (t - 8) * 0.3)) : 0,
        pointsReveal: mode === "points" ? 1 : pointsReveal,
        pointSize: W < 500 ? 1.6 : 2.4,
        wireAlpha: mode === "mesh" ? (W < 500 ? 0.45 : 0.8) : 0,
        wireReveal,
      });
      return;
    }

    // Model phase: fade in the textured model at the cut camera, glide into
    // the orbit, then orbit automatically until the user takes over.
    t3 += dt;
    const idle = performance.now() - orbit.lastInput > 4000;
    if (orbit.auto && idle && t3 > 3.6) orbit.yaw += ORBIT_SPEED * dt;
    const glide = ease(clamp((t3 - 1.2) / 2.4, 0, 1));
    const eye = orbitEye();
    const orbitAxes = lookAtAxes(eye, s.target, up);
    let q, c;
    if (glide < 1 && cutPose) {
      q = slerp(cutPose.q, quatFromAxes(orbitAxes), glide);
      c = vec.lerp(cutPose.c, eye, glide);
    } else {
      q = quatFromAxes(orbitAxes);
      c = eye;
    }
    const view = viewFromAxes(axesFromQuat(q), c);
    const fadeIn = clamp(t3 / 1.2, 0, 1);
    renderer.render({
      view, proj, W, H, dpr,
      modelAlpha: mode === "points" ? 0 : fadeIn,
      shade: 0.75 * glide,
      light,
      wireAlpha: mode === "mesh" ? 0.18 + 0.4 * (1 - glide) : 0,
      wireReveal: 1,
      pointsAlpha: mode === "points" ? 0.95 : 0,
      pointsReveal: 1,
      pointSize: W < 500 ? 1.8 : 2.6,
    });
  }, { still: false });

  return root;
}

// ---------------------------------------------------------------------------
// Stitching: three flight segments, each reconstructed in its own local frame,
// become one map. Isometric canvas; the phases follow the hub stitcher.
const T_STITCH = {
  kicker: { de: "Stitching mehrerer 3D-Karten", en: "Stitching several 3D maps" },
  title: { de: "Drei Teilflüge, eine gemeinsame Karte", en: "Three flight segments, one shared map" },
  sub: {
    de: "Jeder Teilflug liefert ein eigenes Mesh in eigenen Koordinaten. Weil die Schwerkraft die Hochachse festlegt, bleiben nur Drehung um die Hochachse und Verschiebung zu finden.",
    en: "Every flight segment yields its own mesh in its own coordinates. Because gravity fixes the vertical axis, only the rotation about that axis and the shift remain to be found.",
  },
  segments: [
    { de: "Teilflug A (Referenz)", en: "Segment A (reference)" },
    { de: "Teilflug B", en: "Segment B" },
    { de: "Teilflug C", en: "Segment C" },
  ],
  phases: [
    { de: "Lokale Koordinaten", en: "Local frames" },
    { de: "Schwerkraft-Ausrichtung", en: "Gravity alignment" },
    { de: "Drehwinkel-Suche", en: "Yaw search" },
    { de: "Anker einrasten", en: "Snap on anchors" },
    { de: "Eine Karte", en: "One map" },
  ],
  phaseLong: [
    { de: "Jedes Teil-Mesh liegt in eigenen Koordinaten, verdreht und versetzt.", en: "Each partial mesh sits in its own coordinates, rotated and shifted." },
    { de: "+Y zeigt immer nach oben: Neigung entfällt, es bleiben 4 Freiheitsgrade.", en: "+Y always points up: tilt drops out, 4 degrees of freedom remain." },
    { de: "Drehung um die Hochachse wird gesucht, bis die Überlappung am besten passt.", en: "The rotation about the vertical axis is searched until the overlap fits best." },
    { de: "Gemeinsame Anker in der Überlappung legen die Verschiebung fest.", en: "Shared anchors in the overlap fix the shift." },
    { de: "Ein Mesh, ein Koordinatensystem, bereit für das Lagebild.", en: "One mesh, one coordinate frame, ready for the operating picture." },
  ],
  score: { de: "Passung der Überlappung (schematisch)", en: "Overlap fit (schematic)" },
  facts: [
    { v: "4-DoF", de: "Gierwinkel + 3D-Verschiebung statt 6 Freiheitsgraden", en: "yaw + 3D shift instead of 6 degrees of freedom" },
    { v: "≥ 0,25 m", vEn: "≥ 0.25 m", de: "Boden vor dem Abgleich entfernt: flacher Boden passt in jedem Winkel", en: "floor removed before matching: flat ground fits at any angle" },
    { v: "5,5–5,7 mm", vEn: "5.5–5.7 mm", de: "Median-Fehler des Hub-Stitchers, gemessen mit 20 AR-Brillen", en: "median error of the hub stitcher, measured with 20 AR headsets" },
    { v: "0", de: "falsche Zusammenführungen; unsichere Teile bleiben „nicht ausgerichtet“", en: "false accepts; uncertain parts stay “unaligned”" },
  ],
  pause: { de: "Pause", en: "Pause" },
  play: { de: "Abspielen", en: "Play" },
  aria: {
    de: "Animation: drei verdrehte Teil-Meshes werden nach Schwerkraft ausgerichtet, per Drehwinkel-Suche und gemeinsamen Ankern zusammengesetzt.",
    en: "Animation: three rotated partial meshes are gravity-aligned, then joined by a yaw search and shared anchors.",
  },
};

const STITCH_LOOP = 16;
const STITCH_PHASES = [0, 2.5, 5, 10, 12.5]; // phase start times (s)
const terrain = (x, z) => 0.55 * Math.sin(x * 0.9) + 0.35 * Math.cos(z * 1.3) + 0.25 * Math.sin((x + z) * 1.7);
const TILES = [
  { x0: 0, x1: 5, yaw: 0, t: [0, 0, 0], tilt: 0 },
  { x0: 3.5, x1: 8.5, yaw: 55, t: [1.2, 0.9, 1.7], tilt: 14 },
  { x0: 7, x1: 12, yaw: -70, t: [1.8, -0.7, -1.6], tilt: -11 },
];
const ANCHORS = [[4.2, 1.4], [4.4, 4.6], [7.6, 1.8], [7.8, 4.9]];

function renderStitchDemo(block, lang) {
  const root = card(lang, T_STITCH.kicker, T_STITCH.title, T_STITCH.sub);
  const canvas = el("canvas", { role: "img", "aria-label": L(lang, T_STITCH.aria) });
  const phaseEl = el("p", { class: "vd-phase" });
  const stage = el("div", { class: "vd-stage" }, canvas, phaseEl);
  const narrow = globalThis.matchMedia?.("(max-width: 560px)");
  const placePhase = () => { if (narrow?.matches) stage.after(phaseEl); else stage.append(phaseEl); };
  let time = 0;
  let playing = !prefersReducedMotion();
  if (!playing) time = STITCH_PHASES[4] + 1;
  const stepBtns = T_STITCH.phases.map((p, i) => el("button", {
    class: "vd-step", type: "button",
    onclick: () => { time = STITCH_PHASES[i] + 0.01; },
  }, el("b", {}, String(i + 1)), L(lang, p)));
  const playBtn = button(L(lang, playing ? T_STITCH.pause : T_STITCH.play), () => {
    playing = !playing;
    playBtn.textContent = L(lang, playing ? T_STITCH.pause : T_STITCH.play);
  });
  const facts = el("div", { class: "vd-stats" }, T_STITCH.facts.map((f) =>
    el("div", { class: "vd-stat" }, el("b", {}, lang === "en" && f.vEn ? f.vEn : f.v), el("span", {}, L(lang, f)))));
  root.append(stage, el("div", { class: "vd-steps" }, stepBtns), el("div", { class: "vd-bar" }, playBtn), facts);
  placePhase();
  narrow?.addEventListener?.("change", placePhase);

  const ctx = canvas.getContext("2d");
  let W = 0, H = 0;
  const fit = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (w === W && h === H) return;
    W = w; H = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  // Per-tile pose at time t: weights go 1 → 0 as the phases progress.
  function pose(tile, t) {
    if (tile.yaw === 0 && tile.tilt === 0) return { yaw: 0, tilt: 0, t: [0, 0, 0] };
    const u = (a, b) => ease(clamp((t - a) / (b - a), 0, 1));
    const tiltW = 1 - u(STITCH_PHASES[1], STITCH_PHASES[2]);
    const yu = clamp((t - STITCH_PHASES[2]) / (STITCH_PHASES[3] - STITCH_PHASES[2]), 0, 1);
    // The search sweeps past the optimum before settling.
    const yaw = tile.yaw * (1 - ease(yu)) + Math.sin(yu * Math.PI * 3) * 18 * (1 - yu) * (yu > 0 && yu < 1 ? 1 : 0);
    const tW = 1 - u(STITCH_PHASES[3], STITCH_PHASES[4]);
    return { yaw, tilt: tile.tilt * tiltW, t: tile.t.map((v) => v * tW) };
  }

  function transform(tile, p, px, py, pz) {
    const cx = (tile.x0 + tile.x1) / 2, cz = 3;
    let x = px - cx, y = py, z = pz - cz;
    const a = (p.tilt * Math.PI) / 180;
    [y, z] = [y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
    const b = (p.yaw * Math.PI) / 180;
    [x, z] = [x * Math.cos(b) + z * Math.sin(b), -x * Math.sin(b) + z * Math.cos(b)];
    return [x + cx + p.t[0], y + p.t[1], z + cz + p.t[2]];
  }

  // Scale and offset so every pose of the loop stays inside the canvas.
  let view = null;
  function fitView() {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const t of [0, STITCH_PHASES[1], STITCH_PHASES[2] + 1.5, STITCH_PHASES[3], STITCH_LOOP - 0.1]) {
      for (const tile of TILES) {
        const p = pose(tile, t);
        for (const [x, z] of [[tile.x0, 0], [tile.x1, 0], [tile.x0, 6], [tile.x1, 6]]) {
          const [wx, wy, wz] = transform(tile, p, x, terrain(x, z), z);
          const X = (wx - wz) * 0.866, Y = (wx + wz) * 0.5 - wy * 0.9;
          minX = Math.min(minX, X); maxX = Math.max(maxX, X); minY = Math.min(minY, Y); maxY = Math.max(maxY, Y);
        }
      }
    }
    const padTop = 52, padBottom = W < 560 ? 18 : 56, pad = 16;
    const s = Math.min((W - 2 * pad) / (maxX - minX), (H - padTop - padBottom) / (maxY - minY));
    return { W, H, s, ox: pad - minX * s + (W - 2 * pad - (maxX - minX) * s) / 2, oy: padTop - minY * s };
  }

  function frame(t) {
    fit();
    ctx.clearRect(0, 0, W, H);
    const k = tokens(stage);
    const colors = [k.mint, k.amber, k.red];
    if (!view || view.W !== W || view.H !== H) view = fitView();
    const { s, ox, oy } = view;
    const proj = ([x, y, z]) => [ox + (x - z) * 0.866 * s, oy + (x + z) * 0.5 * s - y * s * 0.9];
    const merged = ease(clamp((t - STITCH_PHASES[4]) / 1.5, 0, 1));
    const phase = STITCH_PHASES.reduce((acc, start, i) => (t >= start ? i : acc), 0);
    stepBtns.forEach((b, i) => b.classList.toggle("is-on", i === phase));
    phaseEl.textContent = `${phase + 1} · ${L(lang, T_STITCH.phaseLong[phase])}`;

    TILES.forEach((tile, ti) => {
      const p = pose(tile, t);
      const color = ti === 0 || merged >= 1 ? colors[0] : colors[ti];
      ctx.strokeStyle = alpha(merged > 0 && ti > 0 ? k.mint : color, ti > 0 ? 0.55 + 0.35 * merged : 0.9);
      ctx.lineWidth = 1;
      const nx = 10, nz = 7;
      const at = (i, j) => {
        const x = tile.x0 + ((tile.x1 - tile.x0) * i) / (nx - 1), z = (6 * j) / (nz - 1);
        return proj(transform(tile, p, x, terrain(x, z), z));
      };
      for (let j = 0; j < nz; j++) {
        ctx.beginPath();
        for (let i = 0; i < nx; i++) { const [X, Y] = at(i, j); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
        ctx.stroke();
      }
      for (let i = 0; i < nx; i++) {
        ctx.beginPath();
        for (let j = 0; j < nz; j++) { const [X, Y] = at(i, j); j ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
        ctx.stroke();
      }
      // Gravity arrow during alignment.
      if (phase === 1 && ti > 0) {
        const [X, Y] = proj(transform(tile, p, (tile.x0 + tile.x1) / 2, 1.2, 3));
        ctx.strokeStyle = k.ink;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(X, Y + 26); ctx.lineTo(X, Y - 10); ctx.lineTo(X - 5, Y - 3); ctx.moveTo(X, Y - 10); ctx.lineTo(X + 5, Y - 3); ctx.stroke();
        ctx.fillStyle = k.ink; ctx.font = `600 12px ${k.mono}`; ctx.fillText("+Y", X + 8, Y - 4);
      }
      // Segment label at the tile's near corner.
      if (merged < 1) {
        const [X, Y] = proj(transform(tile, p, tile.x0 + 0.3, terrain(tile.x0, 6) + 0.3, 6));
        ctx.fillStyle = alpha(color, 1 - merged);
        ctx.font = `600 12px ${k.sans}`;
        ctx.fillText(L(lang, T_STITCH.segments[ti]), X - 10, Y + 18);
      }
    });

    // Anchors: each overlapping tile shows its own copy; copies converge.
    if (phase >= 2) {
      for (const [ax, az] of ANCHORS) {
        const copies = TILES.map((tile, ti) => (ax >= tile.x0 && ax <= tile.x1 ? proj(transform(tile, pose(tile, t), ax, terrain(ax, az) + 0.05, az)) : null)).filter(Boolean);
        if (phase === 3 && copies.length === 2) {
          ctx.strokeStyle = alpha(k.ink, 0.6); ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.moveTo(...copies[0]); ctx.lineTo(...copies[1]); ctx.stroke(); ctx.setLineDash([]);
        }
        for (const [X, Y] of copies) {
          ctx.fillStyle = k.ink;
          ctx.beginPath(); ctx.moveTo(X, Y - 5); ctx.lineTo(X + 5, Y); ctx.lineTo(X, Y + 5); ctx.lineTo(X - 5, Y); ctx.closePath(); ctx.fill();
        }
      }
    }

    // Overlap fit meter during the yaw search.
    if (phase === 2 || phase === 3) {
      const err = Math.abs(pose(TILES[1], t).yaw) + Math.abs(pose(TILES[2], t).yaw) / 2;
      const fitV = Math.exp(-((err / 28) ** 2));
      const bw = Math.min(220, W * 0.42), bx = W - bw - 12, by = 14;
      ctx.fillStyle = "rgba(12,11,31,0.78)"; ctx.fillRect(bx - 8, by - 6, bw + 16, 40);
      ctx.fillStyle = k.soft; ctx.font = `12px ${k.sans}`; ctx.fillText(L(lang, T_STITCH.score), bx, by + 8);
      ctx.fillStyle = alpha(k.ink, 0.15); ctx.fillRect(bx, by + 16, bw, 8);
      ctx.fillStyle = fitV > 0.85 ? k.green : k.amber; ctx.fillRect(bx, by + 16, bw * fitV, 8);
    }
  }

  animate(stage, (elapsed, dt, still) => {
    if (playing && !still) time = (time + dt) % STITCH_LOOP;
    frame(time);
  });
  return root;
}

// ---------------------------------------------------------------------------
// Software pipeline: nine stages from drone video to the operating picture.
// The active stage advances on its own; clicking a stage inspects it.
const T_PIPE = {
  kicker: { de: "Software-Architektur", en: "Software architecture" },
  title: { de: "Vom Drohnenvideo zum Lagebild", en: "From drone video to operating picture" },
  sub: {
    de: "Die Kette läuft heute offline auf aufgezeichnetem Video; in dieser Demo gibt es kein Live-Backend. Gestrichelt: Schritte im J.A.R.-Hub und auf den Brillen.",
    en: "Today the chain runs offline on recorded video; this demo has no live backend. Dashed: steps on the J.A.R. hub and on the headsets.",
  },
  labels: { in: { de: "Eingang", en: "Input" }, out: { de: "Ausgang", en: "Output" }, where: { de: "Läuft auf", en: "Runs on" }, why: { de: "Nutzen im MANV", en: "Value in an MCI" } },
  pause: { de: "Pause", en: "Pause" },
  play: { de: "Abspielen", en: "Play" },
  stages: [
    {
      title: { de: "Video + Telemetrie", en: "Video + telemetry" },
      in: { de: "Drohnenvideo, GPS-Position, Flughöhe, Gimbal-Winkel", en: "Drone video, GPS position, altitude, gimbal angle" },
      out: { de: "Bildstrom mit Lage-Schätzung je Bild", en: "Frame stream with a pose estimate per frame" },
      where: { de: "Drohne / Bodenstation", en: "Drone / ground station" },
      why: { de: "Erster Überblick über Zufahrten und Schadensgebiet, bevor Trupps vor Ort sind.", en: "A first look at access routes and the damage area before teams arrive." },
    },
    {
      title: { de: "Bildauswahl", en: "Frame selection" },
      in: { de: "Bildstrom", en: "Frame stream" },
      out: { de: "Schlüsselbilder mit ausreichender Überlappung", en: "Keyframes with enough overlap" },
      where: { de: "Photogrammetrie, offline", en: "Photogrammetry, offline" },
      why: { de: "Weniger, aber gut überlappende Bilder: schnellere Rekonstruktion.", en: "Fewer but well-overlapping frames: faster reconstruction." },
    },
    {
      title: { de: "Merkmale & Abgleich", en: "Features & matching" },
      in: { de: "Schlüsselbilder", en: "Keyframes" },
      out: { de: "Markante Punkte und ihre Zuordnung zwischen Bildern", en: "Distinctive points and their matches across frames" },
      where: { de: "Photogrammetrie, offline", en: "Photogrammetry, offline" },
      why: { de: "Grundlage für jede Geometrie; Lektion 1 zeigt das Ergebnis der ganzen Kette.", en: "The basis of all geometry; lesson 1 shows the result of the whole chain." },
    },
    {
      title: { de: "Structure from Motion", en: "Structure from motion" },
      in: { de: "Punkt-Zuordnungen", en: "Point matches" },
      out: { de: "Kameraposen und dünne 3D-Punktwolke", en: "Camera poses and a sparse 3D point cloud" },
      where: { de: "Photogrammetrie, offline", en: "Photogrammetry, offline" },
      why: { de: "Weiß, wo die Drohne bei jedem Bild war: Voraussetzung für Maßstab.", en: "Knows where the drone was for every frame: the precondition for scale." },
    },
    {
      title: { de: "Dichte Punktwolke", en: "Dense point cloud" },
      in: { de: "Bilder + Kameraposen", en: "Frames + camera poses" },
      out: { de: "Dichte 3D-Punktwolke (Multi-View-Stereo)", en: "Dense 3D point cloud (multi-view stereo)" },
      where: { de: "Photogrammetrie, offline", en: "Photogrammetry, offline" },
      why: { de: "Trümmerkegel, Böschungen und Wasserkanten werden räumlich messbar.", en: "Debris piles, embankments and water edges become measurable in 3D." },
    },
    {
      title: { de: "Mesh & Textur", en: "Mesh & texture" },
      in: { de: "Dichte Punktwolke", en: "Dense point cloud" },
      out: { de: "Texturiertes 3D-Oberflächennetz", en: "Textured 3D surface mesh" },
      where: { de: "Photogrammetrie, offline", en: "Photogrammetry, offline" },
      why: { de: "Ein Modell, das Einsatzleitung und Brillen direkt darstellen können.", en: "A model that command and headsets can display directly." },
    },
    {
      title: { de: "Georeferenzierung", en: "Georeferencing" },
      in: { de: "Mesh + GPS", en: "Mesh + GPS" },
      out: { de: "Orthomosaik, Geländemodell, GeoTIFF (z. B. OpenDroneMap)", en: "Orthomosaic, terrain model, GeoTIFF (e.g. OpenDroneMap)" },
      where: { de: "Photogrammetrie, offline", en: "Photogrammetry, offline" },
      why: { de: "Passt auf Karte und Einsatzraster; Grundlage für Flut- und Routenberechnung.", en: "Fits the map and the incident grid; the basis for flood and route calculation." },
    },
    {
      title: { de: "J.A.R.-Hub-Stitcher", en: "J.A.R. hub stitcher" },
      in: { de: "Drohnen-Mesh + Meshes der AR-Brillen (jarmesh/1)", en: "Drone mesh + AR headset meshes (jarmesh/1)" },
      out: { de: "Eine gemeinsame 3D-Karte (4-DoF-Ausrichtung)", en: "One shared 3D map (4-DoF alignment)" },
      where: { de: "J.A.R.-Hub im Einsatzleitfahrzeug", en: "J.A.R. hub in the command vehicle" },
      why: { de: "Außen aus der Luft, innen aus den Brillen: Patienten auch im Keller verortet.", en: "Outside from the air, inside from the headsets: patients located even in basements." },
      jar: true,
    },
    {
      title: { de: "Lagebild", en: "Operating picture" },
      in: { de: "Gemeinsame 3D-Karte + Patientenanker", en: "Shared 3D map + patient anchors" },
      out: { de: "Dashboard der Einsatzleitung und Einblendung in den AR-Brillen", en: "Command dashboard and overlay in the AR headsets" },
      where: { de: "Dashboard + AR-Brillen", en: "Dashboard + AR headsets" },
      why: { de: "Alle sehen dieselbe Lage: Ablagen, Gefahrenzonen, Wege zu Patienten.", en: "Everyone sees the same situation: collection points, hazard zones, routes to patients." },
      jar: true,
    },
  ],
  aria: {
    de: "Diagramm der Software-Kette in neun Schritten vom Drohnenvideo bis zum Lagebild; der aktive Schritt wandert automatisch weiter.",
    en: "Diagram of the software chain in nine steps from drone video to operating picture; the active step advances automatically.",
  },
};

function renderMappingSoftwarePipeline(block, lang) {
  const root = card(lang, T_PIPE.kicker, T_PIPE.title, T_PIPE.sub);
  let active = 0;
  let playing = !prefersReducedMotion();
  let clock = 0;
  const inspect = el("div", { class: "vd-inspect", "aria-live": "polite" });
  const nodes = T_PIPE.stages.map((st, i) => el("button", {
    class: "vd-node" + (st.jar ? " is-jar" : ""), type: "button",
    onclick: () => { select(i); clock = 0; },
  }, el("b", {}, String(i + 1).padStart(2, "0")), el("strong", {}, L(lang, st.title))));

  function select(i) {
    active = i;
    nodes.forEach((n, j) => n.classList.toggle("is-on", j === i));
    const st = T_PIPE.stages[i];
    const row = (k) => [el("dt", {}, L(lang, T_PIPE.labels[k])), el("dd", {}, L(lang, st[k]))];
    inspect.replaceChildren(
      el("h4", {}, `${String(i + 1).padStart(2, "0")} · ${L(lang, st.title)}`),
      el("dl", {}, row("in"), row("out"), row("where"), row("why")));
  }
  select(0);

  const playBtn = button(L(lang, playing ? T_PIPE.pause : T_PIPE.play), () => {
    playing = !playing;
    playBtn.textContent = L(lang, playing ? T_PIPE.pause : T_PIPE.play);
  });
  const grid = el("div", { class: "vd-pipe", role: "group", "aria-label": L(lang, T_PIPE.aria) }, nodes);
  root.append(grid, inspect, el("div", { class: "vd-bar" }, playBtn));

  animate(grid, (elapsed, dt, still) => {
    if (still || !playing) return;
    clock += dt;
    if (clock > 3.2) {
      clock = 0;
      select((active + 1) % nodes.length);
    }
  });
  return root;
}

export const VISUALS = {
  "drone-mesh-player": renderDroneMeshPlayer,
  "stitch-demo": renderStitchDemo,
  "mapping-software-pipeline": renderMappingSoftwarePipeline,
};

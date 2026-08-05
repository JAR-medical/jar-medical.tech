/* WebXR-Passthrough mit einem Schirm, auf den man zeigen und tippen kann.
 *
 * Ziel: die reale Welt durch die Headset-Kameras sehen (Passthrough), davor der
 * Ablaufschirm mit Lagekarte — auf Quest UND auf PICO.
 *
 * PICOs Browser kann `immersive-ar`, aber NICHT `dom-overlay`. Deshalb liegt der
 * Schirm nicht als HTML darüber, sondern wird mit der Canvas-2D-API gezeichnet
 * (hudscreen.js), als Textur hochgeladen und auf ein Rechteck in der WebGL-Ebene
 * gelegt. Der Augenpuffer wird vollständig transparent gelöscht, damit rundherum
 * die Wirklichkeit stehen bleibt.
 *
 * Bedienung ist Handtracking: jede Eingabequelle hat einen `targetRaySpace` —
 * bei Händen ist das der Pinch-Strahl. Der Strahl wird mit der Ebene des Schirms
 * geschnitten, der Treffer in Canvas-Pixel umgerechnet und mit den
 * Knopf-Rechtecken verglichen, die hudscreen.js zurückgibt. Ein `select` (der
 * abgeschlossene Pinch) löst den Knopf unter dem Zeiger aus. Controller fahren
 * über denselben Weg, ohne Sonderfall.
 *
 * Der Schirm ist körperfest, nicht kopffest: er bleibt stehen, während man
 * darauf zeigt, und zieht erst nach, wenn man sich wirklich weggedreht hat.
 * Auf etwas zu zielen, das jeder Kopfbewegung folgt, ist unbenutzbar.
 */

"use strict";

import { drawScreen, hitTest } from "./hudscreen.js";

export async function passthroughSupported() {
  if (typeof navigator === "undefined" || !navigator.xr) return false;
  try {
    return await navigator.xr.isSessionSupported("immersive-ar");
  } catch (_) {
    return false;
  }
}

// Texturauflösung und physische Größe des Schirms.
const HUD_W = 1024, HUD_H = 872;
const HUD_DIST = 1.5;                     // Meter vor dem Träger
const HUD_HALF_W = 0.62;                  // halbe Breite in Metern
const HUD_HALF_H = HUD_HALF_W * (HUD_H / HUD_W);

// Nachführen des körperfesten Schirms.
const FOLLOW_YAW_DEG = 42;                // ab dieser Kopfdrehung nachziehen
const FOLLOW_MOVE_M = 1.0;                // ab dieser Strecke nachziehen
const FOLLOW_EASE = 0.12;                 // Anteil pro Frame

const CURSOR_PX = 64;
const CURSOR_HALF = 0.018;                // Meter

// Die Karte zeigt die eigene Position live; ohne Bremse würde dafür jedes Frame
// eine 1024×872-Textur neu hochgeladen.
const MAP_REDRAW_MS = 120;

const VERT_SRC = `
  attribute vec2 aPos;
  attribute vec2 aUV;
  uniform mat4 uMVP;
  varying vec2 vUV;
  void main() { vUV = aUV; gl_Position = uMVP * vec4(aPos, 0.0, 1.0); }
`;
const FRAG_SRC = `
  precision mediump float;
  varying vec2 vUV;
  uniform sampler2D uTex;
  void main() { gl_FragColor = texture2D(uTex, vUV); }
`;

/* ------------------------------------------------------------- Vektoren */

function mul(a, b) {                       // spaltenweise 4x4: a * b
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      o[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] +
        a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] +
        a[3 * 4 + r] * b[c * 4 + 3];
  return o;
}

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot3 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const scale3 = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const add3 = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

/** Blickrichtung (-Z) aus einer XRRigidTransform. */
function forwardOf(transform) {
  const m = transform.matrix;              // spaltenweise
  return { x: -m[8], y: -m[9], z: -m[10] };
}

function flatten(v) {
  const len = Math.hypot(v.x, v.z);
  return len < 1e-4 ? { x: 0, y: 0, z: -1 } : { x: v.x / len, y: 0, z: v.z / len };
}

function yawOf(v) { return Math.atan2(-v.x, -v.z); }   // Normale zeigt zum Träger

function shortestAngle(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/* --------------------------------------------------------------- Sitzung */

export class XRPassthrough {
  /**
   * @param {object} opts
   * @param {()=>void}   [opts.onStart]
   * @param {()=>void}   [opts.onEnd]
   * @param {(pos,fwd)=>void} [opts.onPose]  Kopfpose je Frame (für die Nähe-Erkennung)
   * @param {()=>void}   [opts.onFrame]      je Frame, nach der Pose
   */
  constructor({ onStart, onEnd, onPose, onFrame } = {}) {
    this.onStart = onStart || (() => {});
    this.onEnd = onEnd || (() => {});
    this.onPose = onPose || (() => {});
    this.onFrame = onFrame || (() => {});

    this.session = null;
    this.gl = null;
    this.refSpace = null;

    this._screen = { title: "J.A.R.", headline: "", hint: "", body: [], buttons: [], status: "" };
    this._map = { columns: 1, rows: 1, minCol: 0, minRow: 1, dots: [], medic: null,
                  counts: { SK1: 0, SK2: 0, SK3: 0, SK4: 0, DECEASED: 0, open: 0 },
                  footer: "", hint: "", aligned: false };
    this._rects = [];
    this._hover = -1;
    this._cursor = null;
    this._pinching = false;
    this._dirty = true;
    this._mapDrawnAt = 0;

    // Körperfeste Pose des Schirms im Referenzraum.
    this._panel = { pos: { x: 0, y: 0, z: 0 }, yaw: 0 };
    this._target = { pos: { x: 0, y: 0, z: 0 }, yaw: 0 };
    this._placed = false;

    this._frameBound = (t, f) => this._onFrame(t, f);
    this._onSelectBound = () => this._activate();
    this._onSelectStart = () => { this._pinching = true; this._dirty = true; };
    this._onSelectEnd = () => { this._pinching = false; this._dirty = true; };
  }

  get active() { return !!this.session; }

  async start() {
    if (this.session) return;
    if (typeof navigator === "undefined" || !navigator.xr)
      throw new Error("WebXR steht in diesem Browser nicht zur Verfügung.");

    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl", {
      xrCompatible: true, alpha: true, antialias: true, depth: false, stencil: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error("WebGL für die AR-Ebene nicht verfügbar.");

    // Sitzung zuerst anfordern, solange die Nutzeraktion des Knopfdrucks gilt.
    let session;
    try {
      session = await navigator.xr.requestSession("immersive-ar", {
        optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking"],
      });
    } catch (err) {
      const name = err && err.name ? err.name + ": " : "";
      const msg = err && err.message ? err.message : "immersive-ar konnte nicht gestartet werden";
      throw new Error("AR-Sitzung abgelehnt — " + name + msg);
    }

    await gl.makeXRCompatible();
    session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl, { alpha: true }) });

    this.refSpace = await session
      .requestReferenceSpace("local-floor")
      .catch(() => session.requestReferenceSpace("local"))
      .catch(() => session.requestReferenceSpace("viewer"));

    this.gl = gl;
    this.session = session;
    this._initGL();

    session.addEventListener("select", this._onSelectBound);
    session.addEventListener("selectstart", this._onSelectStart);
    session.addEventListener("selectend", this._onSelectEnd);
    session.addEventListener("end", () => this._cleanup());

    this.onStart();
    session.requestAnimationFrame(this._frameBound);
  }

  /** Neuen Schirm + neue Kartendaten anzeigen. */
  setContent(screen, map) {
    if (screen) this._screen = screen;
    if (map) this._map = map;
    this._dirty = true;
  }

  /** Schirm sofort vor den Träger holen (nach einem Zustandswechsel). */
  recenter() { this._placed = false; }

  async end() {
    if (this.session) {
      try { await this.session.end(); } catch (_) { this._cleanup(); }
    }
  }

  /* ------------------------------------------------------------- Zeichnen */

  _draw() {
    if (!this.hudCtx) return;
    // Kein Zeiger auf der Textur — der wird als eigenes Rechteck gezeichnet,
    // sonst müsste für jede Handbewegung die ganze Textur neu hoch.
    this._rects = drawScreen(this.hudCtx, HUD_W, HUD_H, this._screen, this._map, {
      hover: this._hover,
    });
    this._texDirty = true;
    this._dirty = false;
    this._mapDrawnAt = performance.now();
  }

  _initGL() {
    const gl = this.gl;

    this.hudCanvas = document.createElement("canvas");
    this.hudCanvas.width = HUD_W;
    this.hudCanvas.height = HUD_H;
    this.hudCtx = this.hudCanvas.getContext("2d");

    const vs = this._shader(gl.VERTEX_SHADER, VERT_SRC);
    const fs = this._shader(gl.FRAGMENT_SHADER, FRAG_SRC);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
      throw new Error("HUD-Shader fehlgeschlagen: " + gl.getProgramInfoLog(prog));

    this.prog = prog;
    this.aPos = gl.getAttribLocation(prog, "aPos");
    this.aUV = gl.getAttribLocation(prog, "aUV");
    this.uMVP = gl.getUniformLocation(prog, "uMVP");
    this.uTex = gl.getUniformLocation(prog, "uTex");

    const verts = new Float32Array([
      -1, -1, 0, 0,   1, -1, 1, 0,   1, 1, 1, 1,
      -1, -1, 0, 0,   1,  1, 1, 1,  -1, 1, 0, 1,
    ]);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    this.tex = this._texture();
    this.cursorTex = this._texture();
    this._uploadCursor();
    this._draw();
  }

  _texture() {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  _shader(type, src) {
    const gl = this.gl;
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw new Error("Shader-Compile-Fehler: " + gl.getShaderInfoLog(s));
    return s;
  }

  /** Der Zeiger wird als eigenes kleines Rechteck gezeichnet — sonst müsste für
   *  jede Handbewegung die ganze Schirmtextur neu hoch. */
  _uploadCursor() {
    const c = document.createElement("canvas");
    c.width = c.height = CURSOR_PX;
    const g = c.getContext("2d");
    const r = CURSOR_PX / 2;
    g.strokeStyle = "rgba(255,255,255,0.85)";
    g.lineWidth = 4;
    g.beginPath(); g.arc(r, r, r - 6, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#5aa2e6";
    g.beginPath(); g.arc(r, r, r - 16, 0, Math.PI * 2); g.fill();

    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.cursorTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  }

  _uploadHud() {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.hudCanvas);
    this._texDirty = false;
  }

  /* --------------------------------------------------------- Schirm-Pose */

  _basis(yaw) {
    const s = Math.sin(yaw), c = Math.cos(yaw);
    return {
      right: { x: c, y: 0, z: -s },
      up: { x: 0, y: 1, z: 0 },
      normal: { x: s, y: 0, z: c },
    };
  }

  _followHead(head) {
    const fwd = flatten(forwardOf(head));
    const wanted = {
      pos: add3(head.position, add3(scale3(fwd, HUD_DIST), { x: 0, y: -0.12, z: 0 })),
      yaw: yawOf(fwd),
    };

    if (!this._placed) {
      this._target = wanted;
      this._panel = { pos: { ...wanted.pos }, yaw: wanted.yaw };
      this._placed = true;
      return;
    }

    const turned = Math.abs(shortestAngle(this._target.yaw, wanted.yaw)) * 180 / Math.PI;
    const moved = Math.hypot(wanted.pos.x - this._target.pos.x, wanted.pos.z - this._target.pos.z);
    if (turned > FOLLOW_YAW_DEG || moved > FOLLOW_MOVE_M) this._target = wanted;

    const t = FOLLOW_EASE;
    this._panel.pos = {
      x: this._panel.pos.x + (this._target.pos.x - this._panel.pos.x) * t,
      y: this._panel.pos.y + (this._target.pos.y - this._panel.pos.y) * t,
      z: this._panel.pos.z + (this._target.pos.z - this._panel.pos.z) * t,
    };
    this._panel.yaw += shortestAngle(this._panel.yaw, this._target.yaw) * t;
  }

  _modelMatrix(pos, basis, halfW, halfH) {
    return new Float32Array([
      basis.right.x * halfW, basis.right.y * halfW, basis.right.z * halfW, 0,
      basis.up.x * halfH, basis.up.y * halfH, basis.up.z * halfH, 0,
      basis.normal.x, basis.normal.y, basis.normal.z, 0,
      pos.x, pos.y, pos.z, 1,
    ]);
  }

  /* --------------------------------------------------------------- Zeigen */

  _updatePointer(frame) {
    const basis = this._basis(this._panel.yaw);
    let best = null;

    for (const src of this.session.inputSources) {
      if (!src.targetRaySpace) continue;
      const pose = frame.getPose(src.targetRaySpace, this.refSpace);
      if (!pose) continue;

      const origin = pose.transform.position;
      const dir = forwardOf(pose.transform);

      const denom = dot3(basis.normal, dir);
      if (Math.abs(denom) < 1e-5) continue;
      const dist = dot3(basis.normal, sub(this._panel.pos, origin)) / denom;
      if (dist < 0.05 || dist > 6) continue;

      const hit = add3(origin, scale3(dir, dist));
      const rel = sub(hit, this._panel.pos);
      const u = dot3(rel, basis.right) / HUD_HALF_W;
      const v = dot3(rel, basis.up) / HUD_HALF_H;
      if (u < -1 || u > 1 || v < -1 || v > 1) continue;

      if (!best || dist < best.dist) {
        best = {
          dist, hit,
          px: ((u + 1) / 2) * HUD_W,
          py: ((1 - v) / 2) * HUD_H,
        };
      }
    }

    const hover = best ? hitTest(this._rects, best.px, best.py) : -1;
    const cursor = best ? { x: best.px, y: best.py, pressed: this._pinching } : null;

    const moved = !!cursor !== !!this._cursor ||
      (cursor && this._cursor &&
        (Math.abs(cursor.x - this._cursor.x) > 3 || Math.abs(cursor.y - this._cursor.y) > 3 ||
         cursor.pressed !== this._cursor.pressed));

    if (hover !== this._hover) { this._hover = hover; this._dirty = true; }
    if (moved) this._cursor = cursor;      // eigenes Rechteck, kein Neuzeichnen nötig
    this._cursorWorld = best ? best.hit : null;
  }

  _activate() {
    if (this._hover < 0) return;
    const buttons = this._screen.buttons || [];
    const b = buttons[this._hover];
    if (b && typeof b.action === "function") {
      this._hover = -1;                    // der neue Schirm hat andere Knöpfe
      b.action();
    }
  }

  /* ----------------------------------------------------------- Frame-Lauf */

  _onFrame(_t, frame) {
    const session = this.session;
    if (!session) return;
    session.requestAnimationFrame(this._frameBound);

    const gl = this.gl;
    const layer = session.renderState.baseLayer;
    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
    gl.clearColor(0, 0, 0, 0);             // durchsichtig → Passthrough bleibt sichtbar
    gl.clear(gl.COLOR_BUFFER_BIT);

    const pose = frame.getViewerPose(this.refSpace);
    if (!pose) return;

    const head = pose.transform;
    this._followHead(head);
    this.onPose(head.position, flatten(forwardOf(head)));
    this.onFrame();
    this._updatePointer(frame);

    if (this._dirty || performance.now() - this._mapDrawnAt > MAP_REDRAW_MS) this._draw();
    if (this._texDirty) this._uploadHud();

    gl.useProgram(this.prog);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);     // vormultipliziertes Alpha

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(this.aUV);
    gl.vertexAttribPointer(this.aUV, 2, gl.FLOAT, false, 16, 8);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(this.uTex, 0);

    const basis = this._basis(this._panel.yaw);
    const panelModel = this._modelMatrix(this._panel.pos, basis, HUD_HALF_W, HUD_HALF_H);

    // Zeiger einen Millimeter vor der Fläche, sonst z-kämpft er mit ihr.
    let cursorModel = null;
    if (this._cursorWorld) {
      const front = add3(this._cursorWorld, scale3(basis.normal, 0.004));
      cursorModel = this._modelMatrix(front, basis, CURSOR_HALF, CURSOR_HALF);
    }

    for (const view of pose.views) {
      const vp = layer.getViewport(view);
      if (!vp) continue;
      gl.viewport(vp.x, vp.y, vp.width, vp.height);

      const viewProj = mul(view.projectionMatrix, view.transform.inverse.matrix);

      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.uniformMatrix4fv(this.uMVP, false, mul(viewProj, panelModel));
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      if (cursorModel) {
        gl.bindTexture(gl.TEXTURE_2D, this.cursorTex);
        gl.uniformMatrix4fv(this.uMVP, false, mul(viewProj, cursorModel));
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
    }
  }

  _cleanup() {
    if (!this.session) return;
    try {
      this.session.removeEventListener("select", this._onSelectBound);
      this.session.removeEventListener("selectstart", this._onSelectStart);
      this.session.removeEventListener("selectend", this._onSelectEnd);
    } catch (_) {}
    this.session = null;
    this.gl = null;
    this.refSpace = null;
    this.tex = this.cursorTex = this.prog = this.vbo = null;
    this.hudCanvas = this.hudCtx = null;
    this._rects = [];
    this._cursor = this._cursorWorld = null;
    this._placed = false;
    this.onEnd();
  }
}

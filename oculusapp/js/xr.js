/* WebXR passthrough session with a WebGL-rendered HUD.
 *
 * Goal: show the real world through the headset cameras (passthrough) with the
 * patient HUD floating on top — on Quest AND on PICO.
 *
 * Earlier this used the `dom-overlay` feature to draw the HTML HUD. PICO's browser
 * supports `immersive-ar` but NOT `dom-overlay`, so that path failed there. This
 * version needs no dom-overlay: the HUD is drawn with the Canvas 2D API
 * (hudcanvas.js), uploaded as a texture, and rendered on a head-locked quad in the
 * WebGL layer that composites over passthrough. The eye buffer is cleared fully
 * transparent so the real world shows through around the panel.
 *
 * Controller trigger / hand pinch fire the XR `select` event (onSelect).
 */

"use strict";

import { drawHud } from "./hudcanvas.js";

export async function passthroughSupported() {
  if (typeof navigator === "undefined" || !navigator.xr) return false;
  try {
    return await navigator.xr.isSessionSupported("immersive-ar");
  } catch (_) {
    return false;
  }
}

// HUD texture resolution and the physical size / distance of the panel.
const HUD_W = 1024, HUD_H = 872;
const HUD_DIST = 1.4;                     // metres in front of the viewer
const HUD_HALF_W = 0.55;                  // half-width in metres
const HUD_HALF_H = HUD_HALF_W * (HUD_H / HUD_W);

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

// column-major 4x4 multiply: returns a * b
function mul(a, b) {
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

// head-locked model matrix: scale to the panel size, push it -Z in view space
const MODEL = new Float32Array([
  HUD_HALF_W, 0, 0, 0,
  0, HUD_HALF_H, 0, 0,
  0, 0, 1, 0,
  0, 0, -HUD_DIST, 1,
]);

export class XRPassthrough {
  /**
   * @param {object} opts
   * @param {()=>void} [opts.onStart]
   * @param {()=>void} [opts.onEnd]
   * @param {(source:XRInputSource)=>void} [opts.onSelect]
   */
  constructor({ onStart, onEnd, onSelect } = {}) {
    this.onStart = onStart || (() => {});
    this.onEnd = onEnd || (() => {});
    this.onSelect = onSelect || (() => {});
    this.session = null;
    this.gl = null;
    this.refSpace = null;

    // HUD canvas + GL objects
    this.hudCanvas = null;
    this.hudCtx = null;
    this.tex = null;
    this.prog = null;
    this.vbo = null;
    this._texDirty = true;
    this._state = { kind: "scanning", hint: "" };

    this._onSelectBound = (ev) => this.onSelect(ev.inputSource);
    this._frameBound = (t, f) => this._onFrame(t, f);
  }

  get active() { return !!this.session; }

  async start() {
    if (this.session) return;
    if (typeof navigator === "undefined" || !navigator.xr) {
      throw new Error("WebXR steht in diesem Browser nicht zur Verfügung.");
    }

    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl", {
      xrCompatible: true, alpha: true, antialias: true, depth: false, stencil: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error("WebGL für die AR-Ebene nicht verfügbar.");

    // Request the session FIRST, while the button tap's user activation is live.
    // No dom-overlay: the HUD is rendered in WebGL, so PICO's browser (immersive-ar
    // without dom-overlay) is fully supported.
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
      .requestReferenceSpace("local")
      .catch(() => session.requestReferenceSpace("viewer"));

    this.gl = gl;
    this.session = session;
    this._initGL();
    this._draw();            // initial HUD (scanning state)

    session.addEventListener("select", this._onSelectBound);
    session.addEventListener("end", () => this._cleanup());

    this.onStart();
    session.requestAnimationFrame(this._frameBound);
  }

  // --- HUD state (called by the app) -----------------------------------

  /** state = {kind:"patient",patient} | {kind:"unknown",markerId} | {kind:"scanning",hint} */
  setState(state) {
    this._state = state || this._state;
    this._draw();
  }

  _draw() {
    if (!this.hudCtx) return;
    drawHud(this.hudCtx, HUD_W, HUD_H, this._state);
    this._texDirty = true;
  }

  // --- GL setup --------------------------------------------------------

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
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error("HUD-Shader fehlgeschlagen: " + gl.getProgramInfoLog(prog));
    }
    this.prog = prog;
    this.aPos = gl.getAttribLocation(prog, "aPos");
    this.aUV = gl.getAttribLocation(prog, "aUV");
    this.uMVP = gl.getUniformLocation(prog, "uMVP");
    this.uTex = gl.getUniformLocation(prog, "uTex");

    // two triangles: aPos in [-1,1], aUV in [0,1]
    const verts = new Float32Array([
      -1, -1, 0, 0,
       1, -1, 1, 0,
       1,  1, 1, 1,
      -1, -1, 0, 0,
       1,  1, 1, 1,
      -1,  1, 0, 1,
    ]);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  _shader(type, src) {
    const gl = this.gl;
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error("Shader-Compile-Fehler: " + gl.getShaderInfoLog(s));
    }
    return s;
  }

  _uploadTex() {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.hudCanvas);
    this._texDirty = false;
  }

  // --- frame loop ------------------------------------------------------

  _onFrame(_t, frame) {
    const session = this.session;
    if (!session) return;
    session.requestAnimationFrame(this._frameBound);

    const gl = this.gl;
    const layer = session.renderState.baseLayer;
    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
    gl.clearColor(0, 0, 0, 0);           // transparent → passthrough shows through
    gl.clear(gl.COLOR_BUFFER_BIT);

    const pose = frame.getViewerPose(this.refSpace);
    if (!pose) return;

    if (this._texDirty) this._uploadTex();

    gl.useProgram(this.prog);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);   // premultiplied alpha

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(this.aUV);
    gl.vertexAttribPointer(this.aUV, 2, gl.FLOAT, false, 16, 8);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(this.uTex, 0);

    for (const view of pose.views) {
      const vp = layer.getViewport(view);
      if (!vp) continue;
      gl.viewport(vp.x, vp.y, vp.width, vp.height);
      // head-locked: use each eye's projection, ignore the head pose transform
      gl.uniformMatrix4fv(this.uMVP, false, mul(view.projectionMatrix, MODEL));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }

  async end() {
    if (this.session) {
      try { await this.session.end(); } catch (_) { this._cleanup(); }
    }
  }

  _cleanup() {
    if (!this.session) return;
    try { this.session.removeEventListener("select", this._onSelectBound); } catch (_) {}
    this.session = null;
    this.gl = null;
    this.refSpace = null;
    this.tex = this.prog = this.vbo = null;
    this.hudCanvas = this.hudCtx = null;
    this.onEnd();
  }
}

/* WebXR-Passthrough als HUD: Randinformation am Blickfeld, Patientendaten im Raum.
 *
 * PICOs Browser kann `immersive-ar`, aber NICHT `dom-overlay`. Alles wird deshalb
 * mit der Canvas-2D-API gezeichnet (hudscreen.js), als Textur hochgeladen und auf
 * Rechtecke in der WebGL-Ebene gelegt. Der Augenpuffer wird vollständig
 * transparent gelöscht, damit rundherum die Wirklichkeit stehen bleibt.
 *
 * Drei Sorten von Rechtecken, bewusst unterschiedlich verankert:
 *
 *   HUD      kopffest, groß, in der Mitte leer — Zustand, Zählung, Lagekarte und
 *            Hinweis sitzen an den Rändern des Blickfelds. Nicht bedienbar.
 *   Karte    raumfest beim Patienten, dreht sich nur um die Hochachse zum
 *            Betrachter. Sie bleibt stehen, wo der Patient liegt — auch wenn man
 *            den Kopf wegdreht. Hier wird gezeigt und gepinched.
 *   Schilder raumfest an jedem Patienten in der Nähe: Nummer, Feld, Kategorie.
 *
 * Bedienung: jede Eingabequelle hat einen `targetRaySpace` — bei Händen der
 * Pinch-Strahl. Der Strahl wird mit der Ebene der Karte geschnitten, der Treffer
 * in Canvas-Pixel umgerechnet und mit den Knopf-Rechtecken verglichen, die
 * hudscreen.js zurückgibt. `select` (der abgeschlossene Pinch) löst aus.
 */

"use strict";

import { drawHudLayer, drawCard, drawTag, hitTest } from "./hudscreen.js";

export async function passthroughSupported() {
  if (typeof navigator === "undefined" || !navigator.xr) return false;
  try {
    return await navigator.xr.isSessionSupported("immersive-ar");
  } catch (_) {
    return false;
  }
}

// Kopffeste HUD-Ebene: breit genug, dass die Ecken wirklich am Rand sitzen.
const HUD_W = 1536, HUD_H = 864;
const HUD_DIST = 1.5;
const HUD_HALF_W = 1.10;
const HUD_HALF_H = HUD_HALF_W * (HUD_H / HUD_W);

// Raumfeste Handlungskarte beim Patienten.
const CARD_W = 900, CARD_H = 640;
const CARD_HALF_W = 0.43;
const CARD_HALF_H = CARD_HALF_W * (CARD_H / CARD_W);
const CARD_PLACE_DIST = 1.6;          // wenn es (noch) keinen Patienten gibt

// Raumfeste Schilder an den Patienten.
const TAG_W = 512, TAG_H = 176;
const TAG_HALF_W = 0.22;
const TAG_HALF_H = TAG_HALF_W * (TAG_H / TAG_W);
const TAG_LIFT = -0.15;               // Meter unter Augenhöhe

const CURSOR_PX = 64;
const CURSOR_HALF = 0.014;

const HUD_REDRAW_MS = 150;            // die Karte zeigt die eigene Position live

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

/** Gierwinkel, sodass die Normale des Rechtecks auf `toward` zeigt. */
function faceYaw(pos, toward) {
  return Math.atan2(toward.x - pos.x, toward.z - pos.z);
}

// kopffest: fest im Sichtraum, -Z vor dem Auge
const HUD_MODEL = new Float32Array([
  HUD_HALF_W, 0, 0, 0,
  0, HUD_HALF_H, 0, 0,
  0, 0, 1, 0,
  0, 0, -HUD_DIST, 1,
]);

/* --------------------------------------------------------------- Sitzung */

export class XRPassthrough {
  /**
   * @param {object} opts
   * @param {()=>void}        [opts.onStart]
   * @param {()=>void}        [opts.onEnd]
   * @param {(pos,fwd)=>void} [opts.onPose]   Kopfpose je Frame (Nähe-Erkennung)
   * @param {()=>void}        [opts.onFrame]  je Frame, nach der Pose
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
    this._tags = [];
    this._anchor = null;                   // Weltposition des Zielpatienten

    this._rects = [];
    this._hover = -1;
    this._pinching = false;
    this._cardDirty = true;
    this._hudDirty = true;
    this._hudDrawnAt = 0;

    this._placed = null;                   // Ersatzpose, wenn kein Patient da ist
    this._tagTex = new Map();              // id → {tex, key}

    this._frameBound = (t, f) => this._onFrame(t, f);
    this._onSelectBound = () => this._activate();
    this._onSelectStart = () => { this._pinching = true; };
    this._onSelectEnd = () => { this._pinching = false; };
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

  /**
   * @param {object|null} screen  neuer Schirm (null = unverändert)
   * @param {object|null} map     neue Kartendaten
   * @param {Array|null}  tags    raumfeste Patientenschilder
   * @param {object|null} anchor  Weltposition des Zielpatienten für die Karte
   */
  setContent(screen, map, tags, anchor) {
    if (screen) { this._screen = screen; this._cardDirty = true; this._hudDirty = true; }
    if (map) { this._map = map; this._hudDirty = true; }
    if (tags) this._tags = tags;
    if (anchor !== undefined) this._anchor = anchor;
  }

  /** Karte neu setzen, wenn es (noch) keinen Patienten im Raum gibt. */
  recenter() { this._placed = null; }

  async end() {
    if (this.session) {
      try { await this.session.end(); } catch (_) { this._cleanup(); }
    }
  }

  /* --------------------------------------------------------------- GL */

  _initGL() {
    const gl = this.gl;

    this.hudCanvas = this._canvas(HUD_W, HUD_H);
    this.cardCanvas = this._canvas(CARD_W, CARD_H);
    this.tagCanvas = this._canvas(TAG_W, TAG_H);

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

    this.hudTex = this._texture();
    this.cardTex = this._texture();
    this.cursorTex = this._texture();
    this._uploadCursor();
  }

  _canvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    return { el: c, ctx: c.getContext("2d") };
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

  _upload(tex, canvas) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  }

  _uploadCursor() {
    const c = document.createElement("canvas");
    c.width = c.height = CURSOR_PX;
    const g = c.getContext("2d");
    const r = CURSOR_PX / 2;
    g.strokeStyle = "rgba(255,255,255,0.9)";
    g.lineWidth = 3;
    g.beginPath(); g.arc(r, r, r - 5, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#ffffff";
    g.beginPath(); g.arc(r, r, 6, 0, Math.PI * 2); g.fill();
    this._upload(this.cursorTex, c);
  }

  /** Schilder ändern sich selten — Textur nur bei geändertem Inhalt neu. */
  _tagTexture(tag) {
    const key = `${tag.id}|${tag.short}|${tag.sighted}|${tag.cell}`;
    let entry = this._tagTex.get(tag.id);
    if (!entry) {
      entry = { tex: this._texture(), key: null };
      this._tagTex.set(tag.id, entry);
    }
    if (entry.key !== key) {
      drawTag(this.tagCanvas.ctx, TAG_W, TAG_H, tag);
      this._upload(entry.tex, this.tagCanvas.el);
      entry.key = key;
    }
    return entry.tex;
  }

  /* ------------------------------------------------------ Posen im Raum */

  _basis(yaw) {
    const s = Math.sin(yaw), c = Math.cos(yaw);
    return {
      right: { x: c, y: 0, z: -s },
      up: { x: 0, y: 1, z: 0 },
      normal: { x: s, y: 0, z: c },
    };
  }

  _model(pos, basis, halfW, halfH) {
    return new Float32Array([
      basis.right.x * halfW, basis.right.y * halfW, basis.right.z * halfW, 0,
      basis.up.x * halfH, basis.up.y * halfH, basis.up.z * halfH, 0,
      basis.normal.x, basis.normal.y, basis.normal.z, 0,
      pos.x, pos.y, pos.z, 1,
    ]);
  }

  /** Wo die Handlungskarte steht: beim Patienten, sonst einmal vor dem Träger. */
  _cardPose(head) {
    if (this._anchor) return this._anchor;
    if (!this._placed) {
      const fwd = flatten(forwardOf(head));
      this._placed = add3(head.position, add3(scale3(fwd, CARD_PLACE_DIST), { x: 0, y: -0.1, z: 0 }));
    }
    return this._placed;
  }

  /* --------------------------------------------------------------- Zeigen */

  _updatePointer(frame, cardPos, cardBasis) {
    let best = null;

    for (const src of this.session.inputSources) {
      if (!src.targetRaySpace) continue;
      const pose = frame.getPose(src.targetRaySpace, this.refSpace);
      if (!pose) continue;

      const origin = pose.transform.position;
      const dir = forwardOf(pose.transform);

      const denom = dot3(cardBasis.normal, dir);
      if (Math.abs(denom) < 1e-5) continue;
      const dist = dot3(cardBasis.normal, sub(cardPos, origin)) / denom;
      if (dist < 0.05 || dist > 8) continue;

      const hit = add3(origin, scale3(dir, dist));
      const rel = sub(hit, cardPos);
      const u = dot3(rel, cardBasis.right) / CARD_HALF_W;
      const v = dot3(rel, cardBasis.up) / CARD_HALF_H;
      if (u < -1 || u > 1 || v < -1 || v > 1) continue;

      if (!best || dist < best.dist)
        best = { dist, hit, px: ((u + 1) / 2) * CARD_W, py: ((1 - v) / 2) * CARD_H };
    }

    const hover = best ? hitTest(this._rects, best.px, best.py) : -1;
    if (hover !== this._hover) { this._hover = hover; this._cardDirty = true; }
    this._cursorWorld = best ? best.hit : null;
  }

  _activate() {
    if (this._hover < 0) return;
    const b = (this._screen.buttons || [])[this._hover];
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
    gl.clearColor(0, 0, 0, 0);             // durchsichtig → Passthrough bleibt
    gl.clear(gl.COLOR_BUFFER_BIT);

    const pose = frame.getViewerPose(this.refSpace);
    if (!pose) return;

    const head = pose.transform;
    this.onPose(head.position, flatten(forwardOf(head)));
    this.onFrame();

    const cardPos = this._cardPose(head);
    const cardBasis = this._basis(faceYaw(cardPos, head.position));
    this._updatePointer(frame, cardPos, cardBasis);

    if (this._cardDirty) {
      this._rects = drawCard(this.cardCanvas.ctx, CARD_W, CARD_H, this._screen, { hover: this._hover });
      this._upload(this.cardTex, this.cardCanvas.el);
      this._cardDirty = false;
    }
    if (this._hudDirty || performance.now() - this._hudDrawnAt > HUD_REDRAW_MS) {
      drawHudLayer(this.hudCanvas.ctx, HUD_W, HUD_H, this._screen, this._map);
      this._upload(this.hudTex, this.hudCanvas.el);
      this._hudDirty = false;
      this._hudDrawnAt = performance.now();
    }

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

    const cardModel = this._model(cardPos, cardBasis, CARD_HALF_W, CARD_HALF_H);

    // Schilder: raumfest an den Patienten, nur um die Hochachse gedreht.
    const tagDraws = [];
    for (const tag of this._tags) {
      if (tag.target) continue;            // dort steht schon die Karte
      const pos = { x: tag.pos.x, y: tag.pos.y + TAG_LIFT, z: tag.pos.z };
      const basis = this._basis(faceYaw(pos, head.position));
      tagDraws.push({ tex: this._tagTexture(tag), model: this._model(pos, basis, TAG_HALF_W, TAG_HALF_H) });
    }

    let cursorModel = null;
    if (this._cursorWorld) {
      const front = add3(this._cursorWorld, scale3(cardBasis.normal, 0.004));
      cursorModel = this._model(front, cardBasis, CURSOR_HALF, CURSOR_HALF);
    }

    for (const view of pose.views) {
      const vp = layer.getViewport(view);
      if (!vp) continue;
      gl.viewport(vp.x, vp.y, vp.width, vp.height);
      const viewProj = mul(view.projectionMatrix, view.transform.inverse.matrix);

      // Randinformation zuerst, damit alles Raumfeste darüber liegt.
      gl.bindTexture(gl.TEXTURE_2D, this.hudTex);
      gl.uniformMatrix4fv(this.uMVP, false, mul(view.projectionMatrix, HUD_MODEL));
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      for (const t of tagDraws) {
        gl.bindTexture(gl.TEXTURE_2D, t.tex);
        gl.uniformMatrix4fv(this.uMVP, false, mul(viewProj, t.model));
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

      gl.bindTexture(gl.TEXTURE_2D, this.cardTex);
      gl.uniformMatrix4fv(this.uMVP, false, mul(viewProj, cardModel));
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
    this.hudTex = this.cardTex = this.cursorTex = this.prog = this.vbo = null;
    this.hudCanvas = this.cardCanvas = this.tagCanvas = null;
    this._tagTex.clear();
    this._rects = [];
    this._cursorWorld = null;
    this._placed = null;
    this.onEnd();
  }
}

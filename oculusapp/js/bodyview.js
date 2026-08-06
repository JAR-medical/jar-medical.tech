/* Das Körpermodell zeichnen — einmal geschrieben, zweimal benutzt.
 *
 *   BodyMesh  Programm und Puffer für einen beliebigen WebGL-Kontext. In der
 *             Brille (xr.js) hängt das Modell raumfest am Patienten und wird in
 *             beide Augen gezeichnet; die Klasse weiß davon nichts, sie bekommt
 *             fertige Matrizen.
 *   BodyView  dasselbe Netz flach auf einer eigenen Canvas, mit Maus oder
 *             Finger drehbar — für Kamera-Modus und Simulation.
 *
 * Anders als alles andere in dieser App wird hier mit Tiefentest gezeichnet:
 * ein Körper ist ein Volumen, kein Bild auf einer Scheibe.
 */

"use strict";

import { buildMesh, pickRegion, regionColor, REGIONS } from "./body.js";

const VERT = `
  attribute vec3 aPos;
  attribute vec3 aNrm;
  uniform mat4 uMVP;
  uniform mat4 uModel;
  varying float vShade;
  void main() {
    // w = 0 laesst die Verschiebung weg, normalize nimmt die gleichmaessige
    // Skalierung heraus. Bewusst nicht mat3(uModel): nicht jede GLSL-ES-1.0-
    // Umsetzung baut Matrizen aus Matrizen.
    vec3 n = normalize((uModel * vec4(aNrm, 0.0)).xyz);
    float d = max(0.0, dot(n, normalize(vec3(0.35, 0.85, 0.40))));
    vShade = 0.40 + 0.60 * d;
    gl_Position = uMVP * vec4(aPos, 1.0);
  }
`;

// Vormultipliziertes Alpha — dieselbe Mischung wie die Bildebenen (ONE,
// ONE_MINUS_SRC_ALPHA), sonst säße der Körper in einem grauen Kasten.
const FRAG = `
  precision mediump float;
  uniform vec4 uColor;
  varying float vShade;
  void main() {
    gl_FragColor = vec4(uColor.rgb * vShade * uColor.a, uColor.a);
  }
`;

function shader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error("Körpermodell-Shader: " + gl.getShaderInfoLog(s));
  return s;
}

export class BodyMesh {
  constructor(gl) {
    this.gl = gl;
    const prog = gl.createProgram();
    gl.attachShader(prog, shader(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, shader(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
      throw new Error("Körpermodell-Programm: " + gl.getProgramInfoLog(prog));

    this.prog = prog;
    this.aPos = gl.getAttribLocation(prog, "aPos");
    this.aNrm = gl.getAttribLocation(prog, "aNrm");
    this.uMVP = gl.getUniformLocation(prog, "uMVP");
    this.uModel = gl.getUniformLocation(prog, "uModel");
    this.uColor = gl.getUniformLocation(prog, "uColor");

    const mesh = buildMesh();
    this.ranges = mesh.ranges;
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.data, gl.STATIC_DRAW);
  }

  /**
   * Eine Ansicht zeichnen. Der Aufrufer hat Blenden und Ansichtsfenster schon
   * gesetzt; Tiefentest und Attributzeiger richtet diese Methode selbst ein und
   * gibt sie danach wieder frei, weil der Rest der Anwendung ohne Tiefe zeichnet.
   *
   * @param {Float32Array} mvp    Projektion · Ansicht · Modell
   * @param {Float32Array} model  Modell → Welt (nur für die Beleuchtung)
   * @param {object} findings     {regionId: [Befund, …]}
   */
  draw(mvp, model, findings, hover = null, active = null, alpha = 0.95) {
    const gl = this.gl;

    gl.useProgram(this.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(this.aNrm);
    gl.vertexAttribPointer(this.aNrm, 3, gl.FLOAT, false, 24, 12);

    gl.uniformMatrix4fv(this.uMVP, false, mvp);
    gl.uniformMatrix4fv(this.uModel, false, model);

    // Tiefe UND Rückseitenschnitt: sollte eine Umsetzung dem XR-Puffer keine
    // Tiefe mitgeben, hält allein das Wegschneiden der Rückseiten die Quader
    // noch richtig zusammen.
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);

    for (const r of this.ranges) {
      const c = regionColor(r.id, findings, hover, active);
      gl.uniform4f(this.uColor, c[0], c[1], c[2], alpha);
      gl.drawArrays(gl.TRIANGLES, r.start, r.count);
    }

    gl.disable(gl.CULL_FACE);          // die Bildebenen werden beidseitig gesehen
    gl.disable(gl.DEPTH_TEST);
    gl.disableVertexAttribArray(this.aNrm);
  }

  dispose() {
    const gl = this.gl;
    if (!gl) return;
    gl.deleteBuffer(this.vbo);
    gl.deleteProgram(this.prog);
    this.gl = null;
  }
}

/* ------------------------------------------------------------ flache Sicht */

const rad = (d) => (d * Math.PI) / 180;

const FOV = rad(32);
const DIST = 2.05;        // Auge vor dem Modell
const PIVOT = 0.5;        // Drehpunkt auf Brusthöhe (Modell ist 1,0 hoch)

function perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const o = new Float32Array(16);
  o[0] = f / aspect; o[5] = f; o[11] = -1;
  o[10] = (far + near) / (near - far);
  o[14] = (2 * far * near) / (near - far);
  return o;
}

/** Spaltenweise 4x4: a · b. */
function mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      o[c * 4 + r] = a[0 * 4 + r] * b[c * 4 + 0] + a[1 * 4 + r] * b[c * 4 + 1] +
                     a[2 * 4 + r] * b[c * 4 + 2] + a[3 * 4 + r] * b[c * 4 + 3];
  return o;
}

function rotY(a) {
  const s = Math.sin(a), c = Math.cos(a);
  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
}

function rotX(a) {
  const s = Math.sin(a), c = Math.cos(a);
  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
}

function translate(x, y, z) {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
}

/**
 * Das Modell flach auf einer eigenen Canvas — dieselben Maße, dieselben
 * Regionen, mit Maus oder Finger drehbar. Ein Klick, der keine Drehung war,
 * meldet die getroffene Region.
 */
export class BodyView {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {(regionId: string) => void} onPick
   */
  constructor(canvas, onPick = () => {}) {
    this.canvas = canvas;
    this.onPick = onPick;
    this.yaw = 0;
    this.pitch = 0;
    this.findings = {};
    this.hover = null;
    this.active = null;

    const gl = canvas.getContext("webgl", { alpha: true, antialias: true, depth: true });
    if (!gl) { this.gl = null; return; }        // ohne WebGL bleibt die Fläche leer
    this.gl = gl;
    this.mesh = new BodyMesh(gl);

    this._drag = null;
    this._moved = 0;
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", (e) => this._down(e));
    canvas.addEventListener("pointermove", (e) => this._move(e));
    canvas.addEventListener("pointerup", (e) => this._up(e));
    canvas.addEventListener("pointercancel", () => { this._drag = null; });
  }

  get available() { return !!this.gl; }

  setFindings(findings, active = null) {
    this.findings = findings || {};
    this.active = active;
    this.render();
  }

  _down(e) {
    this._drag = { x: e.clientX, y: e.clientY };
    this._moved = 0;
    this.canvas.setPointerCapture(e.pointerId);
  }

  _move(e) {
    const r = this.canvas.getBoundingClientRect();
    if (this._drag) {
      const dx = e.clientX - this._drag.x, dy = e.clientY - this._drag.y;
      this._drag = { x: e.clientX, y: e.clientY };
      this._moved += Math.abs(dx) + Math.abs(dy);
      this.yaw += dx * 0.012;
      this.pitch = Math.max(-0.7, Math.min(0.7, this.pitch + dy * 0.008));
    }
    const hit = this._pickAt(e.clientX - r.left, e.clientY - r.top);
    this.hover = hit ? hit.id : null;
    this.render();
  }

  _up(e) {
    const wasDrag = this._moved > 6;
    this._drag = null;
    try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    if (wasDrag) return;                       // gedreht, nicht gewählt
    const r = this.canvas.getBoundingClientRect();
    const hit = this._pickAt(e.clientX - r.left, e.clientY - r.top);
    if (hit) this.onPick(hit.id);
  }

  /** Bildpunkt → Strahl im Modellraum → Region. */
  _pickAt(px, py) {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    if (px < 0 || py < 0 || px > w || py > h) return null;

    const tan = Math.tan(FOV / 2);
    const dir = {
      x: ((px / w) * 2 - 1) * tan * (w / h),
      y: (1 - (py / h) * 2) * tan,
      z: -1,
    };
    const eye = { x: 0, y: PIVOT, z: DIST };
    return pickRegion(this._toModel(eye, true), this._toModel(dir, false));
  }

  /**
   * Welt → Modellraum. Das Modell steht als T(Pivot)·RotY(yaw)·RotX(pitch)·T(−Pivot)
   * im Raum; umgekehrt heißt das: um den Pivot zurückschieben, Drehung
   * zurücknehmen, Neigung zurücknehmen. Die Achsen sind orthonormal, deshalb
   * reicht das Zurückdrehen — keine Matrixinversion nötig.
   */
  _toModel(v, isPoint) {
    const x0 = v.x;
    const y0 = isPoint ? v.y - PIVOT : v.y;
    const z0 = v.z;

    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const x1 = x0 * cy - z0 * sy;
    const z1 = x0 * sy + z0 * cy;

    const cx = Math.cos(this.pitch), sx = Math.sin(this.pitch);
    const y2 = y0 * cx + z1 * sx;
    const z2 = -y0 * sx + z1 * cx;

    return { x: x1, y: isPoint ? y2 + PIVOT : y2, z: z2 };
  }

  /** Modell → Welt, gedreht um die Brusthöhe. */
  _model() {
    return mul(mul(translate(0, PIVOT, 0), mul(rotY(this.yaw), rotX(this.pitch))),
               translate(0, -PIVOT, 0));
  }

  render() {
    const gl = this.gl;
    if (!gl) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round((this.canvas.clientWidth || 200) * dpr));
    const h = Math.max(1, Math.round((this.canvas.clientHeight || 260) * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; this.canvas.height = h;
    }

    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const proj = perspective(FOV, w / h, 0.05, 20);
    const view = translate(0, -PIVOT, -DIST);      // Auge auf (0, PIVOT, DIST)
    const model = this._model();

    this.mesh.draw(mul(proj, mul(view, model)), model,
                   this.findings, this.hover, this.active);
  }

  dispose() {
    if (this.mesh) this.mesh.dispose();
    this.gl = null;
  }
}

export { REGIONS };

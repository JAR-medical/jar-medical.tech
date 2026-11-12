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

import { buildMesh, pickRegion, regionColor, REGIONS, MESH_URL } from "./body.js";
import { Spring, Decay, VelocityTracker, SPRINGS, clampRubber } from "./motion.js";

/* ------------------------------------------------------- das echte Netz
 *
 * `assets/body/` enthält das MakeHuman-Basisnetz, zerlegt in dieselben dreizehn
 * Regionen (siehe make_body.py). Es wird **einmal je Sitzung** geladen und von
 * allen Ansichten geteilt — in der Brille steht es an jedem Patienten, flach
 * einmal im Ablaufschirm.
 *
 * Solange es nicht da ist (oder gar nicht kommt), zeichnen alle Ansichten die
 * Quader aus body.js. Ein fehlendes Netz darf den Einsatz nicht aufhalten.
 */

let meshPromise = null;

/**
 * @returns {Promise<{data: Float32Array, index: Uint16Array,
 *                    ranges: Array<{id,start,count}>}|null>}
 */
export function loadBodyMesh(base = "") {
  if (meshPromise) return meshPromise;
  meshPromise = (async () => {
    const url = base + MESH_URL;
    const meta = await fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      return r.json();
    });
    const buf = await fetch(url.replace(/\.json$/, ".bin")).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      return r.arrayBuffer();
    });
    const data = new Float32Array(buf, 0, meta.vertices * 6);
    const index = new Uint16Array(buf, meta.vertexBytes, meta.indices);
    return { data, index, ranges: meta.ranges };
  })().catch((err) => {
    console.warn("[JAR] Körpernetz nicht geladen, zeichne Quader:", err.message);
    return null;
  });
  return meshPromise;
}

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

    // Notbehelf sofort: die Quader aus body.js. Sie werden ersetzt, sobald das
    // echte Netz da ist — so steht von der ersten Sekunde an ein Körper da.
    const boxes = buildMesh();
    this.ranges = boxes.ranges;
    this.indexed = false;
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, boxes.data, gl.STATIC_DRAW);
    this.ibo = null;
    this.total = 0;
  }

  /** Das geladene Netz übernehmen. Vorher gezeichnete Quader fallen weg. */
  useMesh(mesh) {
    if (!mesh || !this.gl) return false;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.data, gl.STATIC_DRAW);
    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.index, gl.STATIC_DRAW);
    this.ranges = mesh.ranges;
    this.total = mesh.index.length;
    this.indexed = true;
    return true;
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
  draw(mvp, model, findings, hover = null, active = null, opts = {}) {
    const gl = this.gl;
    const alpha = opts.alpha == null ? 0.95 : opts.alpha;
    const base = opts.base || null;      // Grundfarbe statt Hautton (Sichtungsfarbe)

    gl.useProgram(this.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(this.aNrm);
    gl.vertexAttribPointer(this.aNrm, 3, gl.FLOAT, false, 24, 12);
    if (this.indexed) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);

    gl.uniformMatrix4fv(this.uMVP, false, mvp);
    gl.uniformMatrix4fv(this.uModel, false, model);

    // Tiefe UND Rückseitenschnitt: sollte eine Umsetzung dem XR-Puffer keine
    // Tiefe mitgeben, hält allein das Wegschneiden der Rückseiten den Körper
    // noch richtig zusammen.
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);

    // Ist überall dieselbe Farbe fällig — der Normalfall bei den kleinen
    // Figuren über den Markern —, geht das ganze Netz in einem Zug raus.
    const plain = this.indexed && !hover && !active &&
                  !(findings && Object.keys(findings).length);
    if (plain) {
      const c = base || regionColor(null, null, null, null);
      gl.uniform4f(this.uColor, c[0], c[1], c[2], alpha);
      gl.drawElements(gl.TRIANGLES, this.total, gl.UNSIGNED_SHORT, 0);
    } else {
      for (const r of this.ranges) {
        const c = regionColor(r.id, findings, hover, active, base);
        gl.uniform4f(this.uColor, c[0], c[1], c[2], alpha);
        if (this.indexed) gl.drawElements(gl.TRIANGLES, r.count, gl.UNSIGNED_SHORT, r.start * 2);
        else gl.drawArrays(gl.TRIANGLES, r.start, r.count);
      }
    }

    gl.disable(gl.CULL_FACE);          // die Bildebenen werden beidseitig gesehen
    gl.disable(gl.DEPTH_TEST);
    gl.disableVertexAttribArray(this.aNrm);
  }

  dispose() {
    const gl = this.gl;
    if (!gl) return;
    gl.deleteBuffer(this.vbo);
    if (this.ibo) gl.deleteBuffer(this.ibo);
    gl.deleteProgram(this.prog);
    this.gl = null;
  }
}

/* ------------------------------------------------------------ flache Sicht */

const rad = (d) => (d * Math.PI) / 180;

const FOV = rad(32);
const DIST = 2.05;        // Auge vor dem Modell
const PIVOT = 0.5;        // Drehpunkt auf Brusthöhe (Modell ist 1,0 hoch)
const PITCH_LIMIT = 0.7;  // rad, ab da gibt die Neigung nach
const DRAG_SLOP = 6;      // px, ab da war es ein Drehen und kein Antippen
const FLING_MIN = 0.6;    // rad/s, darunter war es kein Anstoßen

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

    // Bis das Netz da ist, stehen die Quader — danach der Mensch.
    loadBodyMesh().then((m) => {
      if (m && this.mesh && this.mesh.useMesh(m)) this.render();
    });

    this._drag = null;
    this._moved = 0;
    this._pitchRaw = 0;
    this._spin = new Decay(0);                 // Nachlauf nach einem Anstoßen
    this._pitchSpring = new Spring(0, SPRINGS.rotate);
    this._yawVel = new VelocityTracker(120);
    this._pitchVel = new VelocityTracker(120);
    this._raf = 0;
    this._pressed = false;

    // `setPointerCapture` im pointerdown: ohne das endet das Ziehen, sobald der
    // Zeiger die kleine Fläche verlässt — und sie ist 132 px breit, das
    // passiert bei jeder zügigen Drehung.
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", (e) => this._down(e));
    canvas.addEventListener("pointermove", (e) => this._move(e));
    canvas.addEventListener("pointerup", (e) => this._up(e));
    canvas.addEventListener("pointercancel", () => this._release(null));
  }

  get available() { return !!this.gl; }

  setFindings(findings, active = null) {
    this.findings = findings || {};
    this.active = active;
    this.render();
  }

  _down(e) {
    // Ein laufender Nachlauf endet mit dem Zugreifen, an Ort und Stelle.
    this._spin.velocity = 0;
    this._pitchSpring.reset(this.pitch);
    this._pitchRaw = this.pitch;

    this._drag = { x: e.clientX, y: e.clientY };
    this._moved = 0;
    // Rückmeldung im Moment des Drückens, nicht erst beim Loslassen. Als
    // Klasse und nicht als `:active`, weil der Zeiger eingefangen wird und die
    // Fläche dabei verlassen darf — `:active` fiele dann weg.
    this._pressed = true;
    this.canvas.classList.add("greifend");
    this._yawVel.reset().add(this.yaw, e.timeStamp);
    this._pitchVel.reset().add(this.pitch, e.timeStamp);
    try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
    this.render();
  }

  _move(e) {
    const r = this.canvas.getBoundingClientRect();
    if (this._drag) {
      const dx = e.clientX - this._drag.x, dy = e.clientY - this._drag.y;
      this._drag = { x: e.clientX, y: e.clientY };
      this._moved += Math.abs(dx) + Math.abs(dy);
      this.yaw += dx * 0.012;
      // Nachgebender Anschlag statt hartem: über die Grenze hinaus geht es
      // noch, aber immer weniger weit.
      this._pitchRaw += dy * 0.008;
      this.pitch = clampRubber(this._pitchRaw, -PITCH_LIMIT, PITCH_LIMIT);
      this._yawVel.add(this.yaw, e.timeStamp);
      this._pitchVel.add(this.pitch, e.timeStamp);
    }
    const hit = this._pickAt(e.clientX - r.left, e.clientY - r.top);
    this.hover = hit ? hit.id : null;
    this.render();
  }

  _up(e) {
    const wasDrag = this._moved > DRAG_SLOP;
    this._release(e);
    try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    if (wasDrag) return;                       // gedreht, nicht gewählt
    const r = this.canvas.getBoundingClientRect();
    const hit = this._pickAt(e.clientX - r.left, e.clientY - r.top);
    if (hit) this.onPick(hit.id);
  }

  /**
   * Loslassen. Die Drehung läuft mit **genau der Geschwindigkeit weiter**, mit
   * der der Finger aufgehört hat — ohne diese Übergabe stünde das Modell im
   * Moment des Loslassens still, und die Naht zwischen Ziehen und Weiterlaufen
   * ist genau das, was eine Anzeige billig wirken lässt.
   */
  _release(e) {
    if (!this._drag) { this._pressed = false; this.canvas.classList.remove("greifend"); this.render(); return; }
    this._drag = null;
    this._pressed = false;
    this.canvas.classList.remove("greifend");

    const now = e ? e.timeStamp : (typeof performance !== "undefined" ? performance.now() : 0);
    const v = this._yawVel.velocity(now);
    this._spin.velocity = Math.abs(v) > FLING_MIN ? v : 0;

    this._pitchSpring.reset(this.pitch)
      .to(Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this._pitchRaw)))
      .handoff(this._pitchVel.velocity(now));

    this._tick();
  }

  /**
   * Solange etwas nachläuft, wird Bild für Bild weitergerechnet — und nur
   * solange. Eine Dauerschleife für eine Fläche, die meistens stillsteht, wäre
   * auf einem Headset verschenkte Rechenzeit.
   */
  _tick() {
    if (this._raf) return;
    let last = 0;
    const frame = (t) => {
      this._raf = 0;
      const dt = last ? Math.min(0.1, (t - last) / 1000) : 0.016;
      last = t;

      if (!this._drag) {
        this.yaw += this._spin.step(dt);
        if (!this._pitchSpring.settled()) {
          this.pitch = this._pitchSpring.step(dt);
          this._pitchRaw = this.pitch;
        }
      }
      this.render();
      if (!this._drag && (!this._spin.done || !this._pitchSpring.settled()))
        this._raf = requestAnimationFrame(frame);
    };
    this._raf = requestAnimationFrame(frame);
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
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }
    if (this.mesh) this.mesh.dispose();
    this.gl = null;
  }
}

export { REGIONS };

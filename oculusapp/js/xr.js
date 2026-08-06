/* WebXR-Passthrough als HUD: Randinformation am Blickfeld, Patientendaten im Raum.
 *
 * PICOs Browser kann `immersive-ar`, aber NICHT `dom-overlay`. Alles wird deshalb
 * mit der Canvas-2D-API gezeichnet (hudscreen.js), als Textur hochgeladen und auf
 * Rechtecke in der WebGL-Ebene gelegt. Der Augenpuffer wird vollständig
 * transparent gelöscht, damit rundherum die Wirklichkeit stehen bleibt.
 *
 * Drei Sorten Rechtecke, bewusst unterschiedlich verankert:
 *
 *   HUD      steht still, bis der Blick eine große Schwelle überschreitet (40°) —
 *            dann zieht es einmal um und steht wieder. Man kann also frei
 *            herumschauen, ohne dass es mitschwimmt. Randinformation, nicht
 *            bedienbar.
 *   Karte    raumfest beim Patienten, dreht sich nur zum Betrachter. Sie bleibt
 *            stehen, wo der Patient liegt. Hier wird gezeigt und ausgelöst.
 *   Schilder raumfest an jedem Patienten in der Nähe.
 *
 * Bedienung:
 *   Controller und Hände zeigen über ihren `targetRaySpace`, sichtbar als
 *   Strahl. Der PICO-Browser stellt WebXR-Handtracking nicht bereit — dort
 *   übernimmt der **Blick** als Zeiger, mit Fadenkreuz in der Blickmitte.
 *   Ausgelöst wird durch `select` (Pinch/Trigger) oder, solange nie ein
 *   `select` ankam, durch Verweilen auf einem Knopf.
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

// Kopfnahes HUD: nah genug, dass die Ränder ohne Kopfdrehen lesbar sind.
const HUD_W = 1536, HUD_H = 864;
const HUD_DIST = 0.95;
const HUD_HALF_W = 0.82;                 // ≈ 82° Breite
const HUD_HALF_H = HUD_HALF_W * (HUD_H / HUD_W);
// Das HUD steht still, bis der Blick weit genug abgewandert ist — dann zieht es
// einmal um und steht wieder. Kein Mitschwimmen dazwischen.
const HUD_LEASH = 40 * Math.PI / 180;    // so weit darf der Blick wandern
const HUD_MOVE_TAU = 0.16;               // wie schnell es dann umzieht
const HUD_ARRIVED = 1.5 * Math.PI / 180; // ab hier gilt der Umzug als beendet

// Pinch aus den Fingergelenken: Schwellen mit Hysterese, damit es nicht flattert.
const PINCH_ON = 0.028;                  // Meter zwischen Daumen- und Zeigefingerspitze
const PINCH_OFF = 0.045;

// Raumfeste Handlungskarte beim Patienten.
const CARD_W = 900, CARD_H = 640;
const CARD_HALF_W = 0.56;
const CARD_HALF_H = CARD_HALF_W * (CARD_H / CARD_W);
const CARD_PLACE_DIST = 1.25;
const CARD_VIEW_CONE = 45 * Math.PI / 180;   // so weit darf sie aus dem Blick sein
const CARD_RECALL_S = 1.2;                   // danach wird sie herangeholt

// Raumfeste Schilder an den Patienten.
const TAG_W = 512, TAG_H = 176;
const TAG_HALF_W = 0.30;
const TAG_HALF_H = TAG_HALF_W * (TAG_H / TAG_W);
const TAG_LIFT = -0.15;
const TAG_RANGE = 9;                     // Meter

const CURSOR_PX = 64;
const CURSOR_HALF = 0.018;

const BEAM_HALF_W = 0.004;               // Meter, halbe Strahlbreite
const BEAM_LEN = 1.6;                    // Länge, wenn der Strahl nichts trifft

const DWELL_MS = 1100;                   // Verweilen als Ersatz für den Pinch
const HUD_REDRAW_MS = 150;

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
const add3 = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale3 = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const dot3 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross3 = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
function norm3(v) {
  const l = Math.hypot(v.x, v.y, v.z);
  return l < 1e-6 ? { x: 0, y: 0, z: -1 } : { x: v.x / l, y: v.y / l, z: v.z / l };
}

/** Blickrichtung (-Z) aus einer XRRigidTransform. */
function forwardOf(transform) {
  const m = transform.matrix;              // spaltenweise
  return { x: -m[8], y: -m[9], z: -m[10] };
}

function flatten(v) {
  const len = Math.hypot(v.x, v.z);
  return len < 1e-4 ? { x: 0, y: 0, z: -1 } : { x: v.x / len, y: 0, z: v.z / len };
}

/** Basis für ein Rechteck, dessen Normale `n` ist (Welt-Oben als Hilfsachse). */
function basisFromNormal(n) {
  const normal = norm3(n);
  let right = cross3({ x: 0, y: 1, z: 0 }, normal);
  if (Math.hypot(right.x, right.y, right.z) < 1e-4) right = { x: 1, y: 0, z: 0 };
  right = norm3(right);
  const up = cross3(normal, right);
  return { right, up, normal };
}

/** Gierbasis: Rechteck steht senkrecht und dreht sich nur zum Betrachter. */
function basisFacing(pos, viewer) {
  const yaw = Math.atan2(viewer.x - pos.x, viewer.z - pos.z);
  const s = Math.sin(yaw), c = Math.cos(yaw);
  return { right: { x: c, y: 0, z: -s }, up: { x: 0, y: 1, z: 0 }, normal: { x: s, y: 0, z: c } };
}

/* --------------------------------------------------------------- Sitzung */

export class XRPassthrough {
  constructor({ onStart, onEnd, onPose, onFrame } = {}) {
    this.onStart = onStart || (() => {});
    this.onEnd = onEnd || (() => {});
    this.onPose = onPose || (() => {});
    this.onFrame = onFrame || (() => {});

    this.session = null;
    this.gl = null;
    this.refSpace = null;

    this._screen = { title: "J.A.R.", headline: "", hint: "", body: [], buttons: [], status: "" };
    this._map = { dots: [], medic: null, spanMeters: 8,
                  counts: { SK1: 0, SK2: 0, SK3: 0, SK4: 0, DECEASED: 0, UNSIGHTED: 0,
                            total: 0, ohneKarte: 0 },
                  footer: "", hint: "" };
    this._tags = [];
    this._anchor = null;

    this._rects = [];
    this._hover = -1;
    this._hoverSince = 0;
    this._dwell = 0;
    this._pinching = false;
    this._cardDirty = true;
    this._hudDirty = true;
    this._hudDrawnAt = 0;

    this._hudDir = null;                   // gehaltene Blickrichtung des HUD
    this._hudTarget = null;
    this._hudMoving = false;
    this._lastFrameAt = 0;
    this._placed = null;
    this._tagTex = new Map();
    this._hands = new Map();               // handedness → Pinch-Zustand
    this._pendingActivate = false;
    this._recalled = false;                // Karte wurde vor den Träger geholt
    this._cardAwayFor = 0;

    // Intern: steuert Fadenkreuz und Verweil-Auslösung. Wird nicht angezeigt —
    // die Frage, was das Gerät liefert, ist beantwortet.
    this._diag = { sources: 0, selects: 0, joints: 0, gaze: false };

    this._frameBound = (t, f) => this._onFrame(t, f);
    this._onSelectBound = () => { this._diag.selects++; this._hudDirty = true; this._activate(); };
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

    // Manche Browser melden Hände nur, wenn `hand-tracking` verbindlich
    // angefordert wurde — sie scheitern dann aber, wenn sie es nicht können.
    // Also erst verbindlich versuchen, dann ohne.
    const attempts = [
      { requiredFeatures: ["hand-tracking"], optionalFeatures: ["local-floor", "bounded-floor"], tag: "hand-tracking (required)" },
      { optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking"], tag: "hand-tracking (optional)" },
    ];

    let session = null, lastErr = null;
    for (const a of attempts) {
      try {
        session = await navigator.xr.requestSession("immersive-ar", a);
        this._diag.feature = a.tag;
        break;
      } catch (err) { lastErr = err; }
    }
    if (!session) {
      const name = lastErr && lastErr.name ? lastErr.name + ": " : "";
      const msg = lastErr && lastErr.message ? lastErr.message : "immersive-ar konnte nicht gestartet werden";
      throw new Error("AR-Sitzung abgelehnt — " + name + msg);
    }

    await gl.makeXRCompatible();
    session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl, { alpha: true }) });

    this.refSpace = await session
      .requestReferenceSpace("local-floor")
      .catch(() => session.requestReferenceSpace("local"))
      .catch(() => session.requestReferenceSpace("viewer"));

    // Die Sitzung weiß selbst, welche Merkmale sie bekommen hat. Das ist die
    // eindeutige Auskunft darüber, ob Handtracking überhaupt bewilligt wurde —
    // alles andere wäre Raten.
    try {
      const feats = session.enabledFeatures;
      this._diag.granted = feats ? (feats.includes("hand-tracking") ? "ja" : "nein") : "?";
    } catch (_) { this._diag.granted = "?"; }

    this.gl = gl;
    this.session = session;
    this._initGL();

    session.addEventListener("select", this._onSelectBound);
    session.addEventListener("selectstart", this._onSelectStart);
    session.addEventListener("selectend", this._onSelectEnd);
    session.addEventListener("inputsourceschange", () => { this._hudDirty = true; });
    session.addEventListener("end", () => this._cleanup());

    this.onStart();
    session.requestAnimationFrame(this._frameBound);
  }

  setContent(screen, map, tags, anchor) {
    if (screen) {
      this._screen = screen;
      this._cardDirty = true;
      this._hudDirty = true;
      this._recalled = false;              // neuer Schritt → wieder beim Patienten
      this._cardAwayFor = 0;
    }
    if (map) { this._map = map; this._hudDirty = true; }
    if (tags) this._tags = tags;
    if (anchor !== undefined) this._anchor = anchor;
  }

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
    this.beamTex = this._texture();
    this._uploadCursor();
    this._uploadBeam();
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
    g.strokeStyle = "rgba(0,0,0,0.55)";
    g.lineWidth = 7;
    g.beginPath(); g.arc(r, r, r - 6, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.95)";
    g.lineWidth = 3.5;
    g.beginPath(); g.arc(r, r, r - 6, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#ffffff";
    g.beginPath(); g.arc(r, r, 7, 0, Math.PI * 2); g.fill();
    this._upload(this.cursorTex, c);
  }

  _uploadBeam() {
    const c = document.createElement("canvas");
    c.width = 8; c.height = 64;
    const g = c.getContext("2d");
    const grad = g.createLinearGradient(0, 64, 0, 0);      // hinten schwach, vorn hell
    grad.addColorStop(0, "rgba(255,255,255,0.05)");
    grad.addColorStop(1, "rgba(255,255,255,0.85)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 8, 64);
    this._upload(this.beamTex, c);
  }

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

  _model(pos, basis, halfW, halfH) {
    return new Float32Array([
      basis.right.x * halfW, basis.right.y * halfW, basis.right.z * halfW, 0,
      basis.up.x * halfH, basis.up.y * halfH, basis.up.z * halfH, 0,
      basis.normal.x, basis.normal.y, basis.normal.z, 0,
      pos.x, pos.y, pos.z, 1,
    ]);
  }

  /**
   * Das HUD bleibt liegen, wo es liegt, solange der Blick innerhalb von
   * HUD_LEASH umherwandert — man kann also frei herumschauen, das HUD sogar aus
   * dem Blick verlieren, ohne dass sich etwas rührt. Erst wenn der Blick diese
   * Schwelle überschreitet, zieht es **einmal** um: das Ziel wird in dem Moment
   * festgehalten und angesteuert, danach steht es wieder still. Es schwimmt
   * nicht mit dem Kopf mit — wer weiterdreht, löst schlicht den nächsten Umzug
   * aus.
   *
   * Die Position bleibt am Kopf hängen (HUD_DIST voraus in der gehaltenen
   * Richtung), sonst liefe man beim Gehen davon.
   */
  _hudPose(head, dt) {
    const look = norm3(forwardOf(head));
    if (!this._hudDir) { this._hudDir = look; this._hudTarget = look; }

    const angleFromLook = (v) => Math.acos(Math.max(-1, Math.min(1, dot3(v, look))));

    if (!this._hudMoving && angleFromLook(this._hudDir) > HUD_LEASH) {
      this._hudMoving = true;
      this._hudTarget = look;              // Ziel einmal festhalten, nicht nachführen
    }

    if (this._hudMoving) {
      const t = 1 - Math.exp(-dt / HUD_MOVE_TAU);
      this._hudDir = norm3(add3(this._hudDir, scale3(sub(this._hudTarget, this._hudDir), t)));
      const rest = Math.acos(Math.max(-1, Math.min(1, dot3(this._hudDir, this._hudTarget))));
      if (rest < HUD_ARRIVED) {
        this._hudDir = this._hudTarget;
        this._hudMoving = false;
      }
    }

    const pos = add3(head.position, scale3(this._hudDir, HUD_DIST));
    return { pos, basis: basisFromNormal(scale3(this._hudDir, -1)) };
  }

  /**
   * Die Handlungskarte steht raumfest beim Patienten — solange sie dort auch zu
   * sehen ist. Die Patientenposition stammt aus dem ausgerichteten Raster und
   * trifft die Wirklichkeit nur ungefähr; liegt sie daneben, hinge der einzige
   * bedienbare Teil der Anwendung außerhalb des Blickfelds, und auf dem HUD
   * stünde eine Aufforderung ohne sichtbaren Knopf.
   *
   * Deshalb: wer die Karte länger als CARD_RECALL_S nicht im Blick hat, bekommt
   * sie vor sich geholt. Sie bleibt dann dort, bis der nächste Schritt beginnt.
   */
  _cardPose(head, dt) {
    if (this._anchor && !this._recalled) {
      const toCard = norm3(sub(this._anchor, head.position));
      const look = norm3(forwardOf(head));
      const off = Math.acos(Math.max(-1, Math.min(1, dot3(toCard, look))));

      this._cardAwayFor = off > CARD_VIEW_CONE ? this._cardAwayFor + dt : 0;
      if (this._cardAwayFor > CARD_RECALL_S) {
        this._recalled = true;
        this._placed = null;
      } else {
        return this._anchor;
      }
    }

    if (!this._placed) {
      const fwd = flatten(forwardOf(head));
      this._placed = add3(head.position, add3(scale3(fwd, CARD_PLACE_DIST), { x: 0, y: -0.08, z: 0 }));
    }
    return this._placed;
  }

  /* --------------------------------------------------------------- Zeigen */

  /**
   * Alle Strahlen: Hände (aus den Gelenken), Controller — ersatzweise der Blick.
   *
   * Hände werden NICHT über `targetRaySpace` und `select` genommen, sondern
   * direkt aus den Fingergelenken: Richtung vom Handgelenk zur Zeigefingerspitze,
   * Pinch aus dem Abstand Daumen- zu Zeigefingerspitze. Beides braucht nur
   * `frame.getJointPose`, das jeder Browser mit Handtracking liefert — anders als
   * Zielstrahl und `select`, die auf manchen Geräten ausbleiben.
   */
  _rays(frame, head) {
    const out = [];
    let hands = 0, jointed = 0;
    const kinds = new Set();
    let pinchCm = null;

    for (const src of this.session.inputSources) {
      if (src.targetRayMode) kinds.add(src.hand ? "hand" : src.targetRayMode);

      if (src.hand) {
        hands++;
        const ray = this._handRay(frame, src);
        if (ray) {
          jointed++;
          if (pinchCm === null || ray.pinchDistance < pinchCm) pinchCm = ray.pinchDistance;
          out.push(ray);
          continue;                      // Gelenke schlagen den Zielstrahl
        }
      }

      if (!src.targetRaySpace) continue;
      const pose = frame.getPose(src.targetRaySpace, this.refSpace);
      if (!pose) continue;
      out.push({
        origin: pose.transform.position,
        dir: norm3(forwardOf(pose.transform)),
        gaze: false,
      });
    }

    this._diag.sources = this.session.inputSources.length;
    this._diag.hands = hands;
    this._diag.joints = jointed;
    this._diag.kinds = kinds.size ? [...kinds].join("+") : "—";
    this._diag.pinchCm = pinchCm === null ? null : Math.round(pinchCm * 100);
    this._diag.gaze = out.length === 0;

    // Nichts da, worauf man zeigen könnte → der Blick zeigt.
    if (out.length === 0)
      out.push({ origin: head.position, dir: norm3(forwardOf(head)), gaze: true });

    return out;
  }

  /** Strahl und Pinch einer Hand aus ihren Gelenken. null, wenn sie fehlen. */
  _handRay(frame, src) {
    if (typeof frame.getJointPose !== "function" || !src.hand) return null;

    const joint = (name) => {
      try {
        const space = src.hand.get(name);
        if (!space) return null;
        const pose = frame.getJointPose(space, this.refSpace);
        return pose ? pose.transform.position : null;
      } catch (_) {
        return null;                     // Browser meldet Gelenke, liefert aber keine
      }
    };

    const wrist = joint("wrist");
    const indexTip = joint("index-finger-tip");
    const thumbTip = joint("thumb-tip");
    const knuckle = joint("index-finger-metacarpal") || joint("index-finger-phalanx-proximal");
    if (!indexTip || !thumbTip || !(wrist || knuckle)) return null;

    const from = knuckle || wrist;
    const dir = norm3(sub(indexTip, from));
    const gap = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y, indexTip.z - thumbTip.z);

    const key = src.handedness || "unknown";
    const prev = this._hands.get(key) || { pinching: false, dir, origin: from };
    const pinching = prev.pinching ? gap < PINCH_OFF : gap < PINCH_ON;

    // Beim Zupacken krümmt sich der Zeigefinger zum Daumen — würde der Strahl
    // mitwandern, zeigte man im Moment des Auslösens woandershin. Also wird die
    // Richtung mit dem Zugreifen eingefroren.
    const aim = pinching ? prev.dir : dir;
    const origin = pinching ? prev.origin : from;

    const down = pinching && !prev.pinching;
    this._hands.set(key, { pinching, dir: aim, origin });

    if (down) {
      this._diag.selects++;
      this._hudDirty = true;
      this._pendingActivate = true;      // erst auslösen, wenn der Zeiger steht
    }

    return { origin, dir: aim, gaze: false, pinching, pinchDistance: gap };
  }

  _updatePointer(rays, cardPos, cardBasis, now) {
    let best = null;

    for (const ray of rays) {
      const denom = dot3(cardBasis.normal, ray.dir);
      if (Math.abs(denom) < 1e-5) continue;
      const dist = dot3(cardBasis.normal, sub(cardPos, ray.origin)) / denom;
      if (dist < 0.05 || dist > 12) continue;

      const hit = add3(ray.origin, scale3(ray.dir, dist));
      const rel = sub(hit, cardPos);
      const u = dot3(rel, cardBasis.right) / CARD_HALF_W;
      const v = dot3(rel, cardBasis.up) / CARD_HALF_H;
      if (u < -1 || u > 1 || v < -1 || v > 1) continue;

      if (!best || dist < best.dist)
        best = { dist, hit, ray, px: ((u + 1) / 2) * CARD_W, py: ((1 - v) / 2) * CARD_H };
    }

    const hover = best ? hitTest(this._rects, best.px, best.py) : -1;
    if (hover !== this._hover) {
      this._hover = hover;
      this._hoverSince = now;
      this._cardDirty = true;
    }
    this._cursorWorld = best ? best.hit : null;
    this._hitDist = best ? best.dist : null;

    // Verweilen ersetzt den Pinch — aber nur, solange nie einer angekommen ist.
    // Sobald das Gerät einmal `select` geschickt hat, wäre Verweilen nur noch
    // eine Falle, die beim bloßen Hinschauen auslöst.
    const dwellArmed = this._diag.selects === 0;
    const dwell = dwellArmed && this._hover >= 0
      ? Math.min(1, (now - this._hoverSince) / DWELL_MS)
      : 0;
    if (Math.abs(dwell - this._dwell) > 0.02) { this._dwell = dwell; this._cardDirty = true; }
    if (dwell >= 1) { this._dwell = 0; this._activate(); }

    // Ein Pinch aus den Gelenken löst erst hier aus — nachdem feststeht, worauf
    // der eingefrorene Strahl in diesem Frame zeigt.
    if (this._pendingActivate) {
      this._pendingActivate = false;
      this._activate();
    }
  }

  _activate() {
    if (this._hover < 0) return;
    const b = (this._screen.buttons || [])[this._hover];
    if (b && typeof b.action === "function") {
      this._hover = -1;
      this._dwell = 0;
      b.action();
    }
  }

  /* ----------------------------------------------------------- Frame-Lauf */

  _onFrame(t, frame) {
    const session = this.session;
    if (!session) return;
    session.requestAnimationFrame(this._frameBound);

    const dt = this._lastFrameAt ? Math.min(0.1, (t - this._lastFrameAt) / 1000) : 0.016;
    this._lastFrameAt = t;

    const gl = this.gl;
    const layer = session.renderState.baseLayer;
    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const pose = frame.getViewerPose(this.refSpace);
    if (!pose) return;

    const head = pose.transform;
    this.onPose(head.position, flatten(forwardOf(head)));
    this.onFrame();

    const hud = this._hudPose(head, dt);
    const cardPos = this._cardPose(head, dt);
    const cardBasis = basisFacing(cardPos, head.position);

    const rays = this._rays(frame, head);
    this._updatePointer(rays, cardPos, cardBasis, t);

    if (this._cardDirty) {
      this._rects = drawCard(this.cardCanvas.ctx, CARD_W, CARD_H, this._screen,
                             { hover: this._hover, dwell: this._dwell });
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
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(this.aUV);
    gl.vertexAttribPointer(this.aUV, 2, gl.FLOAT, false, 16, 8);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(this.uTex, 0);

    const hudModel = this._model(hud.pos, hud.basis, HUD_HALF_W, HUD_HALF_H);
    const cardModel = this._model(cardPos, cardBasis, CARD_HALF_W, CARD_HALF_H);

    const tagDraws = [];
    for (const tag of this._tags) {
      if (tag.target || (tag.distance != null && tag.distance > TAG_RANGE)) continue;
      const pos = { x: tag.pos.x, y: tag.pos.y + TAG_LIFT, z: tag.pos.z };
      tagDraws.push({
        tex: this._tagTexture(tag),
        model: this._model(pos, basisFacing(pos, head.position), TAG_HALF_W, TAG_HALF_H),
      });
    }

    // Strahlen: sichtbar machen, wohin gezeigt wird — sonst sieht man bei einem
    // Fehlzeiger gar nichts und hält das Handtracking für kaputt.
    const beamModels = [];
    for (const ray of rays) {
      if (ray.gaze) continue;              // der Blick braucht keinen Strahl
      const len = this._hitDist && this._cursorWorld ? this._hitDist : BEAM_LEN;
      const centre = add3(ray.origin, scale3(ray.dir, len / 2));
      const toViewer = norm3(sub(head.position, centre));
      let side = cross3(ray.dir, toViewer);
      if (Math.hypot(side.x, side.y, side.z) < 1e-4) side = { x: 1, y: 0, z: 0 };
      side = norm3(side);
      beamModels.push(this._model(centre, {
        right: side,
        up: ray.dir,
        normal: norm3(cross3(side, ray.dir)),
      }, BEAM_HALF_W, len / 2));
    }

    let cursorModel = null;
    if (this._cursorWorld) {
      cursorModel = this._model(add3(this._cursorWorld, scale3(cardBasis.normal, 0.004)),
                                cardBasis, CURSOR_HALF, CURSOR_HALF);
    } else if (this._diag.gaze) {
      // Nichts getroffen, aber der Blick zeigt: Fadenkreuz mitten im Blickfeld,
      // damit man überhaupt zielen kann.
      const look = norm3(forwardOf(head));
      const at = add3(head.position, scale3(look, 1.0));
      cursorModel = this._model(at, basisFromNormal(scale3(look, -1)),
                                CURSOR_HALF * 0.6, CURSOR_HALF * 0.6);
    }

    for (const view of pose.views) {
      const vp = layer.getViewport(view);
      if (!vp) continue;
      gl.viewport(vp.x, vp.y, vp.width, vp.height);
      const viewProj = mul(view.projectionMatrix, view.transform.inverse.matrix);

      gl.bindTexture(gl.TEXTURE_2D, this.hudTex);
      gl.uniformMatrix4fv(this.uMVP, false, mul(viewProj, hudModel));
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      for (const t2 of tagDraws) {
        gl.bindTexture(gl.TEXTURE_2D, t2.tex);
        gl.uniformMatrix4fv(this.uMVP, false, mul(viewProj, t2.model));
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

      gl.bindTexture(gl.TEXTURE_2D, this.cardTex);
      gl.uniformMatrix4fv(this.uMVP, false, mul(viewProj, cardModel));
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      gl.bindTexture(gl.TEXTURE_2D, this.beamTex);
      for (const m of beamModels) {
        gl.uniformMatrix4fv(this.uMVP, false, mul(viewProj, m));
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

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
    this.hudTex = this.cardTex = this.cursorTex = this.beamTex = this.prog = this.vbo = null;
    this.hudCanvas = this.cardCanvas = this.tagCanvas = null;
    this._tagTex.clear();
    this._rects = [];
    this._cursorWorld = null;
    this._recalled = false;
    this._cardAwayFor = 0;
    this._hudDir = null;
    this._hudTarget = null;
    this._hudMoving = false;
    this._placed = null;
    this.onEnd();
  }
}

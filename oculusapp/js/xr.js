/* WebXR-Passthrough als HUD: Randinformation am Blickfeld, Patientendaten im Raum.
 *
 * PICOs Browser kann `immersive-ar`, aber NICHT `dom-overlay`. Alles wird deshalb
 * mit der Canvas-2D-API gezeichnet (hudscreen.js), als Textur hochgeladen und auf
 * Rechtecke in der WebGL-Ebene gelegt. Der Augenpuffer wird vollständig
 * transparent gelöscht, damit rundherum die Wirklichkeit stehen bleibt.
 *
 * Vier Sorten Rechtecke, bewusst unterschiedlich verankert:
 *
 *   HUD      steht still, bis der Blick eine große Schwelle überschreitet (40°) —
 *            dann zieht es einmal um und steht wieder. Man kann also frei
 *            herumschauen, ohne dass es mitschwimmt. Randinformation — und unten
 *            eine Reihe kleiner Knöpfe (`screen.hudActions`), die anders als der
 *            Rest bedienbar ist.
 *   Karte    raumfest beim Patienten, dreht sich nur zum Betrachter. Sie bleibt
 *            stehen, wo der Patient liegt. Hier wird gezeigt und ausgelöst. Es
 *            gibt sie nur, wenn wirklich ein Schritt ansteht (`screen.showCard`).
 *   Marker liegen flach auf dem Boden beim Patienten — und sind zugleich die
 *            Schaltfläche: ein Patient wird geöffnet, indem man seinen Marker
 *            anklickt. Nichts geht von selbst auf.
 *   Ring     beim Anlegen eines Patienten: er wandert über den Boden dorthin,
 *            wohin gezeigt wird, und legt beim Auslösen die Stelle fest.
 *
 * Wenn sich zwei überlagern, gewinnt beim Zeigen das, was auch obenauf
 * gezeichnet wird: Karte vor HUD-Knöpfen vor Boden.
 *
 * Bedienung:
 *   Controller und Hände zeigen über ihren `targetRaySpace`, sichtbar als
 *   Strahl. Der PICO-Browser stellt WebXR-Handtracking nicht bereit — dort
 *   übernimmt der **Blick** als Zeiger, mit Fadenkreuz in der Blickmitte.
 *   Ausgelöst wird durch `select` (Pinch/Trigger) oder, solange nie ein
 *   `select` ankam, durch Verweilen auf einem Knopf.
 */

"use strict";

import { drawHudLayer, drawCard, drawMarker, drawReticle, drawInfoPopup,
         hitTest } from "./hudscreen.js";
import { BodyMesh, loadBodyMesh } from "./bodyview.js";
import { pickRegion, rgbOf } from "./body.js";

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
const CARD_LIFT = 1.15;                  // über dem Boden, nicht auf ihm

// Die kleine Anzeige, die beim Herantreten über dem Marker aufgeht.
const POP_W = 512, POP_H = 300;
const POP_HALF_W = 0.21;                 // 42 cm breit
const POP_HALF_H = POP_HALF_W * (POP_H / POP_W);
const POP_NEAR = 3.0;                    // Meter: ab hier geht sie auf
const POP_FAR = 3.8;                     // und erst hier wieder zu (kein Flackern)
// Etwa auf Augenhöhe, wenn man davorsteht: tiefer geriete sie in die Reihe der
// HUD-Knöpfe am unteren Blickfeldrand und verdeckte sie.
const POP_TOP = 1.45;                    // Höhe über dem Boden, wenn ganz oben
// Die kleine Figur neben der Anzeige: sie steht für den Patienten, in seiner
// Sichtungsfarbe, mit roten Stellen dort, wo Befunde hängen.
const POP_BODY_H = 0.34;                 // Modellhöhe in Metern
const POP_BODY_SIDE = 0.30;              // links neben der Anzeige
const POP_RISE = 4.5;                    // 1/s — wie schnell sie aufsteigt
const POP_MAX = 3;                       // so viele gleichzeitig

// Körpermodell, raumfest neben der Handlungskarte.
const BODY_H = 0.62;                     // Modellhöhe in Metern
const BODY_LIFT = 1.06;                  // Brusthöhe über dem Boden
const BODY_GAP = 0.20;                   // Abstand zur Kante der Karte
const BODY_HALF_W = 0.22 * BODY_H;
const BODY_DRAG_GAIN = 2.4;
const BODY_AUTOSPIN = 0.42;              // rad/s, wenn nur der Blick zeigt
const BODY_DRAG_SLOP = 0.04;             // rad, ab da gilt es als Drehen

// Marker liegen flach auf dem Boden beim Patienten und sind anklickbar.
const MARK_PX = 512;                     // quadratische Textur
const MARK_HALF = 0.35;                  // 70 cm Durchmesser
const MARK_LIFT = 0.004;                 // knapp über dem Boden gegen Z-Kampf
const MARK_RANGE = 25;                   // Meter

// Die Stelle, an der ein neuer Patient angelegt wird: ein Ring, der über den
// Boden wandert. Die Reichweite ist begrenzt — ein Patient, der 30 m weiter
// entstünde, wäre ein Zeigefehler und keine Absicht.
const PLACE_PX = 256;
const PLACE_HALF = 0.30;                 // 60 cm Ring
const PLACE_MIN = 0.5;                   // Meter vor den Füßen
const PLACE_MAX = 8;
const PLACE_AHEAD = 2.0;                 // wenn der Strahl den Boden nicht trifft
const PLACE_STEADY = 0.30;               // so weit darf die Stelle beim Verweilen wandern

// Augentest (?augentest=1): Schild im Sichtraum der Ansicht, 1,2 m vor dem Auge —
// deshalb ohne view.transform, nur mit der Projektion multipliziert.
const EYE_MODEL = new Float32Array([
  0.30, 0, 0, 0,
  0, 0.15, 0, 0,
  0, 0, 1, 0,
  0, 0, -1.2, 1,
]);

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

export function mul(a, b) {                       // spaltenweise 4x4: a * b
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

/**
 * Basis für ein flach auf dem Boden liegendes Rechteck. Die Normale zeigt nach
 * oben, die Textoberkante vom Betrachter weg — so liest sich die Beschriftung
 * aus jeder Richtung richtig herum, ohne dass der Marker eine Vorderseite hätte.
 */
function basisFloor(pos, viewer) {
  let away = { x: pos.x - viewer.x, y: 0, z: pos.z - viewer.z };
  if (Math.hypot(away.x, away.z) < 1e-4) away = { x: 0, y: 0, z: 1 };
  const up = norm3(away);
  const right = norm3(cross3(up, { x: 0, y: 1, z: 0 }));
  return { right, up, normal: cross3(right, up) };
}

/** Gierbasis: Rechteck steht senkrecht und dreht sich nur zum Betrachter. */
function basisFacing(pos, viewer) {
  const yaw = Math.atan2(viewer.x - pos.x, viewer.z - pos.z);
  const s = Math.sin(yaw), c = Math.cos(yaw);
  return { right: { x: c, y: 0, z: -s }, up: { x: 0, y: 1, z: 0 }, normal: { x: s, y: 0, z: c } };
}

/* --------------------------------------------------------------- Matrizen
 *
 * Nur für das Körpermodell: alles andere sind Rechtecke, die mit `_model`
 * direkt aus einer Basis entstehen. Ein Volumen braucht dagegen eine echte
 * Kette aus Verschieben, Drehen und Skalieren. Alles spaltenweise. */

export function matIdentity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

export function matTranslate(x, y, z) {
  const m = matIdentity();
  m[12] = x; m[13] = y; m[14] = z;
  return m;
}

export function matBasis(b) {
  return new Float32Array([
    b.right.x, b.right.y, b.right.z, 0,
    b.up.x, b.up.y, b.up.z, 0,
    b.normal.x, b.normal.y, b.normal.z, 0,
    0, 0, 0, 1,
  ]);
}

export function matRotY(a) {
  const s = Math.sin(a), c = Math.cos(a);
  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
}

export function matRotX(a) {
  const s = Math.sin(a), c = Math.cos(a);
  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
}

export function matScale(s) {
  return new Float32Array([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1]);
}

/**
 * Welt → Modellraum, für eine Matrix aus Drehung mal gleichmäßiger Skalierung
 * plus Verschiebung. Die Drehung ist orthonormal, also genügt ihre
 * Transponierte — keine allgemeine Inversion nötig.
 *
 * Exportiert, weil daran das Zeigen auf Körperregionen in der Brille hängt und
 * sich das ohne Headset sonst nicht prüfen ließe (tests/logic.test.mjs).
 */
export function intoModel(m, scale, v, isPoint) {
  const p = isPoint ? { x: v.x - m[12], y: v.y - m[13], z: v.z - m[14] } : v;
  const ex = { x: m[0], y: m[1], z: m[2] };
  const ey = { x: m[4], y: m[5], z: m[6] };
  const ez = { x: m[8], y: m[9], z: m[10] };
  const s2 = scale * scale;
  return {
    x: dot3(p, ex) / s2,
    y: dot3(p, ey) / s2,
    z: dot3(p, ez) / s2,
  };
}

/* --------------------------------------------------------------- Sitzung */

export class XRPassthrough {
  constructor({ onStart, onEnd, onPose, onFrame, onMarkerPick, onPlace, onRegionPick,
                onStereoIssue, eyeTest = false } = {}) {
    this.eyeTest = eyeTest;
    this.onStart = onStart || (() => {});
    this.onEnd = onEnd || (() => {});
    this.onPose = onPose || (() => {});
    this.onFrame = onFrame || (() => {});
    this.onMarkerPick = onMarkerPick || (() => {});
    this.onPlace = onPlace || (() => {});
    this.onRegionPick = onRegionPick || (() => {});
    this.onStereoIssue = onStereoIssue || (() => {});

    this.session = null;
    this.gl = null;
    this.refSpace = null;

    this._screen = { title: "J.A.R.", headline: "", hint: "", body: [], buttons: [],
                     hudActions: [], showCard: true, placing: false, status: "" };
    this._map = { dots: [], medic: null, spanMeters: 8,
                  counts: { SK1: 0, SK2: 0, SK3: 0, SK4: 0, DECEASED: 0, UNSIGHTED: 0,
                            total: 0, ohneKarte: 0 },
                  footer: "", hint: "" };
    this._tags = [];
    this._anchor = null;

    this._rects = [];
    this._hover = -1;
    this._hoverSince = 0;
    this._hudRects = [];
    this._hudHover = -1;
    this._hudHoverSince = 0;
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
    this._markTex = new Map();
    this._popTex = new Map();              // Anzeige über dem Marker je Patient
    this._pops = new Map();                // id → Aufgang 0…1
    this._floorNow = 0;                    // gemeinsame Bodenebene aller Marker
    this._floorGuess = null;
    this._hands = new Map();               // handedness → Pinch-Zustand
    this._pendingActivate = false;
    this._bodyYaw = 0;                     // Drehung des Körpermodells
    this._bodyPitch = 0;
    this._bodyHover = null;                // Körperregion unter dem Zeiger
    this._bodyHoverSince = 0;
    this._bodyDrag = null;
    this._bodySwallow = false;             // gerade gedreht → kein Antippen
    this._bodyId = null;                   // zu welchem Patienten es gerade steht
    this._markHover = null;                // Bodenmarker unter dem Zeiger
    this._markHoverSince = 0;
    this._place = null;                    // Stelle am Boden beim Anlegen
    this._placeAnchor = null;              // Bezugspunkt für das ruhige Verweilen
    this._placeSteadyAt = 0;
    this._reticleKey = null;
    this._stereoNote = null;


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

    // Tiefe an: das Körpermodell ist ein Volumen und muss sich selbst
    // verdecken. Alles andere zeichnet weiterhin ohne Tiefentest.
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl", {
      xrCompatible: true, alpha: true, antialias: true, depth: true, stencil: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error("WebGL für die AR-Ebene nicht verfügbar.");

    // `bounded-floor` wird bewusst NIE angefordert. Es ist das einzige Merkmal,
    // für das die Brille eine **gezeichnete Spielfläche** verlangt — und benutzt
    // wurde es hier nie: als Bezugsraum kommt `local-floor` zum Einsatz, die
    // Lagekarte rechnet mit echten Koordinaten und nicht mit Raumgrenzen. Es
    // stand nur in der Liste und hat Einrichtung erzwungen, die niemand braucht.
    //
    // Manche Browser melden Hände nur, wenn `hand-tracking` verbindlich
    // angefordert wurde — sie scheitern dann aber, wenn sie es nicht können.
    // Also erst verbindlich versuchen, dann ohne, dann ganz ohne Zusätze: die
    // letzte Stufe verlangt nichts, was über eine blanke Sitzung hinausgeht.
    const attempts = [
      { requiredFeatures: ["hand-tracking"], optionalFeatures: ["local-floor"], tag: "hand-tracking (required)" },
      { optionalFeatures: ["local-floor", "hand-tracking"], tag: "hand-tracking (optional)" },
      { tag: "ohne Zusatzmerkmale" },
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
    session.updateRenderState({
      baseLayer: new XRWebGLLayer(session, gl, { alpha: true, depth: true }),
    });

    // Mit „local-floor" liegt der Boden bei y = 0 — dorthin gehören die Marker.
    // Gibt die Brille ihn nicht her (etwa im Sitz-/Stationärmodus ohne
    // eingerichtete Fläche), läuft alles mit „local" weiter und die Bodenhöhe
    // wird geschätzt. Das ist ungenauer, aber kein Grund, den Einsatz zu
    // verweigern.
    this.floorY = 0;
    this.refSpace = await session.requestReferenceSpace("local-floor").catch(async () => {
      this.floorY = null;                  // ohne Bodenreferenz schätzt der Ablauf
      return session.requestReferenceSpace("local")
        .catch(() => session.requestReferenceSpace("viewer"));
    });

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
      // Die Trefferflächen gehören zum alten Schirm. Bis neu gezeichnet ist,
      // gibt es keine — sonst träfe ein Auslösen im selben Moment den Knopf,
      // der eben noch an dieser Stelle stand.
      this._rects = [];
      this._hudRects = [];
      this._hover = -1;
      this._hudHover = -1;
      this._bodyHover = null;
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
    this.markCanvas = this._canvas(MARK_PX, MARK_PX);
    this.placeCanvas = this._canvas(PLACE_PX, PLACE_PX);
    this.popCanvas = this._canvas(POP_W, POP_H);

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
    this.placeTex = this._texture();
    this.cursorTex = this._texture();
    this.beamTex = this._texture();
    this._uploadCursor();
    this._uploadBeam();

    // Das Körpermodell bringt sein eigenes Programm mit — es braucht Normalen
    // und Tiefe, nicht die Textur-auf-Rechteck-Maschine von oben. Bis das echte
    // Netz geladen ist, stehen die Quader aus body.js.
    this.body = new BodyMesh(gl);
    loadBodyMesh().then((m) => { if (m && this.body) this.body.useMesh(m); });

    if (this.eyeTest) {
      this.eyeTex = [this._eyeLabel("LINKS", "#46a758"), this._eyeLabel("RECHTS", "#e5484d")];
    }
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

  /**
   * Beschriftung für den Augentest: je Ansicht ein Wort, gezeichnet im
   * Sichtraum dieser Ansicht. Wer nur „LINKS" sieht, bekommt die zweite Ansicht
   * nicht gezeichnet — wer beides sieht (je Auge eines), hat funktionierendes
   * Stereo und das Problem liegt woanders.
   */
  _eyeLabel(text, color) {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "rgba(0,0,0,0.75)";
    g.fillRect(0, 0, 512, 256);
    g.fillStyle = color;
    g.fillRect(0, 0, 512, 14);
    g.fillStyle = "#ffffff";
    g.font = "700 96px 'Helvetica Neue', Arial, sans-serif";
    g.textAlign = "center";
    g.fillText(text, 256, 150);
    g.font = "400 30px 'Helvetica Neue', Arial, sans-serif";
    g.fillText("Augentest", 256, 205);
    const tex = this._texture();
    this._upload(tex, c);
    return tex;
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

  /** Markertextur — nur neu, wenn sich am Inhalt etwas ändert. */
  _markTexture(m) {
    const key = `${m.id}|${m.short}|${m.sighted}|${m.card}|${m.transported ? 1 : 0}|${m.hover ? 1 : 0}`;
    let entry = this._markTex.get(m.id);
    if (!entry) {
      entry = { tex: this._texture(), key: null };
      this._markTex.set(m.id, entry);
    }
    if (entry.key !== key) {
      drawMarker(this.markCanvas.ctx, MARK_PX, MARK_PX, m);
      this._upload(entry.tex, this.markCanvas.el);
      entry.key = key;
    }
    return entry.tex;
  }

  /**
   * Ring für die Stelle am Boden. Nur neu, wenn sich sichtbar etwas ändert —
   * die Entfernung steht auf ein Zehntel gerundet darauf, ruhige Hand heißt
   * also gar keine Neuzeichnung.
   */
  _reticleTexture(place, dwell) {
    const key = `${place.ok ? 1 : 0}|${place.distance.toFixed(1)}|${Math.round(dwell * 12)}`;
    if (this._reticleKey !== key) {
      drawReticle(this.placeCanvas.ctx, PLACE_PX, PLACE_PX,
                  { ok: place.ok, distance: place.distance, dwell });
      this._upload(this.placeTex, this.placeCanvas.el);
      this._reticleKey = key;
    }
    return this.placeTex;
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
   * Die Handlungskarte steht raumfest **beim Patienten**, auf Brusthöhe über
   * seinem Marker. Sie wurde früher vor den Träger geholt, sobald sie länger aus
   * dem Blick war — das ist raus: was zu einem bestimmten Patienten gehört,
   * gehört an diesen Patienten und darf nicht mitwandern. Wer sie sucht, dreht
   * sich zu dem, an dem er arbeitet.
   *
   * Nur wenn gar kein Patient offen ist (Tätigkeitswahl), steht sie vor dem
   * Träger — dann gehört sie auch niemandem.
   */
  _cardPose(head) {
    if (this._anchor)
      return { x: this._anchor.x, y: this._floorNow + CARD_LIFT, z: this._anchor.z };

    if (!this._placed) {
      const fwd = flatten(forwardOf(head));
      this._placed = add3(head.position, add3(scale3(fwd, CARD_PLACE_DIST), { x: 0, y: -0.08, z: 0 }));
    }
    return this._placed;
  }

  /**
   * Die eine Bodenebene der Sitzung. Marker liegen **darauf**, nicht auf dem
   * y-Wert, den ihre Akte zufällig trug: Patienten werden zu verschiedenen
   * Zeitpunkten angelegt, und eine geschätzte Bodenhöhe wandert. Dann schwebt
   * einer und der nächste steckt im Estrich.
   *
   * Mit „local-floor" liefert das Gerät die Ebene (y = 0). Ohne, wird sie einmal
   * aus der Kopfhöhe geschätzt und dann festgehalten — nicht pro Bild neu, sonst
   * sänken alle Marker mit, wenn man sich bückt.
   */
  _updateFloor(head) {
    if (this.floorY != null) { this._floorNow = this.floorY; return; }
    if (this._floorGuess == null) this._floorGuess = head.position.y - 1.6;
    this._floorNow = this._floorGuess;
  }

  /* -------------------------------------------------------- Körpermodell */

  /**
   * Wo das Modell steht: neben der Handlungskarte, beim Patienten, auf
   * Brusthöhe — und mit ihm zusammen raumfest. Gedreht wird um seine eigene
   * Brust (Modellraum y = 0,5), damit es beim Drehen nicht auswandert.
   *
   * @returns {Float32Array|null} Modell → Welt
   */
  _bodyMatrix(head) {
    const bm = this._screen.bodyModel;
    if (!bm || !bm.pos) return null;

    // Neuer Patient → wieder frontal, sonst stünde er verdreht da.
    if (bm.id !== this._bodyId) {
      this._bodyId = bm.id;
      this._bodyYaw = 0;
      this._bodyPitch = 0;
      this._bodyDrag = null;
    }

    const face = basisFacing(bm.pos, head.position);
    const off = CARD_HALF_W + BODY_GAP + BODY_HALF_W;
    const at = {
      x: bm.pos.x - face.right.x * off,
      y: this._floorNow + BODY_LIFT,
      z: bm.pos.z - face.right.z * off,
    };

    return mul(
      mul(matTranslate(at.x, at.y, at.z), matBasis(face)),
      mul(mul(matRotY(this._bodyYaw), matRotX(this._bodyPitch)),
          mul(matScale(BODY_H), matTranslate(0, -0.5, 0))));
  }

  /** Welche Körperregion liegt unter einem der Strahlen? */
  _pickBody(rays, model) {
    let best = null;
    for (const ray of rays) {
      const o = intoModel(model, BODY_H, ray.origin, true);
      const d = intoModel(model, BODY_H, ray.dir, false);
      const hit = pickRegion(o, d);
      if (hit && hit.t > 0 && (!best || hit.t < best.t)) best = hit;
    }
    return best;
  }

  /**
   * Drehen. Mit Controller: Trigger halten und ziehen — der Strahl zieht das
   * Modell mit. Nur mit Blick (kein `select` im ganzen Lauf): es dreht sich von
   * selbst weiter, solange man keine Region ansieht, und steht still, sobald
   * der Blick auf einem Körperteil ruht. So sieht man alle Seiten, ohne dass
   * man etwas halten müsste, und kann trotzdem zielen.
   */
  _turnBody(rays, hovering, dt) {
    const aim = rays.find((r) => !r.gaze) || rays[0];
    const yaw = aim ? Math.atan2(aim.dir.x, -aim.dir.z) : 0;
    const pitch = aim ? Math.asin(Math.max(-1, Math.min(1, aim.dir.y))) : 0;

    if (this._pinching && (hovering || this._bodyDrag)) {
      if (!this._bodyDrag) this._bodyDrag = { yaw, pitch, moved: 0 };
      let dy = yaw - this._bodyDrag.yaw;
      while (dy > Math.PI) dy -= 2 * Math.PI;
      while (dy < -Math.PI) dy += 2 * Math.PI;
      const dp = pitch - this._bodyDrag.pitch;

      this._bodyYaw -= dy * BODY_DRAG_GAIN;
      this._bodyPitch = Math.max(-0.7, Math.min(0.7, this._bodyPitch - dp * BODY_DRAG_GAIN));
      this._bodyDrag = { yaw, pitch, moved: this._bodyDrag.moved + Math.abs(dy) + Math.abs(dp) };
      return;
    }

    // Losgelassen: ein Ziehen darf nicht als Antippen durchgehen.
    if (this._bodyDrag) {
      this._bodySwallow = this._bodyDrag.moved > BODY_DRAG_SLOP;
      this._bodyDrag = null;
    }

    if (this._diag.selects === 0 && !hovering) this._bodyYaw += BODY_AUTOSPIN * dt;
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

  /**
   * Wo trifft der nächste Strahl dieses Rechteck? Liefert die Trefferstelle
   * zusätzlich in Texturkoordinaten, damit `hitTest` damit arbeiten kann.
   */
  _planeHit(rays, pos, basis, halfW, halfH, texW, texH) {
    let best = null;
    for (const ray of rays) {
      const denom = dot3(basis.normal, ray.dir);
      if (Math.abs(denom) < 1e-5) continue;
      const dist = dot3(basis.normal, sub(pos, ray.origin)) / denom;
      if (dist < 0.05 || dist > 12) continue;

      const hit = add3(ray.origin, scale3(ray.dir, dist));
      const rel = sub(hit, pos);
      const u = dot3(rel, basis.right) / halfW;
      const v = dot3(rel, basis.up) / halfH;
      if (u < -1 || u > 1 || v < -1 || v > 1) continue;

      if (!best || dist < best.dist)
        best = { dist, hit, px: ((u + 1) / 2) * texW, py: ((1 - v) / 2) * texH };
    }
    return best;
  }

  /**
   * Zeiger auswerten. Reihenfolge = Zeichenreihenfolge: was oben liegt, wird
   * auch getroffen. Handlungskarte, dann die kleinen HUD-Knöpfe, dann der Boden
   * — beim Anlegen als Stelle, sonst als Patientenmarker.
   */
  _updatePointer(rays, card, hud, bodyMat, now, dt, head) {
    const placing = !!this._screen.placing;
    const showCard = this._screen.showCard !== false;

    const cardHit = showCard
      ? this._planeHit(rays, card.pos, card.basis, CARD_HALF_W, CARD_HALF_H, CARD_W, CARD_H)
      : null;
    const hover = cardHit ? hitTest(this._rects, cardHit.px, cardHit.py) : -1;
    if (hover !== this._hover) {
      this._hover = hover;
      this._hoverSince = now;
      this._cardDirty = true;
    }

    // Die HUD-Ebene füllt das ganze Blickfeld; getroffen ist sie nur dort, wo
    // wirklich ein Knopf liegt — sonst ließe sich nichts dahinter mehr zeigen.
    const hudHit = hover >= 0 || !this._hudRects.length
      ? null
      : this._planeHit(rays, hud.pos, hud.basis, HUD_HALF_W, HUD_HALF_H, HUD_W, HUD_H);
    const hudHover = hudHit ? hitTest(this._hudRects, hudHit.px, hudHit.py) : -1;
    if (hudHover !== this._hudHover) {
      this._hudHover = hudHover;
      this._hudHoverSince = now;
      this._hudDirty = true;
    }

    // Das Körpermodell liegt zwischen Karte und Boden: es steht vor dem Boden,
    // aber hinter Karte und HUD-Knöpfen.
    const bodyHit = bodyMat && hover < 0 && hudHover < 0 ? this._pickBody(rays, bodyMat) : null;
    const bodyId = bodyHit ? bodyHit.id : null;
    if (bodyId !== this._bodyHover) {
      this._bodyHover = bodyId;
      this._bodyHoverSince = now;
    }
    if (bodyMat) this._turnBody(rays, !!bodyHit, dt);
    else { this._bodyDrag = null; this._bodySwallow = false; }

    const floorFree = hover < 0 && hudHover < 0 && !bodyHit;

    // Stelle am Boden — nur beim Anlegen, und dann statt der Marker: sonst
    // klickte man beim Zeigen versehentlich vorhandene Patienten an.
    this._place = placing && floorFree ? this._placementPoint(rays, head) : null;
    if (this._place) {
      const a = this._placeAnchor;
      if (!a || Math.hypot(this._place.point.x - a.x, this._place.point.z - a.z) > PLACE_STEADY) {
        this._placeAnchor = this._place.point;
        this._placeSteadyAt = now;
      }
    } else {
      this._placeAnchor = null;
    }

    const markHit = !placing && floorFree ? this._pickMarker(rays) : null;
    if (markHit !== this._markHover) {
      this._markHover = markHit;
      this._markHoverSince = now;
    }

    this._cursorWorld = cardHit ? cardHit.hit
                      : hudHit && hudHover >= 0 ? hudHit.hit
                      : markHit ? markHit.point : null;
    this._hitDist = cardHit ? cardHit.dist
                  : hudHit && hudHover >= 0 ? hudHit.dist
                  : bodyHit ? bodyHit.t
                  : this._place ? this._place.dist
                  : markHit ? markHit.dist : null;

    // Verweilen ersetzt den Pinch nur auf Geräten, die nie ein `select`
    // schicken. Beim Anlegen zählt zusätzlich, dass die Stelle ruhig liegt.
    const dwellArmed = this._diag.selects === 0;
    const since = this._hover >= 0 ? this._hoverSince
                : this._hudHover >= 0 ? this._hudHoverSince
                : this._bodyHover ? this._bodyHoverSince
                : this._place ? this._placeSteadyAt
                : markHit ? this._markHoverSince : null;
    const dwell = dwellArmed && since !== null ? Math.min(1, (now - since) / DWELL_MS) : 0;
    if (Math.abs(dwell - this._dwell) > 0.02) {
      this._dwell = dwell;
      if (this._hover >= 0) this._cardDirty = true;
      if (this._hudHover >= 0) this._hudDirty = true;
    }
    if (dwell >= 1) { this._dwell = 0; this._activate(); }

    if (this._pendingActivate) {
      this._pendingActivate = false;
      this._activate();
    }
  }

  /**
   * Wohin der Zeiger auf dem Boden trifft. Es kommt immer eine brauchbare
   * Stelle heraus: zeigt der Strahl über den Horizont, wird eine Armlänge
   * voraus angenommen und das gesagt; zeigt er sehr weit, wird auf die
   * Reichweite gekürzt, statt einen Patienten in der Ferne entstehen zu lassen.
   */
  _placementPoint(rays, head) {
    const floor = this._floorNow;
    const eye = head.position;

    let hit = null, aim = null;
    for (const ray of rays) {
      if (!aim) aim = ray;
      if (ray.dir.y > -1e-3) continue;                  // zielt nicht nach unten
      const dist = (floor - ray.origin.y) / ray.dir.y;
      if (dist <= 0) continue;
      const p = add3(ray.origin, scale3(ray.dir, dist));
      const reach = Math.hypot(p.x - eye.x, p.z - eye.z);
      if (!hit || reach < hit.reach) hit = { p, reach, origin: ray.origin };
    }

    let point, ok;
    const from = hit ? hit.origin : aim ? aim.origin : eye;
    if (hit) {
      point = { x: hit.p.x, y: floor, z: hit.p.z };
      ok = true;
    } else {
      const fwd = flatten(aim ? aim.dir : { x: 0, y: 0, z: -1 });
      point = { x: eye.x + fwd.x * PLACE_AHEAD, y: floor, z: eye.z + fwd.z * PLACE_AHEAD };
      ok = false;                                       // „Boden anvisieren"
    }

    // Auf die Reichweite kürzen, ohne die Richtung zu verlieren.
    let dx = point.x - eye.x, dz = point.z - eye.z;
    const reach = Math.hypot(dx, dz);
    if (reach < 1e-4) { dx = 0; dz = -1; }
    const clamped = Math.max(PLACE_MIN, Math.min(PLACE_MAX, reach));
    if (Math.abs(clamped - reach) > 1e-4) {
      const k = clamped / (reach < 1e-4 ? 1 : reach);
      point = { x: eye.x + dx * k, y: floor, z: eye.z + dz * k };
    }

    // `distance` steht auf dem Ring (waagerecht, vom Kopf aus — so wie man
    // Entfernungen im Feld schätzt); `dist` ist die Strahllänge zum Zeichnen.
    return {
      point, ok,
      distance: clamped,
      dist: Math.hypot(point.x - from.x, point.y - from.y, point.z - from.z),
    };
  }

  /* ------------------------------------------- Anzeige über dem Patienten */

  /**
   * Wer nah genug steht, bekommt über dem Marker eine kleine Anzeige, die
   * aufsteigt und wieder einfährt — sie beantwortet „wer liegt da?", bevor man
   * den Patienten öffnet. Aufgehen bei POP_NEAR, zugehen erst bei POP_FAR:
   * ohne diesen Abstand flackert sie, wenn man an der Grenze steht.
   *
   * Nicht für den gerade geöffneten Patienten — der hat die Handlungskarte, und
   * beides übereinander wäre dieselbe Auskunft zweimal.
   */
  _updatePopups(dt) {
    const cardUp = this._screen.showCard !== false && !!this._anchor;

    const near = this._tags
      .filter((m) => m.distance != null && !(cardUp && m.target))
      .filter((m) => m.distance <= (this._pops.has(m.id) ? POP_FAR : POP_NEAR))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, POP_MAX);
    const open = new Set(near.map((m) => m.id));

    for (const m of near) {
      const cur = this._pops.get(m.id) || 0;
      this._pops.set(m.id, Math.min(1, cur + dt * POP_RISE));
    }
    for (const [id, t] of [...this._pops]) {
      if (open.has(id)) continue;
      const next = t - dt * POP_RISE;
      if (next <= 0) { this._pops.delete(id); this._dropPopTexture(id); }
      else this._pops.set(id, next);
    }
    return near;
  }

  /** Textur der kleinen Anzeige — neu nur, wenn sich am Inhalt etwas ändert. */
  _popTexture(m) {
    const key = `${m.short}|${m.card}|${m.sighted}|${m.transported}|${m.findings}|${m.treatments}`;
    let entry = this._popTex.get(m.id);
    if (!entry) {
      entry = { tex: this._texture(), key: null };
      this._popTex.set(m.id, entry);
    }
    if (entry.key !== key) {
      drawInfoPopup(this.popCanvas.ctx, POP_W, POP_H, m);
      this._upload(entry.tex, this.popCanvas.el);
      entry.key = key;
    }
    return entry.tex;
  }

  _dropPopTexture(id) {
    const entry = this._popTex.get(id);
    if (entry && this.gl) this.gl.deleteTexture(entry.tex);
    this._popTex.delete(id);
  }

  /** Welcher Bodenmarker liegt unter einem der Strahlen? */
  _pickMarker(rays) {
    let best = null;
    for (const m of this._tags) {
      const centre = { x: m.pos.x, y: this._floorNow + MARK_LIFT, z: m.pos.z };
      for (const ray of rays) {
        if (Math.abs(ray.dir.y) < 1e-4) continue;
        const dist = (centre.y - ray.origin.y) / ray.dir.y;      // Ebene y = const
        if (dist < 0.05 || dist > MARK_RANGE) continue;
        const hit = add3(ray.origin, scale3(ray.dir, dist));
        if (Math.hypot(hit.x - centre.x, hit.z - centre.z) > MARK_HALF) continue;
        if (!best || dist < best.dist) best = { marker: m, dist, point: hit };
      }
    }
    return best;
  }

  _activate() {
    this._dwell = 0;

    if (this._hover >= 0) {
      const b = (this._screen.buttons || [])[this._hover];
      this._hover = -1;
      if (b && typeof b.action === "function") b.action();
      return;
    }
    if (this._hudHover >= 0) {
      const b = (this._screen.hudActions || [])[this._hudHover];
      this._hudHover = -1;
      this._hudDirty = true;
      if (b && typeof b.action === "function") b.action();
      return;
    }
    if (this._bodyHover) {
      // Wer gerade gedreht hat, wollte nicht antippen.
      if (this._bodySwallow) { this._bodySwallow = false; return; }
      const region = this._bodyHover;
      this._bodyHover = null;
      this.onRegionPick(region);
      return;
    }
    if (this._place) {
      const point = this._place.point;
      this._place = null;
      this._placeAnchor = null;
      this.onPlace(point);
      return;
    }
    if (this._markHover) {
      const id = this._markHover.marker.id;
      this._markHover = null;
      this.onMarkerPick(id);
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

    const pose = frame.getViewerPose(this.refSpace);
    if (!pose) return;

    const head = pose.transform;
    this.onPose(head.position, flatten(forwardOf(head)), this.floorY);
    this.onFrame();

    this._updateFloor(head);

    const hud = this._hudPose(head, dt);
    const cardPos = this._cardPose(head);
    const card = { pos: cardPos, basis: basisFacing(cardPos, head.position) };
    const bodyMat = this._bodyMatrix(head);

    const rays = this._rays(frame, head);
    this._updatePointer(rays, card, hud, bodyMat, t, dt, head);
    const popups = this._updatePopups(dt);

    // Erst JETZT festhalten, was gezeichnet wird: ein Knopfdruck in
    // `_updatePointer` hat den Schirm womöglich schon gewechselt, und dann gibt
    // es die Karte oder das Körpermodell in diesem Bild nicht mehr.
    const showCard = this._screen.showCard !== false;
    const bodyDraw = bodyMat && this._screen.bodyModel
      ? { mat: bodyMat, model: this._screen.bodyModel } : null;

    // ---- Zeichnen auf Canvas + Texturen hochladen -------------------------
    // Bewusst vor dem Binden des Augenpuffers: texImage2D mitten in der
    // Zeichenphase hat sich als Quelle von Zustandsfehlern erwiesen, und für
    // das zweite Auge braucht es ohnehin nichts Neues.
    if (showCard && this._cardDirty) {
      this._rects = drawCard(this.cardCanvas.ctx, CARD_W, CARD_H, this._screen,
                             { hover: this._hover, dwell: this._dwell });
      this._upload(this.cardTex, this.cardCanvas.el);
      this._cardDirty = false;
    }
    if (!showCard) this._rects = [];
    if (this._hudDirty || performance.now() - this._hudDrawnAt > HUD_REDRAW_MS) {
      this._hudRects = drawHudLayer(this.hudCanvas.ctx, HUD_W, HUD_H, this._screen, this._map,
                                    { hover: this._hudHover, dwell: this._dwell });
      this._upload(this.hudTex, this.hudCanvas.el);
      this._hudDirty = false;
      this._hudDrawnAt = performance.now();
    }

    const hudModel = this._model(hud.pos, hud.basis, HUD_HALF_W, HUD_HALF_H);
    const cardModel = this._model(card.pos, card.basis, CARD_HALF_W, CARD_HALF_H);

    let placeModel = null;
    if (this._place) {
      this._reticleTexture(this._place, this._dwell);
      const at = { x: this._place.point.x, y: this._place.point.y + MARK_LIFT, z: this._place.point.z };
      placeModel = this._model(at, basisFloor(at, head.position), PLACE_HALF, PLACE_HALF);
    }

    // Marker liegen auf der gemeinsamen Bodenebene, nicht auf dem y-Wert ihrer
    // Akte — sonst schwebt einer und der nächste steckt im Boden.
    const markDraws = [];
    for (const m of this._tags) {
      if (m.distance != null && m.distance > MARK_RANGE) continue;
      const pos = { x: m.pos.x, y: this._floorNow + MARK_LIFT, z: m.pos.z };
      const hovered = !!(this._markHover && this._markHover.marker.id === m.id);
      markDraws.push({
        tex: this._markTexture({ ...m, hover: hovered }),
        model: this._model(pos, basisFloor(pos, head.position), MARK_HALF, MARK_HALF),
      });
    }

    // Kleine Anzeigen: sie steigen auf und wachsen dabei ein Stück. Daneben
    // steht der Patient selbst als Figur, in seiner Sichtungsfarbe.
    const popDraws = [];
    const popBodies = [];
    for (const m of popups) {
      const t01 = this._pops.get(m.id) || 0;
      if (t01 <= 0.02) continue;
      const e = t01 * t01 * (3 - 2 * t01);                  // weich an beiden Enden
      const at = { x: m.pos.x, y: this._floorNow + 0.10 + (POP_TOP - 0.10) * e, z: m.pos.z };
      const k = 0.55 + 0.45 * e;
      const face = basisFacing(at, head.position);
      popDraws.push({
        tex: this._popTexture(m),
        model: this._model(at, face, POP_HALF_W * k, POP_HALF_H * k),
      });

      const h = POP_BODY_H * k;
      const side = POP_HALF_W * k + POP_BODY_SIDE * k;
      const foot = {
        x: at.x - face.right.x * side,
        y: at.y - h / 2,
        z: at.z - face.right.z * side,
      };
      popBodies.push({
        mat: mul(mul(matTranslate(foot.x, foot.y, foot.z), matBasis(face)), matScale(h)),
        base: rgbOf(m.sighted ? m.color : "#8792a0"),
        findings: m.regions,
      });
    }

    const beamModels = [];
    for (const ray of rays) {
      if (ray.gaze) continue;
      // Der Strahl endet dort, wo er trifft — auch am Boden, wo der Ring liegt
      // und es keinen Zeigerpunkt gibt.
      const len = this._hitDist || BEAM_LEN;
      const centre = add3(ray.origin, scale3(ray.dir, len / 2));
      const toViewer = norm3(sub(head.position, centre));
      let side = cross3(ray.dir, toViewer);
      if (Math.hypot(side.x, side.y, side.z) < 1e-4) side = { x: 1, y: 0, z: 0 };
      side = norm3(side);
      beamModels.push(this._model(centre, {
        right: side, up: ray.dir, normal: norm3(cross3(side, ray.dir)),
      }, BEAM_HALF_W, len / 2));
    }

    let cursorModel = null;
    if (this._cursorWorld) {
      // Der Zeigerpunkt kann auf der Karte, auf einem HUD-Knopf oder am Boden
      // liegen — er wird deshalb zum Betrachter gedreht und nicht an die
      // Ausrichtung der Karte gehängt.
      const toEye = norm3(sub(head.position, this._cursorWorld));
      cursorModel = this._model(add3(this._cursorWorld, scale3(toEye, 0.004)),
                                basisFromNormal(toEye), CURSOR_HALF, CURSOR_HALF);
    } else if (this._diag.gaze) {
      const look = norm3(forwardOf(head));
      const at = add3(head.position, scale3(look, 1.0));
      cursorModel = this._model(at, basisFromNormal(scale3(look, -1)),
                                CURSOR_HALF * 0.6, CURSOR_HALF * 0.6);
    }

    // ---- ab hier nur noch zeichnen ---------------------------------------
    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
    gl.clearColor(0, 0, 0, 0);             // durchsichtig → Passthrough bleibt
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.prog);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    this._bindQuads();

    let drawn = 0, synthesised = 0;
    const views = pose.views;
    for (let vi = 0; vi < views.length; vi++) {
      const view = views[vi];

      // Fehlt der Viewport, wird die Ansicht nicht einfach übersprungen — genau
      // dann sieht man die Anzeige nur auf einem Auge. Bei zwei Ansichten ist
      // die Aufteilung des Augenpuffers bekannt: linke und rechte Hälfte.
      let vp = layer.getViewport(view);
      if (!vp && views.length === 2 && layer.framebufferWidth) {
        const w = Math.floor(layer.framebufferWidth / 2);
        vp = { x: vi * w, y: 0, width: w, height: layer.framebufferHeight };
        synthesised++;
      }
      if (!vp) continue;

      // Für jedes Auge frisch binden: einzelne Umsetzungen hängen den
      // Augenpuffer je Ansicht um, und ein einmaliges Binden am Frame-Anfang
      // trifft dann nur das erste.
      gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
      gl.viewport(vp.x, vp.y, vp.width, vp.height);
      drawn++;
      const viewProj = mul(view.projectionMatrix, view.transform.inverse.matrix);

      gl.bindTexture(gl.TEXTURE_2D, this.hudTex);
      gl.uniformMatrix4fv(this.uMVP, false, mul(viewProj, hudModel));
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      for (const m of markDraws) {
        gl.bindTexture(gl.TEXTURE_2D, m.tex);
        gl.uniformMatrix4fv(this.uMVP, false, mul(viewProj, m.model));
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

      for (const p of popDraws) {
        gl.bindTexture(gl.TEXTURE_2D, p.tex);
        gl.uniformMatrix4fv(this.uMVP, false, mul(viewProj, p.model));
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

      if (placeModel) {
        gl.bindTexture(gl.TEXTURE_2D, this.placeTex);
        gl.uniformMatrix4fv(this.uMVP, false, mul(viewProj, placeModel));
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

      // Das Körpermodell bringt eigenes Programm und Tiefentest mit; danach muss
      // die Rechteck-Maschine wieder eingerichtet werden (WebGL 1 hat keine VAOs,
      // Attributzeiger sind global).
      if (bodyDraw || popBodies.length) {
        for (const p of popBodies) {
          this.body.draw(mul(viewProj, p.mat), p.mat, p.findings, null, null,
                         { base: p.base, alpha: 0.92 });
        }
        if (bodyDraw) {
          this.body.draw(mul(viewProj, bodyDraw.mat), bodyDraw.mat,
                         bodyDraw.model.findings, this._bodyHover, bodyDraw.model.region);
        }
        this._bindQuads();
      }

      if (showCard) {
        gl.bindTexture(gl.TEXTURE_2D, this.cardTex);
        gl.uniformMatrix4fv(this.uMVP, false, mul(viewProj, cardModel));
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

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

      if (this.eyeTest && this.eyeTex) {
        gl.bindTexture(gl.TEXTURE_2D, this.eyeTex[Math.min(vi, this.eyeTex.length - 1)]);
        gl.uniformMatrix4fv(this.uMVP, false, mul(view.projectionMatrix, EYE_MODEL));
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
    }

    // Wenn nicht für jede gemeldete Ansicht gezeichnet wurde, sieht man die
    // Anzeige nur auf einem Auge. Das darf nicht stumm passieren.
    if (drawn !== views.length || views.length < 2 || synthesised) {
      const note = `Stereo: ${drawn}/${views.length} Ansichten` +
                   (synthesised ? `, ${synthesised} Viewport ergänzt` : "");
      if (note !== this._stereoNote) {
        this._stereoNote = note;
        console.warn("[JAR] " + note);
        this.onStereoIssue(note);
      }
    } else if (this._stereoNote) {
      this._stereoNote = null;
      this.onStereoIssue("");
    }
  }

  /** Die Rechteck-Maschine scharf machen: Programm, Puffer, Attribute, Textur 0. */
  _bindQuads() {
    const gl = this.gl;
    gl.useProgram(this.prog);
    gl.disable(gl.DEPTH_TEST);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(this.aUV);
    gl.vertexAttribPointer(this.aUV, 2, gl.FLOAT, false, 16, 8);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(this.uTex, 0);
  }

  _cleanup() {
    if (!this.session) return;
    try {
      this.session.removeEventListener("select", this._onSelectBound);
      this.session.removeEventListener("selectstart", this._onSelectStart);
      this.session.removeEventListener("selectend", this._onSelectEnd);
    } catch (_) {}
    if (this.body) { this.body.dispose(); this.body = null; }
    this.session = null;
    this.gl = null;
    this.refSpace = null;
    this.hudTex = this.cardTex = this.placeTex = this.cursorTex = this.beamTex =
      this.prog = this.vbo = null;
    this.hudCanvas = this.cardCanvas = this.markCanvas = this.placeCanvas =
      this.popCanvas = null;
    this._markTex.clear();
    this._popTex.clear();
    this._pops.clear();
    this._rects = [];
    this._hudRects = [];
    this._hudHover = -1;
    this._place = null;
    this._placeAnchor = null;
    this._reticleKey = null;
    this._cursorWorld = null;
    this._bodyHover = null;
    this._bodyDrag = null;
    this._bodyId = null;
    this._floorGuess = null;
    this._hudDir = null;
    this._hudTarget = null;
    this._hudMoving = false;
    this._placed = null;
    this.onEnd();
  }
}

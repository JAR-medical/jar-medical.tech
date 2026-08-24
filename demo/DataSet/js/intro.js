// The first ninety seconds of Medicraft.
//
// `intro_tunnel` in prefabs.js builds the block shell — a raised gallery that
// starts as a clinic wing and ends as a hole in a grass bank four blocks above
// the plaza. This module hangs everything the shell cannot carry: four real
// photographs stretched across the corridor so the player walks *through* them,
// the short texts that make each one mean something, the arrow that says which
// way is forward, and the four people behind the glass at the player's back.
//
// It also owns the one rule that makes the corridor a corridor: sprinting stays
// off until the player drops out of it. The photographs are the tutorial, so
// the tutorial is not something to run past.
//
// Every coordinate comes from `level.intro`, which is the same object the
// structure entry is spread from. Move the corridor in levels.js and the props
// move with it.

import * as THREE from "../vendor/three.module.js";

const PANEL_BG = "#0e130d";
const TEXT = "#e8eee2";
const MUTED = "#9aa88e";
const GREEN = "#7cfc00";
const RED = "#ff4136";
const YELLOW = "#ffd23f";
const BLUE = "#7fb6ff";

const SANS = "'Segoe UI', system-ui, -apple-system, sans-serif";
const MONO = "'Consolas', 'SF Mono', ui-monospace, monospace";

// The four chapters, in the order of Images/Photos.txt. `headline` is painted
// across the strip under the photograph, big enough to read while walking;
// `body` is the wall panel a few blocks earlier, which is where the actual
// knowledge lives. Keep both short — this is a corridor, not a briefing.
export const INTRO_CHAPTERS = Object.freeze([
  {
    src: "./images/01-sichtungskarte.jpg",
    accent: RED,
    kicker: "01 · SICHTUNG",
    headline: "Vier Kategorien. Wenige Sekunden pro Person.",
    panelTitle: "Sichten heißt sortieren",
    body: [
      { text: "SK I · rot — sofort, akute Lebensgefahr", color: RED },
      { text: "SK II · gelb — aufgeschoben behandelbar", color: YELLOW },
      { text: "SK III · grün — später, leicht verletzt", color: GREEN },
      { text: "SK IV · blau — betreuende Behandlung", color: BLUE },
    ],
    note: "Die Karte hängt am Patienten. Die Einsatzleitung steht woanders — die Information muss gesprochen zu ihr.",
    credit: "Triagekarte Feuerwehr Hamburg · Wiki-observer · CC BY-SA 2.0 DE",
  },
  {
    src: "./images/02-einsatz.jpg",
    accent: YELLOW,
    kicker: "02 · EINSATZ",
    headline: "Mehr Patienten als Hände.",
    panelTitle: "MANV — Massenanfall von Verletzten",
    body: [
      { text: "Behandelt wird nicht der Reihe nach," },
      { text: "sondern nach Dringlichkeit." },
      { text: "" },
      { text: "Jede Übergabe läuft gesprochen:" },
      { text: "Ort · Anzahl · Zustand · Bedarf.", color: YELLOW },
    ],
    note: "Wer schreibt, behandelt nicht. Sprache ist der einzige Kanal, der beide Hände frei lässt.",
    credit: "Russell Square, London, 7. Juli 2005 · Francis Tyers · CC BY-SA 3.0",
  },
  {
    src: "./images/03-ahrtal.jpg",
    accent: RED,
    kicker: "03 · WENN DIE LAGE KIPPT",
    headline: "Juli 2021: über 130 Tote — und kein gemeinsames Lagebild.",
    panelTitle: "Ahrtal, Juli 2021",
    body: [
      { text: "Türkis: die überflutete Fläche.", color: RED },
      { text: "Von oben war sie rekonstruierbar.", color: RED },
      { text: "" },
      { text: "Wo die Menschen waren, stand" },
      { text: "in keiner Karte." },
    ],
    note: "Funk, Strom und Meldewege fielen gleichzeitig aus. Die Informationen existierten — sie kamen nur nicht zusammen.",
    credit: "Überflutungsfläche Ahrtal · eigene Rekonstruktion des Projektteams (KI-gestützt)",
  },
  {
    src: "./images/04-luftaufklaerung.jpg",
    accent: BLUE,
    kicker: "04 · AUGEN VON OBEN",
    headline: "Satellit, Drohne, Mensch — drei Auflösungen derselben Lage.",
    panelTitle: "Aufklärung im Verbund",
    body: [
      { text: "Satellit: die Fläche, in Stunden.", color: BLUE },
      { text: "Drohne: der Straßenzug, in Minuten.", color: BLUE },
      { text: "Mensch: der Patient, in Sekunden.", color: GREEN },
      { text: "" },
      { text: "Nur der Mensch am Boden kann sagen," },
      { text: "wie es diesem einen Menschen geht." },
    ],
    note: "Der Aufklärungsteil entsteht in Zusammenarbeit mit dem DLR und Quantum Systems. Was von oben kommt, ist Fläche. Was zählt, spricht jemand ein.",
    credit: "Eigene Illustration des Projektteams (KI-gestützt) · DLR · Quantum Systems",
  },
  {
    src: "./images/05-lagebild.png",
    accent: GREEN,
    kicker: "05 · DARUM MEDICRAFT",
    headline: "Aus gesprochener Meldung wird ein Lagebild.",
    panelTitle: "Warum deine Stimme zählt",
    body: [
      { text: "Spracherkennung versteht vorgelesene Sätze." },
      { text: "Sie scheitert an Funk, Dialekt, Stress" },
      { text: "und Fachsprache." },
      { text: "" },
      { text: "Für deutsche Einsatzsprache gibt es", color: GREEN },
      { text: "kaum Trainingsdaten.", color: GREEN },
    ],
    note: "Jeder Bericht, den du gleich sprichst, ist einer davon. 19 Patienten, 19 Aufnahmen, ein Datensatz.",
    credit: "J.A.R. — eigenes Lagebild aus gesprochenen Meldungen",
  },
]);

// Three men and one woman, watching the test subject walk into the corridor.
// The coats are identical; what tells them apart at ten blocks in a dim room is
// hair, skin, and the one thing each of them is holding. `waves` marks the one
// who stops pretending to be professional about it.
const OBSERVERS = Object.freeze([
  { offset: -3.1, depth: 0.0, skin: 0xd9a066, hair: 0x2b2118, longHair: false, prop: "clipboard", lean: 0.5 },
  { offset: -1.0, depth: 0.45, skin: 0x8d5a3b, hair: 0x140f0c, longHair: false, prop: "tablet", lean: -0.35 },
  { offset: 1.1, depth: 0.0, skin: 0xe0ac7e, hair: 0x6b3f1d, longHair: true, prop: "mug", lean: 0.25, waves: true },
  { offset: 3.2, depth: 0.5, skin: 0xc68b59, hair: 0x4a4a4f, longHair: false, prop: null, lean: -0.6 },
]);

const WAVE_RANGE = 13;

// The air over the training site. Two liveries: medical, which is what the
// player is joining, and military, which is what actually moves mass in a real
// German disaster deployment. They orbit rather than hover, because a
// helicopter standing still in the sky reads as a bug, and they sit out to the
// sides and high up so the view back at the aircraft has depth to it.
//
// `at` is the centre of the orbit and `radius` how wide, `speed` is radians a
// second and negative goes the other way round, `lift` is height over the apron.
// Orbits are kept tight and centred near the aircraft on purpose. A wide circle
// carries a helicopter out over the edge of a 128-block map, where it is both
// too far to read and flying over nothing.
const AIRCRAFT = Object.freeze([
  { kind: "medic", at: [42, 76], lift: 22, radius: 12, speed: 0.1, scale: 1, body: 0xf2f4ef, trim: 0xd23b30 },
  { kind: "medic", at: [88, 72], lift: 18, radius: 11, speed: -0.13, scale: 0.95, body: 0xf6c945, trim: 0xd23b30 },
  { kind: "medic", at: [64, 58], lift: 15, radius: 9, speed: 0.16, scale: 0.9, body: 0xf2f4ef, trim: 0xe2622a },
  { kind: "military", at: [34, 96], lift: 28, radius: 14, speed: -0.07, scale: 1.35, body: 0x4a5340, trim: 0x353c2e },
  { kind: "military", at: [96, 92], lift: 32, radius: 15, speed: 0.06, scale: 1.5, body: 0x3f4738, trim: 0x2c3227 },
  // Straight over the top of the aircraft, which is where the player is looking
  // when they turn round at the bottom of the drop.
  { kind: "military", at: [64, 92], lift: 34, radius: 12, speed: -0.05, scale: 1.2, body: 0x51594a, trim: 0x363c31 },
]);

function canvasTexture(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function wrapLines(ctx, text, maxWidth) {
  const lines = [];
  let line = "";
  for (const word of String(text).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function panelBackground(ctx, w, h, accent) {
  ctx.fillStyle = PANEL_BG;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(232,238,226,0.22)";
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, w - 6, h - 6);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 14, h);
}

// The strip under each photograph. It is the only text a player who never stops
// walking will actually read, so it holds the chapter number and one sentence.
function captionTexture(chapter) {
  return canvasTexture(1600, 200, (ctx, w, h) => {
    panelBackground(ctx, w, h, chapter.accent);
    ctx.textBaseline = "middle";
    ctx.fillStyle = chapter.accent;
    ctx.font = `700 44px ${MONO}`;
    ctx.fillText(chapter.kicker, 46, h * 0.31);
    ctx.fillStyle = TEXT;
    ctx.font = `700 60px ${SANS}`;
    ctx.fillText(chapter.headline, 46, h * 0.7, w - 100);
  });
}

// The wall panel a few blocks before each photograph, on the left. This one
// carries the facts, so it gets room to breathe.
function panelTexture(chapter) {
  return canvasTexture(1024, 640, (ctx, w, h) => {
    panelBackground(ctx, w, h, chapter.accent);
    ctx.textBaseline = "top";
    ctx.fillStyle = chapter.accent;
    ctx.font = `700 30px ${MONO}`;
    ctx.fillText(chapter.kicker, 56, 52);

    ctx.fillStyle = TEXT;
    ctx.font = `700 54px ${SANS}`;
    ctx.fillText(chapter.panelTitle, 56, 104, w - 112);

    ctx.font = `400 36px ${SANS}`;
    let y = 196;
    for (const line of chapter.body) {
      if (line.text) {
        ctx.fillStyle = line.color || TEXT;
        ctx.fillText(line.text, 56, y, w - 112);
      }
      y += 46;
    }

    ctx.strokeStyle = "rgba(232,238,226,0.2)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(56, h - 168);
    ctx.lineTo(w - 56, h - 168);
    ctx.stroke();

    ctx.fillStyle = MUTED;
    ctx.font = `400 30px ${SANS}`;
    let ny = h - 148;
    for (const line of wrapLines(ctx, chapter.note, w - 112)) {
      ctx.fillText(line, 56, ny);
      ny += 38;
    }
  });
}

// The right-hand wall opposite each panel: where the picture came from. Small
// on purpose — it is a credit, not a chapter. The full list with licence links
// lives in legal/bildnachweise.html.
function creditTexture(chapter) {
  return canvasTexture(1024, 176, (ctx, w, h) => {
    ctx.fillStyle = "rgba(14,19,13,0.92)";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(232,238,226,0.18)";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, w - 4, h - 4);
    ctx.textBaseline = "top";
    ctx.fillStyle = MUTED;
    ctx.font = `700 24px ${MONO}`;
    ctx.fillText("BILDNACHWEIS", 40, 30);
    ctx.fillStyle = TEXT;
    ctx.font = `400 28px ${SANS}`;
    let y = 72;
    for (const line of wrapLines(ctx, chapter.credit, w - 80)) {
      ctx.fillText(line, 40, y);
      y += 36;
    }
  });
}

function signTexture({ kicker, headline, body = [], accent = GREEN }) {
  return canvasTexture(1024, 512, (ctx, w, h) => {
    panelBackground(ctx, w, h, accent);
    ctx.textBaseline = "top";
    ctx.fillStyle = accent;
    ctx.font = `700 30px ${MONO}`;
    ctx.fillText(kicker, 56, 54);
    ctx.fillStyle = TEXT;
    ctx.font = `700 60px ${SANS}`;
    let y = 108;
    for (const line of wrapLines(ctx, headline, w - 112)) {
      ctx.fillText(line, 56, y, w - 112);
      y += 70;
    }
    ctx.font = `400 34px ${SANS}`;
    ctx.fillStyle = MUTED;
    y += 16;
    for (const line of body) {
      ctx.fillText(line, 56, y, w - 112);
      y += 44;
    }
  });
}

function chevron(ctx, cx, cy, halfWidth, halfHeight, thickness, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - halfWidth, cy + halfHeight);
  ctx.lineTo(cx, cy - halfHeight);
  ctx.lineTo(cx + halfWidth, cy + halfHeight);
  ctx.stroke();
}

// Painted on the floor and repeated down the corridor, so the route remains
// legible without putting a large directional icon into the spawn view.
function floorChevronTexture() {
  return canvasTexture(256, 320, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    chevron(ctx, w / 2, h * 0.34, 84, 74, 30, "rgba(124,252,0,0.95)");
    chevron(ctx, w / 2, h * 0.72, 84, 74, 30, "rgba(124,252,0,0.4)");
  });
}

function plaqueTexture() {
  return canvasTexture(1024, 256, (ctx, w, h) => {
    ctx.fillStyle = "rgba(10,14,9,0.92)";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(124,252,0,0.55)";
    ctx.lineWidth = 5;
    ctx.strokeRect(3, 3, w - 6, h - 6);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = GREEN;
    ctx.font = `700 42px ${MONO}`;
    ctx.fillText("BEOBACHTUNGSRAUM · STUDIENLEITUNG", w / 2, 92, w - 60);
    ctx.fillStyle = MUTED;
    ctx.font = `400 34px ${SANS}`;
    ctx.fillText("Bitte nicht winken. Sie winken zurück.", w / 2, 168, w - 60);
  });
}

// A voxel person in a lab coat, built facing -z so the whole room looks down
// the corridor without a rotation. The arms hang from pivot groups, because one
// of them has to be able to wave.
function buildObserver(spec) {
  const group = new THREE.Group();
  const coat = new THREE.MeshLambertMaterial({ color: 0xf2f4ef });
  const skin = new THREE.MeshLambertMaterial({ color: spec.skin });
  const hair = new THREE.MeshLambertMaterial({ color: spec.hair });
  const trousers = new THREE.MeshLambertMaterial({ color: 0x2b3140 });
  const eyes = new THREE.MeshLambertMaterial({ color: 0x1b1f26 });

  const add = (geometry, material, x, y, z, parent = group) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };

  add(new THREE.BoxGeometry(0.2, 0.72, 0.2), trousers, -0.13, 0.36, 0);
  add(new THREE.BoxGeometry(0.2, 0.72, 0.2), trousers, 0.13, 0.36, 0);
  // The coat is two boxes: a fitted chest and a skirt that flares past the hips.
  add(new THREE.BoxGeometry(0.56, 0.42, 0.3), coat, 0, 0.9, 0);
  add(new THREE.BoxGeometry(0.5, 0.5, 0.28), coat, 0, 1.32, 0);

  const shoulders = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.36, 1.5, 0);
    group.add(pivot);
    add(new THREE.BoxGeometry(0.16, 0.62, 0.18), coat, 0, -0.31, 0, pivot);
    add(new THREE.BoxGeometry(0.15, 0.12, 0.17), skin, 0, -0.66, 0, pivot);
    shoulders.push(pivot);
  }

  const head = new THREE.Group();
  head.position.set(0, 1.6, 0);
  group.add(head);
  add(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin, 0, 0.21, 0, head);
  add(new THREE.BoxGeometry(0.44, 0.14, 0.44), hair, 0, 0.4, 0, head);
  if (spec.longHair) {
    add(new THREE.BoxGeometry(0.46, 0.44, 0.12), hair, 0, 0.15, 0.18, head);
  } else {
    add(new THREE.BoxGeometry(0.44, 0.1, 0.2), hair, 0, 0.33, 0.13, head);
  }
  // Eyes on the -z face, which is the side the corridor is on.
  add(new THREE.BoxGeometry(0.08, 0.08, 0.03), eyes, -0.1, 0.24, -0.22, head);
  add(new THREE.BoxGeometry(0.08, 0.08, 0.03), eyes, 0.1, 0.24, -0.22, head);

  if (spec.prop === "clipboard") {
    add(new THREE.BoxGeometry(0.3, 0.38, 0.05), new THREE.MeshLambertMaterial({ color: 0xd8c690 }), 0.3, 1.02, -0.2);
  } else if (spec.prop === "tablet") {
    add(new THREE.BoxGeometry(0.28, 0.36, 0.04), new THREE.MeshBasicMaterial({ color: 0x5ad2c4 }), -0.3, 1.05, -0.2);
  } else if (spec.prop === "mug") {
    add(new THREE.BoxGeometry(0.14, 0.16, 0.14), new THREE.MeshLambertMaterial({ color: 0xc0453c }), 0.29, 1.05, -0.18);
  }

  // A room of four people standing to attention is a shop window. A few degrees
  // of turn each is enough to make it look like they were already talking.
  group.rotation.y = spec.lean * 0.24;
  return { group, head, shoulders, waves: Boolean(spec.waves), phase: Math.random() * Math.PI * 2 };
}

// A helicopter, built nose-along -z so the orbit code can aim it with yaw
// alone. Deliberately coarse: at twenty blocks out and forty up, a silhouette
// and a spinning disc are the whole read, and every extra box is another draw
// call over a level that already has a world to render.
function buildHelicopter(spec) {
  const group = new THREE.Group();
  const body = new THREE.MeshLambertMaterial({ color: spec.body });
  const trim = new THREE.MeshLambertMaterial({ color: spec.trim });
  const glass = new THREE.MeshLambertMaterial({ color: 0x2b3b46 });
  const metal = new THREE.MeshLambertMaterial({ color: 0x5b6169 });

  const add = (geometry, material, x, y, z, parent = group) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };

  add(new THREE.BoxGeometry(1.5, 1.4, 3.4), body, 0, 0, 0);
  add(new THREE.BoxGeometry(1.2, 0.9, 0.7), glass, 0, 0.05, -1.9);
  add(new THREE.BoxGeometry(0.42, 0.5, 3.2), body, 0, 0.25, 2.4);
  add(new THREE.BoxGeometry(0.2, 1.5, 0.9), body, 0, 0.9, 3.7);
  add(new THREE.BoxGeometry(2.2, 0.16, 0.6), body, 0, 0.5, 3.6);
  // Skids on struts, so it does not read as sitting on its belly in mid-air.
  for (const side of [-1, 1]) {
    add(new THREE.BoxGeometry(0.16, 0.16, 3), metal, side * 0.7, -1.05, -0.1);
    add(new THREE.BoxGeometry(0.14, 0.5, 0.14), metal, side * 0.7, -0.85, -1);
    add(new THREE.BoxGeometry(0.14, 0.5, 0.14), metal, side * 0.7, -0.85, 0.9);
  }

  if (spec.kind === "medic") {
    // A cross on each flank and a lit belly beacon. This is the service the
    // player is joining, so it has to be legible from the apron.
    for (const side of [-1, 1]) {
      add(new THREE.BoxGeometry(0.06, 0.9, 0.3), trim, side * 0.78, 0, 0.2);
      add(new THREE.BoxGeometry(0.06, 0.3, 0.9), trim, side * 0.78, 0, 0.2);
    }
    add(new THREE.BoxGeometry(0.3, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0xff5a4a }), 0, -0.78, 0.4);
  } else {
    // Stub wings and a nose sensor turret: the quickest way to read "military"
    // in a silhouette without modelling anything anyone has to think about.
    for (const side of [-1, 1]) {
      add(new THREE.BoxGeometry(1.8, 0.2, 1.1), trim, side * 1.5, 0.1, 0.1);
      add(new THREE.BoxGeometry(0.5, 0.5, 1.6), metal, side * 2, -0.2, 0.1);
    }
    add(new THREE.BoxGeometry(0.6, 0.5, 0.5), metal, 0, -0.6, -1.9);
  }

  add(new THREE.BoxGeometry(0.34, 0.5, 0.34), metal, 0, 0.9, -0.2);
  const mainRotor = new THREE.Group();
  mainRotor.position.set(0, 1.2, -0.2);
  group.add(mainRotor);
  const bladeCount = spec.kind === "military" ? 5 : 4;
  const bladeGeometry = new THREE.BoxGeometry(8.4, 0.09, 0.34);
  for (let i = 0; i < bladeCount; i++) {
    const blade = new THREE.Mesh(bladeGeometry, metal);
    blade.rotation.y = (i / bladeCount) * Math.PI * 2;
    mainRotor.add(blade);
  }

  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.2, 0.9, 3.7);
  group.add(tailRotor);
  const tailBladeGeometry = new THREE.BoxGeometry(0.06, 1.9, 0.2);
  for (let i = 0; i < 2; i++) {
    const blade = new THREE.Mesh(tailBladeGeometry, metal);
    blade.rotation.x = (i / 2) * Math.PI;
    tailRotor.add(blade);
  }

  group.scale.setScalar(spec.scale ?? 1);
  return { group, mainRotor, tailRotor, phase: Math.random() * Math.PI * 2 };
}

export class IntroSequence {
  // `onExit` fires once, on the frame the player leaves the corridor. Anything
  // that belongs to the level rather than the intro — the banner, the audio
  // sting, handing sprinting back — is the caller's business and happens there.
  constructor(scene, level, world, { onExit = null, anisotropy = 1 } = {}) {
    this.scene = scene;
    this.config = level.intro;
    this.onExit = onExit;
    this.done = false;
    this.disposed = false;
    this.clock = 0;
    this.group = new THREE.Group();
    this.group.name = "medicraft-intro";
    this.observers = [];
    this.lights = [];
    this.aircraft = [];
    this.photoTextures = [];

    const cfg = this.config;
    // Feet height in the corridor: the floor block sits at plaza + lift, so the
    // surface the player stands on is one above it.
    this.floorY = world.plazaY + cfg.lift + 1;
    this.axis = cfg.axis;
    this.leftWallX = cfg.axis - cfg.halfWidth;
    this.rightWallX = cfg.axis + cfg.halfWidth + 1;
    this.anisotropy = anisotropy;
    this.loader = new THREE.TextureLoader();
    this.windowPoint = new THREE.Vector3(cfg.axis + 0.5, this.floorY, cfg.windowZ);

    this._buildSignage();
    this._buildChapters();
    this._buildObservationRoom();
    this._buildAtmosphere();
    this._buildAirTraffic(world);

    scene.add(this.group);
  }

  _mesh(geometry, material, x, y, z) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    this.group.add(mesh);
    return mesh;
  }

  // A flat sign facing back down the corridor, i.e. towards a player walking in
  // the -z direction. `wall` puts one against the left or right side instead.
  _sign(texture, { z, width, height, y, wall = null }) {
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    if (wall === "left") {
      mesh.position.set(this.leftWallX + 0.04, y, z);
      mesh.rotation.y = Math.PI / 2;
    } else if (wall === "right") {
      mesh.position.set(this.rightWallX - 0.04, y, z);
      mesh.rotation.y = -Math.PI / 2;
    } else {
      mesh.position.set(this.axis + 0.5, y, z);
    }
    this.group.add(mesh);
    return mesh;
  }

  _buildSignage() {
    const cfg = this.config;
    const y = this.floorY;

    this._sign(
      signTexture({
        kicker: "MEDICRAFT · J.A.R.",
        headline: "Vier Bilder, dann dein erster Patient.",
        body: ["Du sprichst. Daraus wird ein Datensatz,", "der Rettungskräften zuhören lernt."],
      }),
      { z: cfg.arrowZ + 2, y: y + 2.7, width: 4.4, height: 2.2, wall: "left" },
    );

    // Keep the low floor markers as quiet orientation help, but do not place
    // the large "HIER ENTLANG" icon in the player's first view at spawn.
    const chevronTexture = floorChevronTexture();
    const chevronGeometry = new THREE.PlaneGeometry(1.7, 2.1);
    for (let z = cfg.arrowZ - 2; z > cfg.to + 1; z -= 4) {
      const material = new THREE.MeshBasicMaterial({
        map: chevronTexture,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        toneMapped: false,
      });
      const decal = this._mesh(chevronGeometry, material, this.axis + 0.5, y + 0.02, z);
      // -90° about X sends the texture's "up" to -z, which is the way out.
      decal.rotation.x = -Math.PI / 2;
    }
  }

  _buildChapters() {
    const cfg = this.config;
    const y = this.floorY;
      // The corridor is five blocks of air. A photograph has to clear the caption
      // strip under it and still leave head room under the ceiling. Every source
      // image gets this same frame; the texture is cropped to cover it, rather
      // than contained with empty space around narrow/portrait source files.
      const maxWidth = cfg.halfWidth * 2 + 0.6;
      const maxHeight = 3.2;
      const frameAspect = maxWidth / maxHeight;

    INTRO_CHAPTERS.forEach((chapter, index) => {
      const z = cfg.chapterZ[index];
      if (z === undefined) return;

      const photoMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        toneMapped: false,
        transparent: true,
        opacity: 0,
      });
      const photo = this._mesh(
        new THREE.PlaneGeometry(maxWidth, maxHeight),
        photoMaterial,
        this.axis + 0.5,
        y + 2.9,
        z,
      );

      // The originals keep their proportions. The central crop makes every
      // image fill the frame without stretching, including the wide PNG.
      this.loader.load(chapter.src, (texture) => {
        if (this.disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = this.anisotropy;
        const imageAspect = (texture.image?.width || 4) / (texture.image?.height || 3);
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        if (imageAspect > frameAspect) {
          const visibleWidth = frameAspect / imageAspect;
          texture.repeat.set(visibleWidth, 1);
          texture.offset.set((1 - visibleWidth) / 2, 0);
        } else {
          const visibleHeight = imageAspect / frameAspect;
          texture.repeat.set(1, visibleHeight);
          texture.offset.set(0, (1 - visibleHeight) / 2);
        }
        texture.needsUpdate = true;
        this.photoTextures.push(texture);
        photoMaterial.map = texture;
        photoMaterial.opacity = 1;
        photoMaterial.needsUpdate = true;
      });

      // The caption sits in front of the photograph and low, where it does not
      // cover the picture but is unavoidable on the way through it.
      this._sign(captionTexture(chapter), {
        z: z + 0.06,
        y: y + 0.86,
        width: maxWidth,
        height: maxWidth / 8,
      });

      // Read on the approach, a few blocks before the picture it explains.
      const panelZ = cfg.panelZ?.[index] ?? z + 3;
      this._sign(panelTexture(chapter), {
        z: panelZ,
        y: y + 2.5,
        width: 4.2,
        height: 2.62,
        wall: "left",
      });
      this._sign(creditTexture(chapter), {
        z: panelZ,
        y: y + 1.5,
        width: 3.6,
        height: 0.62,
        wall: "right",
      });
    });
  }

  // The easter egg. It is behind the spawn, so it only exists for a player who
  // turns around instead of following the arrow.
  _buildObservationRoom() {
    const cfg = this.config;
    // The gallery is one step up from the corridor, so they look down at the
    // player rather than across. Its floor block is at the corridor's feet
    // height, which puts them standing one above it.
    const roomFloor = this.floorY + 1;

    for (const spec of OBSERVERS) {
      const observer = buildObserver(spec);
      observer.group.position.set(cfg.axis + 0.5 + spec.offset, roomFloor, cfg.windowZ + 1.6 + spec.depth);
      this.group.add(observer.group);
      this.observers.push(observer);
    }

    // Above the pane, on the solid band between the glass and the ceiling.
    const plaque = this._sign(plaqueTexture(), {
      z: cfg.windowZ - 0.06,
      y: this.floorY + 4.5,
      width: 2.8,
      height: 0.7,
    });
    // The plaque is mounted on the observation-room side of the glass. Turn it
    // around so its message is readable from the corridor/spawn side.
    plaque.rotation.y = Math.PI;

    const lamp = new THREE.PointLight(0xdfe9ff, 14, 17, 2);
    lamp.position.set(cfg.axis + 0.5, roomFloor + 3, cfg.windowZ + 2.5);
    this.group.add(lamp);
    this.lights.push(lamp);
  }

  _buildAtmosphere() {
    const cfg = this.config;
    const y = this.floorY;

    // Lights in the clad section only. Past the rock cut the corridor is open
    // to the sky, and lighting that stretch would flatten the transition.
    for (let z = cfg.windowZ - 4; z > cfg.to + 8; z -= 7) {
      const lamp = new THREE.PointLight(0xffeec6, 10, 14, 2);
      lamp.position.set(cfg.axis + 0.5, y + 3.9, z);
      this.group.add(lamp);
      this.lights.push(lamp);
    }

    const count = 260;
    const positions = new Float32Array(count * 3);
    const span = cfg.windowZ - cfg.to;
    for (let i = 0; i < count; i++) {
      positions[i * 3] = cfg.axis + 0.5 + (Math.random() - 0.5) * (cfg.halfWidth * 2 - 0.5);
      positions[i * 3 + 1] = y + 0.3 + Math.random() * 4.2;
      positions[i * 3 + 2] = cfg.to + Math.random() * span;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const motes = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: 0xfff4d8,
        size: 0.055,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    );
    motes.frustumCulled = false;
    this.group.add(motes);
    this.motes = motes;

    // The way out, seen from inside: a warm wash hanging in the mouth so the
    // exit reads as a destination from halfway down the corridor.
    this.glow = this._mesh(
      new THREE.PlaneGeometry(cfg.halfWidth * 2 + 2, 6),
      new THREE.MeshBasicMaterial({
        color: 0xfff2cf,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
      cfg.axis + 0.5,
      y + 2.4,
      cfg.to - 0.4,
    );
  }

  // Helicopters over the site. Unlike everything else in here they outlive the
  // corridor: the point of them is the view back at the aircraft once the
  // player has dropped onto the apron, so they keep flying until the level ends.
  _buildAirTraffic(world) {
    for (const spec of AIRCRAFT) {
      const heli = buildHelicopter(spec);
      heli.orbit = {
        x: spec.at[0],
        z: spec.at[1],
        y: world.plazaY + spec.lift,
        radius: spec.radius,
        speed: spec.speed,
        bob: 0.5 + Math.random() * 0.6,
      };
      heli.spin = spec.kind === "military" ? 15 : 21;
      this.group.add(heli.group);
      this.aircraft.push(heli);
      this._flyAircraft(heli, 0);
    }
  }

  _flyAircraft(heli, elapsed) {
    const orbit = heli.orbit;
    const angle = elapsed * orbit.speed + heli.phase;
    heli.group.position.set(
      orbit.x + Math.cos(angle) * orbit.radius,
      orbit.y + Math.sin(elapsed * 0.5 + heli.phase) * orbit.bob,
      orbit.z + Math.sin(angle) * orbit.radius,
    );
    // Nose along the tangent and banked into the turn, which way depending only
    // on which way round it is going.
    heli.group.rotation.y = -angle + (orbit.speed > 0 ? -Math.PI / 2 : Math.PI / 2);
    heli.group.rotation.z = orbit.speed > 0 ? -0.13 : 0.13;
  }

  update(dt, playerPos) {
    if (!playerPos) return;
    this.clock += dt;

    for (const heli of this.aircraft) {
      this._flyAircraft(heli, this.clock);
      heli.mainRotor.rotation.y += dt * heli.spin;
      heli.tailRotor.rotation.x += dt * heli.spin * 2.4;
    }

    // Everything below belongs to the corridor, and once the player is out
    // there is a drop they cannot climb back up between them and it.
    if (this.done) return;

    if (this.glow) this.glow.material.opacity = 0.13 + 0.05 * Math.sin(this.clock * 1.1);

    // They are watching the player, not the room. Close enough, and one of them
    // gives up on being professional about it.
    const waving = playerPos.distanceTo(this.windowPoint) < WAVE_RANGE;
    for (const observer of this.observers) {
      const sway = Math.sin(this.clock * 0.9 + observer.phase);
      const dx = playerPos.x - observer.group.position.x;
      const dz = Math.max(0.5, observer.group.position.z - playerPos.z);
      // A glance, not a full turn: the head tracks at a fraction of the real
      // bearing so nobody swivels 90° when the player walks past the glass.
      observer.head.rotation.y = Math.atan2(-dx, dz) * 0.6 + sway * 0.05 - observer.group.rotation.y;
      observer.head.rotation.x = sway * 0.03;
      const raise = waving && observer.waves ? 2.5 : sway * 0.06;
      const right = observer.shoulders[1];
      const blend = Math.min(1, dt * 5);
      right.rotation.x += (raise - right.rotation.x) * blend;
      right.rotation.z = waving && observer.waves ? Math.sin(this.clock * 7) * 0.4 : 0;
      observer.shoulders[0].rotation.x = -sway * 0.06;
    }

    if (playerPos.z < this.config.exitZ) {
      this.done = true;
      for (const light of this.lights) light.visible = false;
      this.onExit?.();
    }
  }

  dispose() {
    this.disposed = true;
    this.scene.remove(this.group);
    this.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        if (!material) continue;
        if (material.map) material.map.dispose();
        material.dispose();
      }
    });
    for (const texture of this.photoTextures) texture.dispose();
    this.photoTextures = [];
    this.observers = [];
    this.lights = [];
    this.aircraft = [];
  }
}

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
    src: "./images/03-ahrtal.png",
    accent: RED,
    kicker: "03 · WENN DIE LAGE KIPPT",
    headline: "Juli 2021: Funk, Strom und Meldewege fallen gleichzeitig aus.",
    panelTitle: "Ahrtal, Juli 2021",
    body: [
      { text: "Über 130 Menschen sterben allein", color: RED },
      { text: "im Kreis Ahrweiler.", color: RED },
      { text: "" },
      { text: "Die Informationen waren da." },
      { text: "Sie kamen nur nicht zusammen." },
    ],
    note: "Ohne gemeinsames Lagebild entscheidet jede Einheit für sich — und keine für die Gesamtlage.",
    credit: "Ahrtal nach der Flut · Süddeutsche Zeitung · redaktionelle Verwendung",
  },
  {
    src: "./images/04-lagebild.png",
    accent: GREEN,
    kicker: "04 · DARUM MEDICRAFT",
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

// The hero sign, hanging in the corridor a few blocks ahead of the spawn. One
// arrow, one instruction, nothing else to decide.
function arrowSignTexture() {
  return canvasTexture(1024, 384, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(14,19,13,0.88)";
    ctx.beginPath();
    ctx.roundRect(8, 8, w - 16, h - 16, 26);
    ctx.fill();
    ctx.strokeStyle = GREEN;
    ctx.lineWidth = 6;
    ctx.stroke();

    chevron(ctx, 176, h / 2, 74, 66, 26, GREEN);
    chevron(ctx, 104, h / 2, 74, 66, 26, "rgba(124,252,0,0.42)");

    ctx.textBaseline = "middle";
    ctx.fillStyle = TEXT;
    ctx.font = `700 88px ${SANS}`;
    ctx.fillText("HIER ENTLANG", 300, h / 2 - 36, w - 340);
    ctx.fillStyle = MUTED;
    ctx.font = `400 38px ${SANS}`;
    ctx.fillText("W = vorwärts · vier Bilder bis zum Einsatz", 300, h / 2 + 46, w - 340);
  });
}

// Painted on the floor and repeated down the corridor, so the arrow is still
// answering the question after the sign is behind the player.
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
    this.bobbers = [];
    this.lights = [];
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

    const arrow = this._sign(arrowSignTexture(), {
      z: cfg.arrowZ,
      y: y + 3.5,
      width: 3.6,
      height: 1.35,
    });
    this.bobbers.push({ mesh: arrow, baseY: arrow.position.y, amplitude: 0.09, speed: 1.5 });

    // Repeated on the floor all the way to the mouth, so the arrow is still
    // answering the question after the sign is behind the player.
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
    // strip under it and still leave head room under the ceiling.
    const maxWidth = cfg.halfWidth * 2 + 0.6;
    const maxHeight = 3.2;

    INTRO_CHAPTERS.forEach((chapter, index) => {
      const z = cfg.chapterZ[index];
      if (z === undefined) return;

      // The backing spans the whole cross-section, not just the picture. Two of
      // the four photographs are 4:3 and would otherwise leave a gap at each
      // wall wide enough to walk past — and walking *through* the picture is
      // the entire point of the corridor. Translucent rather than solid, so the
      // way ahead is still legible through four of these in a row.
      this._mesh(
        new THREE.PlaneGeometry(cfg.halfWidth * 2 + 1, 4.9),
        new THREE.MeshBasicMaterial({
          color: 0x0a0d08,
          transparent: true,
          opacity: 0.75,
          side: THREE.DoubleSide,
          depthWrite: false,
          toneMapped: false,
        }),
        this.axis + 0.5,
        y + 2.45,
        z - 0.05,
      );

      const photoMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        toneMapped: false,
        transparent: true,
        opacity: 0,
      });
      const photo = this._mesh(new THREE.PlaneGeometry(1, 1), photoMaterial, this.axis + 0.5, y + 2.9, z);

      // The originals are full resolution and are sized to the corridor once
      // the real aspect ratio is known, rather than guessed per file.
      this.loader.load(chapter.src, (texture) => {
        if (this.disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = this.anisotropy;
        this.photoTextures.push(texture);
        const aspect = (texture.image?.width || 4) / (texture.image?.height || 3);
        let width = maxHeight * aspect;
        let height = maxHeight;
        if (width > maxWidth) {
          width = maxWidth;
          height = maxWidth / aspect;
        }
        photo.geometry.dispose();
        photo.geometry = new THREE.PlaneGeometry(width, height);
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
    this._sign(plaqueTexture(), {
      z: cfg.windowZ - 0.06,
      y: this.floorY + 4.5,
      width: 2.8,
      height: 0.7,
    });

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

  update(dt, playerPos) {
    // Once the player is out, the corridor is scenery behind a drop they cannot
    // climb back up. Nothing in here needs another frame of work.
    if (this.done || !playerPos) return;
    this.clock += dt;

    for (const bob of this.bobbers) {
      bob.mesh.position.y = bob.baseY + Math.sin(this.clock * bob.speed) * bob.amplitude;
    }
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
    this.bobbers = [];
    this.lights = [];
  }
}

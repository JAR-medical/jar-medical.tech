/* Was für ein Gerät ist das eigentlich? — und was folgt daraus.
 *
 * Diese App lief bisher auf PICO 4 und Meta Quest. Beide zeigen Passthrough auf
 * einem undurchsichtigen Bildschirm: die Kamera nimmt die Welt auf, die Anzeige
 * wird darüber gemischt. Eine **HoloLens 2** macht etwas grundlegend anderes —
 * sie spiegelt Licht in ein durchsichtiges Glas. Daraus folgen drei Dinge, die
 * eine Anzeige, die für Quest gebaut wurde, dort unbrauchbar machen:
 *
 *   1. **Schwarz ist unsichtbar.** Ein additives Glas kann nur Licht
 *      hinzufügen, keins wegnehmen. Jede dunkle Unterlage, jeder schwarze Saum
 *      um die Schrift, jeder Verdunkler ist auf einer HoloLens schlicht nicht
 *      da. Genau diese Mittel trugen hier bisher die Lesbarkeit.
 *   2. **Das Blickfeld ist klein.** 43° × 29° gegen rund 100° bei einer Quest.
 *      Ein HUD, das dort am Rand sitzt, liegt hier weit außerhalb des Glases —
 *      man sähe die Ecken nie.
 *   3. **Nah ist unangenehm.** Die Optik ist auf etwa zwei Meter scharf
 *      gestellt. Was 95 cm vor dem Auge steht, zwingt Augen und Schärfe
 *      auseinander und ermüdet.
 *
 * Nichts davon wird an der Kennung des Browsers festgemacht — die ist auf der
 * HoloLens ein gewöhnliches Windows-Edge und von einem Laptop nicht zu
 * unterscheiden. Gefragt wird stattdessen das Gerät selbst:
 * `session.environmentBlendMode` sagt, wie gemischt wird, und die
 * Projektionsmatrix der Ansicht sagt, wie groß das Blickfeld ist. Das trägt
 * auch für Geräte, die es beim Schreiben dieser Zeilen noch nicht gab.
 *
 * Die Rechenteile sind rein und stehen in tests/logic.test.mjs.
 */

"use strict";

/* --------------------------------------------------- Blickfeld ausmessen */

/**
 * Die vier halben Öffnungswinkel aus einer Projektionsmatrix.
 *
 * WebXR-Projektionen sind regelmäßig **asymmetrisch** — bei zwei Augen zeigt
 * jedes ein Stück weiter nach außen als nach innen. Deshalb vier Werte und
 * nicht ein „FOV".
 *
 * Herleitung für die rechte Kante: im Clipraum ist x' = m0·x + m8·z und
 * w = −z. Die Kante liegt bei x'/w = 1, also m0·x + m8·z = −z und damit
 * x/(−z) = (1 + m8)/m0 — und x/(−z) ist der Tangens des Winkels nach rechts.
 *
 * @param {ArrayLike<number>} m spaltenweise 4×4
 * @returns {{left:number, right:number, up:number, down:number,
 *            horizontal:number, vertical:number}} Radiant
 */
export function fovFromProjection(m) {
  const safe = (x) => (Number.isFinite(x) && Math.abs(x) > 1e-6 ? x : 1);
  const m0 = safe(m[0]), m5 = safe(m[5]);
  const m8 = Number.isFinite(m[8]) ? m[8] : 0;
  const m9 = Number.isFinite(m[9]) ? m[9] : 0;

  const right = Math.atan(Math.abs((1 + m8) / m0));
  const left = Math.atan(Math.abs((1 - m8) / m0));
  const up = Math.atan(Math.abs((1 + m9) / m5));
  const down = Math.atan(Math.abs((1 - m9) / m5));

  return { left, right, up, down, horizontal: left + right, vertical: up + down };
}

/**
 * Das größte Rechteck mit festem Seitenverhältnis, das in ein Blickfeld passt.
 *
 * Maßgeblich ist der **kleinere** der beiden Winkel je Achse: nur was auch auf
 * der knapperen Seite noch drin ist, ist auf beiden Augen zu sehen.
 *
 * Zusätzlich gibt es eine Bequemlichkeitsgrenze. Auf einer Quest ist das
 * Blickfeld so groß, dass ein wirklich ausgereiztes HUD Kopfdrehen verlangte —
 * die Randinformation soll aber mit den Augen erfasst werden. Die Grenze ist
 * genau das, was das HUD vorher fest verdrahtet hatte (rund 82° breit); auf
 * einem kleinen Blickfeld greift stattdessen die Gerätegrenze.
 *
 * @param {{left:number,right:number,up:number,down:number}} fov
 * @param {number} distance Meter vor dem Auge
 * @param {number} aspect   Breite/Höhe der Textur
 * @param {{safety?:number, maxHalfH?:number, maxHalfV?:number}} [opts]
 * @returns {{halfW:number, halfH:number}} halbe Kantenlängen in Metern
 */
export function fitToFov(fov, distance, aspect, opts = {}) {
  const safety = opts.safety ?? 0.92;
  const maxHalfH = opts.maxHalfH ?? (41 * Math.PI) / 180;
  const maxHalfV = opts.maxHalfV ?? (25 * Math.PI) / 180;

  const angH = Math.min(fov.left, fov.right, maxHalfH) * safety;
  const angV = Math.min(fov.up, fov.down, maxHalfV) * safety;

  const roomW = distance * Math.tan(Math.max(0.01, angH));
  const roomH = distance * Math.tan(Math.max(0.01, angV));

  // Seitenverhältnis halten: es begrenzt die Achse, die zuerst anstößt.
  return roomW / roomH > aspect
    ? { halfW: roomH * aspect, halfH: roomH }
    : { halfW: roomW, halfH: roomW / aspect };
}

/* ------------------------------------------------------ Geräteeigenschaften */

/** Ab hier gilt ein Blickfeld als klein (HoloLens 2: 43°). */
const NARROW_FOV = (70 * Math.PI) / 180;

/**
 * Was aus Mischart und Blickfeld folgt. Ein einziger Satz von Schaltern, damit
 * nicht an zwanzig Stellen „wenn HoloLens" steht.
 *
 * @param {string} blendMode  aus `session.environmentBlendMode`
 * @param {{horizontal?:number}} [fov]
 * @returns {{blendMode:string, additive:boolean, narrow:boolean,
 *            hudDistance:number, cardDistance:number, comfortNear:number,
 *            label:string}}
 */
export function displayProfile(blendMode, fov = null) {
  const additive = blendMode === "additive";
  const narrow = !!fov && fov.horizontal > 0 && fov.horizontal < NARROW_FOV;

  return {
    blendMode: blendMode || "unknown",
    additive,
    narrow,
    // Ein durchsichtiges Glas ist auf rund zwei Meter scharf. Alles Nähere
    // zwingt Augen und Schärfe auseinander; Microsoft nennt 1,25 m als untere
    // brauchbare Grenze. Bei Passthrough auf einem Bildschirm gibt es das
    // Problem nicht — da bleibt es beim kopfnahen HUD.
    hudDistance: additive ? 1.7 : 0.95,
    cardDistance: additive ? 1.6 : 1.25,
    comfortNear: additive ? 0.3 : 0.1,
    // Wie viel vom Blickfeld eine Fläche einnehmen darf.
    //
    // Auf einem großen Blickfeld ist das fast beliebig — da begrenzt ohnehin
    // die Bequemlichkeitsgrenze. Auf einem kleinen ist es die entscheidende
    // Zahl: das HUD trägt seine Inhalte in den **Ecken**, und eine Fläche, die
    // das Glas ausreizt, schiebt genau diese Ecken an den Rand des Sichtbaren.
    // Man sieht dann eine leere Mitte und hält die Anzeige für kaputt.
    hudSafety: narrow ? 0.75 : 0.92,
    // Die Handlungskarte muss ganz zu lesen sein, Überschrift wie Knöpfe.
    // Sie darf deshalb noch deutlich weniger ausreizen.
    cardSafety: narrow ? 0.70 : 0.95,
    label: additive ? (narrow ? "additiv, kleines Blickfeld" : "additiv")
         : blendMode === "alpha-blend" ? "Passthrough"
         : blendMode === "opaque" ? "geschlossen" : "unbekannt",
  };
}

/* -------------------------------------------------- Farben für additiv
 *
 * Auf einem additiven Glas trägt nur, was leuchtet. Die bisherige Lesbarkeit
 * beruht auf dem Gegenteil: dunkle Unterlagen und ein schwarzer Saum um jede
 * Type. Beides ist dort schlicht nicht vorhanden — die Schrift stünde nackt vor
 * der Welt.
 *
 * Der Ersatz ist kein Trick, sondern die Umkehrung des Mittels: statt die
 * Umgebung abzudunkeln, wird die Type selbst heller und bekommt einen **hellen**
 * Saum in der eigenen Farbe. Große Flächen entfallen ganz — sie wären auf einem
 * additiven Glas ein Schleier über der Wirklichkeit, und der ist bei einer
 * Sichtung genau das Falsche.
 */
export const PALETTE_ALPHA = {
  additive: false,
  ink: "#ffffff",
  dim: "rgba(255,255,255,0.80)",
  faint: "rgba(255,255,255,0.55)",
  rule: "rgba(255,255,255,0.55)",
  ruleSoft: "rgba(255,255,255,0.30)",
  /** Saum um Type und Linien: dunkel, damit Helles auf Hellem steht. */
  halo: "rgba(0,0,0,0.82)",
  haloRule: "rgba(0,0,0,0.55)",
  /** Unterlage eines Anzeigeblocks. */
  blockFill: "rgba(6,9,13,0.58)",
  blockTint: 0.10,
  /** Fond eines Knopfes: ruhend und unter dem Zeiger. */
  btnFill: "rgba(8,11,15,0.42)",
  btnFillOn: "rgba(255,255,255,0.20)",
  hudBtnFill: "rgba(8,11,15,0.62)",
  accent: "#7cc0ff",
  good: "#8ee2a4",
  warn: "#f2dfae",
};

export const PALETTE_ADDITIVE = {
  additive: true,
  // Kein blasses Grau. Auf einem additiven Glas ist eine Abstufung nach unten
  // eine Abstufung ins Nichts — Rangfolge entsteht hier über Größe, Gewicht
  // und Farbe, nicht über Deckkraft.
  ink: "#ffffff",
  dim: "rgba(255,255,255,1)",
  faint: "rgba(255,255,255,0.88)",
  rule: "rgba(255,255,255,0.95)",
  ruleSoft: "rgba(255,255,255,0.6)",
  // **Gar kein Saum.** Ein Saum funktioniert, indem er abdunkelt — und genau
  // das kann diese Optik nicht. Ein heller Saum um helle Type verdickt sie nur
  // zu einem Klumpen, ein dunkler ist schlicht nicht vorhanden. Getragen wird
  // die Lesbarkeit hier von Gewicht und Größe (siehe `T` in hudscreen.js).
  halo: "rgba(0,0,0,0)",
  haloRule: "rgba(0,0,0,0)",
  // Flächen bleiben leer — auch getönte. Jede Fläche ist auf durchsichtigem
  // Glas ein Schleier über der Einsatzstelle, und bei einer Sichtung ist das
  // genau das Falsche. Die kräftige Kante trägt die Zuordnung allein.
  blockFill: "rgba(0,0,0,0)",
  blockTint: 0,
  btnFill: "rgba(0,0,0,0)",
  // Zeigen füllt den Knopf nicht aus — es macht seinen Umriss hell. Eine
  // helle Füllung überstrahlt hier die eigene Beschriftung.
  btnFillOn: "rgba(255,255,255,0.10)",
  hudBtnFill: "rgba(0,0,0,0)",
  // Kräftiger: dünne, blasse Farbe verschwindet vor einer hellen Wand.
  accent: "#8ac6ff",
  good: "#7fe39c",
  warn: "#ffd98a",
};

/** @param {boolean} additive */
export function paletteFor(additive) {
  return additive ? PALETTE_ADDITIVE : PALETTE_ALPHA;
}

/* ----------------------------------------------------------- Sitzungsstart
 *
 * Der Grund für die Leiter unten steht in drei Erfahrungen:
 *
 *   • Manche Browser melden Hände **nur**, wenn `hand-tracking` verbindlich
 *     angefordert wurde — scheitern dann aber, wenn sie es nicht können.
 *   • Edge auf der HoloLens 2 hat `hand-tracking` zeitweise als *unbekanntes*
 *     Merkmal zurückgewiesen und die Sitzung gar nicht erst gestartet. Also
 *     muss es eine Stufe geben, die nur `local-floor` will, und eine, die
 *     nichts will.
 *   • Und `immersive-ar` selbst ist auf der HoloLens 2 je nach Edge-Fassung
 *     nicht zu haben. Dann bleibt `immersive-vr` — was auf einem **additiven**
 *     Glas keine Notlösung ist, sondern dasselbe Bild: der Augenpuffer wird
 *     durchsichtig gelöscht, und Schwarz ist auf dieser Optik ohnehin die
 *     Wirklichkeit. Auf einem geschlossenen Gerät wäre das falsch — deshalb
 *     wird hinterher geprüft, was für ein Glas man erwischt hat.
 */

/** @returns {Array<{mode:string, init:object, tag:string}>} */
export function sessionLadder() {
  const ar = (init, tag) => ({ mode: "immersive-ar", init, tag });
  return [
    ar({ requiredFeatures: ["hand-tracking"], optionalFeatures: ["local-floor"] },
       "AR + Handtracking (verbindlich)"),
    ar({ optionalFeatures: ["local-floor", "hand-tracking"] },
       "AR + Handtracking (freiwillig)"),
    ar({ optionalFeatures: ["local-floor"] }, "AR mit Bodenbezug"),
    ar({}, "AR ohne Zusatzmerkmale"),
    { mode: "immersive-vr", init: { optionalFeatures: ["local-floor", "hand-tracking"] },
      tag: "VR-Sitzung (additives Glas)" },
    { mode: "immersive-vr", init: {}, tag: "VR-Sitzung, blank" },
  ];
}

/**
 * Welche Betriebsarten das Gerät überhaupt anbietet. Eine HoloLens 2 mit einer
 * Edge-Fassung ohne `immersive-ar` meldet hier nur `vr` — und genau das gehört
 * auf die Startseite, statt den Knopf wortlos zu sperren.
 *
 * @returns {Promise<{ar:boolean, vr:boolean, any:boolean}>}
 */
export async function xrSupport() {
  const out = { ar: false, vr: false, any: false };
  if (typeof navigator === "undefined" || !navigator.xr) return out;
  const ask = async (mode) => {
    try { return await navigator.xr.isSessionSupported(mode); }
    catch (_) { return false; }
  };
  out.ar = await ask("immersive-ar");
  out.vr = await ask("immersive-vr");
  out.any = out.ar || out.vr;
  return out;
}

/**
 * Die Leiter ablaufen, bis eine Sitzung steht.
 *
 * Eine `immersive-vr`-Sitzung wird nur behalten, wenn das Glas sie auch
 * durchsichtig zeigt (`additive`). Auf einem geschlossenen Gerät stünde man
 * sonst in einer schwarzen Kammer und hielte sie für einen Absturz — dann
 * lieber ehrlich scheitern.
 *
 * @returns {Promise<{session:XRSession, tag:string, mode:string}>}
 */
export async function requestSession(ladder = sessionLadder()) {
  if (typeof navigator === "undefined" || !navigator.xr)
    throw new Error("WebXR steht in diesem Browser nicht zur Verfügung.");

  let lastErr = null;
  for (const step of ladder) {
    let session;
    try {
      session = await navigator.xr.requestSession(step.mode, step.init);
    } catch (err) { lastErr = err; continue; }

    if (step.mode === "immersive-vr" && session.environmentBlendMode === "opaque") {
      try { await session.end(); } catch (_) {}
      lastErr = new Error(
        "Nur eine geschlossene VR-Sitzung möglich — dieses Gerät zeigt die Umgebung nicht.");
      continue;
    }
    return { session, tag: step.tag, mode: step.mode };
  }

  const name = lastErr && lastErr.name ? lastErr.name + ": " : "";
  const msg = lastErr && lastErr.message ? lastErr.message
            : "immersive-ar konnte nicht gestartet werden";
  throw new Error("AR-Sitzung abgelehnt — " + name + msg);
}

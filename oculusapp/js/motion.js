/* Bewegung als Verhalten, nicht als Ablauf.
 *
 * Alles, was sich in dieser App bewegt, bewegt sich über eine Feder aus dieser
 * Datei — das HUD, wenn es umzieht, die Anzeige, die über einem Marker
 * aufsteigt, der Körper, den man anstößt. Der Grund ist immer derselbe: eine
 * feste Dauer kann auf eine neue Eingabe nicht antworten. Wer eine Karte
 * anstößt und sie sofort wieder greift, bekommt bei einer Zeitkurve einen
 * Sprung; die Feder rechnet einfach vom Ist-Wert und der Ist-Geschwindigkeit
 * weiter.
 *
 * Zwei Begriffe genügen zur Beschreibung — dieselben zwei, mit denen Apple die
 * Physik-Trias (Masse/Steifigkeit/Dämpfung) ersetzt hat:
 *
 *   damping   Dämpfungsverhältnis. 1,0 = aperiodischer Grenzfall, kein
 *             Überschwingen, ruhiges Einlaufen. Darunter schwingt es über.
 *   response  wie schnell der Wert am Ziel ist, in Sekunden. **Keine Dauer** —
 *             eine Feder hat keine; die Einlaufzeit ergibt sich.
 *
 * Hausregel: alles läuft mit damping 1,0. Überschwingen gibt es nur, wo die
 * Geste selbst Schwung hatte — ein Wurf, ein Anstoßen. Ein Schirm, der bloß
 * eingeblendet wird, schwingt nicht.
 *
 * Integriert wird **analytisch**, nicht in Schritten: Bildabstände schwanken in
 * WebXR spürbar (und auf der HoloLens 2 stärker als auf einer Quest), und ein
 * Euler-Schritt wird bei langen Bildern erst ungenau und dann instabil. Die
 * geschlossene Lösung ist bei jedem dt exakt.
 *
 * Reine Rechnung, kein DOM, kein WebGL — deshalb in tests/logic.test.mjs
 * vollständig prüfbar.
 */

"use strict";

/* ---------------------------------------------------------------- Vorgaben
 *
 * Die Werte, die Apple ausliefert. Sie stehen hier als Tabelle, damit an einer
 * Stelle nachlesbar ist, warum sich etwas so anfühlt, wie es sich anfühlt. */

export const SPRINGS = {
  /** Umziehen, Verschieben — der Normalfall. Kein Überschwingen. */
  move: { damping: 1.0, response: 0.4 },
  /** Drehen. Etwas Nachgeben, weil Drehen immer aus einer Geste kommt. */
  rotate: { damping: 0.8, response: 0.4 },
  /** Aufsteigen/Einfahren einer Fläche. */
  sheet: { damping: 0.8, response: 0.3 },
  /** Rückmeldung, die sofort da sein muss (Druck, Hervorhebung). */
  press: { damping: 1.0, response: 0.16 },
};

/** Trägheit wie beim Bildlauf. 0,998 fühlt sich normal an, 0,99 knackiger. */
export const DECELERATION = 0.998;

/* ------------------------------------------------------- Bewegung sparsam
 *
 * „Weniger Bewegung" heißt nicht „keine Rückmeldung", sondern: keine
 * vestibuläre. Federn setzen dann sofort auf den Zielwert — die Anzeige ändert
 * sich weiterhin, sie fliegt nur nicht mehr. */

let reduced = false;

/** @returns {boolean} ob gerade auf Bewegung verzichtet wird */
export function reducedMotion() { return reduced; }

/** Von Hand setzen — für Prüfungen und für Geräte ohne matchMedia. */
export function setReducedMotion(on) { reduced = !!on; }

/**
 * An die Systemeinstellung hängen. Ohne matchMedia (Node) passiert nichts.
 * @returns {boolean} der jetzt geltende Zustand
 */
export function watchReducedMotion() {
  if (typeof matchMedia !== "function") return reduced;
  const mq = matchMedia("(prefers-reduced-motion: reduce)");
  reduced = mq.matches;
  const onChange = (e) => { reduced = e.matches; };
  if (mq.addEventListener) mq.addEventListener("change", onChange);
  else if (mq.addListener) mq.addListener(onChange);
  return reduced;
}

/* ------------------------------------------------------------------ Feder */

/**
 * Eine Feder auf einem Zahlenwert.
 *
 * Zweidimensionales wird **nicht** über eine Feder auf der Strecke geführt,
 * sondern über zwei Federn, eine je Achse: haben x und y verschiedene
 * Geschwindigkeiten, läuft die gemeinsame Feder auseinander und die Bahn
 * verbiegt sich.
 */
export class Spring {
  /**
   * @param {number} value Startwert (zugleich erstes Ziel)
   * @param {{damping?:number, response?:number}} [opts]
   */
  constructor(value = 0, opts = {}) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
    this.configure(opts);
  }

  /** Federkennwerte ändern, ohne Wert oder Geschwindigkeit zu verlieren. */
  configure({ damping = 1.0, response = 0.4 } = {}) {
    this.damping = Math.max(0, damping);
    this.response = Math.max(1e-4, response);
    this.omega = (2 * Math.PI) / this.response;
    return this;
  }

  /**
   * Neues Ziel. Wert und Geschwindigkeit bleiben stehen — genau das macht eine
   * Umkehr mitten in der Bewegung stetig: es gibt keinen Schnitt, an dem die
   * Geschwindigkeit auf null fiele und man gegen eine Wand liefe.
   */
  to(target) { this.target = target; return this; }

  /**
   * Geschwindigkeit übergeben, wenn eine Geste endet. Die Feder läuft dann
   * genau so schnell weiter, wie der Finger zuletzt war — ohne diese Übergabe
   * sieht man die Naht zwischen Ziehen und Weiterlaufen.
   */
  handoff(velocity) { this.velocity = velocity; return this; }

  /** Sofort auf einen Wert setzen, alles andere verwerfen. */
  reset(value, target = value) {
    this.value = value;
    this.target = target;
    this.velocity = 0;
    return this;
  }

  /** Steht die Feder (nahe genug am Ziel und langsam genug)? */
  settled(epsilon = 1e-3) {
    return Math.abs(this.value - this.target) < epsilon &&
           Math.abs(this.velocity) < epsilon / Math.max(1e-4, this.response);
  }

  /**
   * Einen Bildschritt weiterrechnen. Geschlossene Lösung, deshalb bei jedem dt
   * exakt und nie instabil.
   * @param {number} dt Sekunden
   * @returns {number} der neue Wert
   */
  step(dt) {
    if (reduced) return this.reset(this.target).value;
    if (!(dt > 0)) return this.value;

    const w = this.omega;
    const z = this.damping;
    const x0 = this.value - this.target;      // Auslenkung
    const v0 = this.velocity;

    if (Math.abs(x0) < 1e-9 && Math.abs(v0) < 1e-9) {
      this.value = this.target;
      this.velocity = 0;
      return this.value;
    }

    let x, v;
    if (Math.abs(z - 1) < 1e-4) {
      // Aperiodischer Grenzfall: (A + B t) e^{-wt}
      const e = Math.exp(-w * dt);
      const B = v0 + w * x0;
      x = (x0 + B * dt) * e;
      v = (B - w * (x0 + B * dt)) * e;
    } else if (z < 1) {
      // Schwingfall: e^{-zwt} (A cos wd t + B sin wd t)
      const wd = w * Math.sqrt(1 - z * z);
      const e = Math.exp(-z * w * dt);
      const c = Math.cos(wd * dt), s = Math.sin(wd * dt);
      const A = x0;
      const B = (v0 + z * w * x0) / wd;
      x = e * (A * c + B * s);
      v = e * ((-z * w * A + wd * B) * c - (z * w * B + wd * A) * s);
    } else {
      // Kriechfall: zwei reelle Exponenten
      const r = w * Math.sqrt(z * z - 1);
      const r1 = -z * w + r, r2 = -z * w - r;
      const C2 = (v0 - r1 * x0) / (r2 - r1);
      const C1 = x0 - C2;
      const e1 = Math.exp(r1 * dt), e2 = Math.exp(r2 * dt);
      x = C1 * e1 + C2 * e2;
      v = C1 * r1 * e1 + C2 * r2 * e2;
    }

    this.value = this.target + x;
    this.velocity = v;
    return this.value;
  }
}

/**
 * Eine Feder auf einem Winkel. Sie nimmt immer den kürzeren Weg — ohne das
 * dreht sich ein Modell, das von +170° auf −170° soll, einmal fast ganz herum,
 * statt die zwanzig Grad zu gehen.
 *
 * Umgesetzt als Feder auf der **Auslenkung** statt auf dem Winkel selbst: das
 * Ziel wird bei jedem Umsetzen in die Nähe des Ist-Werts gehoben.
 */
export class AngleSpring extends Spring {
  to(target) {
    const two = Math.PI * 2;
    let d = (target - this.value) % two;
    if (d > Math.PI) d -= two;
    if (d < -Math.PI) d += two;
    this.target = this.value + d;
    return this;
  }

  /** Frei weiterdrehen: Ziel bleibt Ziel, es wird nur verschoben. */
  spinBy(delta) {
    this.target += delta;
    return this;
  }
}

/* ----------------------------------------------------------- Schwung
 *
 * Beim Loslassen soll nicht an den nächsten Rastpunkt vom **Loslasspunkt** aus
 * gesprungen werden, sondern an den, der dem **projizierten** Endpunkt am
 * nächsten liegt. Das ist der Unterschied zwischen „es rutscht ein Stück" und
 * „ich habe es geworfen". */

/**
 * Wie weit etwas mit dieser Anfangsgeschwindigkeit noch ausrollt.
 *
 * Bewusst die Exponentialform und nicht das v²/(2a) aus dem Lehrbuch — die
 * Trägheit von Bildläufen ist exponentiell, und mit der Lehrbuchformel landet
 * ein schneller Wurf deutlich zu kurz.
 *
 * @param {number} velocity Einheiten je Sekunde
 * @param {number} [decel]  Trägheit, 0…1
 * @returns {number} zurückgelegte Strecke in denselben Einheiten
 */
export function project(velocity, decel = DECELERATION) {
  if (!Number.isFinite(velocity)) return 0;
  const d = Math.min(0.99999, Math.max(0, decel));
  return (velocity / 1000) * d / (1 - d);
}

/**
 * Aus einer Liste von Rastpunkten den nehmen, der dem Punkt am nächsten liegt.
 * @param {number} point
 * @param {number[]} snaps
 * @returns {number} der Rastpunkt (oder `point`, wenn es keine gibt)
 */
export function nearestSnap(point, snaps) {
  if (!snaps || !snaps.length) return point;
  let best = snaps[0], bestD = Math.abs(point - snaps[0]);
  for (const s of snaps) {
    const d = Math.abs(point - s);
    if (d < bestD) { best = s; bestD = d; }
  }
  return best;
}

/* -------------------------------------------------------------- Gummiband
 *
 * Am Anschlag wird nicht hart gestoppt, sondern zunehmend widerstanden. Ein
 * harter Stopp liest sich als „hängt"; nachgebender Widerstand liest sich als
 * „reagiert, aber weiter geht es nicht". */

/**
 * @param {number} overshoot  wie weit über den Anschlag hinaus gezogen wurde
 * @param {number} dimension  Bezugsgröße (Bahnlänge, Fläche)
 * @param {number} [constant] je kleiner, desto härter
 * @returns {number} wie weit es tatsächlich mitgeht
 */
export function rubberband(overshoot, dimension, constant = 0.55) {
  if (!overshoot) return 0;
  const d = Math.max(1e-6, dimension);
  return (overshoot * d * constant) / (d + constant * Math.abs(overshoot));
}

/**
 * Einen Wert in Grenzen halten — innerhalb hart, außerhalb nachgebend.
 * @returns {number}
 */
export function clampRubber(value, min, max, constant = 0.55) {
  const span = Math.max(1e-6, max - min);
  if (value < min) return min - rubberband(min - value, span, constant);
  if (value > max) return max + rubberband(value - max, span, constant);
  return value;
}

/* ------------------------------------------------------- Geschwindigkeit
 *
 * Für die Übergabe beim Loslassen zählt nicht der letzte Punkt, sondern die
 * letzten paar: ein einzelnes Bildpaar rauscht, und aus Rauschen wird sonst
 * ein Wurf. */

export class VelocityTracker {
  /** @param {number} [window] Zeitfenster in ms, über das gemittelt wird */
  constructor(window = 100) {
    this.window = window;
    this.samples = [];
  }

  /** @param {number} value @param {number} time ms */
  add(value, time) {
    this.samples.push({ value, time });
    const cutoff = time - this.window * 2;
    while (this.samples.length > 2 && this.samples[0].time < cutoff) this.samples.shift();
    return this;
  }

  /**
   * Geschwindigkeit in Einheiten je Sekunde, gemittelt über das Fenster.
   * Liegt der letzte Punkt lange zurück, ist die Geste beendet — dann 0, damit
   * ein Loslassen nach einer Pause nicht plötzlich wirft.
   */
  velocity(now = null) {
    const n = this.samples.length;
    if (n < 2) return 0;
    const last = this.samples[n - 1];
    const t = now == null ? last.time : now;
    if (t - last.time > this.window) return 0;

    let first = this.samples[0];
    for (let i = n - 1; i >= 0; i--) {
      if (last.time - this.samples[i].time > this.window) break;
      first = this.samples[i];
    }
    const dt = last.time - first.time;
    if (dt <= 0) return 0;
    return ((last.value - first.value) / dt) * 1000;
  }

  reset() { this.samples.length = 0; return this; }
}

/* ------------------------------------------------------------- Ausklingen
 *
 * Für Bewegung ohne Ziel: das frei weiterdrehende Körpermodell nach einem
 * Anstoßen. Es hat keinen Rastpunkt, an den es müsste — es soll nur so
 * auslaufen, wie es geworfen wurde, und dabei zu derselben Strecke kommen, die
 * `project` vorhersagt. Sonst sagte die Vorschau etwas anderes als die
 * Bewegung. */

export class Decay {
  constructor(velocity = 0, decel = DECELERATION) {
    this.velocity = velocity;
    this.decel = decel;
  }

  /** Restliche Strecke, wenn es von hier aus ausläuft. */
  get remaining() { return project(this.velocity, this.decel); }

  /**
   * @param {number} dt Sekunden
   * @returns {number} die in diesem Bild zurückgelegte Strecke
   */
  step(dt) {
    if (reduced || !(dt > 0) || !this.velocity) { this.velocity = 0; return 0; }
    // v(t) = v0 · d^(1000 t) — dieselbe Trägheit, aus der `project` folgt.
    const k = Math.pow(this.decel, dt * 1000);
    const moved = (this.velocity * (k - 1)) / (1000 * Math.log(this.decel));
    this.velocity *= k;
    if (Math.abs(this.velocity) < 1e-3) this.velocity = 0;
    return moved;
  }

  get done() { return this.velocity === 0; }
}

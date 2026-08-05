/* Der Einsatzablauf — einmal geschrieben, zweimal dargestellt.
 *
 *   Lage ausrichten ─▶ Lagekarte ─▶ zum Patienten gehen ─▶ „Sichtung starten“
 *        ─▶ mSTaRT (6 Fragen) ─▶ Sichtungskategorie
 *        ─▶ Patientenumhängekarte scannen ─▶ nächster Patient
 *
 * Dieses Modul kennt weder Canvas noch DOM noch WebXR. Es hält den Zustand,
 * entscheidet und beschreibt den nächsten Schirm als Datenstruktur:
 *
 *   { state, title, badge, band, headline, hint, body[], progress, buttons[], status }
 *
 * Die AR-Darstellung (hudscreen.js auf der WebGL-Ebene) und die flache
 * Darstellung (app.js im DOM) rendern dieselbe Beschreibung — deshalb kann der
 * ganze Ablauf am Laptop vorgeführt und in der Brille gelaufen werden, ohne dass
 * er zweimal existiert.
 *
 * Jeder Schreibzugriff auf die Patientenakte geht durch data.js, also durch
 * genau die Funktionen, an denen später PATCH /api/patients/{id} + WebSocket
 * hängen werden.
 */

"use strict";

import { MARKER_IDS, CATEGORY_META, resolvePatient,
         setCategory, addTreatment, pushProtocol, markSeen } from "./data.js";
import { MStartSession, MAX_STEPS, DISCLAIMER } from "./mstart.js";
import { ScenarioLayout } from "./layout.js";

const cat = (c) => CATEGORY_META[c] || CATEGORY_META.UNSIGHTED;

export class Workflow {
  /**
   * @param {object} [opts]
   * @param {number} [opts.approachRadius] Meter, ab wann ein Patient „erreicht“ ist
   * @param {number} [opts.releaseRadius]  Meter, ab wann er wieder losgelassen wird
   * @param {number} [opts.cellSize]       Meter je Rasterzelle
   * @param {number} [opts.fieldDistance]  Meter von der Ausrichtungspose zur Feldmitte
   */
  constructor({ approachRadius = 2.5, releaseRadius = 4, cellSize = 3, fieldDistance = 6 } = {}) {
    this.approachRadius = approachRadius;
    this.releaseRadius = releaseRadius;

    this.layout = new ScenarioLayout({ cellSize, fieldDistance });
    this.layout.build(MARKER_IDS.map(resolvePatient));
    this.session = new MStartSession();

    this.state = "align";
    this.target = null;
    this.result = null;
    this.done = new Set();
    this.scanArmed = false;
    this.cameraLive = false;      // von app.js gesetzt, wenn ein Scanner läuft
    this.notice = "";

    this._suppressed = null;      // gerade verlassener Patient
    this._pickedByHand = false;
    this._pose = { position: { x: 0, y: 0, z: 0 }, forward: { x: 0, y: 0, z: 1 } };

    /** @type {(screen:object)=>void} */
    this.onScreen = () => {};
    /** @type {(text:string)=>void} */
    this.onSpeak = () => {};
    /** @type {(text:string, kind?:string)=>void} */
    this.onToast = () => {};
  }

  /* ------------------------------------------------------------ Eingaben */

  start() {
    if (!this.layout.hasCells) { this.goToLage(); return; }
    this.enterAlign();
  }

  /** Kopfpose aus WebXR (oder gesetzt vom flachen Modus). */
  setPose(position, forward) {
    this._pose = { position, forward };
  }

  get position() { return this._pose.position; }
  get forward() { return this._pose.forward; }

  /** Einmal pro Frame: prüft, ob der Trupp bei jemandem angekommen ist. */
  tick() {
    if (this.state !== "lage" && this.state !== "approach") return;
    if (!this.layout.aligned) return;
    if (this._pickedByHand && this.state === "approach") return;

    if (this._suppressed !== null &&
        this.layout.distance(this._suppressed, this.position) > this.releaseRadius)
      this._suppressed = null;

    const hit = this.layout.nearest(this.position, this._candidates(true), this.approachRadius)
             || this.layout.nearest(this.position, this._candidates(false), this.approachRadius);

    if (hit && hit.markerId !== this.target) {
      this.target = hit.markerId;
      this._pickedByHand = false;
      this.enterApproach();
      return;
    }

    if (this.state === "approach" && this.target !== null && !this._pickedByHand &&
        this.layout.distance(this.target, this.position) > this.releaseRadius) {
      this.target = null;
      this.goToLage();
    }
  }

  _candidates(openOnly) {
    return MARKER_IDS.filter((id) =>
      id !== this._suppressed && (!openOnly || !this.done.has(id)));
  }

  alignHere() {
    this.layout.align(this.position, this.forward);
    this.say("Lage ausgerichtet.");
    this.target = null;
    this.goToLage();
  }

  /** Patient direkt wählen (Lagekarte antippen, Liste, Deep-Link). */
  selectPatient(markerId) {
    if (this.state !== "lage" && this.state !== "approach") return;
    if (!resolvePatient(markerId)) return;
    this.target = markerId;
    this._pickedByHand = true;
    if (this._suppressed === markerId) this._suppressed = null;
    this.enterApproach();
  }

  startSichtung() {
    this.session.reset();
    this.state = "sichtung";
    this._emitQuestion(true);
  }

  answer(yes) {
    if (this.state !== "sichtung") return;
    this.session.answer(yes);
    if (this.session.done) this.enterErgebnis();
    else this._emitQuestion(true);
  }

  stepBack() {
    if (this.session.back()) this._emitQuestion(false);
    else this.goToLage();
  }

  /** SK IV ist keine Vorsichtung, sondern eine ärztliche Entscheidung. */
  overrideLna() {
    if (!this.result) return;
    this.result.category = "SK4";
    this.result.why = "SK IV — ärztliche Entscheidung (LNA), abwartende Behandlung";
    this.say("Kategorie vier, ärztliche Entscheidung.");
    this._emitErgebnis();
  }

  enterScan() {
    this.state = "scan";
    this.scanArmed = true;
    this._emitScan();
  }

  /** Ein gescannter JAR-P<n>-Code. */
  onMarker(markerId) {
    if (this.state !== "scan") return;
    if (markerId !== this.target) {
      // Die Karte ist der körperliche Beleg — niemals still auf die falsche
      // Akte buchen, sondern fragen.
      this.state = "scan-mismatch";
      this.say("Karte passt nicht.");
      this._emitMismatch(markerId);
      return;
    }
    this.commit(markerId, `Karte #${markerId} gescannt`);
  }

  commit(markerId, how) {
    if (!this.result) { this.goToLage(); return; }

    this.scanArmed = false;
    setCategory(markerId, this.result.category);
    markSeen(markerId, "AR-Client");
    for (const m of this.result.measures) addTreatment(markerId, m);
    pushProtocol(markerId, { transcript: "mSTaRT: " + this.result.trail.join(" · ") });
    pushProtocol(markerId, { transcript: this.result.why + " — " + how });

    this.done.add(markerId);
    this.target = markerId;
    this.state = "bestaetigt";

    const c = cat(this.result.category);
    this.say(`Patient ${markerId} auf ${c.spoken} gebucht.`);
    this.onToast(`Patient #${markerId} → ${c.short}`, "ok");
    this._emitBestaetigt(how);
  }

  say(text) { this.onSpeak(text); }

  setNotice(text) {
    this.notice = text || "";
    this.emit();
  }

  /* -------------------------------------------------------------- Schirme */

  enterAlign() {
    this.state = "align";
    this.emit();
  }

  goToLage() {
    if (this.target !== null) this._suppressed = this.target;
    this.state = "lage";
    this.target = null;
    this._pickedByHand = false;
    this.scanArmed = false;
    this.session.reset();
    this.result = null;
    this.emit();
  }

  enterApproach() {
    if (!resolvePatient(this.target)) { this.goToLage(); return; }
    this.state = "approach";
    this.say(`Patient ${this.target}.`);
    this.emit();
  }

  enterErgebnis() {
    this.result = this.session.result;
    this.state = "ergebnis";
    this.say(`Ergebnis: ${cat(this.result.category).spoken}.`);
    this._emitErgebnis();
  }

  /** Den aktuellen Schirm neu ausgeben (z. B. nach setNotice). */
  emit() {
    this.onScreen(this.screen());
  }

  _emitQuestion(speak) {
    this.emit();
    if (speak) this.say(this.session.node.question);
  }

  _emitErgebnis() { this.emit(); }
  _emitScan() { this.emit(); }
  _emitMismatch(scanned) { this._mismatch = scanned; this.emit(); }
  _emitBestaetigt(how) { this._how = how; this.emit(); }

  /** Vitalwerte des Zielpatienten als Zahlenreihe für die Karte. */
  vitalsOf(markerId) {
    const p = resolvePatient(markerId);
    if (!p || !p.vitals) return [];
    const v = p.vitals;
    const out = [];
    if (v.breathing_rate != null) out.push({ label: "AF", value: String(v.breathing_rate) });
    if (v.pulse != null) out.push({ label: "Puls", value: String(v.pulse) });
    if (v.spo2 != null) out.push({ label: "SpO₂", value: v.spo2 + "%" });
    if (v.bp_systolic != null)
      out.push({ label: "RR", value: v.bp_systolic + (v.bp_diastolic != null ? "/" + v.bp_diastolic : "") });
    if (v.gcs != null) out.push({ label: "GCS", value: String(v.gcs) });
    return out;
  }

  /**
   * Was raumfest an den Patienten hängt: ein Schild je Patient an seiner
   * Position. Ohne Ausrichtung gibt es keine Positionen — dann nichts.
   */
  worldTags(maxDistance = 12) {
    if (!this.layout.aligned) return [];
    const tags = [];
    for (const id of MARKER_IDS) {
      const p = resolvePatient(id);
      const pos = this.layout.world(id);
      if (!p || !pos) continue;
      const d = this.layout.distance(id, this.position);
      if (d > maxDistance) continue;
      const c = cat(p.category);
      tags.push({
        id, pos, distance: d,
        cell: this.layout.cellLabel(id),
        short: c.short,
        color: c.color,
        sighted: this.done.has(id),
        target: id === this.target,
      });
    }
    return tags;
  }

  /**
   * Wo die Handlungskarte im Raum hängt: beim Zielpatienten, sobald die Lage
   * ausgerichtet ist. Sonst null — dann setzt xr.js sie einmal vor den Träger.
   */
  cardAnchor() {
    if (this.target === null || !this.layout.aligned) return null;
    return this.layout.world(this.target);
  }

  /** Die Beschreibung des aktuellen Schirms. */
  screen() {
    const s = {
      state: this.state,
      title: "J.A.R.",
      badge: "",
      band: null,
      headline: "",
      hint: "",
      body: [],
      progress: null,
      buttons: [],
      cardTitle: this.target !== null ? `Patient #${this.target}` : "",
      vitals: this.target !== null ? this.vitalsOf(this.target) : [],
      status: this.statusLine(),
    };

    switch (this.state) {
      case "align": return this._screenAlign(s);
      case "lage": return this._screenLage(s);
      case "approach": return this._screenApproach(s);
      case "sichtung": return this._screenSichtung(s);
      case "ergebnis": return this._screenErgebnis(s);
      case "scan": return this._screenScan(s);
      case "scan-mismatch": return this._screenMismatch(s);
      case "bestaetigt": return this._screenBestaetigt(s);
      default: return s;
    }
  }

  statusLine() {
    if (this.notice) return this.notice;
    if (this.state === "scan" || this.state === "scan-mismatch")
      return this.cameraLive ? "Scanner aktiv — Karte ins Blickfeld" : "Scanner aus — manuell bestätigen";
    return DISCLAIMER;
  }

  _screenAlign(s) {
    s.title = "LAGE AUSRICHTEN";
    s.headline = "Am Feldrand aufstellen";
    s.hint = "Mit Blick über die Schadensstelle stehen bleiben — die Lagekarte wird an diese Position und Blickrichtung geheftet.";
    s.buttons = [{ label: "Lage ausrichten", tint: "primary", action: () => this.alignHere() }];
    return s;
  }

  _screenLage(s) {
    const open = MARKER_IDS.filter((id) => !this.done.has(id)).length;
    s.title = "LAGE";
    s.headline = open > 0 ? `${open} Patienten offen` : "Alle Patienten gesichtet";
    s.hint = this.layout.aligned
      ? "Zum nächsten Patienten gehen oder einen Punkt auf der Lagekarte wählen."
      : "Lage ist nicht ausgerichtet — Patient auf der Lagekarte wählen.";
    s.buttons = this._nearbyButtons();
    return s;
  }

  /** Die drei nächsten offenen Patienten als Direktwahl. */
  _nearbyButtons() {
    const openIds = MARKER_IDS.filter((id) => !this.done.has(id));
    const sorted = this.layout.aligned
      ? openIds.slice().sort((a, b) =>
          this.layout.distance(a, this.position) - this.layout.distance(b, this.position))
      : openIds;
    return sorted.slice(0, 3).map((id) => ({
      label: `#${id} · ${this.layout.cellLabel(id)}`,
      tint: "ghost",
      action: () => this.selectPatient(id),
    }));
  }

  _screenApproach(s) {
    const p = resolvePatient(this.target);
    const d = this.layout.aligned ? this.layout.distance(this.target, this.position) : Infinity;

    s.title = `PATIENT #${this.target}`;
    s.badge = this.layout.cellLabel(this.target);
    s.headline = `Patient #${this.target}`;
    s.hint = Number.isFinite(d) && d < 50
      ? `${d.toFixed(1)} m entfernt · Feld ${this.layout.cellLabel(this.target)}`
      : `Feld ${this.layout.cellLabel(this.target)}`;

    if (this.done.has(this.target))
      s.body.push({ text: `Bereits gesichtet: ${cat(p.category).label}`, color: "warn" });
    if (p.sex === "m" || p.sex === "w") {
      const age = p.age_estimate != null ? `, ca. ${p.age_estimate} Jahre` : "";
      s.body.push({ text: (p.sex === "m" ? "männlich" : "weiblich") + age });
    }
    s.body.push({ text: "Sichtung nach mSTaRT — sechs Fragen.", color: "muted" });

    s.buttons = [
      { label: "Sichtung starten", tint: "primary", action: () => this.startSichtung() },
      { label: "Zurück zur Lage", tint: "ghost", action: () => this.goToLage() },
    ];
    return s;
  }

  _screenSichtung(s) {
    const node = this.session.node;
    s.title = `SICHTUNG · PATIENT #${this.target}`;
    s.badge = this.layout.cellLabel(this.target);
    s.headline = node.question;
    s.hint = node.hint;
    s.progress = { step: this.session.stepNumber, total: MAX_STEPS };
    s.body = this.session.answers.slice(-3).map((a) => ({ text: "· " + a.line, color: "muted" }));

    s.buttons = [
      { label: "JA", tint: "yes", action: () => this.answer(true) },
      { label: "NEIN", tint: "no", action: () => this.answer(false) },
      this.session.answers.length > 0
        ? { label: "Schritt zurück", tint: "ghost", action: () => this.stepBack() }
        : { label: "Abbrechen", tint: "ghost", action: () => this.goToLage() },
    ];
    return s;
  }

  _screenErgebnis(s) {
    const c = cat(this.result.category);
    s.title = `ERGEBNIS · PATIENT #${this.target}`;
    s.badge = this.layout.cellLabel(this.target);
    s.band = c.color;
    s.headline = c.label;
    s.headlineColor = c.color;
    s.hint = this.result.why;

    if (this.result.measures.length)
      s.body.push({ text: "Sofortmaßnahmen: " + this.result.measures.join(", "), color: "good" });
    s.body.push({ text: this.result.trail.join("  ·  "), color: "muted" });

    s.buttons = [
      { label: "Karte scannen", tint: "primary", action: () => this.enterScan() },
      { label: "Wiederholen", tint: "ghost", action: () => this.startSichtung() },
      { label: "SK IV (LNA)", tint: "lna", action: () => this.overrideLna() },
    ];
    return s;
  }

  _screenScan(s) {
    const c = cat(this.result.category);
    s.title = `KARTE · PATIENT #${this.target}`;
    s.badge = this.layout.cellLabel(this.target);
    s.band = c.color;
    s.headline = "Patientenumhängekarte scannen";
    s.hint = this.cameraLive
      ? "QR-Code der Karte ins Blickfeld halten — die Sichtungskategorie wird auf die Karte gebucht."
      : "Keine Kamera verfügbar — Zuordnung manuell bestätigen.";
    s.body.push({ text: `Zu buchen: ${c.label}`, color: "cat", color2: c.color });

    s.buttons = [
      { label: "Manuell bestätigen", tint: "primary",
        action: () => this.commit(this.target, "manuell bestätigt") },
      { label: "Zurück", tint: "ghost",
        action: () => { this.scanArmed = false; this.state = "ergebnis"; this._emitErgebnis(); } },
    ];
    return s;
  }

  _screenMismatch(s) {
    const scanned = this._mismatch;
    s.title = `KARTE · PATIENT #${this.target}`;
    s.badge = this.layout.cellLabel(this.target);
    s.band = "#f5b301";
    s.headline = `Karte #${scanned} ≠ Patient #${this.target}`;
    s.hint = "Die gescannte Umhängekarte gehört zu einer anderen Nummer.";
    s.body.push({ text: `Entweder die richtige Karte scannen oder die gescannte übernehmen — dann wird auf Patient #${scanned} gebucht.` });

    s.buttons = [
      { label: `Karte #${scanned} übernehmen`, tint: "primary",
        action: () => this.commit(scanned, `Karte #${scanned} übernommen`) },
      { label: "Nochmal scannen", tint: "ghost", action: () => this.enterScan() },
    ];
    return s;
  }

  _screenBestaetigt(s) {
    const c = cat(this.result.category);
    s.title = `GEBUCHT · PATIENT #${this.target}`;
    s.badge = this.layout.cellLabel(this.target);
    s.band = c.color;
    s.headline = `${c.short} gebucht`;
    s.headlineColor = c.color;
    s.hint = this._how || "";
    s.buttons = [{ label: "Nächster Patient", tint: "primary", action: () => this.goToLage() }];
    return s;
  }

  /* ------------------------------------------------------------ Lagekarte */

  /** Alles, was die Lagekarte zum Zeichnen braucht. */
  mapModel() {
    const counts = { SK1: 0, SK2: 0, SK3: 0, SK4: 0, DECEASED: 0, open: 0 };
    const dots = [];

    for (const id of MARKER_IDS) {
      const p = resolvePatient(id);
      if (!p) continue;
      const sighted = this.done.has(id);
      if (counts[p.category] !== undefined) counts[p.category]++;
      if (!sighted) counts.open++;

      const uv = this.layout.normalizedFor(id);
      if (!uv) continue;
      // Farbe ist immer die eingetragene Kategorie (das gemeinsame Lagebild);
      // `sighted` entscheidet nur, ob der Punkt gefüllt oder hohl gezeichnet wird.
      dots.push({ id, uv, sighted, color: cat(p.category).color, target: id === this.target });
    }

    const medic = this.layout.aligned
      ? { uv: this.layout.normalizedFromWorld(this.position),
          heading: this.layout.headingDegrees(this.forward) }
      : null;

    let footer, hint;
    if (!this.layout.aligned) {
      footer = "Lage nicht ausgerichtet";
      hint = "„Lage ausrichten“ am Feldrand bestätigen";
    } else if (this.target !== null) {
      const d = this.layout.distance(this.target, this.position);
      footer = `Patient #${this.target} · ${this.layout.cellLabel(this.target)} · ${d.toFixed(1)} m`;
      hint = d <= this.approachRadius ? "in Reichweite" : "hingehen oder wählen";
    } else {
      footer = "kein Patient in Reichweite";
      hint = "hingehen oder auf der Karte wählen";
    }

    return {
      columns: this.layout.columns,
      rows: this.layout.rows,
      minCol: this.layout.minCol,
      minRow: this.layout.minRow,
      dots, medic, counts, footer, hint,
      aligned: this.layout.aligned,
    };
  }
}

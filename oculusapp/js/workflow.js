/* Der Einsatzablauf — einmal geschrieben, zweimal dargestellt.
 *
 *   Lagekarte ─▶ „Neuer Patient" (entsteht dort, wo man steht)
 *             ─▶ mSTaRT (6 Fragen) ─▶ Sichtungskategorie
 *             ─▶ Umhängekarte zuweisen ─▶ nächster
 *
 * Es gibt keine mitgelieferten Patienten. Wer vor einem liegt, wird angelegt —
 * an der Position, an der der Trupp gerade steht. Erst danach bekommt er eine
 * Kartennummer, weil im Feld auch erst gesichtet und dann angehängt wird.
 *
 * Dieses Modul kennt weder Canvas noch DOM noch WebXR. Es hält den Zustand,
 * entscheidet und beschreibt den nächsten Schirm als Datenstruktur, die sowohl
 * die AR-Ebene als auch die flache Darstellung rendern.
 *
 * Jeder Schreibzugriff auf eine Akte geht durch data.js — die Naht, an der
 * später der Hub hängt.
 */

"use strict";

import { CATEGORY_META, patientIds, resolvePatient, createPatient, assignCard,
         cardHolder, setCategory, addTreatment, pushProtocol, markSeen, tally } from "./data.js";
import { MStartSession, MAX_STEPS, DISCLAIMER } from "./mstart.js";
import { FieldMap, distance, nearest } from "./layout.js";

const cat = (c) => CATEGORY_META[c] || CATEGORY_META.UNSIGHTED;

export class Workflow {
  /**
   * @param {object} [opts]
   * @param {number} [opts.approachRadius] Meter, ab wann ein angelegter Patient „erreicht" ist
   * @param {number} [opts.releaseRadius]  Meter, ab wann er wieder losgelassen wird
   */
  constructor({ approachRadius = 2, releaseRadius = 3.5 } = {}) {
    this.approachRadius = approachRadius;
    this.releaseRadius = releaseRadius;

    this.map = new FieldMap();
    this.session = new MStartSession();

    this.state = "lage";
    this.target = null;           // die Akte, an der gerade gearbeitet wird
    this.result = null;
    this.scanArmed = false;
    this.cameraLive = false;
    this.notice = "";

    this._suppressed = null;
    this._cardDraft = 1;          // Nummer im Zuweisen-Schritt
    this._conflict = null;
    this._pose = { position: { x: 0, y: 0, z: 0 }, forward: { x: 0, y: 0, z: -1 } };

    this.onScreen = () => {};
    this.onSpeak = () => {};
    this.onToast = () => {};
  }

  /* ------------------------------------------------------------ Eingaben */

  start() { this.goToLage(); }

  setPose(position, forward) { this._pose = { position, forward }; }
  get position() { return this._pose.position; }
  get forward() { return this._pose.forward; }

  patients() { return patientIds().map(resolvePatient).filter(Boolean); }

  /** Einmal pro Frame: bin ich bei einem schon angelegten Patienten angekommen? */
  tick() {
    if (this.state !== "lage" && this.state !== "approach") return;

    if (this._suppressed && distance(this.position, this._suppressed.pos) > this.releaseRadius)
      this._suppressed = null;

    const near = nearest(this.position,
                         this.patients().filter((p) => p !== this._suppressed),
                         this.approachRadius);

    if (near && near.patient !== this.target) {
      this.target = near.patient;
      this.enterApproach();
      return;
    }
    if (this.state === "approach" && this.target &&
        distance(this.position, this.target.pos) > this.releaseRadius) {
      this.target = null;
      this.goToLage();
    }
  }

  /** Hier liegt einer — Akte anlegen und sofort sichten. */
  newPatient() {
    this.target = createPatient(this.position);
    this.say(`Patient ${this.target.marker_id} angelegt.`);
    this.startSichtung();
  }

  openPatient(p) {
    if (!p) return;
    this.target = p;
    if (this._suppressed === p) this._suppressed = null;
    this.enterApproach();
  }

  startSichtung() {
    this.session.reset();
    this.state = "sichtung";
    this.emit();
    this.say(this.session.node.question);
  }

  answer(yes) {
    if (this.state !== "sichtung") return;
    this.session.answer(yes);
    if (this.session.done) this.enterErgebnis();
    else { this.emit(); this.say(this.session.node.question); }
  }

  stepBack() {
    if (this.session.back()) this.emit();
    else this.goToLage();
  }

  /** SK IV ist keine Vorsichtung, sondern eine ärztliche Entscheidung. */
  overrideLna() {
    if (!this.result) return;
    this.result.category = "SK4";
    this.result.why = "SK IV — ärztliche Entscheidung (LNA), abwartende Behandlung";
    this.say("Kategorie vier, ärztliche Entscheidung.");
    this.emit();
  }

  /* ------------------------------------------------------- Kartenschritt */

  enterKarte() {
    if (!this.target) { this.goToLage(); return; }
    this.state = "karte";
    this.scanArmed = true;
    this._conflict = null;
    this._cardDraft = this.freeCardNumber();
    this.emit();
  }

  /** Kleinste Nummer, die noch keiner trägt. */
  freeCardNumber() {
    const used = new Set(this.patients().map((p) => p.card).filter((c) => c != null));
    let n = 1;
    while (used.has(n)) n++;
    return n;
  }

  stepCard(delta) {
    this._cardDraft = Math.max(1, this._cardDraft + delta);
    this.emit();
  }

  /** Ein gescannter Code oder eine von Hand gewählte Nummer. */
  onMarker(card) {
    if (this.state !== "karte" && this.state !== "karte-belegt") return;
    this.assign(card);
  }

  assign(card) {
    if (!this.target) { this.goToLage(); return; }

    const res = assignCard(this.target.marker_id, card);
    if (!res.ok) {
      // Eine Karte gehört immer nur einem. Nicht still umhängen — fragen.
      this._conflict = { card, takenBy: res.takenBy };
      this.state = "karte-belegt";
      this.say("Karte ist schon vergeben.");
      this.emit();
      return;
    }
    this.commit(card);
  }

  /** Karte dem bisherigen Träger wegnehmen und diesem Patienten geben. */
  reassign() {
    if (!this._conflict) return;
    const { card, takenBy } = this._conflict;
    const prev = resolvePatient(takenBy);
    if (prev) {
      prev.card = null;
      pushProtocol(takenBy, { transcript: `Umhängekarte #${card} entzogen` });
    }
    this._conflict = null;
    this.assign(card);
  }

  commit(card) {
    const id = this.target.marker_id;

    this.scanArmed = false;
    if (this.result) {
      setCategory(id, this.result.category);
      for (const m of this.result.measures) addTreatment(id, m);
      pushProtocol(id, { transcript: "mSTaRT: " + this.result.trail.join(" · ") });
      pushProtocol(id, { transcript: this.result.why });
    }
    markSeen(id);

    this.state = "bestaetigt";
    const c = cat(this.target.category);
    this.say(`Patient ${id}, Karte ${card}, ${c.spoken}.`);
    this.onToast(`#${id} → Karte #${card} · ${c.short}`, "ok");
    this.emit();
  }

  say(text) { this.onSpeak(text); }

  setNotice(text) { this.notice = text || ""; this.emit(); }

  /* -------------------------------------------------------------- Schirme */

  goToLage() {
    if (this.target) this._suppressed = this.target;
    this.state = "lage";
    this.target = null;
    this.scanArmed = false;
    this.session.reset();
    this.result = null;
    this._conflict = null;
    this.emit();
  }

  enterApproach() {
    this.state = "approach";
    this.emit();
  }

  enterErgebnis() {
    this.result = this.session.result;
    this.state = "ergebnis";
    this.say(`Ergebnis: ${cat(this.result.category).spoken}.`);
    this.emit();
  }

  emit() { this.onScreen(this.screen()); }

  screen() {
    const s = {
      state: this.state,
      title: "J.A.R.",
      cardTitle: this.target ? `Patient #${this.target.marker_id}` : "",
      badge: this.target && this.target.card != null ? `Karte #${this.target.card}` : "",
      band: null,
      headline: "",
      hint: "",
      body: [],
      progress: null,
      buttons: [],
      status: this.statusLine(),
    };

    switch (this.state) {
      case "lage": return this._lage(s);
      case "approach": return this._approach(s);
      case "sichtung": return this._sichtung(s);
      case "ergebnis": return this._ergebnis(s);
      case "karte": return this._karte(s);
      case "karte-belegt": return this._konflikt(s);
      case "bestaetigt": return this._bestaetigt(s);
      default: return s;
    }
  }

  statusLine() {
    if (this.notice) return this.notice;
    if (this.state === "karte")
      return this.cameraLive ? "Karte in den Blick halten" : "Nummer wählen und übernehmen";
    return DISCLAIMER;
  }

  _lage(s) {
    const t = tally();
    s.title = "LAGE";
    s.headline = t.total === 0 ? "Noch kein Patient erfasst" : `${t.total} Patienten erfasst`;
    s.hint = "Vor dem Patienten stehen und anlegen. Die Position wird dabei festgehalten.";
    if (t.ohneKarte > 0)
      s.body.push({ text: `${t.ohneKarte} ohne Karte`, color: "warn" });

    s.buttons = [{ label: "Neuer Patient", tint: "primary", action: () => this.newPatient() }];
    for (const p of this._nearby(2))
      s.buttons.push({ label: `#${p.marker_id} öffnen`, tint: "ghost", action: () => this.openPatient(p) });
    return s;
  }

  _nearby(limit) {
    return this.patients()
      .filter((p) => p.pos)
      .map((p) => ({ p, d: distance(this.position, p.pos) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, limit)
      .map((x) => x.p);
  }

  _approach(s) {
    const p = this.target;
    const c = cat(p.category);
    s.headline = `Patient #${p.marker_id}`;
    s.hint = `${distance(this.position, p.pos).toFixed(1)} m entfernt`;
    s.band = p.category === "UNSIGHTED" ? null : c.color;
    s.body.push({ text: p.category === "UNSIGHTED" ? "noch nicht gesichtet" : c.label,
                  color: p.category === "UNSIGHTED" ? "muted" : "cat", color2: c.color });
    if (p.card != null) s.body.push({ text: `Umhängekarte #${p.card}`, color: "muted" });

    s.buttons = [
      { label: p.category === "UNSIGHTED" ? "Sichtung starten" : "Neu sichten",
        tint: "primary", action: () => this.startSichtung() },
      { label: "Zurück", tint: "ghost", action: () => this.goToLage() },
    ];
    if (p.card == null && p.category !== "UNSIGHTED")
      s.buttons.splice(1, 0, { label: "Karte zuweisen", tint: "ghost", action: () => this.enterKarte() });
    return s;
  }

  _sichtung(s) {
    const node = this.session.node;
    s.title = "SICHTUNG";
    s.headline = node.question;
    s.hint = node.hint;
    s.progress = { step: this.session.stepNumber, total: MAX_STEPS };
    s.body = this.session.answers.slice(-2).map((a) => ({ text: "· " + a.line, color: "muted" }));

    s.buttons = [
      { label: "JA", tint: "yes", action: () => this.answer(true) },
      { label: "NEIN", tint: "no", action: () => this.answer(false) },
      this.session.answers.length > 0
        ? { label: "Zurück", tint: "ghost", action: () => this.stepBack() }
        : { label: "Abbrechen", tint: "ghost", action: () => this.goToLage() },
    ];
    return s;
  }

  _ergebnis(s) {
    const c = cat(this.result.category);
    s.title = "ERGEBNIS";
    s.band = c.color;
    s.headline = c.label;
    s.headlineColor = c.color;
    s.hint = this.result.why;
    if (this.result.measures.length)
      s.body.push({ text: "Sofortmaßnahmen: " + this.result.measures.join(", "), color: "good" });

    s.buttons = [
      { label: "Karte zuweisen", tint: "primary", action: () => this.enterKarte() },
      { label: "Wiederholen", tint: "ghost", action: () => this.startSichtung() },
      { label: "SK IV (LNA)", tint: "lna", action: () => this.overrideLna() },
    ];
    return s;
  }

  _karte(s) {
    const c = this.result ? cat(this.result.category) : cat(this.target.category);
    s.title = "KARTE ZUWEISEN";
    s.band = c.color;
    s.headline = this.cameraLive ? "Karte scannen" : `Karte #${this._cardDraft}`;
    s.hint = this.cameraLive
      ? "Den QR-Code der Umhängekarte in den Blick halten — oder die Nummer von Hand wählen."
      : "Die Nummer steht auf der Karte, die du dem Patienten umhängst.";
    s.body.push({ text: `Wird gebucht als ${c.label}`, color: "cat", color2: c.color });

    s.buttons = [
      { label: "−", tint: "ghost", action: () => this.stepCard(-1) },
      { label: `#${this._cardDraft} übernehmen`, tint: "primary", action: () => this.assign(this._cardDraft) },
      { label: "+", tint: "ghost", action: () => this.stepCard(1) },
    ];
    return s;
  }

  _konflikt(s) {
    const { card, takenBy } = this._conflict;
    s.title = "KARTE VERGEBEN";
    s.band = "#f5b301";
    s.headline = `Karte #${card} gehört Patient #${takenBy}`;
    s.hint = "Eine Karte kann nur an einem Hals hängen.";
    s.buttons = [
      { label: "Andere Nummer", tint: "primary", action: () => this.enterKarte() },
      { label: `#${takenBy} entziehen`, tint: "ghost", action: () => this.reassign() },
    ];
    return s;
  }

  _bestaetigt(s) {
    const p = this.target;
    const c = cat(p.category);
    s.title = "ERFASST";
    s.band = c.color;
    s.headline = `#${p.marker_id} · Karte #${p.card}`;
    s.headlineColor = c.color;
    s.hint = c.label;
    s.buttons = [{ label: "Weiter", tint: "primary", action: () => this.goToLage() }];
    return s;
  }

  /* ------------------------------------------------------------ Lagekarte */

  /** Alles, was die Lagekarte zum Zeichnen braucht. */
  mapModel() {
    const patients = this.patients();
    this.map.fit(patients.map((p) => p.pos), this.position);

    const dots = patients.filter((p) => p.pos).map((p) => ({
      id: p.marker_id,
      card: p.card,
      uv: this.map.project(p.pos),
      color: cat(p.category).color,
      sighted: p.category !== "UNSIGHTED",
      target: p === this.target,
    }));

    const t = tally();
    let footer, hint;
    if (patients.length === 0) {
      footer = "Lage leer";
      hint = "„Neuer Patient“ beim ersten Verletzten";
    } else if (this.target) {
      footer = `Patient #${this.target.marker_id}` +
               (this.target.card != null ? ` · Karte #${this.target.card}` : " · ohne Karte");
      hint = `${distance(this.position, this.target.pos).toFixed(1)} m`;
    } else {
      footer = `${t.total} erfasst · ${t.ohneKarte} ohne Karte`;
      hint = `Ausschnitt ${Math.round(this.map.spanMeters)} m`;
    }

    return {
      dots,
      medic: { uv: this.map.project(this.position), heading: this.map.heading(this.forward) },
      counts: t,
      spanMeters: this.map.spanMeters,
      footer, hint,
    };
  }

  /** Raumfeste Schilder an den angelegten Patienten. */
  worldTags(maxDistance = 12) {
    const out = [];
    for (const p of this.patients()) {
      if (!p.pos) continue;
      const d = distance(this.position, p.pos);
      if (d > maxDistance) continue;
      const c = cat(p.category);
      out.push({
        id: p.marker_id,
        pos: p.pos,
        card: p.card,
        cell: p.card != null ? `Karte #${p.card}` : "ohne Karte",
        short: c.short,
        color: c.color,
        sighted: p.category !== "UNSIGHTED",
        target: p === this.target,
      });
    }
    return out;
  }

  /** Wo die Handlungskarte im Raum hängt: beim bearbeiteten Patienten. */
  cardAnchor() {
    return this.target && this.target.pos ? this.target.pos : null;
  }
}

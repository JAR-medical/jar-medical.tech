/* Der Einsatzablauf — einmal geschrieben, zweimal dargestellt.
 *
 *   Tätigkeit wählen ─▶ Lage ─▶ Stelle am Boden zeigen ─▶ „Neuer Patient"
 *                    ─▶ was die Tätigkeit vorsieht ─▶ zurück zur Lage
 *
 * Es gibt keine mitgelieferten Patienten. Wer vor einem liegt, wird angelegt —
 * an der Stelle, auf die man mit dem Controller zeigt (in AR), sonst dort, wo
 * man steht. Erst danach bekommt er eine Kartennummer, weil im Feld auch erst
 * gesichtet und dann angehängt wird.
 *
 * Was am Patienten passiert, hängt an der **Tätigkeit** (tasks.js): dieselbe
 * App ist für den vorsichtenden Trupp, den sichtenden LNA, die Registrierung
 * und den Behandlungsplatz je ein anderer Ablauf. Gewählt wird sie zu Beginn,
 * gewechselt jederzeit über die Lage.
 *
 * Dieses Modul kennt weder Canvas noch DOM noch WebXR. Es hält den Zustand,
 * entscheidet und beschreibt den nächsten Schirm als Datenstruktur, die sowohl
 * die AR-Ebene als auch die flache Darstellung rendern. Zwei Sorten Knöpfe:
 *
 *   buttons     der Handlungsschritt selbst — raumfeste Karte beim Patienten
 *   hudActions  kleine, kopffeste Knöpfe am Rand des Blickfelds; sie stehen für
 *               das, was jederzeit möglich ist (neuen Patienten anlegen,
 *               Tätigkeit wechseln, abbrechen) und brauchen keine große Fläche
 *
 * Jeder Schreibzugriff auf eine Akte geht durch data.js — die Naht, an der
 * später der Hub hängt.
 */

"use strict";

import { CATEGORY_META, patientIds, resolvePatient, createPatient, assignCard,
         cardHolder, setCategory, addTreatment, removeTreatment, markTransported,
         addInjury, removeInjury, injuriesByRegion,
         pushProtocol, markSeen, setActiveTask, tally } from "./data.js";
import { MStartSession, MAX_STEPS, DISCLAIMER } from "./mstart.js";
import { FieldMap, distance, nearest } from "./layout.js";
import { TASKS, DEFAULT_TASK, findTask, primaryLabel, MEASURES,
         SIGHTING_CATEGORIES } from "./tasks.js";
import { findRegion, regionLabel, FINDINGS } from "./body.js";

const cat = (c) => CATEGORY_META[c] || CATEGORY_META.UNSIGHTED;

export class Workflow {
  /**
   * @param {object} [opts]
   * @param {number} [opts.approachRadius] Meter, ab wann ein angelegter Patient „erreicht" ist
   * @param {number} [opts.releaseRadius]  Meter, ab wann er wieder losgelassen wird
   * @param {boolean} [opts.pointing]      Stelle wird gezeigt (AR) statt am eigenen Standort angelegt
   */
  constructor({ approachRadius = 2, releaseRadius = 3.5, pointing = false } = {}) {
    this.approachRadius = approachRadius;
    this.releaseRadius = releaseRadius;

    // Nur in AR gibt es einen Zeiger, mit dem sich eine Stelle am Boden wählen
    // lässt. Flach (Kamera, Simulation) entsteht der Patient dort, wo man steht.
    this.pointing = pointing;

    this.map = new FieldMap();
    this.session = new MStartSession();

    this.state = "auftrag";
    this.task = null;             // gewählte Tätigkeit (Objekt aus tasks.js)
    this.target = null;           // die Akte, an der gerade gearbeitet wird
    this.result = null;
    this.scanArmed = false;
    this.cameraLive = false;
    this.notice = "";

    this._cardDraft = 1;          // Nummer im Zuweisen-Schritt
    this._conflict = null;
    this._region = null;          // Körperregion, an der ein Befund hängt
    this._pose = { position: { x: 0, y: 0, z: 0 }, forward: { x: 0, y: 0, z: -1 } };
    this._floorY = null;

    this.onScreen = () => {};
    this.onSpeak = () => {};
    this.onToast = () => {};
    this.onLagebild = () => {};
  }

  /* ------------------------------------------------------------- Sprache
   *
   * Die Vorsichtung ist ein Fragebogen aus Ja und Nein — genau das, was sich
   * sagen lässt, während beide Hände am Patienten sind. Gesprochenes ersetzt
   * hier nichts, es liegt neben den Knöpfen: im Lärm einer Einsatzstelle darf
   * die Bedienung nicht am Mikrofon hängen.
   */

  /**
   * Ein erkanntes Wort auf den laufenden Schritt anwenden.
   * @param {{type: string}} cmd aus voice.js
   * @returns {boolean} ob damit etwas passiert ist
   */
  handleSpeech(cmd) {
    if (!cmd) return false;

    if (this.state === "sichtung") {
      if (cmd.type === "yes") { this.answer(true); return true; }
      if (cmd.type === "no") { this.answer(false); return true; }
      if (cmd.type === "back") { this.stepBack(); return true; }
      if (cmd.type === "close") { this.goToLage(); return true; }
      return false;
    }

    // Außerhalb des Fragebogens bringt „weiter" den nächsten Schritt: den
    // primären Knopf des Schirms, was immer er gerade ist.
    if (cmd.type === "yes" || cmd.type === "next") {
      const s = this.screen();
      const primary = (s.buttons || []).find((b) => b.tint === "primary");
      if (primary) { primary.action(); return true; }
    }
    if (cmd.type === "close" || cmd.type === "back") {
      if (this.state === "approach" || this.state === "befund") { this.goToLage(); return true; }
      if (this.state === "platzieren") { this.cancelPlacement(); return true; }
    }
    return false;
  }

  /* ------------------------------------------------------------ Eingaben */

  start() { this.goToAuftrag(); }

  setPose(position, forward, floorY = null) {
    this._pose = { position, forward };
    if (floorY !== null) this._floorY = floorY;
  }
  get position() { return this._pose.position; }
  get forward() { return this._pose.forward; }

  /** Wo der Boden liegt — Marker gehören dorthin, nicht auf Augenhöhe. */
  get floorY() {
    return this._floorY !== undefined && this._floorY !== null
      ? this._floorY
      : this.position.y - 1.6;      // Notbehelf ohne Bodenreferenz
  }

  patients() { return patientIds().map(resolvePatient).filter(Boolean); }

  /**
   * Einmal pro Frame. Hier wird bewusst NICHTS aufgemacht: früher sprang die
   * Handlungskarte auf, sobald man in die Nähe eines Patienten kam — beim
   * Umhergehen also dauernd. Ein Patient wird geöffnet, indem man seinen Marker
   * am Boden anklickt, und sonst nicht.
   */
  tick() {}

  /* ------------------------------------------------------------ Tätigkeit */

  goToAuftrag() {
    this.state = "auftrag";
    this.target = null;
    this.result = null;
    this.scanArmed = false;
    this._conflict = null;
    this.session.reset();
    this.emit();
  }

  /** Tätigkeit wählen — sie entscheidet, was am Patienten passiert. */
  chooseTask(id) {
    const t = findTask(id) || findTask(DEFAULT_TASK);
    if (!t) return;
    this.task = t;
    setActiveTask(t.label);          // ab jetzt steht sie in jeder Protokollzeile
    this.say(`Tätigkeit: ${t.spoken}.`);
    this.onToast(`Tätigkeit: ${t.label}`, "ok");
    this.goToLage();
  }

  /* --------------------------------------------------- Patient anlegen */

  /**
   * „Neuer Patient" — in AR wird die Stelle am Boden erst gezeigt, flach
   * entsteht er sofort am eigenen Standort.
   */
  newPatient() {
    if (this.state !== "lage") return;
    if (!this.task || !this.task.canCreate) {
      this.onToast(`${this.task ? this.task.label : "Diese Tätigkeit"} legt keine Patienten an`, "warn");
      return;
    }
    if (this.pointing) { this.beginPlacement(); return; }
    this.placeAt(null);
  }

  /** Stelle am Boden zeigen. Bestätigt wird mit Trigger, Pinch oder Verweilen. */
  beginPlacement() {
    this.state = "platzieren";
    this.emit();
    this.say("Stelle am Boden zeigen und auslösen.");
  }

  cancelPlacement() {
    if (this.state !== "platzieren") return;
    this.goToLage();
  }

  /**
   * Die Stelle steht — Akte dort anlegen und weiter in das, was die Tätigkeit
   * vorsieht.
   * @param {{x:number,y:number,z:number}|null} point null = eigener Standort
   */
  placeAt(point) {
    if (this.state !== "lage" && this.state !== "platzieren") return;
    // Dieselbe Bedingung wie am Knopf: wer nicht anlegen darf, legt auch nicht
    // an, wenn die Stelle von außen hereingereicht wird.
    if (!this.task || !this.task.canCreate) return;

    const usable = point && Number.isFinite(point.x) && Number.isFinite(point.z);
    const at = usable
      ? { x: point.x, y: Number.isFinite(point.y) ? point.y : this.floorY, z: point.z }
      // Der Patient liegt am Boden, nicht auf Kopfhöhe.
      : { x: this.position.x, y: this.floorY, z: this.position.z };

    this.target = createPatient(at);
    this.say(`Patient ${this.target.marker_id} angelegt.`);
    this.onToast(`Patient #${this.target.marker_id} angelegt`, "ok");
    this._atPatient();
  }

  /** Auf den Marker am Boden geklickt. */
  openPatient(p) {
    if (!p) return;
    if (this.state !== "lage" && this.state !== "approach") return;
    this.target = p;
    this.enterApproach();
  }

  /** Was die gewählte Tätigkeit am Patienten tut. */
  _atPatient() {
    if (!this.target) { this.goToLage(); return; }
    switch (this.task ? this.task.opens : null) {
      case "kategorie": return this.enterKategorie();
      case "karte":     return this.enterKarte();
      case "behandlung":return this.enterBehandlung();
      default:          return this.startSichtung();
    }
  }

  /* ------------------------------------------------------- Vorsichtung */

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

  /* --------------------------------------------------- ärztliche Sichtung */

  enterKategorie() {
    if (!this.target) { this.goToLage(); return; }
    this.state = "kategorie";
    this.emit();
    this.say("Sichtungskategorie wählen.");
  }

  /**
   * Ärztliche Sichtung: die Kategorie wird festgestellt, nicht errechnet — und
   * genau so protokolliert, damit sie später nicht mit einer mSTaRT-Vorsichtung
   * verwechselt wird.
   */
  chooseCategory(key) {
    if (this.state !== "kategorie" || !this.target) return;
    if (!CATEGORY_META[key] || key === "UNSIGHTED") return;

    const id = this.target.marker_id;
    setCategory(id, key);
    pushProtocol(id, { transcript: `Ärztliche Sichtung: ${cat(key).label}` });
    markSeen(id);
    this.result = null;              // kein mSTaRT-Ergebnis, also nichts nachbuchen
    this.say(`Kategorie ${cat(key).spoken}.`);

    if (this.target.card == null) { this.enterKarte(); return; }
    this.state = "bestaetigt";
    this.onToast(`#${id} · ${cat(key).short}`, "ok");
    this.emit();
  }

  /* ------------------------------------------------------------- Befunde */

  /**
   * Auf eine Körperregion gezeigt. Das Modell steht beim Patienten und ist
   * gleichzeitig die Eingabe: Region antippen, Befund wählen.
   */
  pickRegion(regionId) {
    if (!this.target) return;
    if (this.state !== "approach" && this.state !== "befund") return;
    const r = findRegion(regionId);
    if (!r) return;
    this._region = r;
    this.state = "befund";
    this.emit();
    this.say(r.label);
  }

  /** Befund festhalten — noch einmal derselbe streicht ihn wieder. */
  toggleFinding(text) {
    if (this.state !== "befund" || !this.target || !this._region) return;
    const id = this.target.marker_id;
    const region = this._region.id;
    const had = this.target.injuries.some((i) => i.region === region && i.text === text);
    if (had) removeInjury(id, region, text);
    else addInjury(id, region, text);
    markSeen(id);
    this.say(`${text}, ${this._region.label}${had ? ", gestrichen" : ""}.`);
    this.emit();
  }

  closeBefund() {
    this._region = null;
    if (this.target) this.enterApproach();
    else this.goToLage();
  }

  /* ------------------------------------------------ Behandlung & Transport */

  enterBehandlung() {
    if (!this.target) { this.goToLage(); return; }
    this.state = "behandlung";
    this.emit();
  }

  /** Maßnahme festhalten — nochmaliges Drücken nimmt sie zurück. */
  toggleMeasure(name) {
    if (this.state !== "behandlung" || !this.target) return;
    const id = this.target.marker_id;
    if (this.target.treatments.includes(name)) {
      removeTreatment(id, name);
      this.say(`${name} zurückgenommen.`);
    } else {
      addTreatment(id, name);
      this.say(`${name} festgehalten.`);
    }
    markSeen(id);
    this.emit();
  }

  /** Abtransport buchen — oder zurücknehmen, wenn er schon gebucht war. */
  toggleTransport() {
    if (this.state !== "behandlung" || !this.target) return;
    const id = this.target.marker_id;
    const on = !this.target.transported;
    markTransported(id, on);
    markSeen(id);
    if (on) {
      this.say(`Patient ${id} abtransportiert.`);
      this.onToast(`#${id} abtransportiert`, "ok");
      this.state = "bestaetigt";
    } else {
      this.say("Abtransport zurückgenommen.");
    }
    this.emit();
  }

  /* ------------------------------------------------------- Kartenschritt */

  enterKarte() {
    if (!this.target) { this.goToLage(); return; }
    this.state = "karte";
    this.scanArmed = true;
    this._conflict = null;
    this._cardDraft = this.target.card != null ? this.target.card : this.freeCardNumber();
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
    this.state = "lage";
    this.target = null;
    this.scanArmed = false;
    this.session.reset();
    this.result = null;
    this._conflict = null;
    this._region = null;
    this.emit();
  }

  enterApproach() {
    this.state = "approach";
    this._region = null;
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
      task: this.task ? this.task.short : "",
      title: "J.A.R.",
      cardTitle: this.target ? `Patient #${this.target.marker_id}` : "",
      badge: this.target && this.target.card != null ? `Karte #${this.target.card}` : "",
      band: null,
      headline: "",
      hint: "",
      body: [],
      progress: null,
      buttons: [],
      // Die raumfeste Handlungskarte wird nur gezeigt, wenn wirklich ein Schritt
      // ansteht. In der Lage bleibt die Mitte frei — da schaut man durch.
      showCard: true,
      hudActions: [],
      placing: false,
      bodyModel: this.bodyModel(),
      status: this.statusLine(),
    };

    switch (this.state) {
      case "auftrag": return this._auftrag(s);
      case "lage": return this._lage(s);
      case "platzieren": return this._platzieren(s);
      case "approach": return this._approach(s);
      case "befund": return this._befund(s);
      case "sichtung": return this._sichtung(s);
      case "kategorie": return this._kategorie(s);
      case "behandlung": return this._behandlung(s);
      case "ergebnis": return this._ergebnis(s);
      case "karte": return this._karte(s);
      case "karte-belegt": return this._konflikt(s);
      case "bestaetigt": return this._bestaetigt(s);
      default: return s;
    }
  }

  /**
   * Die Statuszeile trägt nur noch, was das Gerät meldet — eine fehlende
   * Kamera, ein Stereo-Problem. Anleitungen standen hier früher permanent im
   * Blickfeld; wer die Brille trägt, ist eingewiesen. Der Warnhinweis, dass das
   * kein Medizinprodukt ist, steht einmal bei der Tätigkeitswahl.
   */
  statusLine() {
    if (this.notice) return this.notice;
    if (this.state === "auftrag") return DISCLAIMER;
    return "";
  }

  /** Kopffeste Kleinknöpfe: was jederzeit möglich ist. */
  _hudActions() {
    const out = [];
    if (this.task && this.task.canCreate)
      out.push({ label: "Neuer Patient", tint: "primary", action: () => this.newPatient() });
    out.push({ label: "Tätigkeit", tint: "ghost", action: () => this.goToAuftrag() });
    // Das Lagebild der Einsatzleitung ist eine gewöhnliche Webseite und keine
    // AR-Ebene — sie lässt sich nicht ins Blickfeld legen. Der Knopf reicht die
    // Bitte nach oben durch; die Verdrahtung beendet dafür die Sitzung.
    out.push({ label: "Lagebild", tint: "ghost", action: () => this.onLagebild() });
    return out;
  }

  _auftrag(s) {
    s.title = "TÄTIGKEIT";
    s.headline = "Was machst du gerade?";
    s.buttons = TASKS.map((t) => ({
      label: t.label,
      tint: t.id === "vorsichtung" ? "primary" : "ghost",
      action: () => this.chooseTask(t.id),
    }));
    return s;
  }

  _lage(s) {
    const t = tally();
    s.title = "LAGE";
    s.showCard = false;              // kein großer Schirm, nur die Randanzeige
    s.headline = t.total === 0 ? "Noch kein Patient erfasst" : `${t.total} Patienten erfasst`;
    if (t.ohneKarte > 0) s.body.push({ text: `${t.ohneKarte} ohne Karte`, color: "warn" });
    s.hudActions = this._hudActions();
    return s;
  }

  _platzieren(s) {
    s.title = "STELLE WÄHLEN";
    s.showCard = false;              // der Ring am Boden ist die Anzeige
    s.placing = true;
    s.hudActions = [
      { label: "Abbrechen", tint: "ghost", action: () => this.cancelPlacement() },
    ];
    return s;
  }

  _approach(s) {
    const p = this.target;
    const c = cat(p.category);
    s.headline = `Patient #${p.marker_id}`;
    s.hint = `${distance(this.position, p.pos).toFixed(1)} m`;
    s.band = p.category === "UNSIGHTED" ? null : c.color;
    s.body.push({ text: p.category === "UNSIGHTED" ? "ungesichtet" : c.label,
                  color: p.category === "UNSIGHTED" ? "muted" : "cat", color2: c.color });
    if (p.card != null) s.body.push({ text: `Karte #${p.card}`, color: "muted" });
    if (p.transported) s.body.push({ text: "abtransportiert", color: "good" });
    for (const line of this._findingLines(p)) s.body.push({ text: line, color: "warn" });

    s.buttons = [
      { label: primaryLabel(this.task, p), tint: "primary", action: () => this._atPatient() },
    ];
    // Die Karte nachtragen, wo sie zur Tätigkeit passt und noch fehlt.
    const sightingTask = this.task && (this.task.id === "vorsichtung" || this.task.id === "sichtung");
    if (sightingTask && p.card == null && p.category !== "UNSIGHTED")
      s.buttons.push({ label: "Karte zuweisen", tint: "ghost", action: () => this.enterKarte() });
    s.buttons.push({ label: "Zurück", tint: "ghost", action: () => this.goToLage() });
    return s;
  }

  /** Befunde als Zeilen „Region: a, b" — nach Region, nicht nach Eingabezeit. */
  _findingLines(p) {
    const by = injuriesByRegion(p);
    return Object.keys(by).map((r) => `${regionLabel(r)}: ${by[r].join(", ")}`);
  }

  _befund(s) {
    const p = this.target;
    const r = this._region;
    const here = p.injuries.filter((i) => i.region === r.id).map((i) => i.text);
    s.title = "BEFUND";
    s.band = cat(p.category).color;
    s.headline = r.label;
    s.body.push(here.length
      ? { text: here.join(", "), color: "warn" }
      : { text: "ohne Befund", color: "muted" });

    s.buttons = FINDINGS.map((f) => ({
      label: (here.includes(f) ? "✓ " : "") + f,
      tint: here.includes(f) ? "no" : "ghost",
      action: () => this.toggleFinding(f),
    }));
    s.buttons.push({ label: "Fertig", tint: "primary", action: () => this.closeBefund() });
    return s;
  }

  _sichtung(s) {
    const node = this.session.node;
    s.title = "SICHTUNG";
    s.headline = node.question;
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

  _kategorie(s) {
    const p = this.target;
    const c = cat(p.category);
    s.title = "SICHTUNG (ÄRZTLICH)";
    s.headline = "Sichtungskategorie";
    s.band = p.category === "UNSIGHTED" ? null : c.color;
    if (p.category !== "UNSIGHTED")
      s.body.push({ text: "bisher: " + c.label, color: "cat", color2: c.color });

    s.buttons = SIGHTING_CATEGORIES.map((key) => ({
      label: CATEGORY_META[key].short,
      tint: "cat",
      color: CATEGORY_META[key].color,
      action: () => this.chooseCategory(key),
    }));
    s.buttons.push({ label: "Zurück", tint: "ghost", action: () => this.enterApproach() });
    return s;
  }

  _behandlung(s) {
    const p = this.target;
    const c = cat(p.category);
    s.title = "BEHANDLUNG";
    s.band = p.category === "UNSIGHTED" ? null : c.color;
    s.headline = p.category === "UNSIGHTED" ? "Ungesichtet" : c.label;
    s.headlineColor = p.category === "UNSIGHTED" ? "" : c.color;
    if (p.transported) s.hint = "abtransportiert";
    s.body.push(p.treatments.length
      ? { text: "Maßnahmen: " + p.treatments.join(", "), color: "good" }
      : { text: "keine Maßnahmen festgehalten", color: "muted" });

    s.buttons = MEASURES.map((m) => ({
      label: (p.treatments.includes(m) ? "✓ " : "") + m,
      tint: p.treatments.includes(m) ? "yes" : "ghost",
      action: () => this.toggleMeasure(m),
    }));
    s.buttons.push({
      label: p.transported ? "Transport zurück" : "Abtransport",
      tint: "primary", action: () => this.toggleTransport(),
    });
    s.buttons.push({ label: "Fertig", tint: "ghost", action: () => this.goToLage() });
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
    s.body.push({ text: c.label, color: "cat", color2: c.color });

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
    // Derselbe Schirm schließt alle Tätigkeiten ab — was erreicht wurde, steht
    // in der Akte, nicht in einem eigenen Zustand.
    s.headline = p.transported ? `#${p.marker_id} abtransportiert`
               : p.card != null ? `#${p.marker_id} · Karte #${p.card}`
               : `#${p.marker_id} erfasst`;
    s.headlineColor = c.color;
    s.hint = p.card == null && !p.transported ? c.label + " · ohne Karte" : c.label;
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
      transported: !!p.transported,
      target: p === this.target,
    }));

    const t = tally();
    let footer, hint;
    if (this.state === "auftrag") {
      footer = "Tätigkeit wählen";
      hint = `${t.total} erfasst`;
    } else if (patients.length === 0) {
      footer = "Lage leer";
      hint = "";
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

  /**
   * Marker am Boden — anklickbar, das ist der Weg zu einem Patienten. Jeder
   * bringt gleich mit, was in der kleinen Anzeige steht, die beim Herantreten
   * über ihm aufgeht (xr.js entscheidet anhand von `distance`, welche das sind).
   */
  worldTags(maxDistance = 20) {
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
        label: c.label,
        color: c.color,
        sighted: p.category !== "UNSIGHTED",
        transported: !!p.transported,
        target: p === this.target,
        distance: d,
        treatments: p.treatments.length,
        findings: p.injuries.length,
        // Für die kleine Figur über dem Marker: welche Körperteile rot sind.
        regions: injuriesByRegion(p),
      });
    }
    return out;
  }

  /**
   * Was das Körpermodell zeigt — nur am geöffneten Patienten, wo es hingehört.
   * Es hängt an dessen Position, nicht am Kopf des Trägers.
   */
  bodyModel() {
    const p = this.target;
    if (!p || !p.pos) return null;
    if (this.state !== "approach" && this.state !== "befund") return null;
    return {
      id: p.marker_id,
      pos: p.pos,
      findings: injuriesByRegion(p),
      region: this._region ? this._region.id : null,
    };
  }

  /** Wo die Handlungskarte im Raum hängt: beim bearbeiteten Patienten. */
  cardAnchor() {
    return this.target && this.target.pos ? this.target.pos : null;
  }
}

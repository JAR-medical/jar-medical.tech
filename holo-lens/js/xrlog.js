/* Der Flugschreiber des AR-Modus.
 *
 * Auf der HoloLens 2 ist die Darstellung im Headset das Einzige, was man sieht — und wenn
 * die nichts zeigt, gibt es keine Stelle, an der man nachlesen könnte, was los war. Dieses
 * Modul schreibt deshalb mit, was der AR-Lauf wirklich getan hat, und hebt es im
 * Browser-Speicher auf; die Startseite zeigt es danach an (index.html, „Letzter AR-Lauf").
 *
 * Mitgeschrieben wird sekündlich: Bildrate, Rechenzeit je Bild, ob eine Kopfpose und ein
 * Viewport geliefert wurden, GL-Fehler, und wo das HUD im Bild liegt (NDC). Dazu einmalig,
 * was für eine Sitzung zustande kam (Art, Mischung, Merkmale, Puffergröße, Grafikchip) und
 * jedes Ereignis wie ein Wechsel der Sichtbarkeit.
 *
 * Reine Logik ohne DOM, damit sie sich ohne Brille prüfen lässt (tests/xrlog.test.mjs). */

export const STORE_KEY = "jar-xr-report-v1";
const MAX_SECONDS = 180;
const MAX_EVENTS = 60;
const SAVE_EVERY_MS = 1000;

function safeStorage() {
  try { return typeof localStorage !== "undefined" ? localStorage : null; } catch (_) { return null; }
}

export class XrLog {
  /**
   * @param {{storage?: Storage|null, now?: () => number, wall?: () => Date}} [opts]
   *   `now` liefert Millisekunden (performance.now), `wall` die Uhrzeit — beide austauschbar.
   */
  constructor(opts = {}) {
    this.storage = opts.storage !== undefined ? opts.storage : safeStorage();
    this.now = opts.now || (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
    this.wall = opts.wall || (() => new Date());
    this.r = null;
    this._savedAt = -Infinity;
  }

  get active() { return !!this.r && !this.r.ended; }

  begin(meta) {
    this.r = {
      v: 1,
      startedAt: this.wall().toISOString(),
      t0: this.now(),
      meta: meta || {},
      seconds: [],
      events: [],
      ended: null,
    };
    this._save(true);
  }

  _t() { return Math.round((this.now() - this.r.t0) / 100) / 10; }

  event(text) {
    if (!this.r) return;
    if (this.r.events.length >= MAX_EVENTS) this.r.events.shift();
    this.r.events.push({ t: this._t(), text: String(text).slice(0, 240) });
    this._save(true);
  }

  /** Eine Sekunde Messwerte. Die ältesten fallen heraus, der Speicher bleibt klein. */
  second(sample) {
    if (!this.r || this.r.ended) return;
    if (this.r.seconds.length >= MAX_SECONDS) this.r.seconds.shift();
    this.r.seconds.push({ t: this._t(), ...sample });
    this._save(false);
  }

  end(reason) {
    if (!this.r || this.r.ended) return;
    this.r.ended = { t: this._t(), reason: String(reason || "") };
    this._save(true);
  }

  _save(force) {
    if (!this.storage || !this.r) return;
    const now = this.now();
    if (!force && now - this._savedAt < SAVE_EVERY_MS) return;
    this._savedAt = now;
    try { this.storage.setItem(STORE_KEY, JSON.stringify(this.r)); } catch (_) { /* Speicher voll oder gesperrt */ }
  }

  static load(storage = safeStorage()) {
    if (!storage) return null;
    try {
      const r = JSON.parse(storage.getItem(STORE_KEY) || "null");
      return r && r.v === 1 && Array.isArray(r.seconds) && Array.isArray(r.events) ? r : null;
    } catch (_) { return null; }
  }

  static clear(storage = safeStorage()) {
    try { if (storage) storage.removeItem(STORE_KEY); } catch (_) { /* nichts zu tun */ }
  }
}

const sum = (a) => a.reduce((x, y) => x + y, 0);
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const f1 = (x) => (Number.isFinite(x) ? (Math.round(x * 10) / 10).toString().replace(".", ",") : "–");
const f2 = (x) => (Number.isFinite(x) ? (Math.round(x * 100) / 100).toString().replace(".", ",") : "–");

/** Liegt der Punkt im sichtbaren Würfel (NDC)? */
export function ndcVisible(ndc) {
  return !!ndc && Number.isFinite(ndc.x) && Number.isFinite(ndc.y) && Number.isFinite(ndc.z) &&
    Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z >= -1 && ndc.z <= 1 && ndc.w > 0;
}

/**
 * Der Bericht als Text — so kurz, dass er auf der Startseite lesbar ist und sich abfotografieren
 * oder abtippen lässt.
 * @param {object|null} r das Ergebnis von XrLog.load()
 * @returns {string}
 */
export function formatReport(r) {
  if (!r) return "Noch kein AR-Lauf aufgezeichnet.";
  const m = r.meta || {};
  const L = [];
  const dur = r.seconds.length ? r.seconds[r.seconds.length - 1].t : 0;
  L.push(`AR-Lauf ${String(r.startedAt || "").replace("T", " ").slice(0, 16)} · ${f1(dur)} s · ` +
         (r.ended ? `Ende: ${r.ended.reason || "beendet"}` : "ohne Ende aufgezeichnet (Seite geschlossen?)"));
  if (m.ua) L.push(`Gerät: ${String(m.ua).replace(/^Mozilla\/5\.0 /, "").slice(0, 110)}`);
  L.push(`Sitzung: ${m.tag || "?"} [${m.mode || "?"}] · Mischung ${m.blend || "?"} · ` +
         `Merkmale ${Array.isArray(m.features) ? m.features.join(", ") || "keine" : "unbekannt"}`);
  if (m.layer) {
    L.push(`Ebene: ${m.layer.w || "?"}×${m.layer.h || "?"} · Faktor ${f2(m.layer.scale)} · ` +
           `AA ${m.layer.aa ? "an" : "aus"} · Tiefe ${m.layer.depth ? "an" : "aus"} · ` +
           `Nah/Fern ${m.near === undefined ? "Standard" : `${f2(m.near)}/${m.far}`}`);
  }
  if (m.gl) L.push(`Grafik: ${String(m.gl).slice(0, 90)} · Textur max ${m.maxTex || "?"}`);
  if (m.flags) L.push(`Schalter: ${m.flags}`);
  if (m.fov) L.push(`Blickfeld: ${m.fov}`);

  const s = r.seconds;
  if (!s.length) {
    L.push("Keine Sekunde aufgezeichnet — die Bildschleife lief nie oder die Sitzung endete sofort.");
  } else {
    const fps = s.map((x) => x.fps);
    L.push(`Bildrate: min ${Math.min(...fps)} · Mittel ${median(fps)} · max ${Math.max(...fps)} B/s ` +
           `(${s.length} s) · Rechenzeit je Bild Ø ${f1(sum(s.map((x) => x.avgMs)) / s.length)} ms, ` +
           `Spitze ${f1(Math.max(...s.map((x) => x.maxMs)))} ms`);
    const poseNull = sum(s.map((x) => x.poseNull || 0));
    const vpMissing = sum(s.map((x) => x.vpMissing || 0));
    const glErr = [...new Set(s.flatMap((x) => x.glErr || []))];
    L.push(`Ohne Kopfpose: ${poseNull} Bilder · ohne Viewport: ${vpMissing} · GL-Fehler: ${glErr.length ? glErr.join(", ") : "keine"}`);
    const seen = s.filter((x) => x.ndc);
    if (seen.length) {
      const vis = seen.filter((x) => ndcVisible(x.ndc)).length;
      const last = seen[seen.length - 1].ndc;
      L.push(`HUD im Bildbereich: ${vis} von ${seen.length} Messungen · zuletzt x ${f2(last.x)} y ${f2(last.y)} ` +
             `Tiefe ${f2(last.z)} Abstand ${f2(last.w)} m`);
    } else {
      L.push("HUD-Lage: nie gemessen (kein Bild wurde gezeichnet).");
    }
    const uploads = sum(s.map((x) => x.uploads || 0));
    L.push(`Textur-Uploads: ${uploads} in ${s.length} s · Ansichten ${s[s.length - 1].views || "?"} · ` +
           `Viewport ${s[s.length - 1].vp || "?"}`);
    // Die ersten und die letzten Sekunden einzeln: Einbrüche am Anfang sind etwas anderes als Dauerzustand.
    const pick = s.length <= 10 ? s : [...s.slice(0, 5), null, ...s.slice(-4)];
    L.push("  s    B/s   ms Ø/max   Pose-  VP-");
    for (const x of pick) {
      L.push(x === null ? "  …" :
        `${String(f1(x.t)).padStart(4)}  ${String(x.fps).padStart(4)}   ${f1(x.avgMs)}/${f1(x.maxMs)}`.padEnd(30) +
        `${x.poseNull || 0}  ${x.vpMissing || 0}`);
    }
  }
  if (r.events.length) {
    L.push("Ereignisse:");
    for (const e of r.events.slice(-12)) L.push(`  ${f1(e.t)} s  ${e.text}`);
  }
  return L.join("\n");
}

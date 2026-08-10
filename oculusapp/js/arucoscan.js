/* Das Armband vor einer Kamera erkennen.
 *
 * Läuft auf demselben Videobild wie der QR-Scanner (qr.js): dort die
 * Umhängekarte, hier das Armband. Beide teilen sich die Kamera, deshalb zieht
 * dieses Modul die Bilder nicht selbst — es bekommt sie gereicht.
 *
 * **Wie ein Druck erkannt wird.** Nicht über Tiefe und nicht über Handtracking
 * — beides gibt eine gewöhnliche Kamera nicht her. Sondern über Verdeckung:
 * jedes Feld trägt einen eigenen Marker, und wer ein Feld berührt, verdeckt
 * dessen Marker mit dem Finger. Fehlt genau einer, während die Anker noch zu
 * sehen sind, liegt dort ein Finger. Das braucht nur ein Schwarzweißbild und
 * funktioniert deshalb überall, wo es überhaupt eine Kamera gibt.
 *
 * Wo das läuft: Kamera-Modus auf Handy oder Laptop, und im nativen PICO-Build.
 * **Nicht** im Headset-Browser — der gibt keine Kamera heraus (siehe README).
 * Die App versucht es trotzdem bei jedem Start; kommt eine, ist das Armband da.
 */

"use strict";

import { CELLS, ANCHORS, DICTIONARY, PanelPress, coveredCell } from "./wristband.js";

/** Ist die Bibliothek geladen? vendor/aruco.js + vendor/cv.js liefern Globale. */
export function arucoAvailable() {
  return typeof window !== "undefined" &&
         typeof window.AR !== "undefined" && typeof window.CV !== "undefined";
}

/* Wie lange ein einmal gesehener Marker als „gehört zum Armband" gilt. Ohne
 * das würde ein Feld, das gerade erst ins Bild kommt, sofort als verdeckt
 * gelten — und auslösen, ohne dass jemand es berührt hat. */
const SEEN_TTL_MS = 4000;

export class WristbandScanner {
  /**
   * @param {object} opts
   * @param {(action: string, cell: object) => void} opts.onPress
   * @param {(state: object) => void} [opts.onState] {visible, covered, ready}
   */
  constructor({ onPress, onState } = {}) {
    this.onState = onState || (() => {});
    this.press = new PanelPress(onPress);
    this.detector = arucoAvailable()
      ? new window.AR.Detector({ dictionaryName: DICTIONARY })
      : null;
    this._seen = new Map();      // Markernummer → zuletzt gesehen (ms)
    this._lastVisible = [];
  }

  get available() { return !!this.detector; }

  /** Alles vergessen — nach einem Moduswechsel darf nichts nachhallen. */
  reset() {
    this._seen.clear();
    this._lastVisible = [];
    this.press.reset();
  }

  /**
   * Ein Kamerabild auswerten.
   * @param {ImageData} image  wie von ctx.getImageData()
   * @param {number} now
   */
  scan(image, now = Date.now()) {
    if (!this.detector || !image) return;

    let markers = [];
    try {
      markers = this.detector.detect(image) || [];
    } catch (err) {
      // Ein einzelnes verkorkstes Bild darf den Scanner nicht abschießen.
      this.onState({ error: err.message });
      return;
    }

    const visible = new Set(markers.map((m) => m.id));
    for (const id of visible) this._seen.set(id, now);
    for (const [id, at] of [...this._seen]) {
      if (now - at > SEEN_TTL_MS) this._seen.delete(id);
    }

    const seen = new Set(this._seen.keys());
    const anchorsUp = ANCHORS.some((a) => visible.has(a));
    const covered = coveredCell(visible, seen);

    this.press.update(covered, now);
    this._lastVisible = [...visible];

    this.onState({
      ready: anchorsUp,
      visible: this._lastVisible,
      covered: covered ? covered.action : null,
      hold: this.press.progress(now),
    });
  }

  /** Wie viele Armband-Marker gerade zu sehen sind — für die Statuszeile. */
  get seenCount() {
    const own = new Set([...CELLS.map((c) => c.marker), ...ANCHORS]);
    return this._lastVisible.filter((id) => own.has(id)).length;
  }

  /* ------------------------------------------------------- eigene Schleife
   *
   * Der QR-Scanner läuft im Bildtakt; das wäre hier verschwendet und zu teuer.
   * ArUco-Erkennung in JavaScript kostet je nach Auflösung zweistellige
   * Millisekunden — bei 60 Hz bliebe für die Darstellung nichts übrig.
   *
   * Also: eigenes, kleines Canvas, das Bild auf SCAN_W heruntergerechnet, und
   * nur RATE_MS. Für einen Knopfdruck reicht das mit Abstand — die Haltezeit
   * beträgt ohnehin 220 ms, es müssen also nur ein paar Bilder hintereinander
   * dasselbe sehen. */

  /**
   * An ein laufendes <video> hängen. Liefert eine Funktion zum Ablösen.
   * @param {HTMLVideoElement} video
   */
  attachToVideo(video) {
    if (!this.detector || !video) return () => {};

    const SCAN_W = 640;          // breiter bringt für 2-cm-Marker nichts
    const RATE_MS = 80;          // ~12 Bilder je Sekunde

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let timer = null, stopped = false;

    const step = () => {
      if (stopped) return;
      if (video.readyState >= 2 && video.videoWidth) {
        const w = Math.min(SCAN_W, video.videoWidth);
        const h = Math.round((video.videoHeight / video.videoWidth) * w);
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w; canvas.height = h;
        }
        ctx.drawImage(video, 0, 0, w, h);
        this.scan(ctx.getImageData(0, 0, w, h), performance.now());
      }
      timer = setTimeout(step, RATE_MS);
    };
    step();

    return () => { stopped = true; clearTimeout(timer); this.reset(); };
  }
}

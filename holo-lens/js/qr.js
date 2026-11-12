/* QR marker scanning.
 *
 * Two decode backends, picked at runtime:
 *   1. BarcodeDetector — native, hardware-accelerated, present in Chromium
 *      (Meta Quest Browser, Chrome on Android). Preferred when available.
 *   2. jsQR — pure-JS fallback (vendored) for browsers without BarcodeDetector
 *      (e.g. desktop Safari/Firefox used for testing).
 *
 * IMPORTANT (Quest 2): the Meta Quest 2 does NOT expose its passthrough cameras
 * to any app — native or web (the Passthrough Camera API is Quest 3/3S only).
 * So live QR scanning here uses getUserMedia, which on Quest 2 has no usable
 * camera. This scanner therefore runs for real in "Kamera-Modus" on a phone or
 * laptop; in headset AR mode the app identifies patients by voice/controller
 * instead (see app.js). start() surfaces a clear error rather than hanging when
 * no camera is available.
 *
 * Marker payload formats accepted (all resolve to a numeric marker id):
 *   "JAR-P7"  ·  "JAR:7"  ·  ".../patient/7"  ·  "7"
 */

"use strict";

/** Extract the numeric marker id from a decoded QR payload, or null. */
export function parseMarkerPayload(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  let m =
    /^JAR[-_ ]?P?[:#-]?\s*(\d{1,4})$/i.exec(s) ||        // JAR-P7, JAR:7, JARP7
    /\/patient\/(\d{1,4})\b/i.exec(s) ||                  // .../patient/7
    /\bpatient[=:]?\s*(\d{1,4})\b/i.exec(s) ||            // patient=7
    /^(\d{1,4})$/.exec(s);                                // bare 7
  return m ? Number(m[1]) : null;
}

export function barcodeDetectorAvailable() {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

export function jsQRAvailable() {
  return typeof window !== "undefined" && typeof window.jsQR === "function";
}

/** True if any decode backend exists in this browser. */
export function decodeSupported() {
  return barcodeDetectorAvailable() || jsQRAvailable();
}

/* Abstand zwischen zwei ausgewerteten Bildern. Nicht jedes Bild: ein QR-Code
 * hält länger als 66 ms still, und im AR-Modus teilt sich der Scanner die
 * Rechenzeit mit der Darstellung. */
const SCAN_INTERVAL_MS = 66;

/* So lange wird auf die Kamera gewartet, bevor ohne sie weitergemacht wird. */
const GUM_TIMEOUT_MS = 6000;

export class QRScanner {
  /**
   * @param {object} opts
   * @param {HTMLVideoElement} opts.video   hidden/visible <video> for the stream
   * @param {HTMLCanvasElement} opts.canvas  scratch canvas for jsQR frame grabs
   * @param {(markerId:number, raw:string)=>void} opts.onMarker  fired on a fresh detection
   * @param {(err:Error)=>void} [opts.onError]
   * @param {number} [opts.cooldownMs=2500]  ignore repeats of the same marker within this window
   */
  constructor({ video, canvas, onMarker, onError, cooldownMs = 2500 }) {
    this.video = video;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { willReadFrequently: true });
    this.onMarker = onMarker;
    this.onError = onError || (() => {});
    this.cooldownMs = cooldownMs;
    this.stream = null;
    this.detector = null;
    this.running = false;
    this._timer = null;
    this._last = { id: null, at: 0 };
  }

  /**
   * Startet die Kamera.
   *
   * „Keine Kamera verfügbar" hat vier ganz verschiedene Ursachen, die alle
   * unterschiedlich zu beheben sind — deshalb sagt jede Fehlermeldung hier,
   * welche es war und was zu tun ist, statt pauschal dem Gerät die Schuld zu
   * geben.
   */
  async start() {
    if (this.running) return;

    if (!decodeSupported()) {
      throw new Error("Kein QR-Decoder verfügbar (weder BarcodeDetector noch jsQR geladen).");
    }

    // Häufigste Ursache und die einzige, die wie ein Gerätefehler aussieht:
    // ohne HTTPS blendet der Browser navigator.mediaDevices komplett aus.
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      throw new Error("Kamera gesperrt, weil die Seite nicht über HTTPS läuft. " +
        "Browser geben die Kamera nur im sicheren Kontext frei — die Seite über " +
        "https:// oder localhost öffnen (die Adresse " + location.origin + " reicht nicht).");
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Dieser Browser stellt Webseiten keine Kamera bereit. " +
        "In Headset-Browsern (PICO, Quest) ist das normal — dort die Karte manuell " +
        "bestätigen; zum echten Scannen Handy oder Laptop nehmen.");
    }

    try {
      // Mit Zeitgrenze. `getUserMedia` kann hängenbleiben statt abzulehnen —
      // etwa wenn der Browser die Berechtigungsfrage nirgends anzeigen kann.
      // Ohne diese Grenze bliebe der Aufrufer ewig stehen; im AR-Modus hieße
      // das: die Brille startet gar nicht erst, weil die Kamera vorher
      // angefragt wird. Lieber ohne Kamera weitermachen als gar nicht.
      this.stream = await Promise.race([
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        }),
        new Promise((_, reject) => setTimeout(
          () => reject(Object.assign(new Error("timeout"), { name: "TimeoutError" })),
          GUM_TIMEOUT_MS)),
      ]);
    } catch (err) {
      if (err && err.name === "TimeoutError")
        throw new Error("Die Kamera antwortet nicht (keine Rückmeldung nach " +
          (GUM_TIMEOUT_MS / 1000) + " s). Das passiert, wenn der Browser die " +
          "Berechtigungsfrage nicht anzeigen kann. Karte von Hand bestätigen.");
      const name = err && err.name;
      if (name === "NotAllowedError" || name === "SecurityError")
        throw new Error("Kamerazugriff abgelehnt. Im Browser die Kamera-Berechtigung für " +
          "diese Seite erlauben und neu laden.");
      if (name === "NotFoundError" || name === "OverconstrainedError")
        throw new Error("Keine Kamera gefunden. Ein Gerät mit Kamera nehmen — oder die " +
          "Karte manuell bestätigen.");
      if (name === "NotReadableError")
        throw new Error("Die Kamera ist gerade von einer anderen Anwendung belegt. " +
          "Andere Kamera-Apps schließen und neu laden.");
      throw new Error("Kamerazugriff nicht möglich: " + (err && err.message ? err.message : err));
    }
    this.video.srcObject = this.stream;
    this.video.setAttribute("playsinline", "");
    this.video.muted = true;
    await this.video.play().catch(() => {});

    if (barcodeDetectorAvailable()) {
      this.detector = new window.BarcodeDetector({ formats: ["qr_code"] });
    }
    this.running = true;
    this._tick();
  }

  stop() {
    this.running = false;
    if (this._timer) clearTimeout(this._timer);
    this._timer = null;
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.video) this.video.srcObject = null;
  }

  _emit(id, raw) {
    const now = performance.now();
    if (this._last.id === id && now - this._last.at < this.cooldownMs) return;
    this._last = { id, at: now };
    try { this.onMarker(id, raw); } catch (e) { this.onError(e); }
  }

  async _decodeFrame() {
    const v = this.video;
    if (!v || v.readyState < 2 || !v.videoWidth) return;

    // Native detector path.
    if (this.detector) {
      try {
        const codes = await this.detector.detect(v);
        for (const c of codes) {
          const id = parseMarkerPayload(c.rawValue);
          if (id != null) return this._emit(id, c.rawValue);
        }
        return;
      } catch (e) {
        // Some frames throw transiently; fall through to jsQR if present.
        if (!jsQRAvailable()) return;
        this.detector = null; // stop trying the flaky native path
      }
    }

    // jsQR fallback path.
    if (jsQRAvailable()) {
      const w = (this.canvas.width = v.videoWidth);
      const h = (this.canvas.height = v.videoHeight);
      this.ctx.drawImage(v, 0, 0, w, h);
      const img = this.ctx.getImageData(0, 0, w, h);
      const res = window.jsQR(img.data, w, h, { inversionAttempts: "attemptBoth" });
      if (res && res.data) {
        const id = parseMarkerPayload(res.data);
        if (id != null) this._emit(id, res.data);
      }
    }
  }

  /* Die Schleife läuft über einen Zeitgeber, NICHT über requestAnimationFrame.
   *
   * Der Grund ist der AR-Modus: sobald eine immersive WebXR-Sitzung läuft,
   * zeichnet der Browser die flache Seite nicht mehr — und ruft deren
   * requestAnimationFrame nicht mehr auf. Die Schleife stand damit still,
   * sobald man ins Headset ging, und es wurde nie wieder ein Bild ausgewertet.
   * Von außen sah das aus, als gäbe das Gerät keine Kamera her.
   *
   * Ein Zeitgeber läuft weiter. 15 Bilder je Sekunde reichen für einen QR-Code
   * mit Abstand und lassen der Darstellung ihre Rechenzeit. */
  _tick() {
    if (!this.running) return;
    this._decodeFrame().finally(() => {
      if (this.running) this._timer = setTimeout(() => this._tick(), SCAN_INTERVAL_MS);
    });
  }
}

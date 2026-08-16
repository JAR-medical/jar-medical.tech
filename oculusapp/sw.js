/* Der Service Worker — zwei Aufgaben, und nur diese zwei.
 *
 *   1. Er macht die Seite **installierbar**. Ohne einen Service Worker mit
 *      `fetch`-Behandlung bietet Edge „Diese Website als App installieren"
 *      nicht an — und genau das ist der Weg, wie diese App auf einer HoloLens 2
 *      ins Startmenü kommt, ohne dass am Gerät etwas geändert wird.
 *   2. Er macht sie **netzunabhängig**. An einer Einsatzstelle gibt es
 *      womöglich kein Netz; eine Sichtungshilfe, die dann einen Fehler zeigt,
 *      ist keine.
 *
 * Was er ausdrücklich NICHT tut: alte Fassungen ausliefern. Diese App wird
 * gerade auf einem Gerät erprobt, das nicht danebensteht, und nichts kostet
 * dabei mehr Zeit als die Frage, ob man den Fehler von eben oder den Cache von
 * vorgestern vor sich hat. Deshalb gilt:
 *
 *   Code (HTML, CSS, JS)  → **erst das Netz**, Cache nur als Rückfall.
 *                            Wer online ist, sieht immer den letzten Stand.
 *   Große Unveränderliche → **erst der Cache** (Körpernetz 470 kB, die
 *                            Fremdbibliotheken, Symbole, PDFs). Die ändern
 *                            sich praktisch nie, und sie jedes Mal neu zu
 *                            holen, wäre auf einer Brille im WLAN spürbar.
 *
 * Die Fassung unten wird bei jeder Änderung hochgezählt — das ist der Schalter,
 * der alte Bestände wegräumt.
 */

const VERSION = "jar-ar-v1";
const SHELL = VERSION + "-shell";

/* Was beim Installieren mitgenommen wird. Bewusst einzeln und fehlertolerant:
 * `addAll` bricht die ganze Installation ab, wenn **eine** Datei fehlt, und
 * dann gibt es gar keinen Service Worker — und damit auch keine App. */
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/hud.css",
  "./js/app.js", "./js/arucoscan.js", "./js/body.js", "./js/bodyview.js",
  "./js/data.js", "./js/display.js", "./js/hud.js", "./js/hudcanvas.js",
  "./js/hudscreen.js", "./js/layout.js", "./js/motion.js", "./js/mstart.js",
  "./js/qr.js", "./js/tasks.js", "./js/voice.js", "./js/workflow.js",
  "./js/wristband.js", "./js/xr.js",
  "./vendor/aruco.js", "./vendor/cv.js", "./vendor/jsQR.min.js",
  "./assets/body/body.json", "./assets/body/body.bin",
  "./assets/icon/icon-192.png", "./assets/icon/icon-512.png",
  "./assets/icon/icon-maskable-512.png",
];

/** Ändert sich praktisch nie → erst der Cache. */
function immutable(url) {
  return /\/assets\/(body|icon|markers|panel)\//.test(url.pathname) ||
         /\/vendor\//.test(url.pathname);
}

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // Einzeln, mit Nachsicht: eine fehlende Datei darf nicht die Installation
    // verhindern. Was fehlt, wird eben später aus dem Netz geholt.
    await Promise.all(PRECACHE.map((u) =>
      cache.add(new Request(u, { cache: "reload" }))
           .catch((err) => console.warn("[JAR] nicht vorgehalten:", u, err.message))));
    // Sofort übernehmen. Beim Erproben ist eine Fassung, die erst beim
    // übernächsten Start greift, schlimmer als gar keine.
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys())
      if (key !== SHELL) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Fremdes geht uns nichts an

  e.respondWith(immutable(url) ? cacheFirst(req) : networkFirst(req));
});

/** Erst das Netz; was ankommt, wird nebenbei abgelegt. */
async function networkFirst(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (_) {
    const hit = await cache.match(req);
    if (hit) return hit;
    // Eine Navigation ohne Netz und ohne Ablage landet trotzdem in der App
    // und nicht auf einer Fehlerseite des Browsers.
    if (req.mode === "navigate") {
      const shell = await cache.match("./index.html");
      if (shell) return shell;
    }
    throw new Error("offline und nichts vorgehalten: " + req.url);
  }
}

/** Erst die Ablage; nur was fehlt, kommt aus dem Netz. */
async function cacheFirst(req) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}

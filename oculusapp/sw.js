/* Abschalter für den alten Service Worker unter /oculusapp/.
 *
 * Bis zum 10.09.2026 lag der AR-Client hier und registrierte /oculusapp/sw.js (Cache "jar-ar-v1-shell").
 * Der Browser prüft diese Datei bei jedem Start der installierten App auf Änderungen. Solange sie 404 war,
 * blieb der alte Worker aktiv und lieferte die Fehlerseite aus. Diese Fassung übernimmt sofort, löscht nur
 * den Cache der alten Fassung (der neue Client unter /holo-lens/ nutzt "jar-ar-v2-shell" und bleibt
 * unberührt), meldet sich ab und schickt offene Fenster zur neuen Adresse. */

const OLD_CACHE = "jar-ar-v1-shell";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    try { await caches.delete(OLD_CACHE); } catch (_) { /* nichts zu löschen */ }
    await self.registration.unregister();
    const windows = await self.clients.matchAll({ type: "window" });
    for (const client of windows) {
      try { await client.navigate("/holo-lens/"); } catch (_) { /* fremd gesteuert: beim nächsten Start */ }
    }
  })());
});

/* "App aktualisieren" (update.html): erzwingt auf diesem Gerät den neuesten Stand der App.
 *
 * Warum es das braucht: GitHub Pages schickt max-age=14400, der Browser darf Dateien also vier Stunden
 * lang aus seinem Zwischenspeicher nehmen, und ein bereits installierter Service Worker kann den alten
 * Stand zusätzlich festhalten. Diese Seite
 *   1. meldet die Service Worker dieser App ab und löscht deren Caches (jar-ar-*),
 *   2. holt jede Datei der App mit cache: "reload" — das umgeht den Zwischenspeicher und ersetzt dessen
 *      Eintrag durch die frische Datei,
 *   3. bietet dann den Weg zur App an.
 * Die Dateiliste (files.json) und die Fassung stammen aus deploy_website.py. Die Entsperrung (Code) bleibt erhalten. */
(() => {
  "use strict";
  const out = document.getElementById("out");
  const go = document.getElementById("go");
  const say = (text) => { out.textContent += text + "\n"; };

  async function run() {
    const base = new URL("./", location.href);
    const meta = await (await fetch("files.json", { cache: "reload" })).json();
    say("Neue Fassung auf dem Server: " + meta.stamp);

    if ("serviceWorker" in navigator) {
      const regs = (await navigator.serviceWorker.getRegistrations()).filter((r) => r.scope === base.href);
      for (const reg of regs) await reg.unregister();
      say(`Service Worker abgemeldet: ${regs.length}`);
    }
    if (window.caches) {
      const mine = (await caches.keys()).filter((k) => k.startsWith("jar-ar-"));
      for (const key of mine) await caches.delete(key);
      say(`Zwischenspeicher gelöscht: ${mine.length}`);
    }

    let ok = 0;
    const failed = [];
    for (const file of meta.files) {
      try {
        const res = await fetch(new URL(file, base), { cache: "reload" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        await res.arrayBuffer();
        ok++;
      } catch (err) {
        failed.push(`${file} (${err.message})`);
      }
    }
    say(`Dateien neu geladen: ${ok} von ${meta.files.length}`);
    if (failed.length) {
      say("Nicht geladen:\n  " + failed.slice(0, 8).join("\n  "));
      say("Bitte die Verbindung prüfen und diese Seite neu laden.");
    } else {
      say("Fertig.");
    }
    go.hidden = false;
  }

  run().catch((err) => {
    say("Fehler: " + (err && err.message ? err.message : err));
    say("Bitte die Verbindung prüfen und diese Seite neu laden.");
  });
})();

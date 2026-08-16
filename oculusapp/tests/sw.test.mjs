/* Prüfungen für den Service Worker — ohne Browser.
 *
 *   node tests/sw.test.mjs
 *
 * Warum nicht im Browser: `--virtual-time-budget` bleibt bei der Anmeldung
 * eines Service Workers stehen, und ohne diesen Schalter wartet ein
 * kopfloser Chrome nicht auf das Ende der Installation. Wichtiger ist aber,
 * dass hier genau das prüfbar wird, was im Browser mühsam ist: **welcher Weg
 * für welche Datei genommen wird.**
 *
 * Und das ist keine Feinheit. Ein Service Worker, der Programmcode aus der
 * Ablage ausliefert, kostet bei der Erprobung auf einem Gerät, das nicht
 * danebensteht, Stunden — man sucht dann den Fehler von gestern in der Fassung
 * von vorgestern. Deshalb steht hier schwarz auf weiß, dass Code aus dem Netz
 * kommt und nur das Unveränderliche aus der Ablage.
 *
 * Nachgebaut wird nur so viel Umgebung, wie sw.js anfasst: `self`, `caches`,
 * `fetch`, `Request`, `Response`.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

let run = 0, failed = 0;
function check(ok, what) {
  run++;
  if (ok) { console.log("  ok   " + what); return; }
  failed++;
  console.log("  FAIL " + what);
}

/* ------------------------------------------------------------ Umgebung */

class FakeCache {
  constructor() { this.store = new Map(); }
  async put(req, res) { this.store.set(urlOf(req), res); }
  async match(req) { return this.store.get(urlOf(req)) || undefined; }
  async keys() { return [...this.store.keys()].map((u) => ({ url: u })); }
  async add(req) {
    const res = await globalThis.fetch(req);
    if (!res.ok) throw new Error("HTTP " + res.status);
    this.store.set(urlOf(req), res);
  }
}

// Die echte Cache-API löst eine übergebene Zeichenkette gegen den
// Geltungsbereich des Workers auf — `cache.match("./index.html")` findet also
// den Eintrag, der unter der vollen Adresse liegt. Ohne dasselbe hier scheitert
// der Rückfall für Navigationen, obwohl er im Browser trägt.
const BASE = "https://jar-medical.tech/oculusapp/";
const urlOf = (r) => (typeof r === "string" ? new URL(r, BASE).href : r.url);

function makeEnv({ offline = false, missing = [] } = {}) {
  const caches = new Map();
  const log = { fetched: [], deleted: [] };

  const env = {
    location: { origin: "https://jar-medical.tech" },
    listeners: {},
    skipWaitingCalled: false,
    claimCalled: false,
    log,
    caches,
  };

  globalThis.Request = class {
    constructor(url, opts = {}) {
      this.url = new URL(url, BASE).href;
      this.method = opts.method || "GET";
      this.mode = opts.mode || "no-cors";
    }
  };
  globalThis.Response = class {
    constructor(body, opts = {}) {
      this.body = body;
      this.ok = opts.ok !== false;
      this.from = opts.from || "network";
    }
    clone() { return this; }
  };
  globalThis.URL = URL;

  globalThis.fetch = async (req) => {
    const u = urlOf(req);
    log.fetched.push(u);
    if (offline) throw new TypeError("Failed to fetch");
    if (missing.some((m) => u.includes(m))) return new globalThis.Response(null, { ok: false });
    return new globalThis.Response("data:" + u, { ok: true });
  };

  globalThis.caches = {
    async open(name) {
      if (!caches.has(name)) caches.set(name, new FakeCache());
      return caches.get(name);
    },
    async keys() { return [...caches.keys()]; },
    async delete(name) { log.deleted.push(name); return caches.delete(name); },
  };

  globalThis.self = {
    location: env.location,
    addEventListener(type, fn) { env.listeners[type] = fn; },
    skipWaiting: async () => { env.skipWaitingCalled = true; },
    clients: { claim: async () => { env.claimCalled = true; } },
  };
  globalThis.console.warn = () => {};        // die Nachsicht-Meldungen still

  return env;
}

/** Ein Event nachstellen und auf das warten, was der Worker anhängt. */
async function fire(env, type, extra = {}) {
  let waited = null, responded = null;
  const ev = {
    ...extra,
    waitUntil: (p) => { waited = p; },
    respondWith: (p) => { responded = p; },
  };
  env.listeners[type](ev);
  if (waited) await waited;
  return responded ? await responded.catch((e) => ({ error: e.message })) : null;
}

async function load(env) {
  const src = readFileSync(join(here, "..", "sw.js"), "utf8");
  // Als Modul auswerten, damit `const` im Dateibereich nicht kollidiert.
  await new Function(src + "\n//# sourceURL=sw.js")();
  return env;
}

/* ------------------------------------------------------------ Prüfungen */

const REQ = (path, opts) => new globalThis.Request(path, opts);

console.log("\nInstallieren");
{
  const env = makeEnv();
  await load(env);
  await fire(env, "install");

  const names = await globalThis.caches.keys();
  check(names.length === 1, `genau eine Ablage angelegt (${names.join(", ")})`);
  const cache = await globalThis.caches.open(names[0]);
  const urls = (await cache.keys()).map((r) => r.url);
  check(urls.some((u) => u.endsWith("/xr.js")), "der Programmcode ist vorgehalten");
  check(urls.some((u) => u.endsWith("/body.bin")), "das Körpernetz auch");
  check(urls.some((u) => u.endsWith("/hud.css")), "und die Gestaltung");
  check(urls.some((u) => u.includes("icon-192")), "und das Symbol fürs Startmenü");
  check(urls.length >= 28, `insgesamt ${urls.length} Dateien`);
  check(env.skipWaitingCalled, "die neue Fassung übernimmt sofort");
}

console.log("\nEine fehlende Datei darf die Installation nicht verhindern");
{
  // Sonst gäbe es gar keinen Service Worker — und damit keine App im
  // Startmenü, wegen einer einzigen Datei.
  const env = makeEnv({ missing: ["body.bin"] });
  await load(env);
  let threw = false;
  try { await fire(env, "install"); } catch (_) { threw = true; }
  check(!threw, "die Installation läuft trotzdem durch");
  const cache = await globalThis.caches.open((await globalThis.caches.keys())[0]);
  const urls = (await cache.keys()).map((r) => r.url);
  check(urls.some((u) => u.endsWith("/xr.js")), "und hält alles Übrige vor");
  check(!urls.some((u) => u.endsWith("/body.bin")), "nur das Fehlende fehlt");
}

console.log("\nAufräumen beim Übernehmen");
{
  const env = makeEnv();
  await globalThis.caches.open("jar-ar-v0-shell");     // ein alter Bestand
  await load(env);
  await fire(env, "activate");
  check(env.log.deleted.includes("jar-ar-v0-shell"), "alte Ablagen werden gelöscht");
  check(env.claimCalled, "und die offenen Seiten übernommen");
}

console.log("\nWelcher Weg für welche Datei");
{
  const env = makeEnv();
  await load(env);
  await fire(env, "install");
  env.log.fetched.length = 0;

  // Code: erst das Netz. Das ist der Punkt, an dem sich entscheidet, ob man
  // beim Erproben die aktuelle Fassung sieht oder die von vorgestern.
  await fire(env, "fetch", { request: REQ("./js/xr.js") });
  check(env.log.fetched.some((u) => u.endsWith("/xr.js")),
        "Programmcode wird aus dem Netz geholt, obwohl er vorgehalten ist");

  env.log.fetched.length = 0;
  await fire(env, "fetch", { request: REQ("./index.html") });
  check(env.log.fetched.some((u) => u.endsWith("/index.html")),
        "die Seite selbst ebenso");

  // Das Unveränderliche: erst die Ablage. 470 kB Körpernetz bei jedem Start
  // neu zu holen, ist auf einer Brille im WLAN spürbar.
  env.log.fetched.length = 0;
  await fire(env, "fetch", { request: REQ("./assets/body/body.bin") });
  check(env.log.fetched.length === 0, "das Körpernetz kommt ohne Netz aus der Ablage");

  env.log.fetched.length = 0;
  await fire(env, "fetch", { request: REQ("./vendor/jsQR.min.js") });
  check(env.log.fetched.length === 0, "die Fremdbibliotheken auch");

  // Fremde Herkunft und alles außer GET gehen den Worker nichts an.
  env.log.fetched.length = 0;
  const fremd = await fire(env, "fetch",
    { request: new globalThis.Request("https://example.org/x.js") });
  check(fremd === null, "fremde Adressen werden durchgelassen");
  const post = await fire(env, "fetch", { request: REQ("./index.html", { method: "POST" }) });
  check(post === null, "und alles, was kein GET ist");
}

console.log("\nOhne Netz");
{
  const env = makeEnv();
  await load(env);
  await fire(env, "install");

  // Ab hier gibt es kein Netz mehr — die Einsatzstelle ohne Empfang.
  globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };

  const code = await fire(env, "fetch", { request: REQ("./js/xr.js") });
  check(code && !code.error, "der Programmcode kommt aus der Ablage");
  const mesh = await fire(env, "fetch", { request: REQ("./assets/body/body.bin") });
  check(mesh && !mesh.error, "das Körpernetz auch");

  // Eine Navigation auf etwas, das nie vorgehalten wurde, landet trotzdem in
  // der App und nicht auf der Fehlerseite des Browsers.
  const nav = await fire(env, "fetch",
    { request: REQ("./index.html?mode=sim", { mode: "navigate" }) });
  check(nav && !nav.error, "eine unbekannte Adresse fällt auf die App zurück");
}

console.log();
console.log(failed === 0
  ? `${run} Prüfungen, alle bestanden.`
  : `${run} Prüfungen, ${failed} fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);

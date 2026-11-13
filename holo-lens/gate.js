/* Passcode gate for the AR client at https://jar-medical.tech/holo-lens/.
 *
 * Loaded from <head> by the deployed index.html (see deploy_website.py). The app's own
 * module script is NOT in the HTML: it is added here, only after the code was accepted.
 *
 * What this is: a doorman. GitHub Pages serves static files, so there is no server that
 * can refuse a request. The code is checked in the browser against a salted PBKDF2-SHA256
 * hash (the code itself is not in the repository), and the check is remembered on that
 * device for REMEMBER_DAYS so a headset wearer does not have to type it on every start.
 * Anyone who reads the page source can bypass it, and the hash of a short code can be
 * guessed offline. It keeps casual visitors out; it does not protect secrets.
 *
 * ?lock in the URL forgets the remembered unlock on this device.
 *
 * __SALT_HEX__, __ITERATIONS__, __HASH_HEX__ and __BUILD__ are filled in by deploy_website.py. */
(() => {
  "use strict";

  const SALT_HEX = "8b7100b5da857f3e4d0652c626d5663e";
  const ITERATIONS = 200000;
  const HASH_HEX = "c45602a1f0eacc32fcb59674c72aab6f0285c8f0be84cb36a103b281df04f55d";
  const BUILD = "13.11.2026 08:39 · b5c898b";
  const STORE_KEY = "jar-holo-lens-unlock";
  const REMEMBER_DAYS = 30;
  const MAX_WAIT_MS = 8000;

  const root = document.documentElement;

  const store = {
    get() {
      try { return JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (_) { return null; }
    },
    set(value) {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(value)); } catch (_) { /* private mode: ask again next time */ }
    },
    clear() {
      try { localStorage.removeItem(STORE_KEY); } catch (_) { /* nothing to forget */ }
    },
  };

  /* ---- ?lock ----------------------------------------------------------------------------- */
  const params = new URLSearchParams(location.search);
  if (params.has("lock")) {
    store.clear();
    params.delete("lock");
    const rest = params.toString();
    history.replaceState(null, "", location.pathname + (rest ? "?" + rest : "") + location.hash);
  }

  /* The stored value carries the start of the current hash, so changing the code on the
   * server revokes every device that unlocked with the old one. */
  function remembered() {
    const saved = store.get();
    return !!saved && saved.h === HASH_HEX.slice(0, 16) && typeof saved.until === "number" && saved.until > Date.now();
  }

  /* ---- passcode check -------------------------------------------------------------------- */
  const fromHex = (hex) => Uint8Array.from(hex.match(/../g), (pair) => parseInt(pair, 16));
  const toHex = (buffer) => Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");

  async function derive(code) {
    const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(code), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: fromHex(SALT_HEX), iterations: ITERATIONS }, material, 256);
    return toHex(bits);
  }

  function sameHash(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  /* ---- starting the app ------------------------------------------------------------------ */
  let started = false;
  function startApp() {
    if (started) return;
    started = true;
    root.classList.remove("gate-locked");
    const script = document.createElement("script");
    script.type = "module";
    script.src = "js/app.js";
    document.body.appendChild(script);
  }

  /* ---- the passcode screen --------------------------------------------------------------- */
  function showGate() {
    const gate = document.createElement("div");
    gate.id = "gate";
    gate.setAttribute("role", "dialog");
    gate.setAttribute("aria-modal", "true");
    gate.setAttribute("aria-labelledby", "gate-title");
    gate.innerHTML =
      '<form class="gate-card" autocomplete="off" novalidate>' +
        '<h1 id="gate-title">J.A.R. AR-Client</h1>' +
        '<p class="gate-lead">Zugang nur mit Code.</p>' +
        '<p class="gate-version">Fassung ' + BUILD + '</p>' +
        '<label class="gate-label" for="gate-code">Zugangscode</label>' +
        '<input id="gate-code" class="gate-input" type="password" autocomplete="off" autocapitalize="off" ' +
          'autocorrect="off" spellcheck="false" enterkeyhint="go">' +
        '<label class="gate-show"><input id="gate-show" type="checkbox"> Code anzeigen</label>' +
        '<button class="gate-button" type="submit">Öffnen</button>' +
        '<p id="gate-status" class="gate-status" role="status" aria-live="polite"></p>' +
      '</form>';
    document.body.appendChild(gate);

    const form = gate.querySelector("form");
    const input = gate.querySelector("#gate-code");
    const show = gate.querySelector("#gate-show");
    const button = gate.querySelector(".gate-button");
    const status = gate.querySelector("#gate-status");
    let failures = 0;
    let busy = false;

    const say = (text) => { status.textContent = text; };
    show.addEventListener("change", () => { input.type = show.checked ? "text" : "password"; });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy) return;
      const code = input.value.trim();
      if (!code) { say("Bitte den Code eingeben."); return; }
      if (!(window.crypto && crypto.subtle)) {
        say("Dieser Browser kann den Code nur über eine HTTPS-Verbindung prüfen.");
        return;
      }
      busy = true;
      button.disabled = true;
      say("Prüfe …");
      let accepted = false;
      try {
        accepted = sameHash(await derive(code), HASH_HEX);
      } catch (_) {
        say("Die Prüfung ist fehlgeschlagen. Bitte die Seite neu laden.");
        busy = false;
        button.disabled = false;
        return;
      }
      if (accepted) {
        store.set({ h: HASH_HEX.slice(0, 16), until: Date.now() + REMEMBER_DAYS * 86400000 });
        gate.remove();
        startApp();
        return;
      }
      failures += 1;
      say("Der Code stimmt nicht.");
      input.select();
      setTimeout(() => { busy = false; button.disabled = false; input.focus(); },
        Math.min(MAX_WAIT_MS, 1000 * 2 ** (failures - 1)));
    });

    input.focus();
  }

  /* ---- start ----------------------------------------------------------------------------- */
  const unlocked = remembered();
  if (!unlocked) root.classList.add("gate-locked");   // before the first paint: no flash of the app
  document.addEventListener("DOMContentLoaded", () => { if (unlocked) startApp(); else showGate(); });
})();

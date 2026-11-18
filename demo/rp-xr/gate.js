// Access-code gate for the RP-XR simulator. The app module (js/main.js) is not
// in the HTML: it is imported here only after the code was accepted. Uses the
// same code and unlock as the J.A.R. Corporate course "demo-rp-simulation"
// (corporate/js/passcode.js explains what this gate does and does not protect).
// ?lock in the URL forgets the remembered unlock on this device.
import { RP_XR_PASSCODE as PC, isUnlocked, tryUnlock, lock, canCheck, retryDelayMs } from "../../corporate/js/passcode.js";

const root = document.documentElement;

const params = new URLSearchParams(location.search);
if (params.has("lock")) {
  lock(PC);
  params.delete("lock");
  const rest = params.toString();
  history.replaceState(null, "", location.pathname + (rest ? "?" + rest : "") + location.hash);
}

let started = false;
async function startApp() {
  if (started) return;
  started = true;
  root.classList.remove("gate-locked");
  try {
    await import("./js/main.js");
  } catch (err) {
    console.error("RP-XR failed to start", err);
    root.classList.add("gate-locked");
    showGate("The simulator failed to load. Please reload the page.");
  }
}

function showGate(initialMessage = "") {
  document.getElementById("gate")?.remove();
  const gate = document.createElement("div");
  gate.id = "gate";
  gate.setAttribute("role", "dialog");
  gate.setAttribute("aria-modal", "true");
  gate.setAttribute("aria-labelledby", "gate-title");

  const form = document.createElement("form");
  form.className = "gate-card";
  form.noValidate = true;
  form.autocomplete = "off";
  const title = Object.assign(document.createElement("h1"), { id: "gate-title", textContent: "RP-XR Simulator" });
  const lead = Object.assign(document.createElement("p"), { className: "gate-lead", textContent: "Access code required (same code as the J.A.R. Corporate course)." });
  const label = Object.assign(document.createElement("label"), { className: "gate-label", htmlFor: "gate-code", textContent: "Access code" });
  const input = Object.assign(document.createElement("input"), { id: "gate-code", className: "gate-input", type: "password", autocomplete: "off", spellcheck: false });
  input.setAttribute("autocapitalize", "off");
  input.setAttribute("enterkeyhint", "go");
  const showLabel = Object.assign(document.createElement("label"), { className: "gate-show" });
  const show = Object.assign(document.createElement("input"), { type: "checkbox" });
  showLabel.append(show, " Show code");
  const button = Object.assign(document.createElement("button"), { className: "gate-button", type: "submit", textContent: "Open" });
  const status = Object.assign(document.createElement("p"), { className: "gate-status", textContent: initialMessage });
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  form.append(title, lead, label, input, showLabel, button, status);
  gate.append(form);
  document.body.append(gate);

  const say = (text) => { status.textContent = text; };
  show.addEventListener("change", () => { input.type = show.checked ? "text" : "password"; });
  let failures = 0;
  let busy = false;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!input.value.trim()) return say("Please enter the code.");
    if (!canCheck()) return say("This browser can only check the code over an HTTPS connection.");
    busy = true;
    button.disabled = true;
    say("Checking …");
    let ok = false;
    try {
      ok = await tryUnlock(PC, input.value);
    } catch {
      busy = false;
      button.disabled = false;
      return say("The check failed. Please reload the page.");
    }
    if (ok) {
      gate.remove();
      startApp();
      return;
    }
    failures += 1;
    say("That code is not correct.");
    input.select();
    setTimeout(() => { busy = false; button.disabled = false; input.focus(); }, retryDelayMs(failures));
  });
  input.focus();
}

if (isUnlocked(PC)) startApp();
else showGate();

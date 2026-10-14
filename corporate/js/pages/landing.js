// Landing page: the sign-in / register / forgot password card (tabs switched
// by the URL hash). Courses are not listed publicly — only after sign-in.
import { backend } from "../backend.js";
import { t, onLangChange } from "../i18n.js";
import { mountLayout } from "../layout.js";
import { initHeroScroll } from "../hero-scroll.js";
import { el, replace, byId, errorText, setBusy, fieldError, clearFieldErrors } from "../ui.js";

// ?next= may only name a portal page (prevents open redirects).
const NEXT_RE = /^[a-z][a-z-]*\.html(\?[\w=&%.-]*)?(#[\w-]*)?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PANELS = { "#signin": "signin", "#register": "register", "#forgot": "forgot" };
const OAUTH_NAMES = { google: "Google", azure: "Microsoft", github: "GitHub", apple: "Apple" };

mountLayout({ active: "landing" });
try { initHeroScroll(); } catch (e) { console.warn("hero scroll: disabled", e); } // decoration only

function nextTarget() {
  let next = "";
  try { next = new URLSearchParams(location.search).get("next") || ""; } catch { next = ""; }
  return NEXT_RE.test(next) ? next : "dashboard.html";
}

// ── Tabs ────────────────────────────────────────────────────────────────────
function showPanel(scroll) {
  const active = PANELS[location.hash] || "signin";
  for (const name of Object.values(PANELS)) {
    const panel = byId("panel-" + name);
    const tab = byId("tab-" + name);
    if (panel) panel.hidden = name !== active;
    if (tab) {
      tab.setAttribute("aria-selected", name === active ? "true" : "false");
      if (name === active) tab.setAttribute("aria-current", "true");
      else tab.removeAttribute("aria-current");
    }
  }
  const oauth = byId("oauthBox");
  if (oauth) oauth.hidden = backend.oauthProviders.length === 0 || active === "forgot";
  if (scroll && PANELS[location.hash]) byId("signin")?.scrollIntoView({ block: "start" });
}

// ── OAuth ───────────────────────────────────────────────────────────────────
function renderOAuth() {
  const box = byId("oauthButtons");
  if (!box) return;
  replace(box, backend.oauthProviders.map((provider) => {
    const button = el("button", { class: "btn btn-outline btn-block", type: "button" },
      t("oauth_continue", { provider: OAUTH_NAMES[provider] || provider }));
    button.addEventListener("click", async () => {
      const msg = byId(location.hash === "#register" ? "rg-msg" : "si-msg");
      setBusy(button, true);
      try {
        await backend.signInWithOAuth(provider); // redirects away on success
      } catch (e) {
        showMsg(msg, "error", errorText(e));
      } finally {
        setBusy(button, false);
      }
    });
    return button;
  }));
}

function showMsg(node, kind, text) {
  if (!node) return;
  node.className = "form-msg" + (kind ? " form-msg-" + kind : "");
  node.textContent = text || "";
}

// ── Forms ───────────────────────────────────────────────────────────────────
function validEmail(input) {
  const v = input.value.trim();
  if (!v) return fieldError(input, t("v_required"));
  if (!EMAIL_RE.test(v)) return fieldError(input, t("v_email"));
  return fieldError(input, "");
}

function required(input) {
  return fieldError(input, input.value.trim() ? "" : t("v_required"));
}

// Runs an async submit with the button disabled; shows any PortalError.
async function submitting(form, msg, work) {
  const button = form.querySelector('button[type="submit"]');
  showMsg(msg, "", "");
  setBusy(button, true, t("busy"));
  try {
    await work();
  } catch (e) {
    showMsg(msg, "error", errorText(e));
  } finally {
    setBusy(button, false);
  }
}

function focusFirstInvalid(form) {
  form.querySelector('[aria-invalid="true"]')?.focus();
}

function wireSignIn() {
  const form = byId("panel-signin");
  const email = byId("si-email");
  const password = byId("si-password");
  const msg = byId("si-msg");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearFieldErrors(form);
    const ok = [validEmail(email), required(password)].every(Boolean);
    if (!ok) return focusFirstInvalid(form);
    return submitting(form, msg, async () => {
      await backend.signIn({ email: email.value.trim(), password: password.value });
      location.href = nextTarget();
    });
  });
}

function wireRegister() {
  const form = byId("panel-register");
  const name = byId("rg-name");
  const org = byId("rg-org");
  const email = byId("rg-email");
  const pw = byId("rg-password");
  const pw2 = byId("rg-password2");
  const privacy = byId("rg-privacy");
  const msg = byId("rg-msg");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearFieldErrors(form);
    const checks = [
      required(name) && fieldError(name, name.value.trim().length > 120 ? t("v_max", { max: 120 }) : ""),
      required(org) && fieldError(org, org.value.trim().length > 120 ? t("v_max", { max: 120 }) : ""),
      validEmail(email),
      fieldError(pw, pw.value.length < 8 ? t("v_password_min") : ""),
      fieldError(pw2, pw2.value !== pw.value ? t("v_password_match") : ""),
      fieldError(privacy, privacy.checked ? "" : t("v_privacy")),
    ];
    if (!checks.every(Boolean)) return focusFirstInvalid(form);
    return submitting(form, msg, async () => {
      const res = await backend.signUp({
        email: email.value.trim(), password: pw.value,
        fullName: name.value.trim(), organization: org.value.trim(),
      });
      if (res && res.needsConfirmation) {
        form.reset();
        showMsg(msg, "success", t("register_confirm"));
        return;
      }
      location.href = nextTarget();
    });
  });
}

function wireForgot() {
  const form = byId("panel-forgot");
  const email = byId("fg-email");
  const msg = byId("fg-msg");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearFieldErrors(form);
    if (!validEmail(email)) return focusFirstInvalid(form);
    return submitting(form, msg, async () => {
      await backend.sendPasswordReset(email.value.trim());
      showMsg(msg, "success", t("forgot_sent"));
    });
  });
}

// ── Signed-in state ─────────────────────────────────────────────────────────
let currentUser = null;

function renderAuthState() {
  const signedIn = byId("signedInPanel");
  const forms = byId("authForms");
  if (currentUser) {
    byId("signedInText").textContent = t("signed_in_as", { email: currentUser.email });
    byId("toDashboard").href = nextTarget();
  }
  signedIn.hidden = !currentUser;
  forms.hidden = !!currentUser;
}

async function initAuth() {
  try {
    currentUser = await backend.getUser();
  } catch (e) {
    currentUser = null;
    showMsg(byId("si-msg"), "error", errorText(e));
  }
  renderAuthState();
  backend.onAuthChange((user) => {
    currentUser = user;
    renderAuthState();
  });
}

renderOAuth();
showPanel(true);
wireSignIn();
wireRegister();
wireForgot();
// Submit buttons ship disabled so a click before this module runs can't
// fall through to a native GET submit (which would put the password in the URL).
document.querySelectorAll('.auth-panel button[type="submit"]').forEach((b) => { b.disabled = false; });
initAuth();
window.addEventListener("hashchange", () => showPanel(true));
onLangChange(() => {
  renderOAuth();
  renderAuthState();
});

// Password reset: the mail link lands here with a recovery session; the user
// picks a new password.
import { backend } from "../backend.js";
import { t } from "../i18n.js";
import { mountLayout } from "../layout.js";
import { el, replace, byId, errorText, notice, setBusy, fieldError, clearFieldErrors } from "../ui.js";

mountLayout({ active: "reset" });

const form = byId("resetForm");
const pw = byId("rs-password");
const pw2 = byId("rs-password2");
const msg = byId("rs-msg");

// Password managers (iCloud Keychain, Chrome, 1Password) file the new password
// under the account named in the username field, so fill it in for them.
backend.getUser().then((user) => { if (user?.email) byId("rs-username").value = user.email; }).catch(() => {});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearFieldErrors(form);
  replace(msg);
  const ok = [
    fieldError(pw, pw.value.length < 8 ? t("v_password_min") : ""),
    fieldError(pw2, pw2.value !== pw.value ? t("v_password_match") : ""),
  ].every(Boolean);
  if (!ok) {
    form.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  setBusy(button, true, t("busy"));
  try {
    await backend.updatePassword(pw.value);
    form.hidden = true;
    byId("resetDone").hidden = false;
  } catch (err) {
    replace(msg, notice("error",
      el("p", {}, errorText(err)),
      el("p", {}, t("reset_link_hint"), " ", el("a", { href: "index.html#forgot" }, t("reset_link_cta")))));
  } finally {
    setBusy(button, false);
  }
});

// The button ships disabled so a click before this module runs can't submit natively.
form.querySelector('button[type="submit"]').disabled = false;

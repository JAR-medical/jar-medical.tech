// Profile settings in a modal dialog, opened from the account menu on every
// page. A successful save announces the new profile with a "portal:profile"
// event on window, so the page behind it (dashboard greeting, certificate,
// admin client list) can update without a reload.
import { backend } from "./backend.js";
import { t, onLangChange } from "./i18n.js";
import { el, replace, notice, errorText, errorBox, loadingLine, setBusy, fieldError, clearFieldErrors } from "./ui.js";

const MAX = 120;
export const PROFILE_EVENT = "portal:profile";

let dialog = null;
let profile = null;
let flash = null;
let returnTo = null;

export function openProfileDialog() {
  if (!dialog) create();
  flash = null;
  returnTo = document.activeElement;
  if (!dialog.open) dialog.showModal();
  load();
}

function create() {
  dialog = el("dialog", { class: "profile-dialog", "aria-labelledby": "pd-title" });
  // A click on the backdrop lands on the dialog element itself, outside the card.
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
  // Back to whatever opened the dialog; if that is gone or hidden (the closed
  // account menu, a re-rendered dashboard), to the account button.
  dialog.addEventListener("close", () => {
    const visible = returnTo?.isConnected && returnTo.getClientRects().length > 0;
    (visible ? returnTo : document.querySelector(".account-btn"))?.focus();
  });
  document.body.append(dialog);
  // Re-render in the new language, keeping whatever was typed.
  onLangChange(() => { if (dialog.open && profile) render(draft()); });
}

async function load() {
  profile = null;
  replace(dialog, card(loadingLine()));
  try {
    profile = await backend.getMyProfile();
    render();
  } catch (e) {
    replace(dialog, card(errorBox(e, load)));
  }
}

function draft() {
  const name = dialog.querySelector("#pd-name");
  const org = dialog.querySelector("#pd-org");
  return name && org ? { name: name.value, org: org.value } : null;
}

function card(...body) {
  const close = el("button", { class: "dialog-close", type: "button", "aria-label": t("btn_close") }, "×");
  close.addEventListener("click", () => dialog.close());
  return el("div", { class: "dialog-card" },
    el("div", { class: "dialog-head" },
      el("h2", { id: "pd-title" }, t("account_profile")),
      close),
    ...body);
}

function render(values) {
  const name = el("input", { id: "pd-name", type: "text", autocomplete: "name", maxlength: MAX, required: true,
    value: values?.name ?? profile.full_name ?? "" });
  const org = el("input", { id: "pd-org", type: "text", autocomplete: "organization", maxlength: MAX, required: true,
    value: values?.org ?? profile.organization ?? "" });
  const email = el("input", { id: "pd-email", type: "email", value: profile.email || "", readOnly: true, "aria-describedby": "pd-email-hint" });
  const msg = el("div", { class: "form-status", "aria-live": "polite" });
  if (flash) msg.append(notice(flash.kind, el("p", {}, t(flash.key))));
  const save = el("button", { class: "btn btn-primary btn-small", type: "submit" }, t("btn_save"));
  const cancel = el("button", { class: "btn btn-outline btn-small", type: "button" }, flash?.kind === "success" ? t("btn_close") : t("btn_cancel"));
  cancel.addEventListener("click", () => dialog.close());

  const form = el("form", { class: "profile-form", novalidate: true },
    el("div", { class: "field" }, el("label", { for: "pd-name" }, t("f_fullname")), name),
    el("div", { class: "field" }, el("label", { for: "pd-org" }, t("f_org")), org),
    el("div", { class: "field" }, el("label", { for: "pd-email" }, t("f_email")), email,
      el("p", { class: "field-hint", id: "pd-email-hint" }, t("profile_email_hint"))),
    msg,
    el("div", { class: "button-row" }, save, cancel));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFieldErrors(form);
    replace(msg);
    const ok = [name, org].map((input) => {
      const v = input.value.trim();
      return fieldError(input, !v ? t("v_required") : v.length > MAX ? t("v_max", { max: MAX }) : "");
    }).every(Boolean);
    if (!ok) {
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    setBusy(save, true, t("busy"));
    try {
      profile = await backend.updateMyProfile({ fullName: name.value.trim(), organization: org.value.trim() });
      flash = { kind: "success", key: "profile_saved" };
      window.dispatchEvent(new CustomEvent(PROFILE_EVENT, { detail: profile }));
      render();
      dialog.querySelector(".button-row .btn-outline")?.focus();
    } catch (err) {
      setBusy(save, false);
      replace(msg, notice("error", el("p", {}, errorText(err))));
    }
  });

  replace(dialog, card(form));
  // Start where the work is: the first empty field, else the name.
  (!name.value.trim() ? name : !org.value.trim() ? org : name).focus();
}

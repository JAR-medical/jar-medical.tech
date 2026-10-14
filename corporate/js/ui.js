// Small DOM helpers shared by every page. Everything here builds nodes with
// createElement/textContent — never innerHTML — because profile names,
// organisations and request messages come from other users.
import { t, has, getLang } from "./i18n.js";

// el("button", {class: "btn", type: "button", onclick: fn, dataset: {...}}, "Label", childNode)
// Attribute values of null/undefined/false are skipped; true sets an empty attribute.
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
    else if (key === "value" || key === "checked" || key === "disabled" || key === "hidden" || key === "readOnly") node[key] = value;
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  append(node, children);
  return node;
}

function append(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function replace(node, ...children) {
  node.replaceChildren();
  append(node, children);
  return node;
}

export const byId = (id) => document.getElementById(id);

function locale() {
  return getLang() === "en" ? "en-GB" : "de-DE";
}

export function formatDate(iso, withTime = false) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const opts = withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" };
  return new Intl.DateTimeFormat(locale(), opts).format(d);
}

// The text to show for any thrown value: a translated PortalError code when
// we know it, otherwise the raw message, otherwise a generic fallback.
export function errorText(error) {
  const code = error && typeof error.code === "string" ? error.code : "";
  if (code && has("err_" + code)) return t("err_" + code);
  if (error && error.message) return String(error.message);
  return t("err_unknown");
}

export function loadingLine(text = t("loading")) {
  return el("p", { class: "loading-line", role: "status", "aria-live": "polite" }, text);
}

// Error box with an optional "try again" button.
export function errorBox(error, onRetry) {
  return el("div", { class: "notice notice-error", role: "alert" },
    el("p", {}, errorText(error)),
    onRetry ? el("button", { class: "btn btn-outline btn-small", type: "button", onclick: onRetry }, t("retry")) : null,
  );
}

export function notice(kind, ...children) {
  return el("div", { class: "notice notice-" + kind, role: kind === "error" ? "alert" : "status" }, ...children);
}

// Visual + ARIA busy state for a submit button; returns a restore function.
export function setBusy(button, busy, busyLabel) {
  if (!button) return;
  if (busy) {
    if (button.dataset.label == null) button.dataset.label = button.textContent;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    if (busyLabel) button.textContent = busyLabel;
  } else {
    button.disabled = false;
    button.removeAttribute("aria-busy");
    if (button.dataset.label != null) {
      button.textContent = button.dataset.label;
      delete button.dataset.label;
    }
  }
}

export function progressBar(done, total, label) {
  const pct = total > 0 ? Math.round((Math.min(done, total) / total) * 100) : 0;
  return el("div", { class: "progress" },
    el("div", {
      class: "progress-track", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": total,
      "aria-valuenow": Math.min(done, total), "aria-label": label || t("progress_label"),
    }, el("div", { class: "progress-fill", style: `width:${pct}%` })),
    el("span", { class: "progress-text" }, t("lessons_progress", { done: Math.min(done, total), total })),
  );
}

// Status chip with a text label (never colour-only).
export function chip(kind, text) {
  return el("span", { class: "chip chip-" + kind }, text);
}

// Inline field validation: message under the input, aria-invalid on the input.
export function fieldError(input, message) {
  const id = input.id + "-err";
  let box = document.getElementById(id);
  if (!box) {
    box = el("p", { class: "field-error", id, "aria-live": "polite" });
    const field = input.closest(".field");
    if (field) field.append(box);
    else input.after(box);
  }
  box.textContent = message || "";
  if (message) {
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", id);
  } else {
    input.removeAttribute("aria-invalid");
  }
  return !message;
}

export function clearFieldErrors(form) {
  form.querySelectorAll("[aria-invalid]").forEach((input) => fieldError(input, ""));
}

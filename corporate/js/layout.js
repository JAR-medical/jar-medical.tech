// Wires the shared header (nav, language toggle, account area, mobile menu),
// the demo banner and the footer that every page carries as static markup.
import { backend } from "./backend.js";
import { t, getLang, setLang, applyI18n, onLangChange } from "./i18n.js";
import { el, replace, byId, errorText } from "./ui.js";
import { initMotion } from "./motion.js";
import { openProfileDialog } from "./profile-dialog.js";

const PROTECTED = new Set(["dashboard", "course", "admin"]);

export function mountLayout({ active } = {}) {
  window.__portalReady = true; // modules loaded: pages handle their own errors from here
  applyI18n();
  markActive(active);
  wireLangSwitch();
  wireMobileMenu();
  mountDemoBanner();
  mountAccount(active);
  initMotion();
}

function markActive(active) {
  document.querySelectorAll("[data-nav]").forEach((a) => {
    if (a.dataset.nav === active) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

// The main site's DE/EN menu (js/site.js there): a pill button opening a
// small menu; Escape or a click elsewhere closes it.
function wireLangSwitch() {
  const update = () => {
    const lang = getLang();
    document.querySelectorAll("[data-langlabel]").forEach((n) => { n.textContent = lang.toUpperCase(); });
    document.querySelectorAll("[data-lang]").forEach((b) => b.setAttribute("aria-current", b.dataset.lang === lang ? "true" : "false"));
  };
  update();
  onLangChange(update);
  document.querySelectorAll("[data-langswitch]").forEach((sw) => {
    const btn = sw.querySelector(".langswitch__btn");
    const menu = sw.querySelector(".langswitch__menu");
    if (!btn || !menu) return;
    const close = () => { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); };
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = menu.hidden;
      menu.hidden = !open;
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    menu.addEventListener("click", (e) => {
      const b = e.target.closest("[data-lang]");
      if (!b) return;
      setLang(b.dataset.lang);
      close();
      btn.focus();
    });
    document.addEventListener("click", close);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  });
}

// Same behaviour as the main site: the burger toggles .is-open on the bar,
// a link click or Escape closes it.
function wireMobileMenu() {
  const nav = byId("nav");
  const burger = nav?.querySelector(".nav__burger");
  const links = byId("navLinks");
  if (!nav || !burger || !links) return;
  const close = () => { nav.classList.remove("is-open"); burger.setAttribute("aria-expanded", "false"); };
  burger.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", open ? "true" : "false");
  });
  links.addEventListener("click", (e) => { if (e.target.closest("a")) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
}

function mountDemoBanner() {
  const banner = byId("demoBanner");
  if (!banner || backend.mode !== "demo") return;
  const render = () => {
    const reset = el("button", { class: "demo-reset", type: "button" }, t("demo_reset"));
    reset.addEventListener("click", async () => {
      if (!window.confirm(t("demo_reset_confirm"))) return;
      reset.disabled = true;
      try {
        await backend.resetDemo?.();
        location.reload();
      } catch (e) {
        reset.disabled = false;
        window.alert(errorText(e));
      }
    });
    replace(banner, el("div", { class: "wrap" }, el("span", {}, t("demo_banner")), reset));
  };
  render();
  banner.hidden = false;
  onLangChange(render);
}

function mountAccount(active) {
  const area = byId("accountArea");
  const adminItem = byId("navAdmin");
  const coursesItem = byId("navCourses"); // courses exist only for signed-in users
  let user = null;

  const render = () => {
    if (!area) return;
    if (!user) {
      replace(area, el("a", { class: "btn btn-primary nav__cta", href: "index.html#signin" }, t("nav_signin")));
      return;
    }
    replace(area, accountMenu(user));
  };

  const refresh = async (next) => {
    user = next;
    render();
    if (adminItem) adminItem.hidden = true;
    if (coursesItem) coursesItem.hidden = !user;
    if (!user) {
      if (PROTECTED.has(active)) location.replace("index.html#signin");
      return;
    }
    try {
      const profile = await backend.getMyProfile();
      if (adminItem) adminItem.hidden = profile.role !== "admin";
    } catch (e) {
      console.warn("layout: could not load profile for the nav", e);
    }
  };

  // The account menu lives in markup that render() replaces, so it is closed
  // through these two document listeners rather than per-render ones.
  document.addEventListener("click", (e) => { if (!e.target.closest?.(".account")) closeAccountMenu(); });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !area?.querySelector(".account-menu:not([hidden])")) return;
    closeAccountMenu();
    area.querySelector(".account-btn")?.focus();
  });

  backend.getUser().then(refresh, (e) => console.warn("layout: getUser failed", e));
  backend.onAuthChange((next) => {
    if ((next?.id ?? null) === (user?.id ?? null)) return;
    // Another account signed in (e.g. in another tab): protected pages show
    // the previous user's data, so start over.
    if (user && next && PROTECTED.has(active)) {
      location.reload();
      return;
    }
    refresh(next);
  });
  onLangChange(render);
}

// The signed-in account: a button showing the e-mail (just the person icon on
// narrow screens) that opens a small panel with the profile settings and
// sign-out. A disclosure, not an ARIA menu: two plain buttons in a panel.
function accountMenu(user) {
  const SVG = "http://www.w3.org/2000/svg";
  const icon = document.createElementNS(SVG, "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", stroke: "currentColor",
    "stroke-width": "1.8", "stroke-linecap": "round", "aria-hidden": "true" })) icon.setAttribute(k, v);
  for (const d of ["M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8Z", "M4.5 20a7.5 7.5 0 0 1 15 0"]) {
    const path = document.createElementNS(SVG, "path");
    path.setAttribute("d", d);
    icon.append(path);
  }

  const button = el("button", { class: "account-btn", type: "button", "aria-expanded": "false", "aria-controls": "accountMenu",
    "aria-label": t("account_menu_label", { email: user.email }), title: user.email },
    icon, el("span", { class: "account-email" }, user.email));
  const profile = el("button", { type: "button" }, t("account_profile"));
  const out = el("button", { type: "button" }, t("nav_signout"));
  const panel = el("div", { class: "account-menu", id: "accountMenu", hidden: true },
    el("p", { class: "account-menu__email" }, user.email),
    profile, out);

  button.addEventListener("click", () => {
    const open = panel.hidden;
    panel.hidden = !open;
    button.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) profile.focus();
  });
  profile.addEventListener("click", () => {
    closeAccountMenu();
    openProfileDialog();
  });
  out.addEventListener("click", async () => {
    out.disabled = true;
    try {
      await backend.signOut();
      location.href = "index.html";
    } catch (e) {
      out.disabled = false;
      window.alert(errorText(e));
    }
  });
  return el("div", { class: "account" }, button, panel);
}

function closeAccountMenu() {
  const panel = byId("accountMenu");
  if (!panel || panel.hidden) return;
  panel.hidden = true;
  document.querySelector(".account-btn")?.setAttribute("aria-expanded", "false");
}

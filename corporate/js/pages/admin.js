// Admin console: stats, open course requests, and every client with per-course
// grant / revoke controls.
import { backend, requireUser } from "../backend.js";
import { PROFILE_EVENT } from "../profile-dialog.js";
import { t, pick, onLangChange } from "../i18n.js";
import { mountLayout } from "../layout.js";
import { COURSES, lessonCount } from "../catalog.js";
import { el, replace, byId, errorBox, errorText, loadingLine, notice, formatDate, chip } from "../ui.js";

const app = byId("app");
const state = { ready: false, me: null, clients: [], requests: [], query: "", flash: null };

mountLayout({ active: "admin" });

async function load(showLoading = true) {
  if (showLoading) replace(app, loadingLine());
  try {
    state.me = await requireUser({ role: "admin" });
    const [clients, requests] = await Promise.all([backend.adminListClients(), backend.adminListRequests()]);
    state.clients = clients;
    state.requests = requests;
    state.ready = true;
    render();
  } catch (e) {
    replace(app, errorBox(e, () => load()));
  }
}

const courseTitle = (id) => {
  const c = COURSES.find((x) => x.id === id);
  return c ? pick(c.title) : id;
};
const progressOf = (client, courseId) => client.progress?.[courseId] || { done: 0, last: null };

function stats() {
  const clients = state.clients.filter((c) => c.role === "client");
  const grants = state.clients.reduce((n, c) => n + c.enrollments.length, 0);
  const finished = state.clients.reduce((n, c) => n + c.enrollments.filter((e) => {
    const course = COURSES.find((x) => x.id === e.course_id);
    const total = lessonCount(course);
    return total > 0 && progressOf(c, e.course_id).done >= total;
  }).length, 0);
  const tiles = [
    [t("stat_clients"), clients.length],
    [t("stat_open_requests"), state.requests.filter((r) => r.status === "pending").length],
    [t("stat_active_grants"), grants],
    [t("stat_completed"), finished],
  ];
  return el("div", { class: "stat-tiles" }, tiles.map(([label, value]) =>
    el("div", { class: "stat-tile" }, el("span", { class: "stat-value" }, String(value)), el("span", { class: "stat-label" }, label))));
}

// Runs an admin action with the given buttons disabled, then reloads.
async function act(buttons, work, successText) {
  buttons.forEach((b) => { b.disabled = true; b.setAttribute("aria-busy", "true"); });
  try {
    await work();
    state.flash = { kind: "success", text: successText };
    await load(false);
  } catch (e) {
    buttons.forEach((b) => { b.disabled = false; b.removeAttribute("aria-busy"); });
    showStatus("error", errorText(e));
  }
}

function showStatus(kind, text) {
  const box = byId("adminStatus");
  if (box) replace(box, notice(kind, el("p", {}, text)));
}

function requestsSection() {
  const pending = state.requests.filter((r) => r.status === "pending");
  const body = pending.length
    ? el("div", { class: "table-wrap" }, el("table", { class: "data-table" },
      el("thead", {}, el("tr", {}, [t("col_date"), t("col_name"), t("col_org"), t("col_email"), t("col_course"), t("col_message"), t("col_actions")]
        .map((h) => el("th", { scope: "col" }, h)))),
      el("tbody", {}, pending.map((r) => {
        const approve = el("button", { class: "btn btn-primary btn-small", type: "button" }, t("btn_grant"));
        const decline = el("button", { class: "btn btn-outline btn-small", type: "button" }, t("btn_decline"));
        const who = r.full_name || r.email;
        approve.addEventListener("click", () => act([approve, decline],
          () => backend.adminDecideRequest(r.id, "approved"), t("admin_approved", { name: who, course: courseTitle(r.course_id) })));
        decline.addEventListener("click", () => act([approve, decline],
          () => backend.adminDecideRequest(r.id, "declined"), t("admin_declined", { name: who, course: courseTitle(r.course_id) })));
        return el("tr", {},
          el("td", { class: "nowrap" }, formatDate(r.created_at)),
          el("td", {}, r.full_name || "—"),
          el("td", {}, r.organization || "—"),
          el("td", { class: "break" }, r.email || "—"),
          el("td", {}, courseTitle(r.course_id)),
          el("td", { class: "message-cell" }, r.message || "—"),
          el("td", {}, el("div", { class: "button-row" }, approve, decline)));
      }))))
    : el("p", { class: "muted" }, t("admin_no_requests"));
  return el("section", { class: "dash-section", "aria-labelledby": "h-open" },
    el("h2", { id: "h-open" }, t("admin_open_requests")), body);
}

function courseCell(client, course) {
  const enrolled = client.enrollments.some((e) => e.course_id === course.id);
  const pending = client.pending.includes(course.id);
  const prog = progressOf(client, course.id);
  const status = enrolled
    ? el("div", { class: "cell-status" },
      chip("ok", t("chip_granted")),
      el("span", { class: "cell-sub" }, t("lessons_progress", { done: Math.min(prog.done, lessonCount(course)), total: lessonCount(course) })),
      prog.last ? el("span", { class: "cell-sub" }, t("last_activity", { date: formatDate(prog.last) })) : null)
    : pending ? el("div", { class: "cell-status" }, chip("pending", t("chip_pending")))
      : el("div", { class: "cell-status" }, el("span", { class: "muted", title: t("chip_none") }, "—", el("span", { class: "visually-hidden" }, " " + t("chip_none"))));
  const who = client.full_name || client.email;
  const button = enrolled
    ? el("button", { class: "btn btn-outline btn-small", type: "button" }, t("btn_revoke"))
    : el("button", { class: "btn btn-primary btn-small", type: "button" }, t("btn_grant"));
  button.addEventListener("click", () => {
    if (enrolled) {
      if (!window.confirm(t("confirm_revoke", { name: who, course: pick(course.title) }))) return;
      act([button], () => backend.adminRevoke(client.id, course.id), t("admin_revoked", { name: who, course: pick(course.title) }));
    } else {
      act([button], () => backend.adminGrant(client.id, course.id), t("admin_granted", { name: who, course: pick(course.title) }));
    }
  });
  return el("td", {}, status, button);
}

function bulkActionCell(client) {
  const who = client.full_name || client.email;
  const allGranted = COURSES.every((c) => client.enrollments.some((e) => e.course_id === c.id));
  const btn = el("button", {
    class: "btn " + (allGranted ? "btn-outline" : "btn-primary") + " btn-small",
    type: "button",
  }, allGranted ? t("btn_revoke_all") : t("btn_grant_all"));
  const delBtn = client.id !== state.me?.id
    ? el("button", { class: "btn btn-danger btn-small", type: "button" }, t("btn_delete_user"))
    : null;
  const buttons = [btn, delBtn].filter(Boolean);
  btn.addEventListener("click", () => {
    if (allGranted) {
      act(buttons,
        () => Promise.all(COURSES.map((c) => backend.adminRevoke(client.id, c.id))),
        t("admin_revoked_all", { name: who }));
    } else {
      act(buttons,
        () => Promise.all(COURSES.map((c) => backend.adminGrant(client.id, c.id))),
        t("admin_granted_all", { name: who }));
    }
  });
  if (delBtn) {
    delBtn.addEventListener("click", () => {
      if (!window.confirm(t("confirm_delete_user", { name: who, email: client.email }))) return;
      act(buttons,
        () => backend.adminDeleteClient(client.id),
        t("admin_deleted_user", { name: who }));
    });
  }
  return el("td", { class: "nowrap" }, el("div", { class: "button-row" }, btn, delBtn));
}

function clientRows() {
  const q = state.query.trim().toLowerCase();
  const rows = state.clients.filter((c) => !q ||
    [c.full_name, c.organization, c.email].some((v) => String(v || "").toLowerCase().includes(q)));
  if (!rows.length) {
    return [el("tr", {}, el("td", { colspan: 6 + COURSES.length, class: "muted" }, t("admin_no_match")))];
  }
  return rows.map((c) => el("tr", {},
    el("td", {}, c.full_name || "—"),
    el("td", {}, c.organization || "—"),
    el("td", { class: "break" }, c.email),
    el("td", { class: "nowrap" }, formatDate(c.created_at)),
    el("td", {}, c.role === "admin" ? chip("admin", t("role_admin")) : t("role_client")),
    bulkActionCell(c),
    COURSES.map((course) => courseCell(c, course))));
}

function clientsSection() {
  const tbody = el("tbody", {}, clientRows());
  const search = el("input", { id: "clientSearch", type: "search", value: state.query, autocomplete: "off" });
  search.addEventListener("input", () => {
    state.query = search.value;
    replace(tbody, clientRows());
  });
  return el("section", { class: "dash-section", "aria-labelledby": "h-clients" },
    el("h2", { id: "h-clients" }, t("admin_all_clients")),
    el("div", { class: "field field-search" }, el("label", { for: "clientSearch" }, t("admin_search")), search),
    el("div", { class: "table-wrap" }, el("table", { class: "data-table" },
      el("thead", {}, el("tr", {},
        [t("col_name"), t("col_org"), t("col_email"), t("col_registered"), t("col_role"), t("col_actions")].map((h) => el("th", { scope: "col" }, h)),
        COURSES.map((c) => el("th", { scope: "col" }, pick(c.title))))),
      tbody)));
}

function render() {
  const refresh = el("button", { class: "btn btn-outline btn-small", type: "button" }, t("btn_refresh"));
  refresh.addEventListener("click", () => { state.flash = null; load(); });
  const status = el("div", { id: "adminStatus", "aria-live": "polite" });
  if (state.flash) status.append(notice(state.flash.kind, el("p", {}, state.flash.text)));
  state.flash = null;
  replace(app,
    el("div", { class: "page-head page-head-row" },
      el("div", {}, el("span", { class: "eyebrow" }, t("admin_eyebrow")), el("h1", { class: "page-title" }, t("admin_h1"))),
      refresh),
    stats(),
    status,
    requestsSection(),
    clientsSection());
}

onLangChange(() => { if (state.ready) render(); });
// An admin edited their own profile: their row in the client list changed.
window.addEventListener(PROFILE_EVENT, () => { if (state.ready) load(false); });
load();

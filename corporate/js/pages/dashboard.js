// Client dashboard: granted courses with progress, requesting further
// courses and the request history. Profile settings live in the account
// menu (profile-dialog.js); a section without cards is left out entirely.
import { backend, requireUser } from "../backend.js";
import { CONFIG } from "../config.js";
import { t, pick, onLangChange } from "../i18n.js";
import { mountLayout } from "../layout.js";
import { COURSES, lessonCount } from "../catalog.js";
import { courseIcon } from "../icons.js";
import { openProfileDialog, PROFILE_EVENT } from "../profile-dialog.js";
import {
  el, replace, byId, errorText, errorBox, loadingLine, notice, formatDate,
  setBusy, progressBar, chip, fieldError,
} from "../ui.js";

const MAX_MESSAGE = 500;
const app = byId("app");
const state = { profile: null, enrollments: [], requests: [], progress: {}, flash: {} };

mountLayout({ active: "dashboard" });

async function fetchData() {
  const [enrollments, requests] = await Promise.all([backend.listMyEnrollments(), backend.listMyRequests()]);
  const granted = COURSES.filter((c) => enrollments.some((e) => e.course_id === c.id));
  const progressLists = await Promise.all(granted.map((c) => backend.listMyProgress(c.id)));
  state.enrollments = enrollments;
  state.requests = requests;
  state.progress = {};
  granted.forEach((c, i) => {
    const ids = new Set(c.lessons.map((l) => l.id));
    state.progress[c.id] = progressLists[i].filter((p) => ids.has(p.lesson_id)).length;
  });
}

async function load() {
  replace(app, loadingLine());
  try {
    state.profile = await requireUser();
    await fetchData();
    render();
  } catch (e) {
    replace(app, errorBox(e, load));
  }
}

const isGranted = (courseId) => state.enrollments.some((e) => e.course_id === courseId);
// Sign-ups via Google/Apple/… bring a name at best, never an organization.
const profileIncomplete = () => !state.profile.full_name?.trim() || !state.profile.organization?.trim();

function render() {
  const p = state.profile;
  const granted = COURSES.filter((c) => isGranted(c.id));
  replace(app,
    el("div", { class: "page-head" },
      el("span", { class: "eyebrow" }, t("dash_eyebrow")),
      el("h1", { class: "page-title" }, t("dash_welcome", { name: p.full_name || p.email })),
      p.organization ? el("p", { class: "page-sub" }, p.organization) : null),
    profileIncomplete()
      ? notice("warn",
        el("p", {}, el("strong", {}, t("profile_incomplete_title")), " ", t("profile_incomplete_text")),
        el("button", { class: "btn btn-primary btn-small", type: "button", onclick: () => openProfileDialog() }, t("profile_incomplete_btn")))
      : null,
    p.role === "admin"
      ? el("div", { class: "admin-box" },
        el("p", {}, el("strong", {}, t("dash_admin_title")), " ", t("dash_admin_text")),
        el("a", { class: "btn btn-primary btn-small", href: "admin.html" }, t("dash_admin_btn")))
      : null,
    el("section", { class: "dash-section", "aria-labelledby": "h-my" },
      el("h2", { id: "h-my" }, t("dash_my_courses")),
      granted.length
        ? el("div", { class: "course-grid" }, granted.map(myCourseCard))
        : el("p", { class: "muted" }, t("dash_no_courses"))),
    state.requests.length
      ? el("section", { class: "dash-section", "aria-labelledby": "h-req" },
        el("h2", { id: "h-req" }, t("dash_requests")),
        requestsTable())
      : null,
    el("p", { class: "contact-line" }, t("dash_contact"), " ",
      el("a", { href: "mailto:" + CONFIG.CONTACT_EMAIL }, CONFIG.CONTACT_EMAIL)),
  );
  state.flash = {};
}

function courseMeta(course) {
  return el("p", { class: "course-meta" }, t("course_meta", { minutes: course.minutes ?? "–", lessons: lessonCount(course) }));
}

function myCourseCard(course) {
  const total = lessonCount(course);
  const done = Math.min(state.progress[course.id] || 0, total);
  const label = done === 0 ? t("btn_start") : done >= total ? t("btn_repeat") : t("btn_continue");
  return el("article", { class: "course-card" },
    cardHead(course),
    courseMeta(course),
    progressBar(done, total, t("progress_of", { title: pick(course.title) })),
    done >= total && total > 0 ? el("p", {}, chip("ok", t("chip_completed"))) : null,
    el("a", { class: "btn btn-primary btn-small", href: "course.html?c=" + encodeURIComponent(course.id) }, label));
}

// Icon, title and one short line — the details live inside the course.
function cardHead(course) {
  return el("div", { class: "course-card-head" },
    courseIcon(course.icon),
    el("div", {},
      el("h3", {}, pick(course.title)),
      course.subtitle ? el("p", { class: "course-subtitle" }, pick(course.subtitle)) : null));
}

// Card for a course the user has no access to yet: request / pending / declined.
function requestCard(course) {
  const mine = state.requests.filter((r) => r.course_id === course.id);
  const pending = mine.find((r) => r.status === "pending");
  const last = mine[0]; // newest first
  const status = el("div", { class: "card-status", "aria-live": "polite" });
  const flash = state.flash[course.id];
  if (flash) status.append(notice(flash.kind, el("p", {}, flash.text)));

  const card = el("article", { class: "course-card" },
    cardHead(course),
    courseMeta(course));

  if (pending) {
    const cancel = el("button", { class: "btn btn-outline btn-small", type: "button" }, t("btn_cancel_request"));
    cancel.addEventListener("click", async () => {
      setBusy(cancel, true, t("busy"));
      try {
        await backend.cancelRequest(pending.id);
        state.flash[course.id] = { kind: "success", text: t("request_cancelled") };
        await refresh();
      } catch (e) {
        setBusy(cancel, false);
        replace(status, notice("error", el("p", {}, errorText(e))));
      }
    });
    card.append(el("p", {}, chip("pending", t("requested_on", { date: formatDate(pending.created_at) }))), cancel);
  } else {
    if (last && last.status === "declined") card.append(el("p", { class: "note" }, t("request_declined_note")));
    card.append(profileIncomplete()
      ? el("p", { class: "note" }, t("request_needs_profile"))
      : requestForm(course, status));
  }
  card.append(status);
  return card;
}

function requestForm(course, status) {
  const id = "msg-" + course.id;
  const open = el("button", { class: "btn btn-primary btn-small", type: "button", "aria-expanded": "false", "aria-controls": "form-" + course.id }, t("btn_request"));
  const textarea = el("textarea", { id, rows: 3, maxlength: MAX_MESSAGE, "aria-describedby": id + "-count" });
  const counter = el("p", { class: "char-count", id: id + "-count", "aria-live": "polite" }, t("char_count", { n: 0, max: MAX_MESSAGE }));
  const submit = el("button", { class: "btn btn-primary btn-small", type: "submit" }, t("btn_send_request"));
  const cancel = el("button", { class: "btn btn-outline btn-small", type: "button" }, t("btn_cancel"));
  const form = el("form", { class: "request-form", id: "form-" + course.id, hidden: true, novalidate: true },
    el("div", { class: "field" }, el("label", { for: id }, t("request_message_label")), textarea, counter),
    el("div", { class: "button-row" }, submit, cancel));

  const toggle = (show) => {
    form.hidden = !show;
    open.hidden = show;
    open.setAttribute("aria-expanded", show ? "true" : "false");
    if (show) textarea.focus();
    else open.focus();
  };
  open.addEventListener("click", () => toggle(true));
  cancel.addEventListener("click", () => toggle(false));
  textarea.addEventListener("input", () => {
    counter.textContent = t("char_count", { n: textarea.value.length, max: MAX_MESSAGE });
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (textarea.value.trim().length > MAX_MESSAGE) {
      fieldError(textarea, t("v_max", { max: MAX_MESSAGE }));
      return;
    }
    fieldError(textarea, "");
    setBusy(submit, true, t("busy"));
    cancel.disabled = true;
    try {
      await backend.requestCourse(course.id, textarea.value.trim());
      state.flash[course.id] = { kind: "success", text: t("request_sent") };
      await refresh();
    } catch (err) {
      setBusy(submit, false);
      cancel.disabled = false;
      replace(status, notice("error", el("p", {}, errorText(err))));
    }
  });
  return el("div", {}, open, form);
}

function statusChip(status) {
  if (status === "approved") return chip("ok", t("status_approved"));
  if (status === "declined") return chip("declined", t("status_declined"));
  return chip("pending", t("status_pending"));
}

function requestsTable() {
  const courseTitle = (id) => {
    const c = COURSES.find((x) => x.id === id);
    return c ? pick(c.title) : id;
  };
  return el("div", { class: "table-wrap" },
    el("table", { class: "data-table" },
      el("thead", {}, el("tr", {},
        el("th", { scope: "col" }, t("col_course")),
        el("th", { scope: "col" }, t("col_date")),
        el("th", { scope: "col" }, t("col_status")))),
      el("tbody", {}, state.requests.map((r) => el("tr", {},
        el("td", {}, courseTitle(r.course_id)),
        el("td", {}, formatDate(r.created_at)),
        el("td", {}, statusChip(r.status)))))));
}

// Reload data after a change; pending flash messages show in the next render.
async function refresh() {
  try {
    await fetchData();
    render();
  } catch (e) {
    state.flash = {};
    replace(app, errorBox(e, load));
  }
}

onLangChange(() => { if (state.profile) render(); });
// Saved in the profile dialog: new greeting, and requests may now be allowed.
window.addEventListener(PROFILE_EVENT, (e) => {
  if (!state.profile) return;
  state.profile = { ...state.profile, ...e.detail };
  render();
});
load();

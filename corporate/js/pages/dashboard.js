// Client dashboard: once approved by an administrator, displays the unlocked
// courses and demos organized into three sections: Understand, Test and Train.
// Profile settings live in the account menu (profile-dialog.js).
import { backend, requireUser } from "../backend.js";
import { CONFIG } from "../config.js";
import { t, pick, onLangChange } from "../i18n.js";
import { mountLayout } from "../layout.js";
import { COURSES, SECTIONS, lessonCount } from "../catalog.js";
import { courseIcon } from "../icons.js";
import { openProfileDialog, PROFILE_EVENT } from "../profile-dialog.js";
import {
  el, replace, byId, errorBox, loadingLine, notice, formatDate,
  progressBar, chip,
} from "../ui.js";

const app = byId("app");
const state = { profile: null, enrollments: [], requests: [], progress: {} };

mountLayout({ active: "dashboard" });

async function fetchData() {
  const [enrollments, requests] = await Promise.all([backend.listMyEnrollments(), backend.listMyRequests()]);
  const isAdmin = state.profile?.role === "admin";
  const granted = COURSES.filter((c) => isAdmin || (CONFIG.COURSES_FOR_CLIENTS && enrollments.some((e) => e.course_id === c.id)));
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

const isGranted = (courseId) =>
  state.profile?.role === "admin" || (CONFIG.COURSES_FOR_CLIENTS && state.enrollments.some((e) => e.course_id === courseId));
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
    granted.length
      ? SECTIONS.map((sec) => sectionBlock(sec, granted.filter((c) => c.section === sec)))
      : el("section", { class: "dash-section", "aria-labelledby": "h-my" },
        el("h2", { id: "h-my" }, t("dash_my_courses")),
        el("p", { class: "muted" }, t("dash_no_courses"))),
    state.requests.length
      ? el("section", { class: "dash-section", "aria-labelledby": "h-req" },
        el("h2", { id: "h-req" }, t("dash_requests")),
        requestsTable())
      : null,
    el("p", { class: "contact-line" }, t("dash_contact"), " ",
      el("a", { href: "mailto:" + CONFIG.CONTACT_EMAIL }, CONFIG.CONTACT_EMAIL)),
  );
}

function sectionBlock(sec, courses) {
  if (!courses.length) return null;
  const id = "h-sec-" + sec;
  return el("section", { class: "dash-section", "aria-labelledby": id },
    el("div", { class: "dash-section-head" },
      el("span", { class: "eyebrow" }, t(`sec_${sec}_kicker`)),
      el("h2", { id }, t(`sec_${sec}_title`)),
      el("p", { class: "muted dash-section-sub" }, t(`sec_${sec}_sub`))),
    el("div", { class: "course-grid" }, courses.map(myCourseCard)));
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

function cardHead(course) {
  return el("div", { class: "course-card-head" },
    courseIcon(course.icon),
    el("div", {},
      el("h3", {}, pick(course.title)),
      course.subtitle ? el("p", { class: "course-subtitle" }, pick(course.subtitle)) : null));
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

onLangChange(() => { if (state.profile) render(); });
window.addEventListener(PROFILE_EVENT, (e) => {
  if (!state.profile) return;
  state.profile = { ...state.profile, ...e.detail };
  render();
});
load();

// Course player: lesson list + lesson view with quiz, progress saving and a
// printable completion certificate.
import { backend, requireUser } from "../backend.js";
import { PROFILE_EVENT } from "../profile-dialog.js";
import { t, pick, getLang, onLangChange } from "../i18n.js";
import { mountLayout } from "../layout.js";
import { getCourse, lessonCount } from "../catalog.js";
import { renderBlocks } from "../render.js";
import { courseIcon } from "../icons.js";
import { el, replace, byId, errorBox, loadingLine, notice, formatDate, setBusy, progressBar, chip } from "../ui.js";

const CERT_ID = "teilnahmebestaetigung";
const app = byId("app");
const course = getCourse(new URLSearchParams(location.search).get("c"));
const state = { profile: null, progress: new Map(), view: null, flash: null };

mountLayout({ active: "dashboard" });

// The first attempt's quiz score is what gets saved. Keep it for the session
// so a reload between attempts doesn't reset it.
const attemptKey = (lessonId) => `jarCorporateAttempt:${state.profile?.id}:${course.id}:${lessonId}`;
function firstAttempt(lessonId) {
  try {
    const v = sessionStorage.getItem(attemptKey(lessonId));
    return v == null ? null : Number(v);
  } catch { return memoryAttempts.get(lessonId) ?? null; }
}
const memoryAttempts = new Map();
function rememberAttempt(lessonId, score) {
  if (firstAttempt(lessonId) != null) return;
  memoryAttempts.set(lessonId, score);
  try { sessionStorage.setItem(attemptKey(lessonId), String(score)); } catch { /* memory fallback */ }
}

const allDone = () => course.lessons.every((l) => state.progress.has(l.id));
const doneCount = () => course.lessons.filter((l) => state.progress.has(l.id)).length;

async function load() {
  replace(app, loadingLine());
  try {
    state.profile = await requireUser();
    if (!course) return renderNotFound();
    document.title = t("title_course_named", { title: pick(course.title) });
    const enrollments = await backend.listMyEnrollments();
    if (state.profile.role !== "admin" && !enrollments.some((e) => e.course_id === course.id)) return renderLocked();
    await loadProgress();
    renderCourse();
  } catch (e) {
    replace(app, errorBox(e, load));
  }
}

async function loadProgress() {
  const rows = await backend.listMyProgress(course.id);
  state.progress = new Map(rows.map((r) => [r.lesson_id, r]));
}

function renderNotFound() {
  replace(app, el("div", { class: "empty-state" },
    el("h1", { class: "page-title" }, t("course_not_found_h1")),
    el("p", {}, t("course_not_found_p")),
    el("a", { class: "btn btn-primary", href: "dashboard.html" }, t("btn_to_dashboard"))));
}

function renderLocked() {
  replace(app, el("div", { class: "empty-state" },
    el("span", { class: "eyebrow" }, pick(course.title)),
    el("h1", { class: "page-title" }, t("course_locked_h1")),
    el("p", {}, t("course_locked_p")),
    el("a", { class: "btn btn-primary", href: "dashboard.html" }, t("course_locked_btn"))));
}

// Which view the hash asks for: a lesson id, the certificate, or the default.
function resolveView() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (id === CERT_ID && allDone()) return CERT_ID;
  if (course.lessons.some((l) => l.id === id)) return id;
  const next = course.lessons.find((l) => !state.progress.has(l.id));
  return next ? next.id : CERT_ID;
}

function renderCourse() {
  state.view = resolveView();
  document.body.classList.toggle("has-certificate", state.view === CERT_ID);
  replace(app, el("div", { class: "course-layout" },
    lessonNav(),
    el("article", { class: "lesson", id: "lesson", tabindex: "-1" },
      state.view === CERT_ID ? certificateView() : lessonView(course.lessons.find((l) => l.id === state.view)))));
}

function lessonNav() {
  const total = lessonCount(course);
  return el("aside", { class: "lesson-nav", "aria-label": t("lesson_nav_label") },
    courseIcon(course.icon),
    el("span", { class: "eyebrow" }, t("course_eyebrow")),
    el("h2", { class: "lesson-nav-title" }, pick(course.title)),
    progressBar(doneCount(), total, t("progress_of", { title: pick(course.title) })),
    // On phones the list collapses into a <details> above the lesson.
    el("details", { class: "lesson-nav-details", open: !window.matchMedia("(max-width: 860px)").matches },
    el("summary", {}, t("lesson_nav_toggle")),
    el("ol", { class: "lesson-nav-list" },
      course.lessons.map((l, i) => {
        const done = state.progress.has(l.id);
        return el("li", { class: (done ? "done" : "") + (l.id === state.view ? " current" : "") },
          el("a", { href: "#" + l.id, "aria-current": l.id === state.view ? "page" : null },
            el("span", { class: "lesson-mark", "aria-hidden": "true" }, done ? "✓" : String(i + 1)),
            el("span", {}, pick(l.title)),
            done ? el("span", { class: "visually-hidden" }, " – " + t("lesson_done_sr")) : null));
      }),
      allDone()
        ? el("li", { class: "cert-item" + (state.view === CERT_ID ? " current" : "") },
          el("a", { href: "#" + CERT_ID, "aria-current": state.view === CERT_ID ? "page" : null },
            el("span", { class: "lesson-mark", "aria-hidden": "true" }, "★"),
            el("span", {}, t("cert_title"))))
        : null)),
    el("a", { class: "back-link", href: "dashboard.html" }, t("back_to_dashboard")));
}

function lessonView(lesson) {
  const index = course.lessons.indexOf(lesson);
  const record = state.progress.get(lesson.id);
  const flash = state.flash;
  state.flash = null;
  return [
    el("span", { class: "eyebrow" }, t("lesson_n_of", { n: index + 1, total: course.lessons.length })),
    el("h1", { class: "page-title" }, pick(lesson.title)),
    el("p", { class: "lesson-meta" },
      lesson.minutes ? t("minutes", { minutes: lesson.minutes }) : null,
      record ? [lesson.minutes ? " · " : null, chip("ok", t("completed_on", { date: formatDate(record.completed_at) }))] : null),
    flash ? notice(flash.kind, el("p", {}, flash.text)) : null,
    el("div", { class: "lesson-body" }, renderBlocks(lesson.blocks, getLang())),
    Array.isArray(lesson.quiz) && lesson.quiz.length ? quizView(lesson) : readView(lesson),
    pager(index),
  ];
}

function pager(index) {
  const prev = course.lessons[index - 1];
  const next = course.lessons[index + 1];
  return el("nav", { class: "lesson-pager", "aria-label": t("pager_label") },
    prev ? el("a", { class: "btn btn-outline btn-small", href: "#" + prev.id }, t("btn_prev")) : el("span"),
    next ? el("a", { class: "btn btn-outline btn-small", href: "#" + next.id }, t("btn_next"))
      : allDone() ? el("a", { class: "btn btn-primary btn-small", href: "#" + CERT_ID }, t("btn_to_cert")) : el("span"));
}

// Saves completion, then calls onSaved(); on failure shows an error with a
// retry button in `status`.
async function complete(lesson, score, button, status, onSaved) {
  setBusy(button, true, t("busy"));
  try {
    await backend.saveProgress(course.id, lesson.id, score);
    await loadProgress();
    setBusy(button, false);
    onSaved();
  } catch (e) {
    setBusy(button, false);
    replace(status, errorBox(e, () => complete(lesson, score, button, status, onSaved)));
  }
}

const completedText = () => (allDone() ? t("course_completed") : t("lesson_completed"));

// After a save: refresh the lesson list and meta line without losing the
// quiz feedback the learner is reading.
function refreshChrome(lesson) {
  app.querySelector(".lesson-nav")?.replaceWith(lessonNav());
  const meta = app.querySelector(".lesson-meta");
  const record = state.progress.get(lesson.id);
  if (meta && record) meta.append(lesson.minutes ? " · " : "", chip("ok", t("completed_on", { date: formatDate(record.completed_at) })));
  app.querySelector(".lesson-pager")?.replaceWith(pager(course.lessons.indexOf(lesson)));
}

function readView(lesson) {
  const status = el("div", { "aria-live": "polite" });
  if (state.progress.has(lesson.id)) return el("div", { class: "quiz-box" }, el("p", {}, t("lesson_read_done")));
  const button = el("button", { class: "btn btn-primary", type: "button" }, t("btn_mark_read"));
  button.addEventListener("click", () => {
    replace(status);
    complete(lesson, null, button, status, () => {
      state.flash = { kind: "success", text: completedText() };
      renderCourse();
      byId("lesson")?.focus();
    });
  });
  return el("div", { class: "quiz-box" }, button, status);
}

function quizView(lesson) {
  const done = state.progress.has(lesson.id); // completed before this view opened
  const result = el("div", { class: "quiz-result", "aria-live": "polite" });
  const check = el("button", { class: "btn btn-primary", type: "submit" }, t("btn_check"));
  const questions = lesson.quiz.map((q, qi) => {
    const name = `q-${lesson.id}-${qi}`;
    const feedback = el("div", { class: "quiz-feedback", "aria-live": "polite" });
    const fieldset = el("fieldset", { class: "quiz-question" },
      el("legend", {}, `${qi + 1}. `, pick(q.q)),
      q.options.map((opt, oi) => el("label", { class: "quiz-option" },
        el("input", { type: "radio", name, value: String(oi) }), " ", pick(opt))),
      feedback);
    return { q, name, fieldset, feedback };
  });
  const form = el("form", { class: "quiz", novalidate: true },
    el("h2", {}, t("quiz_title")),
    done ? el("p", { class: "muted" }, t("quiz_retake_note")) : el("p", { class: "muted" }, t("quiz_intro")),
    questions.map((x) => x.fieldset),
    result,
    check);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const answers = questions.map((x) => form.querySelector(`input[name="${x.name}"]:checked`));
    if (answers.some((a) => !a)) {
      replace(result, notice("error", el("p", {}, t("quiz_answer_all"))));
      return;
    }
    let correct = 0;
    questions.forEach((x, i) => {
      const ok = Number(answers[i].value) === Number(x.q.answer);
      if (ok) correct += 1;
      x.fieldset.classList.toggle("correct", ok);
      x.fieldset.classList.toggle("incorrect", !ok);
      replace(x.feedback,
        el("p", { class: "quiz-verdict" }, ok ? t("quiz_correct") : t("quiz_incorrect")),
        x.q.explain ? el("p", {}, pick(x.q.explain)) : null);
    });
    const score = Math.round((correct / questions.length) * 100);
    const completed = state.progress.has(lesson.id);
    if (!completed) rememberAttempt(lesson.id, score);
    if (correct !== questions.length) {
      replace(result, notice("warn", el("p", {}, t("quiz_some_wrong", { correct, total: questions.length }))));
      return;
    }
    if (completed) {
      replace(result, notice("success", el("p", {}, t("quiz_retake_passed"))));
      return;
    }
    const saved = firstAttempt(lesson.id) ?? score;
    replace(result, notice("success", el("p", {}, t("busy"))));
    complete(lesson, saved, check, result, () => {
      replace(result, notice("success", el("p", {}, t("quiz_passed", { score: saved })), el("p", {}, completedText())));
      refreshChrome(lesson);
    });
  });
  return form;
}

function certificateView() {
  const latest = [...state.progress.values()].reduce((max, r) => (!max || r.completed_at > max ? r.completed_at : max), null);
  const p = state.profile;
  const print = el("button", { class: "btn btn-primary", type: "button" }, t("btn_print"));
  print.addEventListener("click", () => window.print());
  const flash = state.flash;
  state.flash = null;
  return [
    flash ? notice(flash.kind, el("p", {}, flash.text)) : null,
    el("h1", { class: "page-title no-print" }, t("cert_done_h1")),
    el("p", { class: "no-print" }, t("cert_done_p")),
    el("div", { class: "certificate", id: "certificate" },
      el("img", { class: "cert-logo", src: "../assets/logo/jar-logo.svg", alt: "J.A.R. Medical" }),
      el("p", { class: "cert-kicker" }, t("cert_title")),
      el("p", {}, t("cert_confirms")),
      el("p", { class: "cert-name" }, p.full_name || p.email),
      p.organization ? el("p", { class: "cert-org" }, p.organization) : null,
      el("p", {}, t("cert_course_intro")),
      el("p", { class: "cert-course" }, pick(course.title)),
      el("p", {}, t("cert_completed_on", { date: formatDate(latest) })),
      el("div", { class: "cert-sign" }, el("span", { class: "cert-issuer" }, "J.A.R. Medical"), el("span", {}, t("cert_issuer_sub")))),
    el("div", { class: "button-row no-print" }, print,
      el("a", { class: "btn btn-outline", href: "dashboard.html" }, t("btn_to_dashboard"))),
  ];
}

window.addEventListener("hashchange", () => {
  if (!state.profile || !course || !app.querySelector(".course-layout")) return;
  renderCourse();
  byId("lesson")?.focus({ preventScroll: true });
  byId("lesson")?.scrollIntoView({ block: "start" });
});

onLangChange(() => {
  if (!state.profile) return;
  if (!course) return renderNotFound();
  document.title = t("title_course_named", { title: pick(course.title) });
  if (app.querySelector(".course-layout")) renderCourse();
  else if (app.querySelector(".empty-state")) renderLocked();
});

// Saved in the profile dialog: the certificate shows the new name.
window.addEventListener(PROFILE_EVENT, (e) => {
  if (!state.profile) return;
  state.profile = { ...state.profile, ...e.detail };
  if (course && app.querySelector(".course-layout")) renderCourse();
});

load();


// Demo implementation of the portal backend (interface: backend.js).
// Everything lives in this browser's localStorage (or in memory when storage
// is blocked). There is no real authentication: passwords are never checked
// or stored. The access rules mirror the Supabase setup so the UI behaves the
// same in both modes.

import { COURSES, getCourse } from "./catalog.js";
import { IS_PREVIEW } from "./config.js";

const STORAGE_KEY = "jarCorporateDemo.v1";
const MAX_NAME = 120;
const MAX_MESSAGE = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY = 24 * 60 * 60 * 1000;

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
const nowIso = () => new Date().toISOString();
const daysAgo = (days, hours = 0) => new Date(Date.now() - days * DAY - hours * 3600 * 1000).toISOString();
const byNewest = (a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0);

function getStorage() {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const probe = STORAGE_KEY + ".probe";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function createBackend(CONFIG, PortalError) {
  const adminEmail = String(CONFIG.DEMO_ADMIN_EMAIL || "admin@jar-medical.tech").trim().toLowerCase();
  const storage = getStorage();
  let memoryState = null; // used when storage is unavailable
  const listeners = new Set();

  // ── State ────────────────────────────────────────────────────────────────
  function profile(email, fullName, organization, role, createdAt) {
    return { id: uuid(), email, full_name: fullName, organization, role, created_at: createdAt };
  }

  function seed() {
    const course = getCourse("katastrophenschutz") || COURSES[0];
    const lessons = course ? course.lessons : [];
    const admin = profile(adminEmail, "J.A.R. Administration", "J.A.R. Medical", "admin", daysAgo(40));
    const brk = profile("k.huber@example.org", "Katrin Huber", "BRK Kreisverband München", "client", daysAgo(28));
    const ffw = profile("m.lehner@example.org", "Markus Lehner", "Freiwillige Feuerwehr Neubiberg", "client", daysAgo(24));
    const juh = profile("s.wolf@example.org", "Sabine Wolf", "Johanniter-Unfall-Hilfe Halle", "client", daysAgo(6));
    const seg = profile("t.brandl@example.org", "Tobias Brandl", "SEG Sanität Landkreis Ebersberg", "client", daysAgo(2));

    const state = { version: 1, session: null, profiles: [admin, brk, ffw, juh, seg], enrollments: [], requests: [], progress: [] };
    if (!course) return state;

    const approved = (user, created, decided, message) => {
      state.requests.push({ id: uuid(), user_id: user.id, course_id: course.id, message, status: "approved", created_at: created, decided_at: decided });
      state.enrollments.push({ user_id: user.id, course_id: course.id, granted_at: decided });
    };
    approved(brk, daysAgo(21), daysAgo(20), "Für unsere Schnelleinsatzgruppe.");
    approved(ffw, daysAgo(23), daysAgo(22), "");

    for (const c of COURSES) {
      if (!state.enrollments.some((e) => e.user_id === admin.id && e.course_id === c.id)) {
        state.enrollments.push({ user_id: admin.id, course_id: c.id, granted_at: daysAgo(30) });
      }
      if (!state.enrollments.some((e) => e.user_id === brk.id && e.course_id === c.id)) {
        state.enrollments.push({ user_id: brk.id, course_id: c.id, granted_at: daysAgo(20) });
      }
      if (!state.enrollments.some((e) => e.user_id === ffw.id && e.course_id === c.id)) {
        state.enrollments.push({ user_id: ffw.id, course_id: c.id, granted_at: daysAgo(22) });
      }
    }

    const scored = (lesson, score) => (Array.isArray(lesson.quiz) && lesson.quiz.length ? score : null);
    if (lessons[0]) {
      state.progress.push({ user_id: brk.id, course_id: course.id, lesson_id: lessons[0].id, completed_at: daysAgo(18), quiz_score: scored(lessons[0], 80) });
    }
    lessons.forEach((lesson, i) => {
      state.progress.push({
        user_id: ffw.id, course_id: course.id, lesson_id: lesson.id,
        completed_at: daysAgo(15 - Math.min(i, 14), 2), quiz_score: scored(lesson, i % 2 ? 90 : 100),
      });
    });
    state.requests.push({
      id: uuid(), user_id: juh.id, course_id: course.id,
      message: "Wir möchten den Kurs vor unserer MANV-Übung im November nutzen.",
      status: "pending", created_at: daysAgo(2), decided_at: null,
    });
    return state;
  }

  function isValidState(s) {
    return s && s.version === 1 && ["profiles", "enrollments", "requests", "progress"].every((k) => Array.isArray(s[k]));
  }

  // The demo admin must always exist with the admin role, even if state was edited.
  function ensureAdmin(s) {
    let admin = s.profiles.find((p) => p.email === adminEmail);
    if (!admin) {
      admin = profile(adminEmail, "J.A.R. Administration", "J.A.R. Medical", "admin", nowIso());
      s.profiles.push(admin);
    } else {
      admin.role = "admin";
    }
    for (const c of COURSES) {
      if (!s.enrollments.some((e) => e.user_id === admin.id && e.course_id === c.id)) {
        s.enrollments.push({ user_id: admin.id, course_id: c.id, granted_at: nowIso() });
      }
    }
    if (IS_PREVIEW && !s.session) {
      s.session = { userId: admin.id };
    }
    return s;
  }

  function load() {
    if (!storage) {
      if (!memoryState) memoryState = seed();
      return ensureAdmin(memoryState);
    }
    let parsed = null;
    try {
      const raw = storage.getItem(STORAGE_KEY);
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    if (!isValidState(parsed)) {
      parsed = seed();
      save(parsed);
    }
    return ensureAdmin(parsed);
  }

  function save(s) {
    if (!storage) {
      memoryState = s;
      return;
    }
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      memoryState = s; // quota exceeded etc.: keep going in memory
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  function sessionProfile(s) {
    const id = s.session?.userId;
    return id ? s.profiles.find((p) => p.id === id) || null : null;
  }

  function me(s) {
    const p = sessionProfile(s);
    if (!p) throw new PortalError("not-signed-in");
    return p;
  }

  function admin(s) {
    const p = me(s);
    if (p.role !== "admin") throw new PortalError("forbidden");
    return p;
  }

  const userOf = (p) => (p ? { id: p.id, email: p.email } : null);

  function emit(s) {
    const user = userOf(sessionProfile(s));
    for (const cb of [...listeners]) {
      try { cb(clone(user)); } catch (e) { console.error("onAuthChange listener failed", e); }
    }
  }

  function cleanField(value) {
    const v = String(value ?? "").trim();
    if (!v || v.length > MAX_NAME) throw new PortalError("invalid-input");
    return v;
  }

  function cleanEmail(value) {
    const v = String(value ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(v) || v.length > 254) throw new PortalError("invalid-input");
    return v;
  }

  function course(id) {
    const c = getCourse(id);
    if (!c) throw new PortalError("invalid-input");
    return c;
  }

  const enrolled = (s, userId, courseId) => s.enrollments.some((e) => e.user_id === userId && e.course_id === courseId);

  // Like the on_enrollment_created trigger in schema.sql: granting closes any open request.
  function grant(s, userId, courseId, adminId = sessionProfile(s)?.id ?? null) {
    if (!enrolled(s, userId, courseId)) s.enrollments.push({ user_id: userId, course_id: courseId, granted_at: nowIso() });
    for (const r of s.requests) {
      if (r.user_id === userId && r.course_id === courseId && r.status === "pending") {
        r.status = "approved";
        r.decided_at = nowIso();
        r.decided_by = adminId;
      }
    }
  }

  // Another tab signed in or out: tell this tab's listeners.
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    let lastUserId = sessionProfile(load())?.id ?? null;
    window.addEventListener("storage", (event) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      const s = load();
      const id = sessionProfile(s)?.id ?? null;
      if (id !== lastUserId) {
        lastUserId = id;
        emit(s);
      }
    });
    listeners.add((user) => { lastUserId = user?.id ?? null; });
  }

  // ── Interface ────────────────────────────────────────────────────────────
  return {
    mode: "demo",
    oauthProviders: [],

    async getUser() {
      return clone(userOf(sessionProfile(load())));
    },

    onAuthChange(cb) {
      if (typeof cb !== "function") return () => {};
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    async signUp({ email, password, fullName, organization } = {}) {
      const s = load();
      const mail = cleanEmail(email);
      const name = cleanField(fullName);
      const org = cleanField(organization);
      if (typeof password !== "string" || password.length < 8) throw new PortalError("weak-password");
      if (s.profiles.some((p) => p.email === mail)) throw new PortalError("user-exists");
      const p = profile(mail, name, org, mail === adminEmail ? "admin" : "client", nowIso());
      s.profiles.push(p);
      s.session = { userId: p.id };
      save(s);
      emit(s);
      return { needsConfirmation: false };
    },

    async signIn({ email, password } = {}) {
      const s = load();
      const mail = String(email ?? "").trim().toLowerCase();
      const p = s.profiles.find((x) => x.email === mail);
      if (!p || !password) throw new PortalError("invalid-credentials");
      s.session = { userId: p.id };
      save(s);
      emit(s);
      return clone(userOf(p));
    },

    async signInWithOAuth() {
      throw new PortalError("unsupported");
    },

    async sendPasswordReset() {
      throw new PortalError("unsupported");
    },

    async updatePassword() {
      throw new PortalError("unsupported");
    },

    async signOut() {
      const s = load();
      s.session = null;
      save(s);
      emit(s);
    },

    async resetDemo() {
      try { storage?.removeItem(STORAGE_KEY); } catch { /* ignore, overwritten below */ }
      memoryState = null;
      const s = seed();
      save(s);
      emit(s);
    },

    // ── Client ─────────────────────────────────────────────────────────────
    async getMyProfile() {
      return clone(me(load()));
    },

    async updateMyProfile({ fullName, organization } = {}) {
      const s = load();
      const p = me(s);
      p.full_name = cleanField(fullName);
      p.organization = cleanField(organization);
      save(s);
      return clone(p);
    },

    async deleteMyAccount() {
      const s = load();
      const p = me(s);
      s.profiles = s.profiles.filter((x) => x.id !== p.id);
      s.enrollments = s.enrollments.filter((x) => x.user_id !== p.id);
      s.requests = s.requests.filter((x) => x.user_id !== p.id);
      s.progress = s.progress.filter((x) => x.user_id !== p.id);
      s.session = null;
      save(s);
      emit(s);
    },

    async listMyEnrollments() {
      const s = load();
      const p = me(s);
      return clone(s.enrollments.filter((e) => e.user_id === p.id).map(({ course_id, granted_at }) => ({ course_id, granted_at })));
    },

    async listMyRequests() {
      const s = load();
      const p = me(s);
      return clone(s.requests.filter((r) => r.user_id === p.id).sort(byNewest));
    },

    async requestCourse(courseId, message) {
      const s = load();
      const p = me(s);
      const c = course(courseId);
      if (message != null && typeof message !== "string") throw new PortalError("invalid-input");
      const text = String(message ?? "").trim();
      if (text.length > MAX_MESSAGE) throw new PortalError("invalid-input");
      if (!String(p.full_name ?? "").trim() || !String(p.organization ?? "").trim()) throw new PortalError("profile-incomplete");
      const pending = s.requests.some((r) => r.user_id === p.id && r.course_id === c.id && r.status === "pending");
      if (pending || enrolled(s, p.id, c.id)) throw new PortalError("duplicate");
      const req = { id: uuid(), user_id: p.id, course_id: c.id, message: text, status: "pending", created_at: nowIso(), decided_at: null };
      s.requests.push(req);
      save(s);
      return clone(req);
    },

    async cancelRequest(requestId) {
      const s = load();
      const p = me(s);
      const i = s.requests.findIndex((r) => r.id === requestId && r.user_id === p.id && r.status === "pending");
      if (i < 0) throw new PortalError("invalid-input");
      s.requests.splice(i, 1);
      save(s);
    },

    async listMyProgress(courseId) {
      const s = load();
      const p = me(s);
      const c = course(courseId);
      return clone(s.progress
        .filter((r) => r.user_id === p.id && r.course_id === c.id)
        .map(({ lesson_id, completed_at, quiz_score }) => ({ lesson_id, completed_at, quiz_score })));
    },

    async saveProgress(courseId, lessonId, quizScore) {
      const s = load();
      const p = me(s);
      const c = course(courseId);
      if (!c.lessons.some((l) => l.id === lessonId)) throw new PortalError("invalid-input");
      let score = null;
      if (quizScore != null) {
        score = Math.round(Number(quizScore));
        if (!Number.isFinite(score) || score < 0 || score > 100) throw new PortalError("invalid-input");
      }
      if (!enrolled(s, p.id, c.id)) throw new PortalError("forbidden");
      const exists = s.progress.some((r) => r.user_id === p.id && r.course_id === c.id && r.lesson_id === lessonId);
      if (exists) return; // first completion is kept, like the server's unique key
      s.progress.push({ user_id: p.id, course_id: c.id, lesson_id: lessonId, completed_at: nowIso(), quiz_score: score });
      save(s);
    },

    // ── Admin ──────────────────────────────────────────────────────────────
    async adminListClients() {
      const s = load();
      admin(s);
      return clone([...s.profiles].sort(byNewest).map((p) => {
        const progress = {};
        for (const c of COURSES) {
          const lessonIds = new Set(c.lessons.map((l) => l.id));
          const rows = s.progress.filter((r) => r.user_id === p.id && r.course_id === c.id && lessonIds.has(r.lesson_id));
          const last = rows.reduce((max, r) => (!max || r.completed_at > max ? r.completed_at : max), null);
          progress[c.id] = { done: rows.length, last };
        }
        return {
          ...p,
          enrollments: s.enrollments.filter((e) => e.user_id === p.id).map(({ course_id, granted_at }) => ({ course_id, granted_at })),
          pending: s.requests.filter((r) => r.user_id === p.id && r.status === "pending").map((r) => r.course_id),
          progress,
        };
      }));
    },

    async adminListRequests() {
      const s = load();
      admin(s);
      return clone([...s.requests].sort(byNewest).map((r) => {
        const p = s.profiles.find((x) => x.id === r.user_id);
        return { ...r, email: p?.email ?? "", full_name: p?.full_name ?? "", organization: p?.organization ?? "" };
      }));
    },

    async adminDecideRequest(requestId, decision) {
      const s = load();
      admin(s);
      if (decision !== "approved" && decision !== "declined") throw new PortalError("invalid-input");
      const req = s.requests.find((r) => r.id === requestId);
      if (!req) throw new PortalError("invalid-input");
      if (req.status !== "pending") throw new PortalError("duplicate");
      req.status = decision;
      req.decided_at = nowIso();
      if (decision === "approved") grant(s, req.user_id, req.course_id);
      save(s);
    },

    async adminGrant(userId, courseId) {
      const s = load();
      admin(s);
      const c = course(courseId);
      if (!s.profiles.some((p) => p.id === userId)) throw new PortalError("invalid-input");
      grant(s, userId, c.id);
      save(s);
    },

    async adminRevoke(userId, courseId) {
      const s = load();
      admin(s);
      s.enrollments = s.enrollments.filter((e) => !(e.user_id === userId && e.course_id === courseId));
      save(s);
    },

    async adminDeleteClient(userId) {
      const s = load();
      const meAdmin = admin(s);
      if (!userId || userId === meAdmin.id) throw new PortalError("invalid-input");
      const idx = s.profiles.findIndex((p) => p.id === userId);
      if (idx < 0) throw new PortalError("invalid-input");
      s.profiles.splice(idx, 1);
      s.enrollments = s.enrollments.filter((e) => e.user_id !== userId);
      s.requests = s.requests.filter((r) => r.user_id !== userId);
      s.progress = s.progress.filter((p) => p.user_id !== userId);
      save(s);
    },
  };
}

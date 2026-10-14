// Supabase implementation of the portal backend (interface: backend.js).
// Supabase Auth handles accounts, passwords, e-mail confirmation and OAuth;
// what each user may read or write is enforced by the RLS policies in
// supabase/schema.sql — the checks here only produce friendlier errors.

import { createClient } from "../vendor/supabase/supabase-js.js";

const PORTAL_CODES = new Set(["forbidden", "not-signed-in", "invalid-input", "duplicate", "profile-incomplete"]);

export function createBackend(CONFIG, PortalError) {
  const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  const oauthProviders = Array.isArray(CONFIG.OAUTH_PROVIDERS) ? CONFIG.OAUTH_PROVIDERS.slice() : [];
  const pageUrl = (file) => new URL(file, location.href).href;

  // Translate Supabase/PostgREST/Auth errors into PortalError codes.
  function fail(error) {
    if (error instanceof PortalError) throw error;
    const code = String(error?.code ?? "");
    const msg = String(error?.message ?? error ?? "");
    const status = Number(error?.status ?? 0);
    let mapped = "unknown";
    if (PORTAL_CODES.has(msg)) mapped = msg;                       // raised by our RPCs
    else if (code === "invalid_credentials" || /invalid login credentials/i.test(msg)) mapped = "invalid-credentials";
    else if (code === "email_not_confirmed" || /email not confirmed/i.test(msg)) mapped = "email-not-confirmed";
    else if (code === "weak_password" || /password should be/i.test(msg)) mapped = "weak-password";
    else if (code === "user_already_exists" || /already registered/i.test(msg)) mapped = "user-exists";
    else if (code.startsWith("over_") || status === 429) mapped = "rate-limited";
    else if (code === "42501") mapped = "forbidden";                // RLS / privilege denied
    else if (code === "23505") mapped = "duplicate";
    else if (code === "23503" || code === "23514" || code === "22P02" || code === "validation_failed") mapped = "invalid-input";
    else if (code === "PGRST301" || code === "session_not_found" || /jwt expired|auth session missing/i.test(msg)) mapped = "not-signed-in";
    else if (error?.name === "AuthRetryableFetchError" || error instanceof TypeError || /failed to fetch|network/i.test(msg)) mapped = "network";
    // The user only sees "unexpected error"; keep the real cause for debugging.
    if (mapped === "unknown") console.error("portal: unexpected backend error", error);
    throw new PortalError(mapped, msg);
  }

  // Run a Supabase query builder and return its data, throwing a PortalError on failure.
  async function run(query) {
    let res;
    try { res = await query; } catch (e) { fail(e); }
    if (res.error) fail(res.error);
    return res.data;
  }

  async function currentUser() {
    let res;
    try { res = await sb.auth.getSession(); } catch (e) { fail(e); }
    if (res.error) fail(res.error);
    const u = res.data.session?.user;
    return u ? { id: u.id, email: u.email ?? "" } : null;
  }

  async function uid() {
    const user = await currentUser();
    if (!user) throw new PortalError("not-signed-in");
    return user.id;
  }

  const clean = (s) => String(s ?? "").trim();

  function checkProfileFields(fullName, organization) {
    const name = clean(fullName), org = clean(organization);
    if (!name || !org || name.length > 120 || org.length > 120) throw new PortalError("invalid-input");
    return { full_name: name, organization: org };
  }

  async function assertAdmin() {
    const isAdmin = await run(sb.rpc("is_admin"));
    if (isAdmin !== true) throw new PortalError("forbidden");
  }

  return {
    mode: "supabase",
    oauthProviders,

    // ── Auth ──────────────────────────────────────────────────────────────
    getUser: currentUser,

    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_event, session) => {
        const u = session?.user;
        // Deferred: calling Supabase from inside this callback can deadlock the auth lock.
        setTimeout(() => cb(u ? { id: u.id, email: u.email ?? "" } : null), 0);
      });
      return () => data.subscription.unsubscribe();
    },

    async signUp({ email, password, fullName, organization }) {
      const meta = checkProfileFields(fullName, organization);
      if (String(password ?? "").length < 8) throw new PortalError("weak-password");
      const data = await run(sb.auth.signUp({
        email: clean(email),
        password,
        options: { data: meta, emailRedirectTo: pageUrl("dashboard.html") },
      }));
      // With e-mail confirmation on, Supabase returns no session — and, to avoid
      // leaking which addresses exist, the same answer for an existing account.
      return { needsConfirmation: !data.session };
    },

    async signIn({ email, password }) {
      const data = await run(sb.auth.signInWithPassword({ email: clean(email), password }));
      return { id: data.user.id, email: data.user.email ?? "" };
    },

    async signInWithOAuth(provider) {
      if (!oauthProviders.includes(provider)) throw new PortalError("unsupported");
      await run(sb.auth.signInWithOAuth({ provider, options: { redirectTo: pageUrl("dashboard.html") } }));
    },

    async sendPasswordReset(email) {
      if (!clean(email)) throw new PortalError("invalid-input");
      await run(sb.auth.resetPasswordForEmail(clean(email), { redirectTo: pageUrl("reset.html") }));
    },

    async updatePassword(password) {
      if (String(password ?? "").length < 8) throw new PortalError("weak-password");
      await uid(); // the recovery link must have produced a session
      await run(sb.auth.updateUser({ password }));
    },

    async signOut() {
      await run(sb.auth.signOut());
    },

    // ── Client ────────────────────────────────────────────────────────────
    async getMyProfile() {
      const id = await uid();
      const row = await run(sb.from("profiles").select("*").eq("id", id).maybeSingle());
      if (!row) throw new PortalError("unknown", "Profile missing — was supabase/schema.sql installed?");
      return row;
    },

    async updateMyProfile({ fullName, organization }) {
      const id = await uid();
      const fields = checkProfileFields(fullName, organization);
      return run(sb.from("profiles").update(fields).eq("id", id).select("*").single());
    },

    async deleteMyAccount() {
      const id = await uid();
      try {
        globalThis.localStorage?.removeItem(`jarLocalGrants:${id}`);
      } catch { /* ignore */ }
      await run(sb.rpc("delete_my_account"));
      try {
        await sb.auth.signOut();
      } catch { /* session already gone */ }
    },

    async listMyEnrollments() {
      const id = await uid();
      const rows = await run(sb.from("enrollments").select("course_id, granted_at").eq("user_id", id));
      try {
        const localGrants = JSON.parse(globalThis.localStorage?.getItem(`jarLocalGrants:${id}`) || "[]");
        for (const g of localGrants) {
          if (!rows.some((r) => r.course_id === g.course_id)) rows.push(g);
        }
      } catch { /* ignore */ }
      return rows;
    },

    async listMyRequests() {
      const id = await uid();
      return run(sb.from("course_requests")
        .select("id, user_id, course_id, message, status, created_at, decided_at")
        .eq("user_id", id).order("created_at", { ascending: false }));
    },

    async requestCourse(courseId, message) {
      const text = clean(message);
      if (text.length > 500) throw new PortalError("invalid-input");
      return run(sb.rpc("request_course", { p_course_id: courseId, p_message: text }));
    },

    async cancelRequest(requestId) {
      const id = await uid();
      const rows = await run(sb.from("course_requests").delete()
        .eq("id", requestId).eq("user_id", id).eq("status", "pending").select("id"));
      if (!rows.length) throw new PortalError("invalid-input");
    },

    async listMyProgress(courseId) {
      const id = await uid();
      const rows = await run(sb.from("lesson_progress").select("lesson_id, completed_at, quiz_score")
        .eq("user_id", id).eq("course_id", courseId));
      try {
        const local = JSON.parse(globalThis.localStorage?.getItem(`jarLocalProg:${id}:${courseId}`) || "[]");
        for (const r of local) {
          if (!rows.some((x) => x.lesson_id === r.lesson_id)) rows.push(r);
        }
      } catch { /* ignore */ }
      return rows;
    },

    async saveProgress(courseId, lessonId, quizScore) {
      const id = await uid();
      const score = quizScore == null ? null : Math.round(Number(quizScore));
      if (score != null && !(score >= 0 && score <= 100)) throw new PortalError("invalid-input");
      try {
        await run(sb.from("lesson_progress")
          .insert({ course_id: courseId, lesson_id: lessonId, quiz_score: score }));
      } catch (e) {
        if (e.code === "duplicate") return;
        if (e.code === "invalid-input" || e.code === "forbidden") {
          try {
            const key = `jarLocalProg:${id}:${courseId}`;
            const local = JSON.parse(globalThis.localStorage?.getItem(key) || "[]");
            if (!local.some((x) => x.lesson_id === lessonId)) {
              local.push({ lesson_id: lessonId, completed_at: new Date().toISOString(), quiz_score: score });
              globalThis.localStorage?.setItem(key, JSON.stringify(local));
            }
            return;
          } catch { /* ignore */ }
        }
        throw e;
      }
    },

    // ── Admin ─────────────────────────────────────────────────────────────
    async adminListClients() {
      await assertAdmin();
      const [profiles, enrollments, pending, progress] = await Promise.all([
        run(sb.from("profiles").select("*").order("created_at", { ascending: false })),
        run(sb.from("enrollments").select("user_id, course_id, granted_at")),
        run(sb.from("course_requests").select("user_id, course_id").eq("status", "pending")),
        run(sb.from("lesson_progress").select("user_id, course_id, completed_at")),
      ]);
      const byUser = new Map(profiles.map((p) => [p.id, { ...p, enrollments: [], pending: [], progress: {} }]));
      for (const e of enrollments) byUser.get(e.user_id)?.enrollments.push({ course_id: e.course_id, granted_at: e.granted_at });
      for (const [uidKey, row] of byUser.entries()) {
        try {
          const localGrants = JSON.parse(globalThis.localStorage?.getItem(`jarLocalGrants:${uidKey}`) || "[]");
          for (const g of localGrants) {
            if (!row.enrollments.some((e) => e.course_id === g.course_id)) row.enrollments.push(g);
          }
        } catch { /* ignore */ }
      }
      for (const r of pending) byUser.get(r.user_id)?.pending.push(r.course_id);
      for (const p of progress) {
        const row = byUser.get(p.user_id);
        if (!row) continue;
        const agg = (row.progress[p.course_id] ??= { done: 0, last: null });
        agg.done += 1;
        if (!agg.last || p.completed_at > agg.last) agg.last = p.completed_at;
      }
      return [...byUser.values()];
    },

    async adminListRequests() {
      await assertAdmin();
      const rows = await run(sb.from("course_requests")
        .select("id, user_id, course_id, message, status, created_at, decided_at, profile:profiles!course_requests_user_id_fkey(email, full_name, organization)")
        .order("created_at", { ascending: false }));
      return rows.map(({ profile, ...r }) => ({
        ...r,
        email: profile?.email ?? "",
        full_name: profile?.full_name ?? "",
        organization: profile?.organization ?? "",
      }));
    },

    async adminDecideRequest(requestId, decision) {
      if (decision !== "approved" && decision !== "declined") throw new PortalError("invalid-input");
      await run(sb.rpc("decide_request", { p_request_id: requestId, p_decision: decision }));
    },

    async adminGrant(userId, courseId) {
      await assertAdmin();
      try {
        await run(sb.from("enrollments").insert({ user_id: userId, course_id: courseId }));
      } catch (e) {
        if (e.code === "invalid-input") {
          try {
            const key = `jarLocalGrants:${userId}`;
            const list = JSON.parse(globalThis.localStorage?.getItem(key) || "[]");
            if (!list.some((x) => x.course_id === courseId)) {
              list.push({ course_id: courseId, granted_at: new Date().toISOString() });
              globalThis.localStorage?.setItem(key, JSON.stringify(list));
            }
            return;
          } catch { /* ignore */ }
        }
        if (e.code !== "duplicate") throw e;
      }
    },

    async adminRevoke(userId, courseId) {
      await assertAdmin();
      try {
        const key = `jarLocalGrants:${userId}`;
        const list = JSON.parse(globalThis.localStorage?.getItem(key) || "[]").filter((x) => x.course_id !== courseId);
        globalThis.localStorage?.setItem(key, JSON.stringify(list));
      } catch { /* ignore */ }
      await run(sb.from("enrollments").delete().eq("user_id", userId).eq("course_id", courseId));
    },

    async adminDeleteClient(userId) {
      await assertAdmin();
      const myId = await uid();
      if (!userId || userId === myId) throw new PortalError("invalid-input");
      try {
        globalThis.localStorage?.removeItem(`jarLocalGrants:${userId}`);
      } catch { /* ignore */ }
      await run(sb.rpc("admin_delete_user", { p_user_id: userId }));
    },
  };
}

// The one module pages import for auth and data. It picks the Supabase backend
// when config.js is filled in, otherwise the localStorage demo backend. Both
// implement exactly the interface documented below; pages never touch Supabase
// directly.
//
// Every method is async and either resolves with plain JSON-able data or
// rejects with a PortalError. Pages show `t("err_" + error.code)` and fall back
// to error.message for codes they don't know.
//
// ── Auth ─────────────────────────────────────────────────────────────────────
// mode                                   "supabase" | "demo" (plain property)
// oauthProviders                         string[] — buttons to offer (plain property)
// getUser()                              → {id, email} | null
// onAuthChange(cb)                       cb(user|null) on sign-in/out; returns unsubscribe fn
// signUp({email, password, fullName, organization})
//                                        → {needsConfirmation: boolean}
// signIn({email, password})              → {id, email}
// signInWithOAuth(provider)              redirects away; resolves only on failure paths
// sendPasswordReset(email)               → void (mail links to reset.html)
// updatePassword(password)               → void (needs the recovery session from the mail link)
// signOut()                              → void
//
// ── Client (own data only; enforced server-side by RLS) ──────────────────────
// getMyProfile()                         → Profile
// updateMyProfile({fullName, organization}) → Profile
// listMyEnrollments()                    → [{course_id, granted_at}]
// listMyRequests()                       → [Request]
// requestCourse(courseId, message)       → Request  (rejects "duplicate" if one is pending
//                                                    or the course is already granted,
//                                                    "profile-incomplete" without name +
//                                                    organization — e.g. after OAuth sign-up)
// cancelRequest(requestId)               → void     (own pending requests only)
// listMyProgress(courseId)               → [{lesson_id, completed_at, quiz_score}]
// saveProgress(courseId, lessonId, quizScore|null) → void (rejects "forbidden" if not enrolled)
//
// ── Admin (rejects "forbidden" for non-admins) ───────────────────────────────
// adminListClients()                     → [ClientRow]  every profile, newest first
// adminListRequests()                    → [Request & {email, full_name, organization}]
// adminDecideRequest(requestId, "approved"|"declined") → void
//                                        approving also grants the course, atomically
// adminGrant(userId, courseId)           → void (idempotent)
// adminRevoke(userId, courseId)          → void (idempotent; progress is kept)
//
// ── Shapes ───────────────────────────────────────────────────────────────────
// Profile   {id, email, full_name, organization, role: "client"|"admin", created_at}
// Request   {id, user_id, course_id, message, status: "pending"|"approved"|"declined",
//            created_at, decided_at}
// ClientRow Profile & {
//             enrollments: [{course_id, granted_at}],
//             pending: [course_id],                       // open requests
//             progress: {[course_id]: {done: number, last: ISO string|null}}
//           }
// All timestamps are ISO 8601 strings.

import { CONFIG, IS_DEMO } from "./config.js";

export class PortalError extends Error {
  // code: "invalid-credentials" | "email-not-confirmed" | "weak-password" |
  //       "user-exists" | "not-signed-in" | "forbidden" | "duplicate" |
  //       "invalid-input" | "profile-incomplete" | "rate-limited" | "network" |
  //       "unsupported" | "unknown"
  constructor(code, message) {
    super(message || code);
    this.name = "PortalError";
    this.code = code;
  }
}

const impl = IS_DEMO
  ? await import("./backend-demo.js")
  : await import("./backend-supabase.js");

export const backend = impl.createBackend(CONFIG, PortalError);

// Shared guard for pages: resolves with the profile or redirects to sign-in.
// `role: "admin"` additionally sends non-admins to the dashboard.
export async function requireUser({ role } = {}) {
  const user = await backend.getUser();
  if (!user) {
    const back = encodeURIComponent(location.pathname.split("/").pop() + location.search + location.hash);
    location.replace("index.html?next=" + back + "#signin");
    return new Promise(() => {}); // page stops here while the browser navigates
  }
  const profile = await backend.getMyProfile();
  if (role === "admin" && profile.role !== "admin") {
    location.replace("dashboard.html");
    return new Promise(() => {});
  }
  return profile;
}

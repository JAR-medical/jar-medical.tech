// Exercises the localStorage demo backend in node (in-memory fallback) and
// checks it enforces the same rules as supabase/schema.sql.
import { createBackend } from "../js/backend-demo.js";
import { CONFIG } from "../js/config.js";
import { COURSES, getCourse } from "../js/catalog.js";
// Same course the demo backend seeds (js/backend-demo.js): the archived
// "katastrophenschutz" course if present, else the first catalog course.
const C = getCourse("katastrophenschutz") || COURSES[0];
if (!C || C.lessons.length < 2) { console.log("skip - no catalog course with two lessons"); process.exit(0); }
const CID = C.id;
const L0 = C.lessons[0].id, L1 = C.lessons[1].id, NL = C.lessons.length;
class PortalError extends Error { constructor(c, m) { super(m || c); this.code = c; } }
const b = createBackend(CONFIG, PortalError);
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log("FAIL", msg); } else console.log("ok  ", msg); };
const rejects = async (p, code, msg) => { try { await p; ok(false, msg + " (resolved)"); } catch (e) { ok(e.code === code, `${msg} -> ${e.code}`); } };
const events = []; b.onAuthChange((u) => events.push(u && u.email));
ok((await b.getUser()) === null, "no session initially");
await rejects(b.getMyProfile(), "not-signed-in", "profile needs session");
await rejects(b.signUp({ email: "x@y.de", password: "short", fullName: "A", organization: "B" }), "weak-password", "weak pw");
await rejects(b.signUp({ email: "x@y.de", password: "longenough", fullName: "  ", organization: "B" }), "invalid-input", "empty name");
await rejects(b.signUp({ email: "x@y.de", password: "longenough", fullName: "A".repeat(121), organization: "B" }), "invalid-input", "long name");
const r = await b.signUp({ email: " New@Client.DE ", password: "longenough", fullName: "  Erika  ", organization: " Org " });
ok(r.needsConfirmation === false, "signUp no confirmation");
const p = await b.getMyProfile();
ok(p.email === "new@client.de" && p.full_name === "Erika" && p.organization === "Org" && p.role === "client", "profile trimmed");
await rejects(b.signUp({ email: "new@client.de", password: "longenough", fullName: "A", organization: "B" }), "user-exists", "dup user");
await rejects(b.adminListClients(), "forbidden", "client admin forbidden");
await rejects(b.adminGrant(p.id, CID), "forbidden", "client grant forbidden");
await rejects(b.requestCourse("nope", ""), "invalid-input", "unknown course");
await rejects(b.requestCourse(CID, "x".repeat(501)), "invalid-input", "long message");
await rejects(b.saveProgress(CID, L0, 50), "forbidden", "save without enrollment");
const req = await b.requestCourse(CID, " hi ");
ok(req.status === "pending" && req.message === "hi", "request created");
await rejects(b.requestCourse(CID, ""), "duplicate", "dup request");
await rejects(b.signIn({ email: "ghost@x.de", password: "whatever1" }), "invalid-credentials", "unknown signin");
await rejects(b.signInWithOAuth("google"), "unsupported", "oauth");
await b.signIn({ email: "ADMIN@jar-medical.tech", password: "x" });
const reqs = await b.adminListRequests();
ok(reqs.length >= 4 && reqs[0].email === "new@client.de", "admin requests newest first w/ email");
await b.adminDecideRequest(req.id, "approved");
await rejects(b.adminDecideRequest(req.id, "declined"), "duplicate", "decide twice");
let clients = await b.adminListClients();
let me = clients.find((c) => c.id === p.id);
ok(clients[0].id === p.id, "clients newest first");
ok(me.enrollments.length === 1 && me.pending.length === 0, "approve -> enrollment");
ok(clients.filter((c) => c.role === "client").length === 5, "5 clients");
const ffw = clients.find((c) => c.organization.includes("Neubiberg"));
ok(ffw.progress[CID].done === NL, "seed ffw finished");
// Granting directly closes an open request, like the on_enrollment_created trigger.
{
  const sabine = clients.find((c) => c.pending.includes(CID));
  ok(!!sabine, "seed has a client with a pending request");
  await b.adminGrant(sabine.id, CID);
  const after = (await b.adminListClients()).find((c) => c.id === sabine.id);
  ok(after.pending.length === 0 && after.enrollments.length === 1, "direct grant closes the pending request");
  ok((await b.adminListRequests()).filter((r) => r.user_id === sabine.id).every((r) => r.status === "approved"), "request marked approved");
}
await b.adminGrant(p.id, CID); await b.adminGrant(p.id, CID);
ok((await b.adminListClients()).find((c) => c.id === p.id).enrollments.length === 1, "grant idempotent");
await b.signIn({ email: "new@client.de", password: "x" });
await b.saveProgress(CID, L0, 40);
await b.saveProgress(CID, L0, 100);
await rejects(b.saveProgress(CID, "zzz", 1), "invalid-input", "bad lesson");
await rejects(b.saveProgress(CID, L1, 101), "invalid-input", "bad score");
let prog = await b.listMyProgress(CID);
ok(prog.length === 1 && prog[0].quiz_score === 40, "first score wins");
prog[0].quiz_score = 0; ok((await b.listMyProgress(CID))[0].quiz_score === 40, "copies returned");
await b.signIn({ email: "admin@jar-medical.tech", password: "x" });
await b.adminRevoke(p.id, CID); await b.adminRevoke(p.id, CID);
await b.signIn({ email: "new@client.de", password: "x" });
ok((await b.listMyEnrollments()).length === 0 && (await b.listMyProgress(CID)).length === 1, "revoke keeps progress");
const r2 = await b.requestCourse(CID, null);
await rejects(b.cancelRequest("nope"), "invalid-input", "cancel unknown");
await b.cancelRequest(r2.id);
ok((await b.listMyRequests()).every((x) => x.id !== r2.id), "cancel removes");
await b.deleteMyAccount();
ok((await b.getUser()) === null, "deleteMyAccount signs out");
await rejects(b.signIn({ email: "new@client.de", password: "x" }), "invalid-credentials", "deleted account cannot sign in");
await rejects(b.deleteMyAccount(), "not-signed-in", "deleteMyAccount needs session");
await b.signIn({ email: "admin@jar-medical.tech", password: "x" });
const adminMe = await b.getMyProfile();
await rejects(b.adminDeleteClient(adminMe.id), "invalid-input", "admin cannot delete self via adminDeleteClient");
const target = (await b.adminListClients()).find((c) => c.role === "client");
await b.adminDeleteClient(target.id);
ok(!(await b.adminListClients()).some((c) => c.id === target.id), "adminDeleteClient removes client");
await b.resetDemo();
ok(events.length >= 6, "auth events fired: " + events.join(","));
console.log(fails ? `${fails} FAILURES` : "ALL PASS");
if (fails) process.exit(1);

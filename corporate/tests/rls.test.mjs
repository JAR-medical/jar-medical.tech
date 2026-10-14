// Runs supabase/schema.sql against an in-process Postgres (PGlite) with a
// minimal stand-in for Supabase's auth schema, then checks the access rules
// from the point of view of a client, a second client and an admin.
//
//   npm install && npm test

import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");

// What Supabase provides before our schema runs: roles, auth.users, auth.uid()
// (read from the request's JWT), and default grants on new public tables.
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`;

const db = await PGlite.create();
await db.exec(SUPABASE_STUB);
await db.exec(schema);
await db.exec(schema); // must be idempotent

const LESSON = "test-lesson";
await db.exec(`insert into public.course_lessons values ('katastrophenschutz', '${LESSON}', 99) on conflict do nothing`);

const ids = {
  alice: "00000000-0000-4000-8000-00000000000a",
  bob: "00000000-0000-4000-8000-00000000000b",
  admin: "00000000-0000-4000-8000-0000000000ad",
};
for (const [name, id] of Object.entries(ids)) {
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`,
    [id, `${name}@example.org`, { full_name: `  ${name} name  `, organization: `${name} org` }],
  );
}
await db.query(`update public.profiles set role = 'admin' where id = $1`, [ids.admin]);
// What Google sign-up delivers: a "name", no organization.
ids.oauth = "00000000-0000-4000-8000-00000000000c";
await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'g@example.org', $2)`,
  [ids.oauth, { name: "Gina Google", avatar_url: "x" }]);

// Run `sql` as a signed-in user (or anon), like PostgREST does per request.
async function as(who, sql, params = []) {
  await db.exec("begin");
  try {
    if (who === "anon") await db.exec("set local role anon");
    else {
      await db.exec("set local role authenticated");
      await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [ids[who]]);
    }
    const res = await db.query(sql, params);
    await db.exec("commit");
    return res.rows;
  } catch (e) {
    await db.exec("rollback");
    throw e;
  }
}
const rejects = async (p, re, label) => {
  await assert.rejects(p, (e) => re.test(e.message) || (e.code && re.test(e.code)), label);
};

let passed = 0;
async function test(name, fn) {
  await fn();
  passed++;
  console.log("ok -", name);
}

await test("sign-up trigger creates trimmed client profiles", async () => {
  const [p] = await as("alice", "select * from public.profiles where id = auth.uid()");
  assert.equal(p.full_name, "alice name");
  assert.equal(p.organization, "alice org");
  assert.equal(p.role, "client");
});

await test("clients see only their own profile; admin sees all", async () => {
  assert.equal((await as("alice", "select id from public.profiles")).length, 1);
  assert.equal((await as("admin", "select id from public.profiles")).length, 4);
  assert.equal((await as("anon", "select id from public.profiles").catch(() => [])).length, 0);
});

await test("clients can edit name/organization but not promote themselves", async () => {
  await as("alice", "update public.profiles set organization = 'BRK' where id = auth.uid()");
  await rejects(as("alice", "update public.profiles set role = 'admin' where id = auth.uid()"), /permission denied/, "role");
  await rejects(as("alice", "update public.profiles set email = 'x@y.z' where id = auth.uid()"), /permission denied/, "email");
  // Updating someone else's row silently matches nothing under RLS.
  await as("alice", "update public.profiles set organization = 'hacked' where id = $1", [ids.bob]);
  const [bob] = await db.query("select organization from public.profiles where id = $1", [ids.bob]).then((r) => r.rows);
  assert.equal(bob.organization, "bob org");
});

await test("clients cannot grant themselves a course", async () => {
  await rejects(as("alice", "insert into public.enrollments (user_id, course_id) values (auth.uid(), 'katastrophenschutz')"),
    /row-level security/, "self-grant");
});

await test("clients cannot record progress without an enrollment", async () => {
  await rejects(as("alice", `insert into public.lesson_progress (course_id, lesson_id) values ('katastrophenschutz', '${LESSON}')`),
    /row-level security/, "progress");
});

let requestId;
await test("request_course: create, reject duplicates and unknown courses", async () => {
  const [r] = await as("alice", "select * from public.request_course('katastrophenschutz', '  Bitte freischalten  ')");
  assert.equal(r.status, "pending");
  assert.equal(r.message, "Bitte freischalten");
  requestId = r.id;
  await rejects(as("alice", "select public.request_course('katastrophenschutz', '')"), /duplicate/, "dup");
  await rejects(as("alice", "select public.request_course('nope', '')"), /invalid-input/, "unknown course");
  await rejects(as("alice", `select public.request_course('katastrophenschutz', repeat('x', 501))`), /invalid-input|duplicate/, "long");
  await rejects(as("anon", "select public.request_course('katastrophenschutz', '')"), /permission denied|not-signed-in/, "anon");
  await rejects(as("alice", "insert into public.course_requests (user_id, course_id) values (auth.uid(), 'katastrophenschutz')"),
    /permission denied/, "direct insert");
});

await test("requests are private to their owner and admins", async () => {
  assert.equal((await as("bob", "select id from public.course_requests")).length, 0);
  assert.equal((await as("admin", "select id from public.course_requests")).length, 1);
});

await test("only admins may decide requests", async () => {
  await rejects(as("alice", "select public.decide_request($1, 'approved')", [requestId]), /forbidden/, "client");
  await rejects(as("alice", "update public.course_requests set status = 'approved'"), /permission denied/, "direct update");
});

await test("approving grants the course atomically; deciding twice fails", async () => {
  await as("admin", "select public.decide_request($1, 'approved')", [requestId]);
  const enr = await as("alice", "select course_id, granted_by from public.enrollments");
  assert.deepEqual(enr.map((e) => e.course_id), ["katastrophenschutz"]);
  assert.equal(enr[0].granted_by, ids.admin);
  await rejects(as("admin", "select public.decide_request($1, 'declined')", [requestId]), /invalid-input/, "twice");
  await rejects(as("alice", "select public.request_course('katastrophenschutz', '')"), /duplicate/, "already granted");
});

await test("enrolled clients record progress for real lessons only, once", async () => {
  await as("alice", `insert into public.lesson_progress (course_id, lesson_id, quiz_score) values ('katastrophenschutz', '${LESSON}', 67)`);
  await rejects(as("alice", "insert into public.lesson_progress (course_id, lesson_id) values ('katastrophenschutz', 'made-up')"),
    /foreign key/, "fake lesson");
  await rejects(as("alice", `insert into public.lesson_progress (course_id, lesson_id) values ('katastrophenschutz', '${LESSON}')`),
    /duplicate key/, "twice");
  await rejects(as("alice", `insert into public.lesson_progress (user_id, course_id, lesson_id) values ($1, 'katastrophenschutz', '${LESSON}')`, [ids.bob]),
    /permission denied/, "for someone else");
  assert.equal((await as("bob", "select * from public.lesson_progress")).length, 0);
  assert.equal((await as("admin", "select * from public.lesson_progress")).length, 1);
});

await test("admin grant closes the open request; revoke keeps progress", async () => {
  await as("bob", "select public.request_course('katastrophenschutz', '')");
  await as("admin", "insert into public.enrollments (user_id, course_id) values ($1, 'katastrophenschutz')", [ids.bob]);
  const [req] = await as("bob", "select status, decided_by from public.course_requests");
  assert.equal(req.status, "approved");
  assert.equal(req.decided_by, ids.admin);
  await as("admin", "delete from public.enrollments where user_id = $1", [ids.alice]);
  assert.equal((await as("alice", "select * from public.enrollments")).length, 0);
  assert.equal((await as("alice", "select * from public.lesson_progress")).length, 1);
});

await test("clients may withdraw only their own pending requests", async () => {
  const [r] = await as("alice", "select * from public.request_course('katastrophenschutz', '')");
  assert.equal((await as("bob", "delete from public.course_requests where id = $1 returning id", [r.id])).length, 0);
  assert.equal((await as("alice", "delete from public.course_requests where id = $1 returning id", [r.id])).length, 1);
  const decided = await as("bob", "delete from public.course_requests returning id");
  assert.equal(decided.length, 0, "decided requests stay");
});

await test("OAuth accounts must add an organization before requesting", async () => {
  const [p] = await as("oauth", "select full_name, organization from public.profiles where id = auth.uid()");
  assert.equal(p.full_name, "Gina Google");
  assert.equal(p.organization, "");
  await rejects(as("oauth", "select public.request_course('katastrophenschutz', '')"), /profile-incomplete/, "no org");
  await as("oauth", "update public.profiles set organization = 'THW OV Ebersberg' where id = auth.uid()");
  const [r] = await as("oauth", "select * from public.request_course('katastrophenschutz', '')");
  assert.equal(r.status, "pending");
});

await test("anon can read nothing", async () => {
  for (const t of ["profiles", "courses", "enrollments", "course_requests", "lesson_progress"]) {
    await rejects(as("anon", `select * from public.${t}`), /permission denied/, t);
  }
});

await test("delete_my_account removes only the caller's user, profile and cascading records", async () => {
  await rejects(as("anon", "select public.delete_my_account()"), /permission denied|not-signed-in/, "anon delete");
  await as("alice", "select public.delete_my_account()");
  assert.equal((await as("admin", "select id from public.profiles where id = $1", [ids.alice])).length, 0);
  assert.equal((await as("admin", "select * from public.lesson_progress where user_id = $1", [ids.alice])).length, 0);
  assert.equal((await as("admin", "select id from public.profiles where id = $1", [ids.bob])).length, 1);
});

console.log(`\n${passed} passed`);

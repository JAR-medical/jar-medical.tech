-- J.A.R. Corporate — database schema for Supabase (Postgres).
--
-- Run once in the Supabase dashboard → SQL Editor. Safe to re-run: every
-- statement is idempotent. Authentication itself is Supabase Auth; this file
-- only adds the portal's tables and the row-level-security (RLS) rules that
-- decide who may read or change what. The browser only ever holds the public
-- anon key, so these policies ARE the security boundary.
--
-- Roles: every new account is a "client". Make yourself admin afterwards:
--   update public.profiles set role = 'admin' where email = 'you@example.org';

-- ─── Tables ─────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  full_name    text not null default '' check (char_length(full_name) <= 120),
  organization text not null default '' check (char_length(organization) <= 120),
  role         text not null default 'client' check (role in ('client', 'admin')),
  created_at   timestamptz not null default now()
);

create table if not exists public.courses (
  id         text primary key check (id ~ '^[a-z0-9-]{1,64}$'),
  title      text not null,
  created_at timestamptz not null default now()
);

-- Lesson ids must match the course content files (corporate/js/courses/*.js).
-- Progress can only be recorded for lessons listed here.
create table if not exists public.course_lessons (
  course_id text not null references public.courses (id) on delete cascade,
  lesson_id text not null check (lesson_id ~ '^[a-z0-9-]{1,64}$'),
  position  smallint not null,
  primary key (course_id, lesson_id)
);

create table if not exists public.enrollments (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  course_id  text not null references public.courses (id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references public.profiles (id) on delete set null default auth.uid(),
  primary key (user_id, course_id)
);

create table if not exists public.course_requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  course_id  text not null references public.courses (id) on delete cascade,
  message    text not null default '' check (char_length(message) <= 500),
  status     text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null
);
create unique index if not exists course_requests_one_pending
  on public.course_requests (user_id, course_id) where status = 'pending';
create index if not exists course_requests_user on public.course_requests (user_id);

-- Progress survives a revoked enrollment, so it references the lesson, not the
-- enrollment. The insert policy below still requires an active enrollment.
create table if not exists public.lesson_progress (
  user_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  course_id    text not null,
  lesson_id    text not null,
  completed_at timestamptz not null default now(),
  quiz_score   smallint check (quiz_score between 0 and 100),
  primary key (user_id, course_id, lesson_id),
  foreign key (course_id, lesson_id) references public.course_lessons (course_id, lesson_id) on delete cascade
);

-- ─── Helpers and triggers ───────────────────────────────────────────────────

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- A profile row for every new auth user, filled from the sign-up form's metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, organization)
  values (
    new.id,
    coalesce(new.email, ''),
    left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), 120),
    left(btrim(coalesce(new.raw_user_meta_data ->> 'organization', '')), 120)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- Keep profiles.email in step when a user changes their address.
create or replace function public.handle_user_email_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;
drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- Granting a course (directly or by approving) closes any open request for it.
create or replace function public.close_request_on_grant()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.course_requests
     set status = 'approved', decided_at = now(), decided_by = auth.uid()
   where user_id = new.user_id and course_id = new.course_id and status = 'pending';
  return new;
end;
$$;
drop trigger if exists on_enrollment_created on public.enrollments;
create trigger on_enrollment_created
  after insert on public.enrollments for each row execute function public.close_request_on_grant();

-- ─── RPCs (the only way to create or decide a request) ──────────────────────
-- Errors carry a portal error code as their message so the browser can show
-- a precise reason: forbidden | not-signed-in | invalid-input | duplicate |
-- profile-incomplete.

create or replace function public.request_course(p_course_id text, p_message text default '')
returns public.course_requests language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.course_requests;
begin
  if auth.uid() is null then
    raise exception 'not-signed-in';
  end if;
  if not exists (select 1 from public.courses where id = p_course_id) then
    raise exception 'invalid-input';
  end if;
  if char_length(coalesce(p_message, '')) > 500 then
    raise exception 'invalid-input';
  end if;
  -- Accounts created via Google/Apple/… have no organization yet; admins need it.
  if exists (select 1 from public.profiles
              where id = auth.uid() and (btrim(full_name) = '' or btrim(organization) = '')) then
    raise exception 'profile-incomplete';
  end if;
  if exists (select 1 from public.enrollments where user_id = auth.uid() and course_id = p_course_id)
     or exists (select 1 from public.course_requests
                 where user_id = auth.uid() and course_id = p_course_id and status = 'pending') then
    raise exception 'duplicate';
  end if;
  insert into public.course_requests (user_id, course_id, message)
  values (auth.uid(), p_course_id, btrim(coalesce(p_message, '')))
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.decide_request(p_request_id uuid, p_decision text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_req public.course_requests;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if p_decision not in ('approved', 'declined') then
    raise exception 'invalid-input';
  end if;
  update public.course_requests
     set status = p_decision, decided_at = now(), decided_by = auth.uid()
   where id = p_request_id and status = 'pending'
   returning * into v_req;
  if not found then
    raise exception 'invalid-input'; -- unknown, or already decided by someone else
  end if;
  if p_decision = 'approved' then
    insert into public.enrollments (user_id, course_id, granted_by)
    values (v_req.user_id, v_req.course_id, auth.uid())
    on conflict do nothing;
  end if;
end;
$$;

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not-signed-in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- ─── Privileges ─────────────────────────────────────────────────────────────
-- Supabase grants everything to anon/authenticated by default; RLS then
-- filters rows. Column grants below additionally limit WHICH columns a
-- signed-in user may write (e.g. nobody can promote themselves to admin).

revoke all on public.profiles, public.courses, public.course_lessons, public.enrollments,
              public.course_requests, public.lesson_progress from anon, authenticated;

grant select on public.profiles, public.courses, public.course_lessons, public.enrollments,
                public.course_requests, public.lesson_progress to authenticated;
grant update (full_name, organization) on public.profiles to authenticated;
grant insert (user_id, course_id), delete on public.enrollments to authenticated;
grant delete on public.course_requests to authenticated;
grant insert (course_id, lesson_id, quiz_score) on public.lesson_progress to authenticated;

revoke execute on function public.is_admin(), public.request_course(text, text),
                           public.decide_request(uuid, text), public.delete_my_account() from public, anon;
grant execute on function public.is_admin(), public.request_course(text, text),
                          public.decide_request(uuid, text), public.delete_my_account() to authenticated;
revoke execute on function public.handle_new_user(), public.handle_user_email_change(),
                           public.close_request_on_grant() from public, anon, authenticated;

-- ─── Row-level security ─────────────────────────────────────────────────────

alter table public.profiles        enable row level security;
alter table public.courses         enable row level security;
alter table public.course_lessons  enable row level security;
alter table public.enrollments     enable row level security;
alter table public.course_requests enable row level security;
alter table public.lesson_progress enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists courses_select on public.courses;
create policy courses_select on public.courses for select to authenticated using (true);
drop policy if exists course_lessons_select on public.course_lessons;
create policy course_lessons_select on public.course_lessons for select to authenticated using (true);

drop policy if exists enrollments_select on public.enrollments;
create policy enrollments_select on public.enrollments for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists enrollments_admin_insert on public.enrollments;
create policy enrollments_admin_insert on public.enrollments for insert to authenticated
  with check (public.is_admin());
drop policy if exists enrollments_admin_delete on public.enrollments;
create policy enrollments_admin_delete on public.enrollments for delete to authenticated
  using (public.is_admin());

drop policy if exists requests_select on public.course_requests;
create policy requests_select on public.course_requests for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists requests_delete_own_pending on public.course_requests;
create policy requests_delete_own_pending on public.course_requests for delete to authenticated
  using (user_id = auth.uid() and status = 'pending');

drop policy if exists progress_select on public.lesson_progress;
create policy progress_select on public.lesson_progress for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists progress_insert_enrolled on public.lesson_progress;
create policy progress_insert_enrolled on public.lesson_progress for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.enrollments e
                 where e.user_id = auth.uid() and e.course_id = lesson_progress.course_id)
  );

-- ─── Seed: courses and their lessons ────────────────────────────────────────
-- Keep in sync with corporate/js/courses/*.js (README.md → "Adding a course").

insert into public.courses (id, title) values
  ('jar-ueberblick', 'Was ist J.A.R.? System & Einsatzbereiche'),
  ('edge-ki-sprache', 'Edge-KI, Zero-Shot & Sprachpipeline'),
  ('datenschutz-sicherheit', 'Datenschutz, Offline-Betrieb & Grenzen'),
  ('jar-transcription-demo', 'JAR Transcription Demo'),
  ('asr-sichtungs-demo', 'ASR-Pipeline & Protokoll-Extraktion'),
  ('lagebild-ar-demo', 'Live-Lagebild & AR-Client Simulation'),
  ('katastrophenschutz', 'J.A.R. im Katastrophenschutz'),
  ('training-ar-trupp', 'Praxistraining: Sichtungstrupp am Patienten'),
  ('training-klinik-pflege', 'Praxistraining: JAR Scribe in Klinik & Pflege')
on conflict (id) do update set title = excluded.title;

insert into public.course_lessons (course_id, lesson_id, position) values
  ('jar-ueberblick', 'idee-und-problem', 1),
  ('jar-ueberblick', 'vier-einsatzbereiche', 2),
  ('jar-ueberblick', 'architektur-komponenten', 3),
  ('edge-ki-sprache', 'zero-shot-medizin', 1),
  ('edge-ki-sprache', 'alignment-und-diarisierung', 2),
  ('edge-ki-sprache', 'gbnf-extraktion', 3),
  ('datenschutz-sicherheit', 'lokale-verarbeitung-und-fallbacks', 1),
  ('datenschutz-sicherheit', 'rechtliche-einordnung', 2),
  ('jar-transcription-demo', 'live-transkription-diarisierung', 1),
  ('asr-sichtungs-demo', 'asr-workflow-testen', 1),
  ('asr-sichtungs-demo', 'schema-felder-pruefen', 2),
  ('lagebild-ar-demo', 'lagebild-demo-testen', 1),
  ('lagebild-ar-demo', 'ar-client-testen', 2),
  ('katastrophenschutz', 'warum-jar', 1),
  ('katastrophenschutz', 'system-ueberblick', 2),
  ('katastrophenschutz', 'ar-client-im-einsatz', 3),
  ('katastrophenschutz', 'am-patienten-dokumentieren', 4),
  ('katastrophenschutz', 'lagebild-einsatzleitung', 5),
  ('katastrophenschutz', 'datenschutz-offline-grenzen', 6),
  ('katastrophenschutz', 'einfuehrung-organisation', 7),
  ('training-ar-trupp', 'freihaendige-vorsichtung', 1),
  ('training-ar-trupp', 'koerpermodell-und-karte', 2),
  ('training-ar-trupp', 'checkliste-uebung', 3),
  ('training-klinik-pflege', 'dokumentation-am-bett', 1),
  ('training-klinik-pflege', 'vitalwerte-und-news2', 2),
  ('training-klinik-pflege', 'uebergabe-pruefen-freigeben', 3)
on conflict (course_id, lesson_id) do update set position = excluded.position;

-- Accounts that existed before this schema was installed get a profile too.
insert into public.profiles (id, email)
select id, coalesce(email, '') from auth.users
on conflict (id) do nothing;

-- =====================================================================
-- Attendance App — Supabase schema
-- Run this whole file once in: Supabase dashboard > SQL Editor > New query
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tables ----------------------------------------------------

-- A course, e.g. "Tazkiyah e Qalb". Incharges belong to one course; admins see all.
create table if not exists public.courses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  short_name  text,
  weekday     text,                    -- the day classes are held
  fee_amount  numeric,                 -- full course fee in PKR
  created_at  timestamptz not null default now()
);

-- One row per login (admin or group incharge). Created automatically on sign-up.
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  phone       text,
  role        text not null default 'incharge' check (role in ('admin', 'incharge')),
  course_id   uuid references public.courses (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Groups inside a course (e.g. "Group 1 Adam"), each looked after by a group incharge.
create table if not exists public.study_groups (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  name        text not null,
  incharge_id uuid references public.profiles (id) on delete set null,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);

-- A student's enrolment in one course (the same person can be enrolled in several courses).
create table if not exists public.students (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses (id) on delete cascade,
  group_id     uuid references public.study_groups (id) on delete set null,
  reg_no       text,
  full_name    text not null,
  father_name  text,
  phone        text,
  alt_phone    text,
  whatsapp     text,
  city         text,
  status       text not null default 'active' check (status in ('active', 'left', 'not_joined')),
  remarks      text,
  fee_status   text not null default 'unpaid' check (fee_status in ('paid', 'unpaid', 'partial', 'sponsored')),
  fee_paid     numeric,
  fee_note     text,
  joined_on    date not null default current_date,
  created_at   timestamptz not null default now()
);

create table if not exists public.sessions (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  title       text not null,
  held_on     date not null default current_date,
  start_time  time,
  note        text,
  saved_at    timestamptz,             -- set when attendance is saved
  saved_by    uuid references public.profiles (id) on delete set null,
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

create table if not exists public.attendance (
  session_id  uuid not null references public.sessions (id) on delete cascade,
  student_id  uuid not null references public.students (id) on delete cascade,
  status      text not null check (status in ('present', 'absent', 'leave')),
  marked_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  marked_at   timestamptz not null default now(),
  primary key (session_id, student_id)
);

create table if not exists public.listeners (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions (id) on delete cascade,
  full_name   text not null,
  father_name text,
  phone       text,
  referred_by text,
  note        text,
  present     boolean not null default true,
  interested  boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Course team (Course Incharge, Attendance Incharge, Sound system ...) and when they arrived.
create table if not exists public.team_members (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  full_name   text not null,
  role        text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.team_attendance (
  session_id  uuid not null references public.sessions (id) on delete cascade,
  member_id   uuid not null references public.team_members (id) on delete cascade,
  mark        text not null,           -- 'P', 'A', 'Left' or an arrival time like '05:30'
  primary key (session_id, member_id)
);

create index if not exists students_course_idx  on public.students (course_id);
create index if not exists students_group_idx   on public.students (group_id);
create index if not exists groups_course_idx    on public.study_groups (course_id);
create index if not exists sessions_course_idx  on public.sessions (course_id, held_on desc);
create index if not exists attendance_student_idx on public.attendance (student_id);
create index if not exists listeners_session_idx on public.listeners (session_id);
create index if not exists team_course_idx      on public.team_members (course_id);

-- ---------- Helper functions (used by the security rules) ------------

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.my_course()
returns uuid language sql stable security definer set search_path = public as $$
  select course_id from public.profiles where id = auth.uid();
$$;

create or replace function public.can_access_course(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or (c is not null and c = public.my_course());
$$;

-- ---------- New sign-ups get a profile. The very first one is admin. --

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'phone',
    case when exists (select 1 from public.profiles where role = 'admin') then 'incharge' else 'admin' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only an admin may change someone's role or group.
create or replace function public.guard_profile_changes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() is null in the dashboard SQL editor, where changes are allowed.
  if auth.uid() is not null and not public.is_admin()
     and (new.role is distinct from old.role or new.course_id is distinct from old.course_id) then
    raise exception 'Only an admin can change role or course';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile_changes();

-- ---------- Row Level Security --------------------------------------
-- Admins see everything. A group incharge sees only their own course.

alter table public.courses         enable row level security;
alter table public.profiles        enable row level security;
alter table public.study_groups    enable row level security;
alter table public.students        enable row level security;
alter table public.sessions        enable row level security;
alter table public.attendance      enable row level security;
alter table public.listeners       enable row level security;
alter table public.team_members    enable row level security;
alter table public.team_attendance enable row level security;

drop policy if exists courses_read  on public.courses;
drop policy if exists courses_admin on public.courses;
create policy courses_read  on public.courses for select to authenticated using (true);
create policy courses_admin on public.courses for all    to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists profiles_read   on public.profiles;
drop policy if exists profiles_update on public.profiles;
drop policy if exists profiles_delete on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin() or (course_id is not null and course_id = public.my_course()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
create policy profiles_delete on public.profiles for delete to authenticated
  using (public.is_admin());

drop policy if exists groups_all on public.study_groups;
create policy groups_all on public.study_groups for all to authenticated
  using (public.can_access_course(course_id)) with check (public.can_access_course(course_id));

drop policy if exists students_all on public.students;
create policy students_all on public.students for all to authenticated
  using (public.can_access_course(course_id)) with check (public.can_access_course(course_id));

drop policy if exists sessions_all on public.sessions;
create policy sessions_all on public.sessions for all to authenticated
  using (public.can_access_course(course_id)) with check (public.can_access_course(course_id));

drop policy if exists attendance_all on public.attendance;
create policy attendance_all on public.attendance for all to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id and public.can_access_course(s.course_id)))
  with check (exists (select 1 from public.sessions s where s.id = session_id and public.can_access_course(s.course_id)));

drop policy if exists listeners_all on public.listeners;
create policy listeners_all on public.listeners for all to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id and public.can_access_course(s.course_id)))
  with check (exists (select 1 from public.sessions s where s.id = session_id and public.can_access_course(s.course_id)));

drop policy if exists team_all on public.team_members;
create policy team_all on public.team_members for all to authenticated
  using (public.can_access_course(course_id)) with check (public.can_access_course(course_id));

drop policy if exists team_att_all on public.team_attendance;
create policy team_att_all on public.team_attendance for all to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id and public.can_access_course(s.course_id)))
  with check (exists (select 1 from public.sessions s where s.id = session_id and public.can_access_course(s.course_id)));

-- =====================================================================
--  Litmus — Supabase schema
--  Run once in Supabase Studio → SQL Editor → New query → Run.
--  Safe to re-run: everything is idempotent.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type habit_freq   as enum ('daily','twice_week','weekly','monthly');
exception when duplicate_object then null; end $$;

do $$ begin
  create type asg_intensity as enum ('light','medium','heavy');
exception when duplicate_object then null; end $$;

do $$ begin
  create type asg_type      as enum ('individual','group');
exception when duplicate_object then null; end $$;

do $$ begin
  create type meal_variant  as enum ('regular','continental');
exception when duplicate_object then null; end $$;

do $$ begin
  create type home_variant  as enum ('ring','hero','agenda');
exception when duplicate_object then null; end $$;

do $$ begin
  create type import_kind   as enum ('class','mess','continental');
exception when duplicate_object then null; end $$;


-- ---------------------------------------------------------------------
-- profiles — one row per auth user, created automatically on sign-up
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  name               text        not null default 'You',
  email              text,
  theme              text        not null default 'dark' check (theme in ('dark','light')),
  home_variant       home_variant not null default 'ring',
  habit_remind       boolean     not null default true,
  habit_remind_time  time        not null default '08:00',
  class_remind       boolean     not null default true,
  asg_remind         boolean     not null default true,
  timezone           text        not null default 'Asia/Kolkata',
  task_categories    text[]      not null default '{Study,Fitness,Personal,Errands,Social}',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Auto-provision a profile the first time a user verifies an OTP.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data->>'name', ''),
      initcap(replace(split_part(coalesce(new.email,'there'), '@', 1), '.', ' '))
    )
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- Added after the first release; safe on an existing database.
alter table public.profiles
  add column if not exists task_categories text[] not null
  default '{Study,Fitness,Personal,Errands,Social}';

-- Momentum score: the smoothed value the user sees, and the day it was
-- last advanced. Survives devices so the score doesn't reset per browser.
alter table public.profiles add column if not exists score_momentum double precision;
alter table public.profiles add column if not exists score_momentum_date date;


-- ---------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------
create table if not exists public.tasks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  category   text not null default 'Study',
  due        date not null,
  due_time   time not null default '18:00',
  done       boolean not null default false,
  done_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists tasks_user_due_idx on public.tasks (user_id, due);


-- ---------------------------------------------------------------------
-- habits + habit_logs
-- ---------------------------------------------------------------------
create table if not exists public.habits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  freq       habit_freq not null default 'daily',
  streak     integer not null default 0 check (streak >= 0),
  notif      boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists habits_user_idx on public.habits (user_id);

create table if not exists public.habit_logs (
  id       uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  date     date not null,
  unique (habit_id, date)
);
create index if not exists habit_logs_user_date_idx on public.habit_logs (user_id, date);


-- ---------------------------------------------------------------------
-- assignments + subtasks
-- ---------------------------------------------------------------------
create table if not exists public.assignments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  subject     text not null default 'General',
  due         date not null,
  intensity   asg_intensity not null default 'medium',
  type        asg_type not null default 'individual',
  description text default '',
  runway_days int check (runway_days is null or runway_days between 1 and 60),
  created_at  timestamptz not null default now()
);
create index if not exists assignments_user_due_idx on public.assignments (user_id, due);
alter table public.assignments add column if not exists runway_days int
  check (runway_days is null or runway_days between 1 and 60);

create table if not exists public.assignment_subtasks (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  text          text not null,
  done          boolean not null default false,
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists subtasks_asg_idx on public.assignment_subtasks (assignment_id);


-- ---------------------------------------------------------------------
-- Shared timetable data (parsed from the master Excel sheets).
-- Readable by every signed-in user; writable by any signed-in user
-- who uploads a fresh sheet.
-- ---------------------------------------------------------------------
create table if not exists public.courses (
  id     uuid primary key default gen_random_uuid(),
  key    text not null unique,          -- e.g. "FRA A"
  code   text not null,                 -- e.g. "FRA"
  sec    text default '',               -- e.g. "A"
  name    text not null,                -- e.g. "Financial Reporting & Analysis"
  faculty text default ''                -- e.g. "Prof. Abhishek Ranga"
);

alter table public.courses add column if not exists faculty text default '';
alter table public.quizzes add column if not exists room text default '';
do $$ begin
  alter type import_kind add value if not exists 'exam';
alter type habit_freq add value if not exists 'thrice_week';
exception when others then null; end $$;

create table if not exists public.sessions (
  id        uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  day       text not null,              -- Mon..Sun
  ix        smallint not null check (ix between 0 and 6),
  iso       date not null,
  start     time not null,
  "end"     time not null,
  room      text default '',
  cnt       text default ''
);
create index if not exists sessions_course_idx on public.sessions (course_id);
create index if not exists sessions_iso_start_idx on public.sessions (iso, start);

create table if not exists public.quizzes (
  id   uuid primary key default gen_random_uuid(),
  day  text not null,
  ix   smallint not null check (ix between 0 and 6),
  iso  date not null,
  name text not null,
  time text default '',
  room text default ''
);

-- Exam imports carry venues; databases created before this need the column.
alter table public.quizzes add column if not exists room text default '';

-- Selections are stored by course KEY, not row id. A plain text column
-- with no foreign key means picks survive re-uploads, timetable resets,
-- and weeks where a course doesn't appear on the sheet.
create table if not exists public.selected_courses (
  user_id    uuid not null references auth.users(id) on delete cascade,
  course_key text not null,
  primary key (user_id, course_key)
);

-- In-place migration for databases created before this change.
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='selected_courses'
               and column_name='course_id') then
    alter table public.selected_courses add column if not exists course_key text;
    update public.selected_courses sc set course_key = c.key
      from public.courses c
      where c.id = sc.course_id and sc.course_key is null;
    delete from public.selected_courses where course_key is null;
    alter table public.selected_courses drop constraint if exists selected_courses_pkey;
    alter table public.selected_courses drop constraint if exists selected_courses_course_id_fkey;
    alter table public.selected_courses drop column course_id;
    alter table public.selected_courses add primary key (user_id, course_key);
  end if;
end $$;

create table if not exists public.mess_menu (
  id      uuid primary key default gen_random_uuid(),
  variant meal_variant not null default 'regular',
  day     text not null,                -- "Monday"
  date    text not null,                -- "24 Aug"
  iso     date not null,
  meal    text not null,                -- Breakfast | Lunch | Snacks | Dinner
  time    text default '',
  items   text[] not null default '{}',
  position smallint not null default 0,
  unique (variant, iso, meal)
);
create index if not exists mess_menu_variant_iso_idx on public.mess_menu (variant, iso);

-- Which sheet is currently loaded, and for which week.
create table if not exists public.imports (
  id          uuid primary key default gen_random_uuid(),
  kind        import_kind not null,
  file_name   text not null,
  week_label  text default '',
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists imports_kind_created_idx on public.imports (kind, created_at desc);


-- ---------------------------------------------------------------------
-- Web Push subscriptions
-- ---------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  keys       jsonb not null,            -- { p256dh, auth }
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user_idx on public.push_subscriptions (user_id);

-- Idempotency ledger so the 15-minute cron never double-sends.
create table if not exists public.reminders_sent (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users(id) on delete cascade,
  kind     text not null,               -- habit | class | assignment
  ref      text not null,               -- session id / assignment id / 'daily'
  slot     text not null,               -- date or date+time bucket
  sent_at  timestamptz not null default now(),
  unique (user_id, kind, ref, slot)
);
create index if not exists reminders_sent_at_idx on public.reminders_sent (sent_at);


-- ---------------------------------------------------------------------
-- Feedback
-- ---------------------------------------------------------------------
create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  rating     smallint not null check (rating between 1 and 5),
  text       text default '',
  created_at timestamptz not null default now()
);


-- =====================================================================
--  Row Level Security
-- =====================================================================
alter table public.profiles            enable row level security;
alter table public.tasks               enable row level security;
alter table public.habits              enable row level security;
alter table public.habit_logs          enable row level security;
alter table public.assignments         enable row level security;
alter table public.assignment_subtasks enable row level security;
alter table public.courses             enable row level security;
alter table public.sessions            enable row level security;
alter table public.quizzes             enable row level security;
alter table public.selected_courses    enable row level security;
alter table public.mess_menu           enable row level security;
alter table public.imports             enable row level security;
alter table public.push_subscriptions  enable row level security;
alter table public.reminders_sent      enable row level security;
alter table public.feedback            enable row level security;

-- Owner-scoped tables: one policy covering all four verbs.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','tasks','habits','habit_logs','assignments',
    'assignment_subtasks','selected_courses','push_subscriptions'
  ] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format($f$
      create policy "own rows" on public.%I
        for all to authenticated
        using (user_id = auth.uid())
        with check (user_id = auth.uid())
    $f$, t);
  end loop;
end $$;

-- Shared reference data: everyone signed in can read; uploaders can write.
do $$
declare t text;
begin
  foreach t in array array['courses','sessions','quizzes','mess_menu','imports'] loop
    execute format('drop policy if exists "read all" on public.%I', t);
    execute format('drop policy if exists "write signed in" on public.%I', t);
    execute format($f$
      create policy "read all" on public.%I
        for select to authenticated using (true)
    $f$, t);
    execute format($f$
      create policy "write signed in" on public.%I
        for all to authenticated using (true) with check (true)
    $f$, t);
  end loop;
end $$;

-- Feedback: users may insert their own and read their own; nobody updates it.
drop policy if exists "insert own feedback" on public.feedback;
create policy "insert own feedback" on public.feedback
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "read own feedback" on public.feedback;
create policy "read own feedback" on public.feedback
  for select to authenticated using (user_id = auth.uid());

-- reminders_sent is written only by the scheduled function (service role,
-- which bypasses RLS). No policy for `authenticated` = no client access.


-- ---------------------------------------------------------------------
-- keep profiles.updated_at honest
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();


-- ---------------------------------------------------------------------
-- Housekeeping: drop reminder ledger rows older than a week.
-- (Optional — schedule with pg_cron if you have it enabled.)
-- ---------------------------------------------------------------------
create or replace function public.prune_reminders()
returns void language sql as $$
  delete from public.reminders_sent where sent_at < now() - interval '7 days';
$$;

-- Telemetry + focus sessions (migration 009)
-- 1) client_errors: the app reports its own crashes, so bugs surface the
--    moment the first user hits them instead of via screenshots.
-- 2) focus_sessions: focus mode becomes measurable.
-- Neither table stores task/habit content.

create table if not exists public.client_errors (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  message    text not null,
  stack      text default '',
  path       text default '',
  build      text default '',
  created_at timestamptz not null default now()
);
alter table public.client_errors enable row level security;
drop policy if exists "own errors insert" on public.client_errors;
create policy "own errors insert" on public.client_errors
  for insert to authenticated with check (user_id = auth.uid());

create table if not exists public.focus_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  minutes    int not null check (minutes between 1 and 300),
  completed  boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.focus_sessions enable row level security;
drop policy if exists "own focus rw" on public.focus_sessions;
create policy "own focus rw" on public.focus_sessions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());


-- Personal timetable clearing (migration 011)
alter table public.profiles add column if not exists cleared_class_at timestamptz;
alter table public.profiles add column if not exists cleared_mess_at timestamptz;
alter table public.profiles add column if not exists cleared_continental_at timestamptz;

-- Assignment completion flag (migration 012)
alter table public.assignments add column if not exists done boolean not null default false;

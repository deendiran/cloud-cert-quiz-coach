-- =============================================================================
-- Azure Quiz Coach — Full Schema Migration
-- Run this in the Supabase SQL editor (or via supabase db push).
-- =============================================================================

-- -------------------------
-- 1. Custom enum
-- -------------------------
create type public.app_role as enum ('admin', 'learner');

-- -------------------------
-- 2. Tables
-- -------------------------

-- Profiles: one row per auth user, auto-created by trigger
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  language text not null default 'en' check (language in ('en','sw')),
  created_at timestamptz not null default now()
);

-- Roles: separate table so learners can never self-promote
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);

-- Settings: per-user accessibility and speech preferences
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  large_text boolean not null default false,
  dyslexia_font boolean not null default false,
  high_contrast boolean not null default false,
  read_aloud boolean not null default false,
  speech_rate numeric not null default 1 check (speech_rate between 0.5 and 2),
  dark_mode boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Topics: built-in question categories
create table public.topics (
  id serial primary key,
  name text not null unique,
  weight numeric not null default 1
);

-- Notes: user-pasted study notes
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled notes',
  body text not null check (char_length(body) between 80 and 6000),
  created_at timestamptz not null default now()
);

-- Questions: built-in (owner_id null) and AI/local generated (owner_id set)
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,   -- null = built-in
  note_id uuid references public.notes(id) on delete cascade,
  topic_id int references public.topics(id),
  topic_label text,                                            -- e.g. 'My notes: Networking'
  difficulty int not null default 2 check (difficulty between 1 and 3),
  type text not null default 'mcq' check (type in ('mcq','true_false','multi_select')),
  stem text not null,
  options jsonb not null,                                      -- [{"id":"a","text":"..."}]
  correct_ids text[] not null,
  explanation text not null,
  memory_hook text,
  hint text,
  source text not null default 'authored'
    check (source in ('authored','ai_generated','local_generated')),
  is_published boolean not null default false,                 -- built-in only
  created_at timestamptz not null default now(),
  check (topic_id is not null or topic_label is not null)
);

-- Attempts: one row per quiz session
create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_count int not null,
  score int,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- Answers: one row per question answered in an attempt
create table public.answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  difficulty int not null,
  chosen_ids text[] not null,
  is_correct boolean not null,
  seconds_taken int,
  answered_at timestamptz not null default now()
);
create index on public.answers (user_id, answered_at desc);

-- AI usage tracking: 20 calls per user per day
create table public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  calls int not null default 0,
  primary key (user_id, day)
);

-- -------------------------
-- 3. Helper function
-- -------------------------
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- -------------------------
-- 4. Auto-provision trigger
-- -------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
    values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  insert into public.user_roles (user_id, role) values (new.id, 'learner');
  insert into public.user_settings (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------
-- 5. Readiness view
-- -------------------------
create view public.readiness_inputs with (security_invoker = true) as
select
  a.user_id,
  coalesce(t.name, q.topic_label) as topic,
  a.is_correct,
  a.difficulty * power(0.5, extract(epoch from (now() - a.answered_at)) / 86400 / 14.0) as w,
  a.answered_at
from public.answers a
join public.questions q on q.id = a.question_id
left join public.topics t on t.id = q.topic_id;

-- -------------------------
-- 6. Row Level Security
-- -------------------------
alter table public.profiles       enable row level security;
alter table public.user_roles     enable row level security;
alter table public.user_settings  enable row level security;
alter table public.topics         enable row level security;
alter table public.notes          enable row level security;
alter table public.questions      enable row level security;
alter table public.attempts       enable row level security;
alter table public.answers        enable row level security;
alter table public.ai_usage       enable row level security;

-- Profiles: each user manages their own
create policy "own profile" on public.profiles for all
  using (id = auth.uid()) with check (id = auth.uid());

-- User roles: read own; admin manages all
create policy "read own roles" on public.user_roles for select
  using (user_id = auth.uid());
create policy "admin manage roles" on public.user_roles for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- User settings: own only
create policy "own settings" on public.user_settings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Topics: all authenticated users can read; admin can write
create policy "read topics" on public.topics for select to authenticated using (true);
create policy "admin manage topics" on public.topics for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Notes: own only
create policy "own notes" on public.notes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Questions: built-in published questions readable by all; own questions full access; admin manages built-in
create policy "read questions" on public.questions for select to authenticated
  using ((owner_id is null and is_published) or owner_id = auth.uid());
create policy "own questions write" on public.questions for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "admin manage built-in" on public.questions for all
  using (owner_id is null and public.has_role(auth.uid(), 'admin'))
  with check (owner_id is null and public.has_role(auth.uid(), 'admin'));

-- Attempts: own only
create policy "own attempts" on public.attempts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Answers: own only
create policy "own answers" on public.answers for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- AI usage: read own (edge function writes via service role)
create policy "read own usage" on public.ai_usage for select
  using (user_id = auth.uid());

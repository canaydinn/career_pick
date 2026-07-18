-- CareerPick — kullanıcı tabloları + RLS
-- Qdrant'a dokunulmaz. Supabase Auth (Google OAuth) ile auth.users dolar.

-- 1) profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

-- 2) user_answers
create table if not exists public.user_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id text,
  question_text text,
  answer_text text,
  session_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists user_answers_user_id_idx on public.user_answers (user_id);
create index if not exists user_answers_session_id_idx on public.user_answers (session_id);

-- 3) recommended_trainings
-- status: tamamlandi | devam_ediyor | eksik
create table if not exists public.recommended_trainings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  training_id text not null,
  training_name text not null,
  status text not null default 'eksik'
    check (status in ('tamamlandi', 'devam_ediyor', 'eksik')),
  recommended_at timestamptz not null default now(),
  unique (user_id, training_id)
);

create index if not exists recommended_trainings_user_id_idx
  on public.recommended_trainings (user_id);

-- 4) user_insights
create table if not exists public.user_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  insight_text text not null,
  category text,
  created_at timestamptz not null default now()
);

create index if not exists user_insights_user_id_idx on public.user_insights (user_id);

-- 5) Yeni kullanıcı → profiles satırı
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.profiles.display_name, excluded.display_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 6) RLS
alter table public.profiles enable row level security;
alter table public.user_answers enable row level security;
alter table public.recommended_trainings enable row level security;
alter table public.user_insights enable row level security;

-- profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- user_answers
drop policy if exists "user_answers_select_own" on public.user_answers;
create policy "user_answers_select_own"
  on public.user_answers for select
  using (auth.uid() = user_id);

drop policy if exists "user_answers_insert_own" on public.user_answers;
create policy "user_answers_insert_own"
  on public.user_answers for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_answers_update_own" on public.user_answers;
create policy "user_answers_update_own"
  on public.user_answers for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_answers_delete_own" on public.user_answers;
create policy "user_answers_delete_own"
  on public.user_answers for delete
  using (auth.uid() = user_id);

-- recommended_trainings
drop policy if exists "recommended_trainings_select_own" on public.recommended_trainings;
create policy "recommended_trainings_select_own"
  on public.recommended_trainings for select
  using (auth.uid() = user_id);

drop policy if exists "recommended_trainings_insert_own" on public.recommended_trainings;
create policy "recommended_trainings_insert_own"
  on public.recommended_trainings for insert
  with check (auth.uid() = user_id);

drop policy if exists "recommended_trainings_update_own" on public.recommended_trainings;
create policy "recommended_trainings_update_own"
  on public.recommended_trainings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "recommended_trainings_delete_own" on public.recommended_trainings;
create policy "recommended_trainings_delete_own"
  on public.recommended_trainings for delete
  using (auth.uid() = user_id);

-- user_insights
drop policy if exists "user_insights_select_own" on public.user_insights;
create policy "user_insights_select_own"
  on public.user_insights for select
  using (auth.uid() = user_id);

drop policy if exists "user_insights_insert_own" on public.user_insights;
create policy "user_insights_insert_own"
  on public.user_insights for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_insights_update_own" on public.user_insights;
create policy "user_insights_update_own"
  on public.user_insights for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_insights_delete_own" on public.user_insights;
create policy "user_insights_delete_own"
  on public.user_insights for delete
  using (auth.uid() = user_id);

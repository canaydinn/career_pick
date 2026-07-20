-- CareerPick — Haftalik check-in (Bu hafta ne ilerledin?)
-- Mikro gorev week_start ile ayni Pazartesi tanimi.

create table if not exists public.weekly_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  q1_text text not null default '',
  q2_text text,
  q2_choice text
    check (q2_choice is null or q2_choice in ('egitim', 'pratik', 'basvuru', 'belirsiz')),
  reflection text,
  source text not null default 'profile'
    check (source in ('profile', 'email_link')),
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

comment on table public.weekly_checkins is 'Haftalik 1-2 soruluk ilerleme check-in';
comment on column public.weekly_checkins.week_start is 'Yerel Pazartesi (YYYY-MM-DD), micro_tasks ile ayni';

create index if not exists weekly_checkins_user_week_idx
  on public.weekly_checkins (user_id, week_start desc);

alter table public.weekly_checkins enable row level security;

drop policy if exists "weekly_checkins_select_own" on public.weekly_checkins;
create policy "weekly_checkins_select_own"
  on public.weekly_checkins for select
  using (auth.uid() = user_id);

drop policy if exists "weekly_checkins_insert_own" on public.weekly_checkins;
create policy "weekly_checkins_insert_own"
  on public.weekly_checkins for insert
  with check (auth.uid() = user_id);

drop policy if exists "weekly_checkins_update_own" on public.weekly_checkins;
create policy "weekly_checkins_update_own"
  on public.weekly_checkins for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "weekly_checkins_delete_own" on public.weekly_checkins;
create policy "weekly_checkins_delete_own"
  on public.weekly_checkins for delete
  using (auth.uid() = user_id);

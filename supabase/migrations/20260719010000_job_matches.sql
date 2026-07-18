-- CareerPick — Is ilani uyum analizi
-- job_matches + recommended_trainings.source

create table if not exists public.job_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_url text,
  job_title text,
  fit_score numeric(5,1) not null default 0
    check (fit_score >= 0 and fit_score <= 100),
  gaps_json jsonb,
  created_at timestamptz not null default now()
);

comment on table public.job_matches is 'Ilan URL/metin analizleri; yaklasik uyum sinyali';
comment on column public.job_matches.job_url is 'Bos olabilir (elle yapistirilan metin)';
comment on column public.job_matches.gaps_json is 'strong, gaps, items, job ozeti';

create index if not exists job_matches_user_created_idx
  on public.job_matches (user_id, created_at desc);

alter table public.job_matches enable row level security;

drop policy if exists "job_matches_select_own" on public.job_matches;
create policy "job_matches_select_own"
  on public.job_matches for select
  using (auth.uid() = user_id);

drop policy if exists "job_matches_insert_own" on public.job_matches;
create policy "job_matches_insert_own"
  on public.job_matches for insert
  with check (auth.uid() = user_id);

drop policy if exists "job_matches_update_own" on public.job_matches;
create policy "job_matches_update_own"
  on public.job_matches for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "job_matches_delete_own" on public.job_matches;
create policy "job_matches_delete_own"
  on public.job_matches for delete
  using (auth.uid() = user_id);

-- Egitim kaynagi (sohbet | job_match)
alter table public.recommended_trainings
  add column if not exists source text not null default 'sohbet';

comment on column public.recommended_trainings.source is 'sohbet | job_match';

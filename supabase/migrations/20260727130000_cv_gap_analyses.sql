-- CareerPick — CV → hedef role boşluk analizi

create table if not exists public.cv_gap_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  target_role text not null,
  fit_score numeric(5,1) not null default 0
    check (fit_score >= 0 and fit_score <= 100),
  gaps_json jsonb,
  created_at timestamptz not null default now()
);

comment on table public.cv_gap_analyses is 'CV metni vs hedef rol; yaklasik bosluk sinyali';
comment on column public.cv_gap_analyses.gaps_json is 'cv ozeti, strong, gaps, items, recommendations, disclaimer';

create index if not exists cv_gap_analyses_user_created_idx
  on public.cv_gap_analyses (user_id, created_at desc);

alter table public.cv_gap_analyses enable row level security;

drop policy if exists "cv_gap_analyses_select_own" on public.cv_gap_analyses;
create policy "cv_gap_analyses_select_own"
  on public.cv_gap_analyses for select
  using (auth.uid() = user_id);

drop policy if exists "cv_gap_analyses_insert_own" on public.cv_gap_analyses;
create policy "cv_gap_analyses_insert_own"
  on public.cv_gap_analyses for insert
  with check (auth.uid() = user_id);

drop policy if exists "cv_gap_analyses_delete_own" on public.cv_gap_analyses;
create policy "cv_gap_analyses_delete_own"
  on public.cv_gap_analyses for delete
  using (auth.uid() = user_id);

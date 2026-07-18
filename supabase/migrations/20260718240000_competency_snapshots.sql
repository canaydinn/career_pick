-- CareerPick — Yetkinlik olcum snapshotlari (onceki vs simdi)
-- user_insights'a dokunulmaz; yapilandirilmis puanlar burada.

-- 1) Snapshot (sohbet oturumu basina bir kayit)
create table if not exists public.competency_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid,
  created_at timestamptz not null default now()
);

comment on table public.competency_snapshots is 'Sohbet sonu yetkinlik olcumu; silinmez, uzerine yazilmaz';

create index if not exists competency_snapshots_user_created_idx
  on public.competency_snapshots (user_id, created_at desc);

-- 2) Skorlar (normalize yetkinlik_adi ile eslestirme)
create table if not exists public.competency_scores (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.competency_snapshots (id) on delete cascade,
  yetkinlik_adi text not null,
  puan numeric(3,1) not null check (puan >= 1 and puan <= 5),
  seviye text,
  yorum text
);

comment on column public.competency_scores.yetkinlik_adi is 'Trim + kucuk harf normalize anahtar';

create index if not exists competency_scores_snapshot_idx
  on public.competency_scores (snapshot_id);

create index if not exists competency_scores_yetkinlik_idx
  on public.competency_scores (snapshot_id, yetkinlik_adi);

-- 3) RLS
alter table public.competency_snapshots enable row level security;
alter table public.competency_scores enable row level security;

drop policy if exists "competency_snapshots_select_own" on public.competency_snapshots;
create policy "competency_snapshots_select_own"
  on public.competency_snapshots for select
  using (auth.uid() = user_id);

drop policy if exists "competency_snapshots_insert_own" on public.competency_snapshots;
create policy "competency_snapshots_insert_own"
  on public.competency_snapshots for insert
  with check (auth.uid() = user_id);

-- Scores: erisim snapshot sahibi uzerinden
drop policy if exists "competency_scores_select_own" on public.competency_scores;
create policy "competency_scores_select_own"
  on public.competency_scores for select
  using (
    exists (
      select 1 from public.competency_snapshots s
      where s.id = competency_scores.snapshot_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "competency_scores_insert_own" on public.competency_scores;
create policy "competency_scores_insert_own"
  on public.competency_scores for insert
  with check (
    exists (
      select 1 from public.competency_snapshots s
      where s.id = competency_scores.snapshot_id
        and s.user_id = auth.uid()
    )
  );

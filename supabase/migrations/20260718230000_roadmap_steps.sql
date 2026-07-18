-- CareerPick — Kariyer hedefi yol haritasi (3-5 adim)
-- roadmap_steps + recommended_trainings.step_id
-- Eski roadmap silinmez; archived = true ile arsivlenir.

-- 1) Yol haritasi adimlari
create table if not exists public.roadmap_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  step_order int not null check (step_order >= 1 and step_order <= 5),
  title text not null,
  description text,
  status text not null default 'bekliyor'
    check (status in ('bekliyor', 'aktif', 'bitti')),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.roadmap_steps is 'Kariyer hedefi icin 3-5 adimlik yol haritasi';
comment on column public.roadmap_steps.archived is 'Yeni sohbet sonrasi eski roadmap arsiv';

create index if not exists roadmap_steps_user_current_idx
  on public.roadmap_steps (user_id, step_order)
  where archived = false;

create index if not exists roadmap_steps_user_id_idx
  on public.roadmap_steps (user_id);

-- 2) Egitimleri adima bagla (nullable)
alter table public.recommended_trainings
  add column if not exists step_id uuid references public.roadmap_steps (id) on delete set null;

comment on column public.recommended_trainings.step_id is 'Bagli roadmap adi; bos olabilir';

create index if not exists recommended_trainings_step_id_idx
  on public.recommended_trainings (step_id)
  where step_id is not null;

-- 3) RLS
alter table public.roadmap_steps enable row level security;

drop policy if exists "roadmap_steps_select_own" on public.roadmap_steps;
create policy "roadmap_steps_select_own"
  on public.roadmap_steps for select
  using (auth.uid() = user_id);

drop policy if exists "roadmap_steps_insert_own" on public.roadmap_steps;
create policy "roadmap_steps_insert_own"
  on public.roadmap_steps for insert
  with check (auth.uid() = user_id);

drop policy if exists "roadmap_steps_update_own" on public.roadmap_steps;
create policy "roadmap_steps_update_own"
  on public.roadmap_steps for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "roadmap_steps_delete_own" on public.roadmap_steps;
create policy "roadmap_steps_delete_own"
  on public.roadmap_steps for delete
  using (auth.uid() = user_id);

-- CareerPick — Zayif yetkinlikler icin haftalik mikro gorevler
-- Egitim degil; 10-30 dk pratik. Onceki haftalar silinmez.

create table if not exists public.micro_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  yetkinlik_adi text not null,
  title text not null,
  description text,
  week_start date not null,
  due_hint text,
  status text not null default 'bekliyor'
    check (status in ('bekliyor', 'yapildi', 'atlandi')),
  source text not null default 'template'
    check (source in ('claude', 'template')),
  competency_snapshot_id uuid references public.competency_snapshots (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.micro_tasks is 'Haftalik kisa pratikler; week_start ile arsivlenir, silinmez';
comment on column public.micro_tasks.yetkinlik_adi is 'Trim + kucuk harf normalize anahtar';

create index if not exists micro_tasks_user_week_idx
  on public.micro_tasks (user_id, week_start);

create index if not exists micro_tasks_user_status_idx
  on public.micro_tasks (user_id, status)
  where status = 'bekliyor';

alter table public.micro_tasks enable row level security;

drop policy if exists "micro_tasks_select_own" on public.micro_tasks;
create policy "micro_tasks_select_own"
  on public.micro_tasks for select
  using (auth.uid() = user_id);

drop policy if exists "micro_tasks_insert_own" on public.micro_tasks;
create policy "micro_tasks_insert_own"
  on public.micro_tasks for insert
  with check (auth.uid() = user_id);

drop policy if exists "micro_tasks_update_own" on public.micro_tasks;
create policy "micro_tasks_update_own"
  on public.micro_tasks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "micro_tasks_delete_own" on public.micro_tasks;
create policy "micro_tasks_delete_own"
  on public.micro_tasks for delete
  using (auth.uid() = user_id);

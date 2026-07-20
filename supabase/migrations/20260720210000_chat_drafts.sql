-- CareerPick — Yarida kalan sohbet draft'i
-- UI hydrate kaynagi; user_answers audit olarak kalir.

create table if not exists public.chat_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'abandoned')),
  phase text not null default 'asking'
    check (phase in ('asking', 'result')),
  step int not null default 0,
  locale text not null default 'tr',
  answers_json jsonb not null default '[]'::jsonb,
  attempts_json jsonb not null default '{}'::jsonb,
  scenario_questions_json jsonb not null default '[]'::jsonb,
  scenarios_ready boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.chat_drafts is 'Kariyer sohbeti UI draft — kaldigi yerden devam';
comment on column public.chat_drafts.answers_json is 'Kabul edilmis cevaplar string[]';
comment on column public.chat_drafts.attempts_json is 'Follow-up denemeleri { index: [{q, followupText}] }';
comment on column public.chat_drafts.scenario_questions_json is 'RAG senaryo listesi (kritik)';

-- Kullanici basina tek aktif in_progress
create unique index if not exists chat_drafts_one_in_progress_uidx
  on public.chat_drafts (user_id)
  where status = 'in_progress';

create index if not exists chat_drafts_user_updated_idx
  on public.chat_drafts (user_id, updated_at desc);

alter table public.chat_drafts enable row level security;

drop policy if exists "chat_drafts_select_own" on public.chat_drafts;
create policy "chat_drafts_select_own"
  on public.chat_drafts for select
  using (auth.uid() = user_id);

drop policy if exists "chat_drafts_insert_own" on public.chat_drafts;
create policy "chat_drafts_insert_own"
  on public.chat_drafts for insert
  with check (auth.uid() = user_id);

drop policy if exists "chat_drafts_update_own" on public.chat_drafts;
create policy "chat_drafts_update_own"
  on public.chat_drafts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "chat_drafts_delete_own" on public.chat_drafts;
create policy "chat_drafts_delete_own"
  on public.chat_drafts for delete
  using (auth.uid() = user_id);

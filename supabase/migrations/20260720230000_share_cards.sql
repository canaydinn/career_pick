-- CareerPick — Paylasilabilir ozet karti (public link, asama 2)
-- Token ile ozet.html; noindex istemci tarafinda.

create table if not exists public.share_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  public_token text not null,
  payload_json jsonb not null default '{}'::jsonb,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  unique (public_token)
);

comment on table public.share_cards is 'LinkedIn ozet karti public link payload';

create index if not exists share_cards_user_idx on public.share_cards (user_id, created_at desc);
create index if not exists share_cards_public_token_idx
  on public.share_cards (public_token)
  where is_public = true;

alter table public.share_cards enable row level security;

drop policy if exists "share_cards_select_own" on public.share_cards;
create policy "share_cards_select_own"
  on public.share_cards for select
  using (auth.uid() = user_id or (is_public = true));

drop policy if exists "share_cards_insert_own" on public.share_cards;
create policy "share_cards_insert_own"
  on public.share_cards for insert
  with check (auth.uid() = user_id);

drop policy if exists "share_cards_update_own" on public.share_cards;
create policy "share_cards_update_own"
  on public.share_cards for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "share_cards_delete_own" on public.share_cards;
create policy "share_cards_delete_own"
  on public.share_cards for delete
  using (auth.uid() = user_id);

-- Anon public read for is_public cards (token filtered in query)
grant select on public.share_cards to anon, authenticated;

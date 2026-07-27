-- CareerPick — Ürün olayları (profil sayfa görüntüleme vb.)
-- Admin öneri kalitesine bağlanabilir; kullanıcı sadece kendi satırını yazar.

create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  event_type text not null default 'page_view'
    check (event_type in ('page_view')),
  page_id text not null
    check (page_id in ('bugun', 'yol', 'pratik', 'kesfet')),
  meta jsonb not null default '{}'::jsonb
);

comment on table public.product_events is 'Urun telemetrisi (profil sayfa acilisi); admin okur';

create index if not exists product_events_created_idx
  on public.product_events (created_at desc);

create index if not exists product_events_page_idx
  on public.product_events (page_id, created_at desc);

alter table public.product_events enable row level security;

drop policy if exists "product_events_insert_own" on public.product_events;
create policy "product_events_insert_own"
  on public.product_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Kullanici SELECT yok; service_role admin API okur
grant select, insert on public.product_events to service_role;
grant insert on public.product_events to authenticated;

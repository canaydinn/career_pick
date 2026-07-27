-- CareerPick — Freemium (Free 1 sohbet + Plus abonelik / iyzico)
-- Qdrant / oneri motoruna dokunulmaz; sadece erisim.

-- 1) profiles plan alanlari
alter table public.profiles
  add column if not exists plan text not null default 'free'
    check (plan in ('free', 'plus')),
  add column if not exists plan_expires_at timestamptz,
  add column if not exists iyzico_customer_id text;

comment on column public.profiles.plan is 'free | plus';
comment on column public.profiles.plan_expires_at is 'Plus bitis (iptal sonrasi grace)';
comment on column public.profiles.iyzico_customer_id is 'iyzico customerReferenceCode';

-- 2) usage_counters
create table if not exists public.usage_counters (
  user_id uuid primary key references auth.users (id) on delete cascade,
  free_chats_used int not null default 0,
  period_start date not null default (date_trunc('month', now())::date),
  plus_chats_used int not null default 0,
  updated_at timestamptz not null default now()
);

comment on table public.usage_counters is 'Sohbet kotasi (free + plus aylik)';

-- 3) chat_completions audit
create table if not exists public.chat_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null,
  created_at timestamptz not null default now(),
  counted boolean not null default true,
  unique (user_id, session_id)
);

comment on table public.chat_completions is 'Tamamlanan sohbet turu; ayni session bir kez sayilir';
create index if not exists chat_completions_user_idx
  on public.chat_completions (user_id, created_at desc);

-- 4) subscriptions (iyzico)
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  iyzico_subscription_reference_code text not null,
  status text not null default 'ACTIVE',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (iyzico_subscription_reference_code)
);

create index if not exists subscriptions_user_idx
  on public.subscriptions (user_id, created_at desc);

-- 5) RLS — kullanici okur; yazma service role (API)
alter table public.usage_counters enable row level security;
alter table public.chat_completions enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists "usage_counters_select_own" on public.usage_counters;
create policy "usage_counters_select_own"
  on public.usage_counters for select
  using (auth.uid() = user_id);

drop policy if exists "chat_completions_select_own" on public.chat_completions;
create policy "chat_completions_select_own"
  on public.chat_completions for select
  using (auth.uid() = user_id);

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- profiles plan alanlari mevcut update policy ile okunur (select own zaten var)
-- Kullanici plan/usage yazamaz: insert/update policy yok (yalniz service role)

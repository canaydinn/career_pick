-- CareerPick — Admin panel + öneri kalitesi gözlemi
-- Qdrant / öneri algoritması değişmez; erişim + ölçüm.

-- 1) Admin flag
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

comment on column public.profiles.is_admin is 'Admin paneli erisimi; yalniz service role ile true yapilir';

create index if not exists profiles_is_admin_idx
  on public.profiles (is_admin)
  where is_admin = true;

-- Kullanici is_admin yukseltmesin (service_role haric)
create or replace function public.protect_profiles_is_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.is_admin is distinct from old.is_admin
     and coalesce(auth.role(), '') <> 'service_role' then
    new.is_admin := old.is_admin;
  end if;
  if tg_op = 'INSERT'
     and coalesce(new.is_admin, false) = true
     and coalesce(auth.role(), '') <> 'service_role' then
    new.is_admin := false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profiles_is_admin on public.profiles;
create trigger trg_protect_profiles_is_admin
  before insert or update on public.profiles
  for each row execute function public.protect_profiles_is_admin();

-- 2) recommended_trainings: session + placeholder
alter table public.recommended_trainings
  add column if not exists session_id uuid,
  add column if not exists is_placeholder boolean not null default false;

comment on column public.recommended_trainings.session_id is 'Sohbet turu; bos oneri hesabi icin';
comment on column public.recommended_trainings.is_placeholder is 'Qdrant eslesmesi olmadan uretilen kart (ornegin job_match)';

create index if not exists recommended_trainings_session_idx
  on public.recommended_trainings (session_id)
  where session_id is not null;

-- 3) recommendation_events — her sohbet recommend cagrisi
create table if not exists public.recommendation_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null default 'sohbet'
    check (source in ('sohbet', 'job_match')),
  user_id uuid references auth.users (id) on delete set null,
  session_id uuid,
  sektor_raw text,
  hedef_raw text,
  sektor_key text,
  search_query text,
  qdrant_hit_count int not null default 0,
  top_score numeric(8, 5),
  final_rec_count int not null default 0,
  outcome text not null default 'ok'
    check (outcome in ('ok', 'empty_qdrant', 'thin', 'low_score', 'error')),
  meta jsonb not null default '{}'::jsonb
);

comment on table public.recommendation_events is 'Oneri kalitesi olaylari (admin); kullanici sohbet metni tutulmaz';

create index if not exists recommendation_events_created_idx
  on public.recommendation_events (created_at desc);
create index if not exists recommendation_events_outcome_idx
  on public.recommendation_events (outcome, created_at desc);
create index if not exists recommendation_events_sektor_idx
  on public.recommendation_events (sektor_key, created_at desc);
create index if not exists recommendation_events_session_idx
  on public.recommendation_events (session_id)
  where session_id is not null;

alter table public.recommendation_events enable row level security;
-- Kullanici okuyamaz/yazamaz; service role admin API yazar/okur
drop policy if exists "recommendation_events_no_user" on public.recommendation_events;
-- RLS acik + policy yok = authenticated erisemez (service role bypass)

grant select, insert on public.recommendation_events to service_role;

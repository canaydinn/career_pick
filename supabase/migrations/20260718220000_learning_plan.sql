-- CareerPick — Ogrenme plani (egitim takibi + hatirlatma)
-- Mevcut recommended_trainings / profiles tablolarina alan ekler.

-- 1) Egitim takip alanlari
alter table public.recommended_trainings
  add column if not exists link text,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists last_reminded_at timestamptz;

comment on column public.recommended_trainings.link is 'Dis egitim URL (edupick / kurum)';
comment on column public.recommended_trainings.started_at is 'Kullanici Baslattim dediginde';
comment on column public.recommended_trainings.completed_at is 'Kullanici Bitirdim dediginde';
comment on column public.recommended_trainings.last_reminded_at is 'Son e-posta / ozet hatirlatmasi';

-- 2) Haftalik e-posta opt-in (varsayilan kapali)
alter table public.profiles
  add column if not exists email_reminders_opt_in boolean not null default false;

comment on column public.profiles.email_reminders_opt_in is 'Haftalik ogrenme hatirlatma e-postasi (opt-in)';

-- 3) Hatirlatma sorgulari icin indeksler
create index if not exists recommended_trainings_status_started_idx
  on public.recommended_trainings (status, started_at)
  where status = 'devam_ediyor';

create index if not exists recommended_trainings_status_recommended_idx
  on public.recommended_trainings (status, recommended_at)
  where status = 'eksik';

create index if not exists profiles_email_reminders_idx
  on public.profiles (email_reminders_opt_in)
  where email_reminders_opt_in = true;

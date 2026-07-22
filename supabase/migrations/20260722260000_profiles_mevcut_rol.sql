-- CareerPick — profiles.mevcut_rol
-- Yatay gecis (sikistin mi) icin kullanicinin bugunku rol metni

alter table public.profiles
  add column if not exists mevcut_rol text;

comment on column public.profiles.mevcut_rol is
  'Kullanicinin bugunku / mevcut rol metni; yatay gecis eslestirmesinde kullanilir';

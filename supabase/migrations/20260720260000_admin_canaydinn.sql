-- Admin: canaydinn@gmail.com
-- Trigger is_admin degisikligini engelledigi icin gecici olarak kapatilir.
-- Not: Bu SQL'i Supabase SQL Editor'da (postgres) calistir.
-- Once 20260720250000_admin_recommendation_quality.sql uygulanmis olmali.

alter table public.profiles disable trigger trg_protect_profiles_is_admin;

update public.profiles
set is_admin = true
where lower(trim(email)) = lower('canaydinn@gmail.com');

alter table public.profiles enable trigger trg_protect_profiles_is_admin;

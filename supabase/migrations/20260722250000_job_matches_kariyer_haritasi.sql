-- CareerPick — job_matches.kariyer_haritasi_eslesme
-- Eslesen meslek_adi (kariyer_gecis_haritasi) veya bos

alter table public.job_matches
  add column if not exists kariyer_haritasi_eslesme text;

comment on column public.job_matches.kariyer_haritasi_eslesme is
  'kariyer_gecis_haritasi eslesen meslek_adi; eslesme yoksa null';

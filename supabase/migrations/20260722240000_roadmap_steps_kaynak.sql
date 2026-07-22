-- CareerPick — roadmap_steps.kaynak
-- roadmap_veri  = kariyer_gecis_haritasi eslesmesinden uretildi
-- roadmap_genel = Claude genel / yetkinlik-kova fallback

alter table public.roadmap_steps
  add column if not exists kaynak text not null default 'roadmap_genel';

-- Mevcut satirlarda default zaten roadmap_genel; check constraint ekle
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'roadmap_steps_kaynak_check'
      and conrelid = 'public.roadmap_steps'::regclass
  ) then
    alter table public.roadmap_steps
      add constraint roadmap_steps_kaynak_check
      check (kaynak in ('roadmap_veri', 'roadmap_genel'));
  end if;
end $$;

comment on column public.roadmap_steps.kaynak is
  'roadmap_veri = kariyer_gecis_haritasi; roadmap_genel = Claude/yetkinlik fallback';

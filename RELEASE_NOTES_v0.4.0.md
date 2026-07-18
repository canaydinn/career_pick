# Career Pick v0.4.0 — Yetkinlik: önceki vs şimdi

Sohbet ölçümleri yapılandırılmış snapshot olarak saklanır; ikinci ölçümde karşılaştırma paneli açılır.

## Ne geldi?

- `competency_snapshots` + `competency_scores` (RLS)
- Sohbet sonunda snapshot kaydı (eski silinmez)
- Sonuç ekranı: önceki / şimdi / fark (yaklaşık sinyal dili)
- İlk ölçümde bilgilendirme mesajı
- Profilde ilerleme / yumuşak sinyal özeti
- Opsiyonel Claude tek cümle özeti

## Kurulum

Supabase SQL Editor → `supabase/migrations/20260718240000_competency_snapshots.sql` → deploy

## Tag önerisi

**Tag:** `v0.4.0`  
**Title:** `v0.4.0 — Yetkinlik karşılaştırması`

# Career Pick v0.3.0 — Kariyer yol haritası

Önerilen eğitimler artık hedefine giden 3–5 adımlık bir rota altında.

## Ne geldi?

### Yol haritası (3–5 adım)
Sohbet bitince hedef + zayıf yetkinlikler + eğitimler Claude’a gider; JSON roadmap üretilir.
Başarısız olursa Temel / Uygulama / Liderlik fallback.

### Profil zaman çizelgesi
Hedef metninin altında numaralı adımlar; aktif adım vurgulu, diğerleri soluk.
Her adımda bağlı eğitimler + Eğitime git / Başlattım / Bitirdim.

### İlerleme
Adımdaki tüm eğitimler tamamlanınca adım `bitti`, sıradaki `aktif`.
Gösterim: eğitim % + **Adım 2 / 4**. Sert kilit yok.

### Versiyonlama
Yeni sohbet → yeni roadmap; eskisi `archived = true` (silinmez).

### Hatırlatmalar
E-posta ve “Bu hafta yapman gerekenler” aktif adımı belirtir.

## Kurulum

1. Supabase SQL Editor → `supabase/migrations/20260718230000_roadmap_steps.sql`
2. (Önceki) `20260718220000_learning_plan.sql` yoksa onu da çalıştır
3. Deploy

## Tag önerisi

**Tag:** `v0.3.0`  
**Title:** `v0.3.0 — Kariyer yol haritası`

# Career Pick v0.9.0 — Haftalık check-in

“Bu hafta ne ilerledin?” — profilde 1–2 soruluk kısa form. Qdrant / sohbet puanlama / eğitim öneri motoruna dokunulmaz.

## Ne geldi?

- `weekly_checkins` tablosu + RLS (`unique user_id + week_start`)
- Profil bloğu: form / özet kart / düzenle / son haftalar
- Opsiyonel `checkin_reflect` (Claude) + şablon fallback
- Haftalık hatırlatma mailine check-in CTA (`profil.html#check-in`)

## Kurulum

1. Supabase → `20260720220000_weekly_checkins.sql`
2. Deploy

## Tag önerisi

**Tag:** `v0.9.0`  
**Title:** `v0.9.0 — Haftalık check-in`

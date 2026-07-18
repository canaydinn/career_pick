# Career Pick v0.2.0 — Öğrenme Planı

Profildeki eğitimler artık sadece bir liste değil; takip edilen bir öğrenme planı.

## Ne geldi?

### Eğitime git
Her eğitim kartında dış platform linki (edupick / kurum sayfası).

### Başlattım / Bitirdim
- **Başlattım** → `devam_ediyor` + `started_at`
- **Bitirdim** → `tamamlandi` + `completed_at`  
Kullanıcı beyanı (platform API entegrasyonu yok).

### Bu hafta yapman gerekenler
Profil üstünde uygulama içi özet:
- 7+ gündür devam edenler
- 3+ gündür başlanmamış öneriler
- Sıradaki öneri

### Haftalık e-posta (opt-in)
Varsayılan kapalı. Açılırsa Pazartesi cron ile en fazla haftada 1 özet (Resend).

## Kurulum (release sonrası)

1. Supabase SQL Editor → `supabase/migrations/20260718220000_learning_plan.sql`
2. Deploy
3. (Opsiyonel) Vercel’e `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_*`, `APP_BASE_URL`

## GitHub Release önerisi

**Tag:** `v0.2.0`  
**Title:** `v0.2.0 — Öğrenme planı`  
**Body:** Bu dosyanın içeriği

```bash
git tag -a v0.2.0 -m "v0.2.0 Ogrenme plani"
git push origin v0.2.0
gh release create v0.2.0 --title "v0.2.0 — Öğrenme planı" --notes-file RELEASE_NOTES_v0.2.0.md
```

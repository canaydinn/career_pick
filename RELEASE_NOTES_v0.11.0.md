# Career Pick v0.11.0 — Freemium + Career Pick Plus (iyzico)

Ücretsiz 1 tamamlanmış sohbet + kayıtlı profil; ekstra turlar aylık **Career Pick Plus** aboneliği ile. Qdrant / öneri algoritması değişmedi.

## Ne geldi?

- Migration: `profiles.plan`, `usage_counters`, `chat_completions`, `subscriptions` + RLS
- Sunucu kota: `/api/billing/quota` (`can_start`, `record`)
- iyzico Checkout Form: `/api/billing/checkout`, callback, cancel, webhook
- Sohbet: ücretsiz banner, sonuç sonrası Plus nudge, paywall modal
- Profil: Free/Plus rozeti, kalan sohbet, abonelik iptal
- Sayfa: `/fiyatlandirma.html` (landing’e dokunulmadı)

## Kurulum

1. Supabase → `20260720240000_billing_freemium.sql`
2. Vercel env: `IYZICO_*`, `IYZICO_PLUS_PLAN_REF`, `APP_BASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
3. iyzico’da aylık plan + callback URL
4. Deploy — detay: `SETUP.md`

## Tag önerisi

**Tag:** `v0.11.0`  
**Title:** `v0.11.0 — Freemium + Career Pick Plus (iyzico)`

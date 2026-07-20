# CareerPick — Freemium / iyzico kurulum (v0.11)

Landing (`index.html`) değişmez. Fiyatlandırma: `/fiyatlandirma.html`.

## 1. Supabase migration

SQL Editor → `supabase/migrations/20260720240000_billing_freemium.sql`

## 2. Vercel ortam değişkenleri

| Değişken | Açıklama |
|----------|----------|
| `IYZICO_API_KEY` | iyzico API key |
| `IYZICO_SECRET_KEY` | iyzico secret |
| `IYZICO_BASE_URL` | Sandbox: `https://sandbox-api.iyzipay.com` · Prod: `https://api.iyzipay.com` |
| `IYZICO_PLUS_PLAN_REF` | Aylık Pricing Plan `referenceCode` |
| `APP_BASE_URL` | Örn. `https://careerpick.vercel.app` |
| `SUPABASE_SERVICE_ROLE_KEY` | Kota / abonelik yazma (frontend’e koyma) |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Mevcut |

## 3. iyzico

1. Abonelik ürünü + **aylık pricing plan** oluştur.
2. Callback URL: `{APP_BASE_URL}/api/billing/callback`
3. (Opsiyonel) Webhook: `{APP_BASE_URL}/api/billing/webhook`

Troy / taksit / TL iyzico paneli üzerinden; kart CareerPick sunucusuna hiç gelmez.

## 4. Kota kuralları

- Free: **1** tamamlanmış sohbet (`completeChatDraft` + sonuç sonrası `record`)
- Draft / yarım sohbet kredi düşürmez
- Aynı `session_id` yeniden hesap → ikinci kredi sayılmaz
- Plus: ayda **5** ekstra tur (`PLUS_CHAT_LIMIT`)
- Sunucu zorunlu: `POST /api/billing/quota` (`can_start` / `record`)

## 5. API

- `POST /api/billing/quota` — status / can_start / record
- `POST /api/billing/checkout` — Checkout Form initialize
- `POST /api/billing/callback` — token retrieve + plan=plus
- `POST /api/billing/cancel` — abonelik iptal
- `POST /api/billing/webhook` — yenileme / başarısız tahsilat

CPAuth: `fetchPlan`, `fetchUsage`, `canStartChat`, `recordChatCompletion`, `createIyzicoCheckout`, `cancelSubscription`

## 6. Admin paneli (öneri kalitesi)

1. Migration: `supabase/migrations/20260720250000_admin_recommendation_quality.sql`
2. Admin bayrağı:

```sql
update public.profiles set is_admin = true where email = 'sen@ornek.com';
```

3. Aç: `/admin.html` — Gmail + `is_admin`
4. API sunucu tarafında da `is_admin` doğrular (`/api/admin/recommendation-quality`)


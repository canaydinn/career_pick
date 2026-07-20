# Career Pick v0.10.0 — Paylaşılabilir özet kartı

Yetkinlik sinyalleri + yol haritası → LinkedIn için PNG ve hazır metin. Qdrant / sohbet puanlamasına dokunulmaz.

## Ne geldi?

### Aşama 1 (hemen)
- `buildShareCardPayload` (CPAuth)
- Profil + sohbet sonuç: **Özet kartı** modal
- Canvas PNG indir + metin kopyala (`share-card.js` / `share-card-ui.jsx`)
- İsim kartta varsayılan kapalı

### Aşama 2 (migration sonrası)
- `share_cards` tablosu + RLS
- `/ozet.html?t=…` public özet (`noindex`)
- Modalda **Public link oluştur**

## Kurulum

1. (Opsiyonel public link) Supabase → `20260720230000_share_cards.sql`
2. Deploy

## Tag önerisi

**Tag:** `v0.10.0`  
**Title:** `v0.10.0 — Paylaşılabilir özet kartı`

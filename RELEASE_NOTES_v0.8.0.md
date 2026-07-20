# Career Pick v0.8.0 — Sohbet kaldığı yerden devam

Yarıda kalan Kariyer Sohbeti, girişli kullanıcıda draft olarak saklanır; dönüşte **Devam et** veya **Baştan başla** seçilir. Qdrant / öneri puanlamasına dokunulmaz.

## Ne geldi?

- `chat_drafts` tablosu + RLS (kullanıcı başına tek `in_progress`)
- Cevap / senaryo / follow-up state debounce (~400ms) ile upsert
- Sonuçta `completed`; baştan başla → `abandoned` + yeni session
- Banner + “Kaldığın yerden” etiketi; profilde opsiyonel devam linki (`?resume=1`)
- 14 gün TTL; bozuk draft sessizce yok sayılır

## Kurulum

1. Supabase → `20260720210000_chat_drafts.sql`
2. Deploy

## Tag önerisi

**Tag:** `v0.8.0`  
**Title:** `v0.8.0 — Sohbet kaldığı yerden devam`
